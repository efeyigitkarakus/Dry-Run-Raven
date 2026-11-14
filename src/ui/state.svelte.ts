/**
 * Uygulama durumu (Svelte 5 runes). Bileşenler bu tek nesneyi okur/yazar.
 */

import { loadSettings, type Settings } from '../lib/settings';
import { loadDraft, loadUserProblems } from '../lib/storage';
import type { AlgoIssue } from '../lib/lang/messages';
import type { CompareOutcome, SelfTestOutcome } from '../lib/interp/protocol';
import type { MemorySnapshot, RunStatus } from '../lib/interp/types';
import { newScenarioId, type TestScenario } from '../lib/tests/types';
import type { Problem } from '../lib/problems';

export type Tab = 'console' | 'memory' | 'tests' | 'flow' | 'problems';
export type RunPhase = 'ready' | 'running' | 'paused' | 'error' | 'done' | 'stopped';

export interface ConsoleLine {
  kind: 'out' | 'info' | 'err' | 'in';
  text: string;
}

export interface UiTestResult {
  scenarioId: string;
  name: string;
  expected: string;
  actual: string;
  equal: boolean;
  diffIndex: number;
  expectedToken: string | null;
  actualToken: string | null;
  status: RunStatus;
  error: AlgoIssue | null;
  steps: number;
  ms: number;
}

export interface TestState {
  running: boolean;
  done: boolean;
  total: number;
  results: UiTestResult[];
}

export interface CompareState {
  running: boolean;
  trialsRun: number;
  outcome: CompareOutcome | null;
}

export interface SelfTestState {
  running: boolean;
  outcome: SelfTestOutcome | null;
}

const SAMPLE = [
  '1- Başla',
  '2- say = 0',
  '3- Sayı Gir (n)',
  '4- if (n > 0) Then',
  '5-     Print ("Pozitif")',
  '6- else',
  '7-     Print ("Pozitif değil")',
  '8- Dur.',
].join('\n');

const draft = loadDraft();

class AppState {
  settings = $state<Settings>(loadSettings());
  source = $state(draft?.source ?? SAMPLE);
  tests = $state<TestScenario[]>(draft?.tests ?? []);
  problemId = $state<number | null>(draft?.problemId ?? null);
  inputQueue = $state(draft?.inputQueue ?? '');
  path = $state<string | null>(draft?.path ?? null);
  fileName = $state(draft?.fileName ?? '');

  tab = $state<Tab>('console');
  phase = $state<RunPhase>('ready');
  consoleLines = $state<ConsoleLine[]>([]);
  memory = $state<MemorySnapshot>({ vars: [], lastChanged: null });
  currentLine = $state<number | null>(null);
  breakpoints = $state<number[]>([]);
  warnings = $state<AlgoIssue[]>([]);
  error = $state<AlgoIssue | null>(null);
  steps = $state(0);
  ms = $state(0);
  waitingInput = $state(false);
  inputTarget = $state('');
  inputTargets = $state<string[]>([]);
  notice = $state<{ text: string; kind: 'info' | 'ok' | 'err' } | null>(null);
  themeRevision = $state(0);

  cursorLine = $state(1);
  cursorCol = $state(1);
  gotoNonce = $state(0);
  gotoLine = $state(1);

  testsState = $state<TestState>({ running: false, done: false, total: 0, results: [] });
  selfTestState = $state<SelfTestState>({ running: false, outcome: null });
  compareState = $state<CompareState>({ running: false, trialsRun: 0, outcome: null });
  referenceSource = $state('');

  userProblems = $state<Problem[]>(loadUserProblems());
  settingsOpen = $state(false);

  get lang() { return this.settings.lang; }
  get running() { return this.phase === 'running'; }
  get paused() { return this.phase === 'paused'; }
  get active() { return this.phase === 'running' || this.phase === 'paused'; }

  requestGoto(line: number): void {
    this.gotoLine = Math.max(1, line);
    this.gotoNonce++;
  }

  clearRunView(): void {
    this.consoleLines = [];
    this.memory = { vars: [], lastChanged: null };
    this.error = null;
    this.warnings = [];
    this.steps = 0;
    this.ms = 0;
    this.currentLine = null;
    this.waitingInput = false;
    this.inputTarget = '';
    this.inputTargets = [];
  }

  resetTests(): void {
    this.testsState = { running: false, done: false, total: 0, results: [] };
    this.selfTestState = { running: false, outcome: null };
    this.compareState = { running: false, trialsRun: 0, outcome: null };
  }

  replaceTests(inputs: { name: string; inputs: string; expected: string }[]): void {
    this.tests = inputs.map((x) => ({
      id: newScenarioId(), name: x.name, inputs: x.inputs, expected: x.expected,
    }));
    this.resetTests();
  }
}

export const app = new AppState();
export { SAMPLE };
