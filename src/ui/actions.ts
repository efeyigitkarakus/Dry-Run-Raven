/**
 * Uygulama eylemleri: çalıştırma, adım, test, dosya ve soru işlemleri.
 * Worker oturumları burada tutulur; UI yalnızca `app` durumunu okur.
 */

import { app } from './state.svelte.js';
import { t } from './i18n';
import { RunSession, TestBatchSession, CompareSession, SelfTestSession } from '../lib/interp/workerClient';
import type { RunResult, VMEvent } from '../lib/interp/types';
import { formatIssue, issueLine } from '../lib/lang/messages';
import { prepare } from '../lib/interp/run';
import { resetHighlightCache } from '../lib/editor/highlight';
import { compareOutputs } from '../lib/tests/compare';
import { splitInputs, PROBLEMS, getProblem, skeletonFor, type Problem } from '../lib/problems';
import { openAlgFile, saveAlgFile, saveTextFile, isTauri } from '../lib/platform';
import { applyInputAliases, saveSettings, type Settings } from '../lib/settings';
import { saveUserProblems } from '../lib/storage';
import { newScenarioId } from '../lib/tests/types';
import type { TestScenario } from '../lib/tests/types';

let runSession: RunSession | null = null;
let testSession: TestBatchSession | null = null;
let compareSession: CompareSession | null = null;
let selfTestSession: SelfTestSession | null = null;
let seenWarnings = new Set<string>();

/**
 * Worker'a gönderilecek ek giriş takma adları. Ayarlar reaktif bir proxy
 * olduğundan postMessage ile kopyalanamaz; düz bir diziye alınır.
 */
function inputAliases(): string[] {
  return [...app.settings.inputAliases];
}

function stopSelfTest(): void {
  if (!selfTestSession) return;
  selfTestSession.cancel();
  selfTestSession = null;
  app.selfTestState = { running: false, outcome: null };
}

function pushWarning(code: string, line: number): boolean {
  const key = `${code}:${line}`;
  if (seenWarnings.has(key)) return false;
  seenWarnings.add(key);
  return true;
}

function pushError(result: RunResult): void {
  if (!result.error) return;
  const lang = app.lang;
  const f = formatIssue(result.error, lang);
  app.consoleLines = [...app.consoleLines, { kind: 'err', text: issueLine(result.error, lang) }];
  if (f.hint) app.consoleLines = [...app.consoleLines, { kind: 'info', text: `${t(lang, 'hint')}: ${f.hint}` }];
}

function finishRun(result: RunResult): void {
  app.memory = result.memory;
  app.steps = result.steps;
  app.ms = result.ms;
  app.warnings = result.warnings;
  app.error = result.error;
  app.waitingInput = false;
  app.inputTarget = '';
  app.phase = result.status === 'error' ? 'error' : result.status === 'stopped' ? 'stopped' : 'done';
  app.currentLine = result.error?.line ?? null;
  if (result.status === 'error') pushError(result);
  else if (result.status === 'stopped') {
    app.consoleLines = [...app.consoleLines, { kind: 'info', text: t(app.lang, 'stoppedByUser') }];
  }
  if (result.status !== 'error') {
    for (const w of result.warnings) {
      if (pushWarning(w.code, w.line)) {
        const f = formatIssue(w, app.lang);
        app.consoleLines = [...app.consoleLines, { kind: 'info', text: `${t(app.lang, 'warning')}: ${f.message}` }];
      }
    }
  }
}

export function startRun(stepMode: boolean): void {
  runSession?.stop();
  if (testSession) {
    testSession.dispose();
    testSession = null;
    app.resetTests();
  }
  if (compareSession) {
    compareSession.cancel();
    compareSession = null;
    app.compareState = { running: false, trialsRun: 0, outcome: null };
  }
  stopSelfTest();
  runSession = null;
  seenWarnings = new Set();
  app.clearRunView();
  app.phase = stepMode ? 'paused' : 'running';
  if (!stepMode || (app.tab !== 'memory' && app.tab !== 'flow')) app.tab = 'console';

  const maxSteps = app.settings.maxSteps;
  const maxOutput = app.settings.maxOutput;

  runSession = new RunSession({
    source: app.source,
    inputs: splitInputs(app.inputQueue),
    maxSteps,
    maxOutput,
    stepMode,
    allowPrompt: true,
    breakpoints: [...app.breakpoints],
    inputAliases: inputAliases(),
  }, {
    onEvent: (ev: VMEvent) => {
      if (ev.type === 'print') {
        app.consoleLines = [...app.consoleLines, { kind: 'out', text: ev.text }];
        return;
      }
      if (ev.type === 'pause') {
        app.phase = 'paused';
        app.currentLine = ev.line;
        app.memory = ev.memory;
        app.steps = ev.steps;
        app.waitingInput = false;
        return;
      }
      if (ev.type === 'input') {
        app.phase = 'paused';
        app.currentLine = ev.line;
        app.waitingInput = true;
        app.inputTarget = ev.target;
        app.inputTargets = ev.targets;
        if (app.tab !== 'console') app.tab = 'console';
        app.consoleLines = [...app.consoleLines, {
          kind: 'info', text: `${t(app.lang, 'waitingInput')}: ${ev.target}`,
        }];
        return;
      }
      if (ev.type === 'warning') {
        if (pushWarning(ev.issue.code, ev.issue.line)) {
          const f = formatIssue(ev.issue, app.lang);
          app.consoleLines = [...app.consoleLines, { kind: 'info', text: `${t(app.lang, 'warning')}: ${f.message}` }];
        }
      }
    },
    onDone: (result) => {
      runSession = null;
      finishRun(result);
    },
    onFatal: (message) => {
      runSession = null;
      app.phase = 'error';
      app.consoleLines = [...app.consoleLines, { kind: 'err', text: message }];
    },
  });
}

export function stepRun(): void {
  if (app.waitingInput) return;
  if (runSession && app.phase === 'running') return;
  if (!runSession) { startRun(true); return; }
  runSession.resume({ cmd: 'step', breakpoints: [...app.breakpoints] });
}

export function continueRun(): void {
  if (app.waitingInput) return;
  if (!runSession) { startRun(false); return; }
  app.phase = 'running';
  runSession.resume({ cmd: 'continue', breakpoints: [...app.breakpoints] });
}

export function stopRun(): void {
  if (!runSession) {
    if (selfTestSession) {
      stopSelfTest();
      app.notice = { text: t(app.lang, 'stoppedByUser'), kind: 'info' };
      return;
    }
    if (app.phase === 'paused' || app.phase === 'running') app.phase = 'stopped';
    return;
  }
  runSession.stop();
  runSession = null;
  app.phase = 'stopped';
  app.waitingInput = false;
  app.currentLine = null;
  app.consoleLines = [...app.consoleLines, { kind: 'info', text: t(app.lang, 'stoppedByUser') }];
}

export function sendInput(value: string): void {
  if (!runSession || !app.waitingInput) {
    if (value.trim()) app.inputQueue = `${app.inputQueue.trim()} ${value.trim()}`.trim();
    return;
  }
  app.consoleLines = [...app.consoleLines, { kind: 'in', text: `${t(app.lang, 'inputEcho')}: ${value}` }];
  app.waitingInput = false;
  app.phase = 'running';
  runSession.resume({ value });
}

export function toggleBreakpoint(line: number): void {
  const set = new Set(app.breakpoints);
  if (set.has(line)) set.delete(line);
  else set.add(line);
  app.breakpoints = [...set].sort((a, b) => a - b);
}

export function runTests(): void {
  stopSelfTest();
  if (app.tests.length === 0) {
    app.notice = { text: t(app.lang, 'noTests'), kind: 'info' };
    app.tab = 'tests';
    return;
  }
  const prep = prepare(app.source);
  if (!prep.ok) {
    const first = prep.errors[0];
    app.tab = 'console';
    app.clearRunView();
    app.phase = 'error';
    app.waitingInput = false;
    app.error = first ?? null;
    app.currentLine = first?.line ?? null;
    app.resetTests();
    if (first) {
      const hint = formatIssue(first, app.lang).hint;
      app.consoleLines = [{ kind: 'err', text: issueLine(first, app.lang) }];
      if (hint) {
        app.consoleLines = [...app.consoleLines, { kind: 'info', text: `${t(app.lang, 'hint')}: ${hint}` }];
      }
    } else {
      app.consoleLines = [{ kind: 'err', text: t(app.lang, 'parseBeforeRun') }];
    }
    return;
  }
  runSession?.stop();
  runSession = null;
  if (app.active) app.phase = 'ready';
  app.waitingInput = false;
  app.inputTarget = '';
  app.currentLine = null;
  testSession?.dispose();
  app.resetTests();
  app.tab = 'tests';
  app.testsState = {
    running: true, done: false, total: app.tests.length, results: [],
  };
  const cases = app.tests.map((s) => ({ name: s.name, inputs: splitInputs(s.inputs) }));
  testSession = new TestBatchSession(app.source, cases, app.settings.maxSteps, app.settings.maxOutput, inputAliases(), {
    onResult: (_index, _name, result) => {
      const scenario = app.tests[_index];
      if (!scenario) return;
      const actual = result.output.join('\n');
      const diff = compareOutputs(scenario.expected, actual);
      const entry = {
        scenarioId: scenario.id,
        name: scenario.name,
        expected: scenario.expected,
        actual,
        equal: diff.equal && result.status === 'ok',
        diffIndex: diff.index,
        expectedToken: diff.expectedToken,
        actualToken: diff.actualToken,
        status: result.status,
        error: result.error,
        steps: result.steps,
        ms: result.ms,
      };
      app.testsState.results = [...app.testsState.results, entry];
    },
    onDone: (count) => {
      app.testsState = {
        ...app.testsState, running: false, done: true, total: count || app.tests.length,
      };
      testSession = null;
    },
  });
}

export function selfTest(): void {
  runSession?.stop();
  runSession = null;
  if (app.active) app.phase = 'ready';
  app.waitingInput = false;
  app.inputTarget = '';
  app.currentLine = null;
  testSession?.dispose();
  testSession = null;
  if (compareSession) {
    compareSession.cancel();
    compareSession = null;
    app.compareState = { running: false, trialsRun: 0, outcome: null };
  }
  stopSelfTest();

  const prep = prepare(app.source);
  const first = prep.errors[0] ?? null;
  if (!prep.ok) {
    app.tab = 'console';
    app.clearRunView();
    app.phase = 'error';
    app.error = first;
    app.currentLine = first?.line ?? null;
    if (first) {
      const hint = formatIssue(first, app.lang).hint;
      app.consoleLines = [{ kind: 'err', text: issueLine(first, app.lang) }];
      if (hint) {
        app.consoleLines = [...app.consoleLines, { kind: 'info', text: `${t(app.lang, 'hint')}: ${hint}` }];
      }
    }
    return;
  }

  const problem = app.problemId === null
    ? null
    : (getProblem(app.problemId) ?? app.userProblems.find((x) => x.id === app.problemId) ?? null);
  const reference = problem?.solution?.trim() || app.referenceSource.trim() || null;

  app.tab = 'tests';
  app.selfTestState = { running: true, outcome: null };
  selfTestSession = new SelfTestSession({
    source: app.source,
    referenceSource: reference,
    trials: app.settings.compareTrials,
    seed: (Date.now() >>> 0) || 1,
    maxSteps: app.settings.maxSteps,
    maxOutput: app.settings.maxOutput,
    inputAliases: inputAliases(),
  }, {
    onDone: (outcome) => {
      app.selfTestState = { running: false, outcome };
      selfTestSession = null;
    },
    onFatal: () => {
      app.selfTestState = { running: false, outcome: null };
      app.notice = { text: t(app.lang, 'selfTestFailed'), kind: 'err' };
      selfTestSession = null;
    },
  });
}

/**
 * Test düğmesi/kısayolu: senaryo varsa onları, yoksa kendi kendini testi çalıştırır.
 */
export function testOrSelfTest(): void {
  if (app.tests.length > 0) runTests();
  else selfTest();
}

export function compareReference(trials: number): void {
  if (!app.referenceSource.trim()) {
    app.notice = { text: t(app.lang, 'referenceHint'), kind: 'info' };
    return;
  }
  compareSession?.cancel();
  app.compareState = { running: true, trialsRun: 0, outcome: null };
  compareSession = new CompareSession({
    sourceA: app.source,
    sourceB: app.referenceSource,
    trials,
    seed: (Date.now() >>> 0) || 1,
    maxSteps: app.settings.maxSteps,
    maxOutput: app.settings.maxOutput,
    inputAliases: inputAliases(),
  }, {
    onDone: (outcome, trialsRun) => {
      app.compareState = { running: false, trialsRun, outcome };
      compareSession = null;
    },
  });
}

export function persistSettings(next?: Settings): void {
  const s = next ?? app.settings;
  saveSettings(s);
  applyInputAliases(s.inputAliases);
  resetHighlightCache();
  app.settings = s;
}

export function applySettings(next: Settings): void {
  persistSettings(next);
  app.settingsOpen = false;
}

export function newAlgorithm(): void {
  runSession?.stop();
  runSession = null;
  stopSelfTest();
  app.source = '1- Başla\n2- \n3- Dur.';
  app.tests = [];
  app.problemId = null;
  app.path = null;
  app.fileName = '';
  app.inputQueue = '';
  app.resetTests();
  app.clearRunView();
  app.breakpoints = [];
  app.referenceSource = '';
  app.phase = 'ready';
  app.notice = null;
  app.tab = 'console';
}

export function sidecarJson(): string {
  return JSON.stringify({
    version: 1,
    tests: app.tests,
    problemId: app.problemId,
    inputQueue: app.inputQueue,
  }, null, 2);
}

function baseName(p: string): string {
  const m = /[^\\/]+$/.exec(p);
  return m ? m[0] : p;
}

export async function saveAlgorithm(saveAs: boolean): Promise<void> {
  try {
    const suggested = app.fileName || 'adsiz.alg';
    const target = saveAs ? null : app.path;
    const saved = await saveAlgFile(target, suggested, app.source, sidecarJson());
    if (!saved) return;
    app.fileName = baseName(saved);
    if (isTauri()) app.path = saved;
    app.notice = { text: t(app.lang, 'saved'), kind: 'ok' };
  } catch {
    app.notice = { text: t(app.lang, 'saveFailed'), kind: 'err' };
  }
}

export async function openAlgorithm(): Promise<void> {
  try {
    const opened = await openAlgFile();
    if (!opened) return;
    runSession?.stop();
    runSession = null;
    stopSelfTest();
    app.source = opened.content;
    app.fileName = baseName(opened.path);
    app.path = isTauri() ? opened.path : null;
    app.problemId = null;
    app.tests = [];
    app.inputQueue = '';
    app.breakpoints = [];
    app.referenceSource = '';
    let bad = false;
    if (opened.sidecar) {
      try {
        const d = JSON.parse(opened.sidecar) as {
          tests?: typeof app.tests; problemId?: number | null; inputQueue?: string;
        };
        if (Array.isArray(d.tests)) {
          app.tests = d.tests.filter((x): x is TestScenario =>
            !!x && typeof x === 'object'
            && typeof x.id === 'string'
            && typeof x.name === 'string'
            && typeof x.inputs === 'string'
            && typeof x.expected === 'string');
        }
        if (typeof d.problemId === 'number') app.problemId = d.problemId;
        if (typeof d.inputQueue === 'string') app.inputQueue = d.inputQueue;
      } catch {
        bad = true;
      }
    }
    app.resetTests();
    app.clearRunView();
    app.phase = 'ready';
    app.notice = bad
      ? { text: t(app.lang, 'invalidSidecar'), kind: 'err' }
      : { text: t(app.lang, 'loaded'), kind: 'ok' };
  } catch {
    app.notice = { text: t(app.lang, 'openFailed'), kind: 'err' };
  }
}

export function loadProblem(id: number): void {
  const p = getProblem(id) ?? app.userProblems.find((x) => x.id === id);
  if (!p) return;
  runSession?.stop();
  runSession = null;
  stopSelfTest();
  app.source = skeletonFor(p);
  app.replaceTests(p.tests);
  app.problemId = p.id;
  app.path = null;
  app.fileName = `soru-${p.id}.alg`;
  app.inputQueue = '';
  app.breakpoints = [];
  app.clearRunView();
  app.phase = 'ready';
  app.referenceSource = '';
  app.notice = {
    text: `${t(app.lang, 'problemLoaded')}: ${app.lang === 'en' ? (p.titleEn || p.titleTr) : (p.titleTr || p.titleEn)} — ${p.tests.length} ${t(app.lang, 'testCount')}`,
    kind: 'ok',
  };
}

function nextUserId(): number {
  const ids = [...PROBLEMS, ...app.userProblems].map((p) => p.id);
  return Math.max(1000, ...ids) + 1;
}

export function addUserProblem(p: Omit<Problem, 'id' | 'user'>): void {
  const withId: Problem = { ...p, id: nextUserId(), user: true };
  app.userProblems = [...app.userProblems, withId];
  saveUserProblems(app.userProblems);
  app.notice = { text: t(app.lang, 'questionSaved'), kind: 'ok' };
}

export function deleteUserProblem(id: number): void {
  app.userProblems = app.userProblems.filter((p) => p.id !== id);
  saveUserProblems(app.userProblems);
  if (app.problemId === id) app.problemId = null;
}

export async function exportProblems(): Promise<void> {
  try {
    const data = JSON.stringify([...PROBLEMS, ...app.userProblems], null, 2);
    const saved = await saveTextFile('sorular.json', data, 'application/json', '.json');
    if (saved) app.notice = { text: t(app.lang, 'exportDone'), kind: 'ok' };
  } catch {
    app.notice = { text: t(app.lang, 'exportError'), kind: 'err' };
  }
}

export function addScenario(): void {
  app.tests = [...app.tests, { id: newScenarioId(), name: '', inputs: '', expected: '' }];
}
