/**
 * UI ↔ Worker mesaj protokolü.
 */

import type { AlgoIssue } from '../lang/messages';
import type { SelfTestFailure } from '../tests/selftest';
import type { RunResult, VMResume, VMEvent } from './types';

export interface StartMsg {
  cmd: 'start';
  source: string;
  inputs: string[];
  maxSteps: number;
  maxOutput: number;
  stepMode: boolean;
  allowPrompt: boolean;
  breakpoints: number[];
}

export interface ResumeMsg { cmd: 'resume'; resume: VMResume }

export interface TestCaseMsg {
  name: string;
  inputs: string[];
}

export interface TestBatchMsg {
  cmd: 'testBatch';
  source: string;
  cases: TestCaseMsg[];
  maxSteps: number;
  maxOutput: number;
}

export interface CompareMsg {
  cmd: 'compare';
  sourceA: string;
  sourceB: string;
  trials: number;
  seed: number;
  maxSteps: number;
  maxOutput: number;
}

export interface SelfTestMsg {
  cmd: 'selfTest';
  source: string;
  /** Doluysa rastgele karşılaştırma, boşsa hata taraması yapılır. */
  referenceSource: string | null;
  trials: number;
  seed: number;
  maxSteps: number;
  maxOutput: number;
}

export type ToWorker = StartMsg | ResumeMsg | TestBatchMsg | CompareMsg | SelfTestMsg;

export type CompareOutcome =
  | { kind: 'mismatch'; trial: number; inputs: string[]; outA: string; outB: string; errA: string | null; errB: string | null }
  | { kind: 'same'; trials: number; sampleInputs: string[] }
  | { kind: 'invalid'; issues: AlgoIssue[]; which: 'a' | 'b' };

export type SelfTestOutcome =
  | { kind: 'invalid'; issues: AlgoIssue[]; which: 'source' | 'reference' }
  | { kind: 'fuzz'; trials: number; passed: number; failures: SelfTestFailure[]; noOutput: number }
  | { kind: 'compare'; outcome: CompareOutcome; trialsRun: number };

export type FromWorker =
  | { kind: 'event'; event: VMEvent }
  | { kind: 'done'; result: RunResult }
  | { kind: 'testResult'; index: number; name: string; result: RunResult }
  | { kind: 'testDone'; count: number }
  | { kind: 'compareDone'; outcome: CompareOutcome; trialsRun: number }
  | { kind: 'selfTestDone'; outcome: SelfTestOutcome }
  | { kind: 'fatal'; message: string };
