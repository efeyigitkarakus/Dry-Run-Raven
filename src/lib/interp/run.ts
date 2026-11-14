/**
 * Yorumlayıcıyı UI olmadan çalıştırma yardımcıları (testler, referans
 * karşılaştırma, worker).
 */

import { parse } from '../lang/parser';
import { compile, type Compiled } from '../lang/compiler';
import type { Program } from '../lang/ast';
import type { AlgoIssue } from '../lang/messages';
import { execute } from '../interp/vm';
import type { RunOptions, RunResult, VMEvent } from '../interp/types';

export interface Prepared {
  ok: boolean;
  program: Program | null;
  compiled: Compiled | null;
  /** Hata ve uyarılar birlikte; `E_` ile başlayanlar çalışmayı engeller. */
  issues: AlgoIssue[];
  errors: AlgoIssue[];
  warnings: AlgoIssue[];
}

export function prepare(source: string): Prepared {
  const p = parse(source);
  if (p.issues.some((i) => i.code.startsWith('E_'))) {
    return {
      ok: false, program: p.program, compiled: null, issues: p.issues,
      errors: p.issues.filter((i) => i.code.startsWith('E_')),
      warnings: p.issues.filter((i) => i.code.startsWith('W_')),
    };
  }
  const c = compile(p.program);
  const issues = [...p.issues, ...c.issues];
  const errors = issues.filter((i) => i.code.startsWith('E_'));
  return {
    ok: errors.length === 0,
    program: p.program,
    compiled: c,
    issues,
    errors,
    warnings: issues.filter((i) => i.code.startsWith('W_')),
  };
}

export interface SyncRunOptions {
  maxSteps?: number;
  maxOutput?: number;
  history?: boolean;
}

/** Hazır bir derlenmiş programı girdi kuyruğuyla sonuna kadar çalıştırır. */
export function runPrepared(
  prepared: Prepared,
  inputs: string[],
  opts: SyncRunOptions = {},
): RunResult {
  const emptyMemory = { vars: [], lastChanged: null };
  if (!prepared.ok || !prepared.compiled) {
    return {
      status: 'error',
      error: prepared.errors[0] ?? { line: 1, label: null, code: 'E_EMPTY_EXPR' },
      output: [], steps: 0, ms: 0, warnings: [], memory: emptyMemory,
    };
  }
  const runOpts: RunOptions = {
    maxSteps: opts.maxSteps ?? 1_000_000,
    maxOutput: opts.maxOutput ?? 10_000,
    history: opts.history ?? false,
    inputs,
    allowPrompt: false,
    stepMode: false,
    breakpoints: [],
    initialWarnings: prepared.warnings,
  };
  const gen = execute(prepared.compiled.code, runOpts);
  let r = gen.next();
  while (!r.done) {
    // Print / uyarı olayları biriktirilir; sonuç zaten hepsini taşır.
    r = gen.next();
  }
  return r.value;
}

export function runSync(source: string, inputs: string[], opts: SyncRunOptions = {}): RunResult {
  return runPrepared(prepare(source), inputs, opts);
}

/**
 * Worker için generator pompası: olayları `onEvent`e verir, gerekince durur.
 * Dönen değer null ise generator bitti demektir.
 */
export function pump(
  gen: Generator<VMEvent, RunResult, unknown>,
  resume: unknown,
  onEvent: (e: VMEvent) => void,
): { done: false } | { done: true; result: RunResult } {
  let r = (resume === undefined ? gen.next() : gen.next(resume)) as IteratorResult<VMEvent, RunResult>;
  while (!r.done) {
    onEvent(r.value);
    if (r.value.type === 'pause' || r.value.type === 'input') return { done: false };
    r = gen.next() as IteratorResult<VMEvent, RunResult>;
  }
  return { done: true, result: r.value };
}
