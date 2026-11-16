/**
 * Worker'ın mesaj işleme mantığı (`self`/DOM bağımsız).
 *
 * `worker.ts` bu işleyiciyi yalnızca `postMessage`'a bağlar. Mantık burada
 * durduğu için gerçek bir Worker açmadan da test edilebilir.
 */

import { prepare, runPrepared } from './run';
import { execute } from './vm';
import type { RunResult, VMResume, VMEvent } from './types';
import type { FromWorker, ToWorker } from './protocol';
import { compareAlgorithms } from '../tests/random';
import { fuzzAlgorithm } from '../tests/selftest';
import { setInputAliases } from '../lang/keywords';

export type WorkerPost = (msg: FromWorker) => void;

/** Bir çıktı partisindeki en fazla satır. */
const PRINT_BATCH_MAX = 500;
/** İki çıktı partisi arasındaki en kısa süre (ms). */
const PRINT_FLUSH_MS = 30;

/** Tek bir worker'ın durumunu tutan mesaj işleyicisini üretir. */
export function createWorkerHost(
  post: WorkerPost,
  now: () => number = () => performance.now(),
): (msg: ToWorker) => void {
  let gen: Generator<VMEvent, RunResult, VMResume> | null = null;

  // Print çıktıları biriktirilip toplu gönderilir. Satır başına bir mesaj,
  // çok satır yazan programlarda arayüzü mesaj ve yeniden çizim yüküyle boğar.
  let printBuf: string[] = [];
  let lastFlush = -Infinity;

  function flushPrints(): void {
    if (printBuf.length === 0) return;
    post({ kind: 'prints', texts: printBuf });
    printBuf = [];
    lastFlush = now();
  }

  function pump(resume?: VMResume): void {
    if (!gen) return;
    try {
      let r = gen.next(resume as VMResume);
      while (!r.done) {
        if (r.value.type === 'print') {
          printBuf.push(r.value.text);
          // Son gönderimin üzerinden yeterince süre geçtiyse bekletme; seyrek
          // yazan programlarda her satır eskisi gibi anında görünür.
          if (printBuf.length >= PRINT_BATCH_MAX || now() - lastFlush >= PRINT_FLUSH_MS) flushPrints();
        } else {
          // Sıra korunsun: bekleyen çıktı, diğer olaylardan önce gider.
          flushPrints();
          post({ kind: 'event', event: r.value });
          if (r.value.type === 'pause' || r.value.type === 'input') return;
        }
        r = gen.next(undefined as unknown as VMResume);
      }
      flushPrints();
      post({ kind: 'done', result: r.value });
      gen = null;
    } catch (e) {
      flushPrints();
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

  return (msg: ToWorker): void => {
    try {
      // Worker ayrı bir modül örneğidir; ana iş parçacığındaki takma adlar
      // burada yoktur. Kaynak ayrıştıran her iş kendi takma adlarını getirir.
      if (msg.cmd !== 'resume') {
        setInputAliases(Array.isArray(msg.inputAliases) ? msg.inputAliases : []);
      }
      if (msg.cmd === 'start') {
        gen = null;
        printBuf = [];
        lastFlush = -Infinity;
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
        return;
      }
      if (msg.cmd === 'selfTest') {
        if (msg.referenceSource && msg.referenceSource.trim()) {
          const summary = compareAlgorithms(
            msg.source, msg.referenceSource, msg.trials, msg.seed, msg.maxSteps, msg.maxOutput,
          );
          if (summary.outcome.kind === 'invalid') {
            post({
              kind: 'selfTestDone',
              outcome: {
                kind: 'invalid',
                issues: summary.outcome.issues,
                which: summary.outcome.which === 'a' ? 'source' : 'reference',
              },
            });
          } else {
            post({
              kind: 'selfTestDone',
              outcome: { kind: 'compare', outcome: summary.outcome, trialsRun: summary.trialsRun },
            });
          }
          return;
        }
        const outcome = fuzzAlgorithm(
          msg.source, msg.trials, msg.seed, msg.maxSteps, msg.maxOutput,
        );
        post({
          kind: 'selfTestDone',
          outcome: outcome.kind === 'invalid'
            ? { kind: 'invalid', issues: outcome.issues, which: 'source' }
            : outcome,
        });
      }
    } catch (e) {
      post({ kind: 'fatal', message: e instanceof Error ? e.message : String(e) });
    }
  };
}
