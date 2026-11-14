/// <reference lib="webworker" />
/**
 * Yorumlayıcı Web Worker'ı.
 *
 * Bir worker tek bir iş yapar: çalıştırma (adım/adım-durdur), test partisi veya
 * referans karşılaştırma. UI "Durdur" dediğinde worker'ı sonlandırır; böylece
 * sonsuz döngü arayüzü asla kilitlemez.
 */

import { prepare, runPrepared } from './run';
import { execute } from './vm';
import type { RunResult, VMResume, VMEvent } from './types';
import type { FromWorker, ToWorker } from './protocol';
import { compareAlgorithms } from '../tests/random';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let gen: Generator<VMEvent, RunResult, VMResume> | null = null;

function post(msg: FromWorker): void {
  ctx.postMessage(msg);
}

function pump(resume?: VMResume): void {
  if (!gen) return;
  try {
    let r = gen.next(resume as VMResume);
    while (!r.done) {
      post({ kind: 'event', event: r.value });
      if (r.value.type === 'pause' || r.value.type === 'input') return;
      r = gen.next(undefined as unknown as VMResume);
    }
    post({ kind: 'done', result: r.value });
    gen = null;
  } catch (e) {
    post({ kind: 'fatal', message: e instanceof Error ? e.message : String(e) });
    gen = null;
  }
}

function startRun(msg: Extract<ToWorker, { cmd: 'start' }>): void {
  const prepared = prepare(msg.source);
  if (!prepared.ok) {
    post({
      kind: 'done',
      result: {
        status: 'error', error: prepared.errors[0] ?? null, output: [],
        steps: 0, ms: 0, warnings: prepared.warnings,
        memory: { vars: [], lastChanged: null },
      },
    });
    return;
  }
  gen = execute(prepared.compiled!.code, {
    maxSteps: msg.maxSteps,
    maxOutput: msg.maxOutput,
    history: msg.stepMode,
    inputs: msg.inputs,
    allowPrompt: msg.allowPrompt,
    stepMode: msg.stepMode,
    breakpoints: msg.breakpoints,
    initialWarnings: prepared.warnings,
  });
  pump();
}

ctx.onmessage = (ev: MessageEvent<ToWorker>) => {
  const msg = ev.data;
  try {
    if (msg.cmd === 'start') {
      gen = null;
      startRun(msg);
      return;
    }
    if (msg.cmd === 'resume') {
      if (gen) pump(msg.resume);
      return;
    }
    if (msg.cmd === 'testBatch') {
      const prepared = prepare(msg.source);
      if (!prepared.ok) {
        post({ kind: 'testDone', count: 0 });
        return;
      }
      msg.cases.forEach((c, index) => {
        const result = runPrepared(prepared, c.inputs, {
          maxSteps: msg.maxSteps, maxOutput: msg.maxOutput, history: false,
        });
        post({ kind: 'testResult', index, name: c.name, result });
      });
      post({ kind: 'testDone', count: msg.cases.length });
      return;
    }
    if (msg.cmd === 'compare') {
      const summary = compareAlgorithms(
        msg.sourceA, msg.sourceB, msg.trials, msg.seed, msg.maxSteps, msg.maxOutput,
      );
      post({ kind: 'compareDone', outcome: summary.outcome, trialsRun: summary.trialsRun });
    }
  } catch (e) {
    post({ kind: 'fatal', message: e instanceof Error ? e.message : String(e) });
  }
};
