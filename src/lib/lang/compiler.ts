/**
 * Dry Run Raven — AST → düz komut (instruction) derleyicisi.
 *
 * Neden düz komutlar? Aynı temsil hem yorumlayıcıyı hem akış şeması/CFG'yi
 * besler. `if` ve `goto` tek bir yerde çözülür; adım adım çalıştırma, breakpoint
 * ve akış şeması aynı sıra üzerinde çalışır.
 */

import type { Expr, Program, Stmt, Target } from './ast';
import type { AlgoIssue } from './messages';

export interface InstrBase {
  line: number;
  label: string | null;
  /** Akış şemasında "ifade" modunda gösterilecek metin. */
  text: string;
}

export interface AssignInstr extends InstrBase {
  op: 'assign'; target: Target; expr: Expr | null; inc: boolean; dec: boolean;
}
export interface PrintInstr extends InstrBase { op: 'print'; args: Expr[] }
export interface InputInstr extends InstrBase { op: 'input'; targets: Target[] }
export interface DeclInstr extends InstrBase { op: 'decl'; name: string; size: number | null }
export interface GotoInstr extends InstrBase { op: 'goto'; targetLabel: string; target: number }
export interface JumpIfFalseInstr extends InstrBase { op: 'jf'; cond: Expr; target: number }
export interface JumpInstr extends InstrBase { op: 'jmp'; target: number }
export interface NopInstr extends InstrBase { op: 'nop'; what: 'start' | 'stop' | 'empty' }

export type Instr =
  | AssignInstr | PrintInstr | InputInstr | DeclInstr
  | GotoInstr | JumpIfFalseInstr | JumpInstr | NopInstr;

export interface Compiled {
  code: Instr[];
  labels: Map<string, number>;
  lineToPc: Map<number, number>;
  issues: AlgoIssue[];
}

/*────────────────────────── Metne çevirme ─────────────────────────*/

export function exprText(e: Expr): string {
  switch (e.kind) {
    case 'num': return formatNum(e.value);
    case 'str': return `"${e.value}"`;
    case 'var': return e.name;
    case 'index': return `${e.name}[${exprText(e.index)}]`;
    case 'unary': return `-${exprText(e.expr)}`;
    case 'not': return `not ${exprText(e.expr)}`;
    case 'bin': return `${exprText(e.left)} ${e.op} ${exprText(e.right)}`;
    case 'call': return `${e.fn}(${exprText(e.arg)})`;
  }
}

export function targetText(t: Target): string {
  return t.kind === 'var' ? t.name : `${t.name}[${exprText(t.index)}]`;
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toPrecision(12)));
}

function stmtText(s: Stmt): string {
  switch (s.kind) {
    case 'assign':
      if (s.inc) return `${targetText(s.target)}++`;
      if (s.dec) return `${targetText(s.target)}--`;
      return `${targetText(s.target)} = ${s.expr ? exprText(s.expr) : ''}`;
    case 'print': return `Print (${s.args.map(exprText).join(', ')})`;
    case 'input': return `Sayı Gir (${s.targets.map(targetText).join(', ')})`;
    case 'goto': return `Goto ${s.target}`;
    case 'decl': return `Dizi ${s.name}${s.size !== null ? `[${s.size}]` : ''}`;
    case 'if': return `if (${exprText(s.cond)})`;
    case 'flow': return s.what === 'start' ? 'Başla' : s.what === 'stop' ? 'Dur' : '';
  }
}

/*────────────────────────── Derleyici ─────────────────────────*/

class Compiler {
  code: Instr[] = [];
  issues: AlgoIssue[] = [];
  private labels = new Map<string, number>();
  private lineToPc = new Map<number, number>();

  private push(instr: Instr): number {
    const idx = this.code.length;
    this.code.push(instr);
    if (!this.lineToPc.has(instr.line)) this.lineToPc.set(instr.line, idx);
    if (instr.label && !this.labels.has(instr.label)) this.labels.set(instr.label, idx);
    return idx;
  }

  /** Bir ifadenin ilk basamağı için görünen etiket; yoksa üst etiket + .1/.2. */
  private branchLabel(parent: Stmt, branch: 1 | 2): string | null {
    if (!parent.label) return null;
    if (!/^\d+(?:\.\d+)*$/.test(parent.label)) return null;
    return `${parent.label}.${branch}`;
  }

  compileStmt(s: Stmt, parentForInline: Stmt | null = null, branch: 1 | 2 = 1): void {
    switch (s.kind) {
      case 'assign':
        this.push({
          op: 'assign', target: s.target, expr: s.expr, inc: s.inc, dec: s.dec,
          line: s.line, label: s.label, text: stmtText(s),
        });
        return;
      case 'print':
        this.push({ op: 'print', args: s.args, line: s.line, label: s.label, text: stmtText(s) });
        return;
      case 'input':
        this.push({ op: 'input', targets: s.targets, line: s.line, label: s.label, text: stmtText(s) });
        return;
      case 'decl':
        this.push({ op: 'decl', name: s.name, size: s.size, line: s.line, label: s.label, text: stmtText(s) });
        return;
      case 'goto':
        this.push({
          op: 'goto', targetLabel: s.target, target: -1,
          line: s.line, label: s.label, text: stmtText(s),
        });
        return;
      case 'flow':
        this.push({ op: 'nop', what: s.what, line: s.line, label: s.label, text: stmtText(s) });
        return;
      case 'if': {
        const jf = this.push({
          op: 'jf', cond: s.cond, target: -1,
          line: s.line, label: s.label, text: exprText(s.cond),
        });
        this.compileBranch(s.then, s, 1);
        if (s.else.length > 0) {
          const jmp = this.push({
            op: 'jmp', target: -1, line: s.line, label: s.label,
            text: '',
          });
          (this.code[jf] as JumpIfFalseInstr).target = this.code.length;
          this.compileBranch(s.else, s, 2);
          (this.code[jmp] as JumpInstr).target = this.code.length;
        } else {
          (this.code[jf] as JumpIfFalseInstr).target = this.code.length;
        }
        return;
      }
    }
  }

  private compileBranch(stmts: Stmt[], parent: Stmt, branch: 1 | 2): void {
    const auto = this.branchLabel(parent, branch);
    stmts.forEach((s, i) => {
      const applyAuto = auto && !s.label && s.line === parent.line;
      if (applyAuto) {
        const copy: Stmt = { ...s, label: auto };
        this.compileStmt(copy);
      } else {
        this.compileStmt(s);
      }
      // Aynı satırdaki ikinci ve sonraki deyimler otomatik etiketi paylaşır.
      void i;
    });
  }

  finish(): Compiled {
    // goto hedeflerini çöz.
    for (const ins of this.code) {
      if (ins.op !== 'goto') continue;
      let target = this.labels.get(ins.targetLabel);
      if (target === undefined) {
        // Etiketsiz satırlarda fiziksel satır numarası hedef olabilir.
        const n = Number(ins.targetLabel);
        if (Number.isFinite(n)) target = this.lineToPc.get(n);
      }
      if (target === undefined) {
        this.issues.push({
          line: ins.line, label: ins.label, code: 'E_GOTO_TARGET',
          params: { target: ins.targetLabel },
        });
      } else {
        ins.target = target;
      }
    }
    return {
      code: this.code,
      labels: this.labels,
      lineToPc: this.lineToPc,
      issues: this.issues,
    };
  }
}

export function compile(program: Program): Compiled {
  const c = new Compiler();
  for (const s of program.body) c.compileStmt(s);
  return c.finish();
}
