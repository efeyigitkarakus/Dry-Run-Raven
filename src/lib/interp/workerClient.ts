/**
 * Worker istemcisi. Her işlem yeni bir worker açar; "Durdur" worker'ı
 * sonlandırır. Böylece sonsuz döngü arayüzü kilitleyemez.
 */

import type { CompareMsg, FromWorker, SelfTestMsg, SelfTestOutcome, TestCaseMsg, ToWorker } from './protocol';
import type { RunResult, VMResume, VMEvent } from './types';

function spawn(): Worker {
  return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
}

export interface RunHandlers {
  onEvent: (event: VMEvent) => void;
  onDone: (result: RunResult) => void;
  onFatal: (message: string) => void;
}

export interface StartOptions {
  source: string;
  inputs: string[];
  maxSteps: number;
  maxOutput: number;
  stepMode: boolean;
  allowPrompt: boolean;
  breakpoints: number[];
}

/** Tek bir çalıştırma oturumu. */
export class RunSession {
  private worker: Worker | null;
  private ended = false;

  constructor(opts: StartOptions, private handlers: RunHandlers) {
    this.worker = spawn();
    this.worker.onmessage = (ev: MessageEvent<FromWorker>) => this.receive(ev.data);
    this.worker.onerror = (ev) => {
      if (this.ended) return;
      this.ended = true;
      this.handlers.onFatal(ev.message || 'worker');
    };
    const msg: ToWorker = { cmd: 'start', ...opts };
    this.worker.postMessage(msg);
  }

  private receive(msg: FromWorker): void {
    if (this.ended) return;
    if (msg.kind === 'event') {
      this.handlers.onEvent(msg.event);
      if (msg.event.type === 'done') this.finish(msg.event.result);
      return;
    }
    if (msg.kind === 'done') { this.finish(msg.result); return; }
    if (msg.kind === 'fatal') { this.ended = true; this.handlers.onFatal(msg.message); this.worker?.terminate(); }
  }

  private finish(result: RunResult): void {
    this.ended = true;
    this.handlers.onDone(result);
    this.worker?.terminate();
    this.worker = null;
  }

  resume(resume: VMResume): void {
    if (!this.worker) return;
    this.worker.postMessage({ cmd: 'resume', resume } satisfies ToWorker);
  }

  /** Çalışmayı hemen keser; sonuç üretilmez. */
  stop(): void {
    if (this.ended) return;
    this.ended = true;
    this.worker?.terminate();
    this.worker = null;
  }

  get active(): boolean { return !this.ended; }
}

export interface TestBatchHandlers {
  onResult: (index: number, name: string, result: RunResult) => void;
  onDone: (count: number) => void;
}

export class TestBatchSession {
  private worker: Worker | null;
  private ended = false;

  constructor(source: string, cases: TestCaseMsg[], maxSteps: number, maxOutput: number, private handlers: TestBatchHandlers) {
    this.worker = spawn();
    this.worker.onmessage = (ev: MessageEvent<FromWorker>) => {
      const msg = ev.data;
      if (msg.kind === 'testResult') {
        this.handlers.onResult(msg.index, msg.name, msg.result);
      } else if (msg.kind === 'testDone') {
        this.handlers.onDone(msg.count);
        this.dispose();
      } else if (msg.kind === 'fatal') {
        this.handlers.onDone(0);
        this.dispose();
      }
    };
    this.worker.onerror = () => { if (!this.ended) this.handlers.onDone(0); this.dispose(); };
    this.worker.postMessage({ cmd: 'testBatch', source, cases, maxSteps, maxOutput } satisfies ToWorker);
  }

  dispose(): void {
    if (this.ended) return;
    this.ended = true;
    this.worker?.terminate();
    this.worker = null;
  }
}

export function runTestBatch(
  source: string,
  cases: TestCaseMsg[],
  maxSteps: number,
  maxOutput: number,
  handlers: TestBatchHandlers,
): TestBatchSession {
  return new TestBatchSession(source, cases, maxSteps, maxOutput, handlers);
}

export interface CompareHandlers {
  onDone: (outcome: import('./protocol').CompareOutcome, trialsRun: number) => void;
}

export class CompareSession {
  private worker: Worker | null;
  private ended = false;

  constructor(msg: Omit<CompareMsg, 'cmd'>, private handlers: CompareHandlers) {
    this.worker = spawn();
    this.worker.onmessage = (ev: MessageEvent<FromWorker>) => {
      const m = ev.data;
      if (m.kind === 'compareDone') {
        this.handlers.onDone(m.outcome, m.trialsRun);
        this.dispose();
      } else if (m.kind === 'fatal') {
        this.cancel();
      }
    };
    this.worker.onerror = () => this.cancel();
    this.worker.postMessage({ cmd: 'compare', ...msg } satisfies ToWorker);
  }

  cancel(): void {
    if (this.ended) return;
    this.ended = true;
    this.worker?.terminate();
    this.worker = null;
  }

  dispose(): void { this.cancel(); }
}

export interface SelfTestHandlers {
  onDone: (outcome: SelfTestOutcome) => void;
  onFatal: (message: string) => void;
}

export class SelfTestSession {
  private worker: Worker | null;
  private ended = false;

  constructor(msg: Omit<SelfTestMsg, 'cmd'>, private handlers: SelfTestHandlers) {
    this.worker = spawn();
    this.worker.onmessage = (ev: MessageEvent<FromWorker>) => {
      const m = ev.data;
      if (m.kind === 'selfTestDone') {
        this.handlers.onDone(m.outcome);
        this.cancel();
      } else if (m.kind === 'fatal') {
        this.handlers.onFatal(m.message);
        this.cancel();
      }
    };
    this.worker.onerror = (ev) => {
      this.handlers.onFatal(ev.message || 'worker');
      this.cancel();
    };
    this.worker.postMessage({ cmd: 'selfTest', ...msg } satisfies ToWorker);
  }

  cancel(): void {
    if (this.ended) return;
    this.ended = true;
    this.worker?.terminate();
    this.worker = null;
  }
}
