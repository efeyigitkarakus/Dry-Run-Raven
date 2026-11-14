/**
 * Dry Run Raven — yorumlayıcı çekirdeği (generator tabanlı VM).
 *
 * Adım adım çalıştırma, girdi bekleme ve breakpoint aynı generator üzerinden
 * yürür. Worker bu generator'ı pompalar; testler ise doğrudan sonuna kadar
 * çalıştırır. Böylece iki ayrı yorumlayıcı bakımı gerekmez.
 */

import type { Expr, Target } from '../lang/ast';
import { targetText } from '../lang/compiler';
import type { Instr } from '../lang/compiler';
import type { AlgoIssue } from '../lang/messages';
import { norm } from '../lang/keywords';
import { formatValue, parseInputValue } from './format';
import type {
  Scalar, MemorySnapshot, MemVar, VMEvent, VMResume, RunOptions, RunResult,
} from './types';

class VMError extends Error {
  constructor(public issue: AlgoIssue) {
    super(issue.code);
  }
}

interface ScalarVar {
  kind: 'scalar';
  name: string;
  value: Scalar;
  history: Scalar[];
}
interface ArrayVar {
  kind: 'array';
  name: string;
  size: number | null;
  cells: Map<number, Scalar>;
}
type Var = ScalarVar | ArrayVar;

const HISTORY_MAX = 10;

/*────────────────────────── Bellek ─────────────────────────*/

class Env {
  private vars = new Map<string, Var>();
  private lastChanged: string | null = null;

  constructor(private keepHistory: boolean) {}

  private key(name: string): string { return norm(name); }

  private fail(ins: Instr, code: string, params?: Record<string, string | number>): never {
    throw new VMError({ line: ins.line, label: ins.label, code, params });
  }

  getScalar(name: string, ins: Instr): Scalar {
    const v = this.vars.get(this.key(name));
    if (!v) this.fail(ins, 'E_UNDEFINED_VAR', { name });
    if (v!.kind === 'array') this.fail(ins, 'E_BAD_TARGET', { name });
    return v!.value;
  }

  setScalar(name: string, value: Scalar, ins: Instr): void {
    const k = this.key(name);
    const existing = this.vars.get(k);
    if (existing && existing.kind === 'array') {
      this.fail(ins, 'E_BAD_TARGET', { name });
    }
    if (existing) {
      const s = existing as ScalarVar;
      s.value = value;
      if (this.keepHistory) {
        s.history.push(value);
        if (s.history.length > HISTORY_MAX) s.history.shift();
      }
    } else {
      this.vars.set(k, {
        kind: 'scalar', name, value,
        history: this.keepHistory ? [value] : [],
      });
    }
    this.lastChanged = name;
  }

  hasVar(name: string): boolean { return this.vars.has(this.key(name)); }
  isArray(name: string): boolean { return this.vars.get(this.key(name))?.kind === 'array'; }

  declareArray(name: string, size: number | null, ins: Instr): void {
    const k = this.key(name);
    const existing = this.vars.get(k);
    if (existing && existing.kind === 'array') {
      existing.size = size ?? existing.size;
      if (size !== null) existing.cells.clear();
    } else {
      this.vars.set(k, { kind: 'array', name, size, cells: new Map() });
    }
    this.lastChanged = name;
  }

  private indexFor(name: string, index: Scalar, ins: Instr, writing: boolean): number {
    if (typeof index !== 'number') {
      this.fail(ins, 'E_BAD_INDEX', { name, val: formatValue(index) });
    }
    const i = index as number;
    if (!Number.isInteger(i)) this.fail(ins, 'E_INDEX_INT', { name, i });
    if (i < 0) this.fail(ins, 'E_INDEX_NEGATIVE', { name, i });
    const v = this.vars.get(this.key(name));
    if (!v) {
      if (writing) return i; // dinamik dizi
      this.fail(ins, 'E_UNDEFINED_ARRAY', { name });
    }
    if (v!.kind !== 'array') this.fail(ins, 'E_NOT_ARRAY', { name });
    const arr = v as ArrayVar;
    if (arr.size !== null && i >= arr.size) {
      this.fail(ins, 'E_INDEX_RANGE', { name, i, size: arr.size });
    }
    return i;
  }

  getIndex(name: string, index: Scalar, ins: Instr): Scalar {
    const i = this.indexFor(name, index, ins, false);
    const arr = this.vars.get(this.key(name)) as ArrayVar;
    if (!arr.cells.has(i)) this.fail(ins, 'E_INDEX_UNSET', { name, i });
    return arr.cells.get(i)!;
  }

  setIndex(name: string, index: Scalar, value: Scalar, ins: Instr): void {
    const i = this.indexFor(name, index, ins, true);
    let arr = this.vars.get(this.key(name)) as ArrayVar | undefined;
    if (!arr) {
      arr = { kind: 'array', name, size: null, cells: new Map() };
      this.vars.set(this.key(name), arr);
    }
    arr.cells.set(i, value);
    this.lastChanged = `${arr.name}[${i}]`;
  }

  currentVar(name: string): ScalarVar | null {
    const v = this.vars.get(this.key(name));
    return v && v.kind === 'scalar' ? v : null;
  }

  snapshot(): MemorySnapshot {
    const vars: MemVar[] = [];
    for (const v of this.vars.values()) {
      if (v.kind === 'scalar') {
        vars.push({
          kind: 'scalar', key: this.key(v.name), name: v.name,
          value: v.value, history: [...v.history],
        });
      } else {
        let maxIdx = -1;
        for (const i of v.cells.keys()) if (i > maxIdx) maxIdx = i;
        const count = Math.max(v.size ?? 0, maxIdx + 1, 0);
        const cells = [];
        for (let i = 0; i < count; i++) {
          const changed = this.lastChanged === `${v.name}[${i}]`;
          cells.push({ index: i, value: v.cells.has(i) ? v.cells.get(i)! : null, changed });
        }
        vars.push({
          kind: 'array', key: this.key(v.name), name: v.name,
          size: v.size, cells,
        });
      }
    }
    return { vars, lastChanged: this.lastChanged };
  }
}

/*────────────────────────── Değer işlemleri ─────────────────────────*/

function truthy(v: Scalar): boolean {
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'boolean') return v;
  return v.length > 0;
}

function asNumber(v: Scalar, op: string, ins: Instr): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  throw new VMError({ line: ins.line, label: ins.label, code: 'E_TYPE_MATH', params: { op } });
}

/*────────────────────────── İfade değerlendirme ─────────────────────────*/

function evalExpr(e: Expr, env: Env, ins: Instr): Scalar {
  switch (e.kind) {
    case 'num': return e.value;
    case 'str': return e.value;
    case 'var': return env.getScalar(e.name, ins);
    case 'index': {
      const idx = evalExpr(e.index, env, ins);
      return env.getIndex(e.name, idx, ins);
    }
    case 'unary': {
      const v = evalExpr(e.expr, env, ins);
      return -asNumber(v, '-', ins);
    }
    case 'not': return !truthy(evalExpr(e.expr, env, ins));
    case 'call': {
      const v = asNumber(evalExpr(e.arg, env, ins), e.fn, ins);
      if (e.fn === 'sqrt') {
        if (v < 0) {
          throw new VMError({ line: ins.line, label: ins.label, code: 'E_TYPE_MATH', params: { op: 'sqrt' } });
        }
        return Math.sqrt(v);
      }
      return Math.abs(v);
    }
    case 'bin': {
      const op = e.op;
      if (op === 'and') return truthy(evalExpr(e.left, env, ins)) && truthy(evalExpr(e.right, env, ins));
      if (op === 'or') return truthy(evalExpr(e.left, env, ins)) || truthy(evalExpr(e.right, env, ins));

      const a = evalExpr(e.left, env, ins);
      const b = evalExpr(e.right, env, ins);

      if (op === '+' && (typeof a === 'string' || typeof b === 'string')) {
        return formatValue(a) + formatValue(b);
      }
      if (op === '==' || op === '!=') {
        let eq: boolean;
        if (typeof a === 'string' || typeof b === 'string') {
          eq = formatValue(a) === formatValue(b);
        } else {
          eq = asNumber(a, op, ins) === asNumber(b, op, ins);
        }
        return op === '==' ? eq : !eq;
      }
      if (op === '<' || op === '>' || op === '<=' || op === '>=') {
        let cmp: number;
        if (typeof a === 'string' && typeof b === 'string') {
          cmp = a < b ? -1 : a > b ? 1 : 0;
        } else if (typeof a === 'number' && typeof b === 'number') {
          cmp = a < b ? -1 : a > b ? 1 : 0;
        } else {
          throw new VMError({ line: ins.line, label: ins.label, code: 'E_TYPE_CMP', params: { op } });
        }
        if (op === '<') return cmp < 0;
        if (op === '>') return cmp > 0;
        if (op === '<=') return cmp <= 0;
        return cmp >= 0;
      }

      const x = asNumber(a, op, ins);
      const y = asNumber(b, op, ins);
      switch (op) {
        case '+': return x + y;
        case '-': return x - y;
        case '*': return x * y;
        case '/':
          if (y === 0) throw new VMError({ line: ins.line, label: ins.label, code: 'E_DIV_ZERO' });
          return x / y;
        case 'div':
          if (y === 0) throw new VMError({ line: ins.line, label: ins.label, code: 'E_DIV_ZERO' });
          return Math.trunc(x / y);
        case 'mod':
          if (y === 0) throw new VMError({ line: ins.line, label: ins.label, code: 'E_DIV_ZERO' });
          return x % y;
        case '^': return Math.pow(x, y);
        default: return 0;
      }
    }
  }
}

/*────────────────────────── Yardımcılar ─────────────────────────*/

function errorResult(
  issue: AlgoIssue, output: string[], steps: number, ms: number,
  env: Env, warnings: AlgoIssue[],
): RunResult {
  return {
    status: 'error', error: issue, output: [...output], steps, ms,
    warnings: [...warnings], memory: env.snapshot(),
  };
}

/** Satır başındaki komutların PC'leri (breakpoint yalnızca burada durur). */
function lineStartPcs(code: Instr[]): Set<number> {
  const seen = new Set<number>();
  const out = new Set<number>();
  code.forEach((ins, pc) => {
    if (!seen.has(ins.line)) { seen.add(ins.line); out.add(pc); }
  });
  return out;
}

/*────────────────────────── Ana yürütücü ─────────────────────────*/

export function* execute(
  code: Instr[],
  opts: RunOptions,
): Generator<VMEvent, RunResult, VMResume> {
  const env = new Env(opts.history);
  const queue = [...opts.inputs];
  const output: string[] = [];
  const warnings: AlgoIssue[] = [...(opts.initialWarnings ?? [])];
  const breakpoints = new Set(opts.breakpoints);
  const starts = lineStartPcs(code);
  const pending: AlgoIssue[] = [];
  const t0 = performance.now();

  let pc = 0;
  let steps = 0;
  let pauseEvery = opts.stepMode;
  let skipPause = false;

  const finish = (status: RunResult['status'], error: AlgoIssue | null): RunResult => ({
    status, error, output: [...output], steps,
    ms: Math.max(0, performance.now() - t0),
    warnings: [...warnings], memory: env.snapshot(),
  });

  while (pc < code.length) {
    const ins = code[pc];

    if (steps >= opts.maxSteps) {
      return finish('error', {
        line: ins.line, label: ins.label, code: 'E_STEP_LIMIT',
        params: { max: opts.maxSteps },
      });
    }

    const atBreakpoint = breakpoints.has(ins.line) && starts.has(pc);
    if (!skipPause && ((opts.stepMode && pauseEvery) || atBreakpoint)) {
      const cmd = yield {
        type: 'pause',
        reason: opts.stepMode && pauseEvery ? 'step' : 'breakpoint',
        pc, line: ins.line, label: ins.label, text: ins.text, steps,
        memory: env.snapshot(), outputCount: output.length,
      };
      // Girdi cevabı burada beklenmez; yalnızca komut.
      if ('cmd' in cmd && cmd.cmd === 'stop') {
        return finish('stopped', null);
      }
      if ('cmd' in cmd && cmd.breakpoints) {
        breakpoints.clear();
        for (const b of cmd.breakpoints) breakpoints.add(b);
      }
      pauseEvery = 'cmd' in cmd && cmd.cmd === 'step';
      skipPause = true;
    }

    try {
      switch (ins.op) {
        case 'nop':
          pc++;
          break;

        case 'decl':
          env.declareArray(ins.name, ins.size, ins);
          pc++;
          break;

        case 'assign': {
          if (ins.inc || ins.dec) {
            const cur = ins.target.kind === 'var'
              ? env.currentVar(ins.target.name)?.value
              : undefined;
            let value: Scalar;
            if (ins.target.kind === 'var') {
              // Atanmamış değişkeni ++ yapmak hatadır.
              if (cur === undefined) {
                env.getScalar(ins.target.name, ins); // hatayı fırlatır
              }
              value = asNumber(cur as Scalar, ins.inc ? '++' : '--', ins) + (ins.inc ? 1 : -1);
              env.setScalar(ins.target.name, value, ins);
            } else {
              const idxExpr = ins.target.index;
              const idx = evalExpr(idxExpr, env, ins);
              const old = env.getIndex(ins.target.name, idx, ins);
              env.setIndex(ins.target.name, idx, asNumber(old, ins.inc ? '++' : '--', ins) + (ins.inc ? 1 : -1), ins);
            }
          } else if (ins.expr) {
            const value = evalExpr(ins.expr, env, ins);
            if (ins.target.kind === 'var') env.setScalar(ins.target.name, value, ins);
            else env.setIndex(ins.target.name, evalExpr(ins.target.index, env, ins), value, ins);
          }
          pc++;
          break;
        }

        case 'print': {
          if (output.length >= opts.maxOutput) {
            return finish('error', {
              line: ins.line, label: ins.label, code: 'E_OUTPUT_LIMIT',
              params: { max: opts.maxOutput },
            });
          }
          const parts = ins.args.map((a) => {
            // Print (Sıfır) gibi tırnaksız tanımsız ad → uyarı + metin.
            if (a.kind === 'var' && !env.hasVar(a.name) && !env.isArray(a.name)) {
              const w: AlgoIssue = {
                line: ins.line, label: ins.label, code: 'W_UNDEFINED_PRINT',
                params: { name: a.name },
              };
              warnings.push(w);
              // Uyarıyı hemen UI'ya iletmek için kuyruğa alınır.
              pending.push(w);
              return a.name;
            }
            return formatValue(evalExpr(a, env, ins));
          });
          const text = parts.join(' ');
          output.push(text);
          yield { type: 'print', text, outputCount: output.length };
          pc++;
          break;
        }

        case 'input': {
          const texts = ins.targets.map(targetText);
          for (let k = 0; k < ins.targets.length; k++) {
            const target = ins.targets[k];
            let raw: string;
            if (queue.length > 0) {
              raw = queue.shift()!;
            } else if (opts.allowPrompt) {
              const res = yield {
                type: 'input', line: ins.line, label: ins.label,
                target: texts[k], targets: texts,
              };
              if (!('value' in res)) {
                return finish('stopped', null);
              }
              raw = res.value;
            } else {
              throw new VMError({
                line: ins.line, label: ins.label, code: 'E_INPUT_EOF',
              });
            }
            const value = parseInputValue(raw);
            if (target.kind === 'var') env.setScalar(target.name, value, ins);
            else env.setIndex(target.name, evalExpr(target.index, env, ins), value, ins);
          }
          pc++;
          break;
        }

        case 'goto':
          if (ins.target < 0) {
            throw new VMError({
              line: ins.line, label: ins.label, code: 'E_GOTO_TARGET',
              params: { target: ins.targetLabel },
            });
          }
          pc = ins.target;
          break;

        case 'jf': {
          const cond = evalExpr(ins.cond, env, ins);
          pc = truthy(cond) ? pc + 1 : ins.target;
          break;
        }

        case 'jmp':
          pc = ins.target;
          break;
      }
    } catch (e) {
      if (e instanceof VMError) {
        // Bekleyen uyarıları sonuçla birlikte gönder.
        while (pending.length) yield { type: 'warning', issue: pending.shift()! };
        return finish('error', e.issue);
      }
      throw e;
    }

    steps++;
    skipPause = false;

    while (pending.length) yield { type: 'warning', issue: pending.shift()! };
  }

  return finish('ok', null);
}
