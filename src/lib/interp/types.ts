/**
 * Yorumlayıcı veri tipleri ve olay protokolü.
 * Hem Worker hem test motoru bu tipleri kullanır.
 */

import type { AlgoIssue } from '../lang/messages';

export type Scalar = number | string | boolean;

export interface ScalarMem {
  kind: 'scalar';
  key: string;
  name: string;
  value: Scalar;
  history: Scalar[];
}

export interface CellMem {
  index: number;
  /** null = atanmamış hücre. */
  value: Scalar | null;
  changed: boolean;
}

export interface ArrayMem {
  kind: 'array';
  key: string;
  name: string;
  size: number | null;
  cells: CellMem[];
}

export type MemVar = ScalarMem | ArrayMem;

export interface MemorySnapshot {
  vars: MemVar[];
  /** Son değişen hücre/değişken: "A[3]" veya "say". */
  lastChanged: string | null;
}

export interface RunStats {
  steps: number;
  ms: number;
}

export type RunStatus = 'ok' | 'error' | 'stopped';

export interface RunResult extends RunStats {
  status: RunStatus;
  output: string[];
  error: AlgoIssue | null;
  warnings: AlgoIssue[];
  memory: MemorySnapshot;
}

export type PauseReason = 'step' | 'breakpoint' | 'start';

export type VMEvent =
  | {
      type: 'pause';
      reason: PauseReason;
      pc: number;
      line: number;
      label: string | null;
      text: string;
      steps: number;
      memory: MemorySnapshot;
      outputCount: number;
    }
  | { type: 'print'; text: string; outputCount: number }
  | {
      type: 'input';
      line: number;
      label: string | null;
      /** Girdi istenen hedefin metni, ör. "A[2]". */
      target: string;
      targets: string[];
    }
  | { type: 'warning'; issue: AlgoIssue }
  | { type: 'done'; result: RunResult };

export type VMResume =
  | { cmd: 'step' | 'continue' | 'stop'; breakpoints?: number[] }
  | { value: string };

export interface RunOptions {
  maxSteps: number;
  maxOutput: number;
  /** Adım geçmişi (bellek paneli) tutulsun mu? */
  history: boolean;
  /** Başlangıç girdi kuyruğu. */
  inputs: string[];
  /** Kuyruk boşalınca konsoldan girdi sorulsun mu? */
  allowPrompt: boolean;
  /** Adım modu. */
  stepMode: boolean;
  breakpoints: number[];
  /** Ayrıştırma/derleme aşamasından gelen uyarılar. */
  initialWarnings?: AlgoIssue[];
}
