/**
 * Dry Run Raven — algoritma dili AST'si.
 * UI'dan tamamen bağımsız saf TypeScript.
 */

import type { AlgoIssue } from './messages';

export type Expr =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'var'; name: string }
  | { kind: 'index'; name: string; index: Expr }
  | { kind: 'unary'; op: '-'; expr: Expr }
  | { kind: 'not'; expr: Expr }
  | {
      kind: 'bin';
      op: '+' | '-' | '*' | '/' | '^' | '%' | 'mod' | 'div'
        | '==' | '!=' | '<' | '>' | '<=' | '>='
        | 'and' | 'or';
      left: Expr;
      right: Expr;
    }
  | { kind: 'call'; fn: 'sqrt' | 'abs'; arg: Expr };

export interface TargetVar { kind: 'var'; name: string }
export interface TargetIndex { kind: 'index'; name: string; index: Expr }
export type Target = TargetVar | TargetIndex;

interface StmtBase {
  /** Fiziksel satır numarası (1 tabanlı, editör gutter'ı ile aynı). */
  line: number;
  /** Basamak etiketi ("3", "5.1"). Etiket yoksa null. */
  label: string | null;
}

export interface AssignStmt extends StmtBase {
  kind: 'assign';
  target: Target;
  expr: Expr | null;
  inc: boolean;
  dec: boolean;
}
export interface PrintStmt extends StmtBase { kind: 'print'; args: Expr[] }
export interface InputStmt extends StmtBase { kind: 'input'; targets: Target[] }
export interface GotoStmt extends StmtBase { kind: 'goto'; target: string }
export interface DeclStmt extends StmtBase { kind: 'decl'; name: string; size: number | null }
export interface IfStmt extends StmtBase {
  kind: 'if';
  cond: Expr;
  then: Stmt[];
  else: Stmt[];
}
/** Başla / Dur / boş satır. */
export interface FlowStmt extends StmtBase { kind: 'flow'; what: 'start' | 'stop' | 'empty' }

export type Stmt =
  | AssignStmt | PrintStmt | InputStmt | GotoStmt
  | DeclStmt | IfStmt | FlowStmt;

export interface Program {
  body: Stmt[];
  warnings: AlgoIssue[];
  hasStart: boolean;
  hasStop: boolean;
  startLabel: string | null;
  stopLabel: string | null;
}

export function isIndexTarget(t: Target): t is TargetIndex { return t.kind === 'index'; }
