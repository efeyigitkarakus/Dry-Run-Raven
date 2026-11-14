/**
 * Dry Run Raven — Parser.
 *
 * Girdi: lexer'ın satır listesi (etiket + girinti + tokenlar).
 * Çıktı: iç içe blokları koruyan AST.
 *
 * Blok kuralı: `Then` sonrası aynı satırdaki deyimler ve/veya daha derin
 * girintili satırlar dalı oluşturur. `else`, en yakın eşleşmemiş `if`e bağlanır
 * (dangling else); bir sonraki satırdaki else'in girintisi, if'in girintisinden
 * küçükse o else dıştaki if'e aittir.
 */

import type { Program, Stmt, Expr, Target } from './ast';
import { lex, tokenMeaning, type LexLine, type Token, type LexIssue } from './lexer';
import type { AlgoIssue } from './messages';

class ParseFailure {
  constructor(public issue: AlgoIssue) {}
}

type Pos = { line: LexLine; toks: Token[]; i: number };

const MAX_DEPTH = 80;

export interface ParseResult {
  program: Program;
  issues: AlgoIssue[];
}

class Parser {
  private lines: LexLine[] = [];
  private pos = 0;
  private cur: Pos | null = null;
  private issues: AlgoIssue[] = [];
  private warnings: AlgoIssue[] = [];
  private hasStart = false;
  private hasStop = false;
  private startLabel: string | null = null;
  private stopLabel: string | null = null;
  private depth = 0;
  /** Lexer'dan gelen hatalar; parse edilemeyen satırlar boş kabul edilir. */
  private lexIssues: LexIssue[] = [];

  parseSource(source: string): ParseResult {
    const lx = lex(source);
    this.lexIssues = lx.issues;
    for (const e of lx.issues) {
      this.issues.push({ line: e.line, label: e.label, code: e.code, params: e.params });
    }
    this.lines = lx.lines;

    let body: Stmt[] = [];
    if (this.issues.length === 0) {
      try {
        body = this.parseBlock(0);
        if (this.pos < this.lines.length) {
          // Kalan satır beklenmeyen else vb.
          const ln = this.lines[this.pos];
          this.fail('E_UNEXPECTED_TOKEN', ln.lineNo, ln.label, { tok: this.firstRaw(ln) });
        }
      } catch (e) {
        if (e instanceof ParseFailure) {
          this.issues.push(e.issue);
          body = [];
        } else {
          throw e;
        }
      }
    }

    if (this.issues.length === 0) {
      if (!this.hasStart) {
        this.warnings.push({ line: 1, label: null, code: 'W_NO_START' });
      }
      if (!this.hasStop) {
        const last = [...this.lines].reverse().find((l) => l.tokens.length > 0);
        this.warnings.push({ line: last?.lineNo ?? 1, label: last?.label ?? null, code: 'W_NO_STOP' });
      }
    }

    return {
      program: {
        body,
        warnings: [...this.warnings],
        hasStart: this.hasStart,
        hasStop: this.hasStop,
        startLabel: this.startLabel,
        stopLabel: this.stopLabel,
      },
      issues: [...this.issues, ...this.warnings],
    };
  }

  /*────────────────────────── Satır/blok yardımcıları ──────────────────────────*/

  private firstRaw(ln: LexLine): string {
    return ln.tokens.length ? ln.tokens[0].raw : ln.text.trim().slice(0, 20);
  }

  private setLine(ln: LexLine): void {
    this.cur = { line: ln, toks: ln.tokens, i: 0 };
  }

  private eol(): boolean {
    return !this.cur || this.cur.i >= this.cur.toks.length;
  }

  private peek(k = 0): Token | null {
    if (!this.cur) return null;
    const j = this.cur.i + k;
    return j < this.cur.toks.length ? this.cur.toks[j] : null;
  }

  private advance(): Token | null {
    if (!this.cur) return null;
    const t = this.cur.i < this.cur.toks.length ? this.cur.toks[this.cur.i] : null;
    this.cur.i++;
    return t;
  }

  private meaning(t: Token | null): string | null {
    return tokenMeaning(t);
  }

  private fail(code: string, line: number, label: string | null, params?: Record<string, string | number>): never {
    throw new ParseFailure({ line, label, code, params });
  }

  private warn(line: number, label: string | null, code: string, params?: Record<string, string | number>): void {
    this.warnings.push({ line, label, code, params });
  }

  private isElseStart(t: Token | null): boolean {
    const m = this.meaning(t);
    return m === 'degilse' || m === 'degilse_eger';
  }

  private nextNonEmpty(from: number): number {
    let j = from;
    while (j < this.lines.length && this.lines[j].tokens.length === 0) j++;
    return j < this.lines.length ? j : -1;
  }

  /**
   * Girintisi `minIndent` veya daha fazla olan satırları sırayla çözümler.
   * `else` ile başlayan satırda durur (çağıran bağlar).
   */
  private parseBlock(minIndent: number): Stmt[] {
    const out: Stmt[] = [];
    while (this.pos < this.lines.length) {
      const ln = this.lines[this.pos];
      if (ln.tokens.length === 0) { this.pos++; continue; }
      if (ln.indent < minIndent) break;
      if (this.isElseStart(ln.tokens[0])) break;
      this.pos++;
      out.push(...this.parseLine(ln));
    }
    return out;
  }

  /** Tek satırı (virgülle ayrılmış birden çok deyim olabilir) çözümler. */
  private parseLine(ln: LexLine): Stmt[] {
    this.setLine(ln);
    const out: Stmt[] = [];
    while (!this.eol()) {
      if (this.isElseStart(this.peek())) break;
      out.push(...this.parseStmt(ln));
      if (!this.eol() && this.peek()!.type === 'comma') { this.advance(); continue; }
      if (!this.eol()) {
        this.fail('E_UNEXPECTED_TOKEN', ln.lineNo, ln.label, { tok: this.peek()!.raw });
      }
    }
    return out;
  }

  /*────────────────────────── Deyimler ──────────────────────────*/

  private parseStmt(ln: LexLine): Stmt[] {
    const t = this.peek();
    if (!t) this.fail('E_EMPTY_EXPR', ln.lineNo, ln.label);
    const m = this.meaning(t);

    if (m === 'eger') return [this.parseIf(ln, false)];
    if (m === 'basla') {
      this.advance();
      this.hasStart = true;
      if (ln.label) this.startLabel = ln.label;
      return [{ kind: 'flow', what: 'start', line: ln.lineNo, label: ln.label }];
    }
    if (m === 'dur') {
      this.advance();
      this.hasStop = true;
      if (ln.label) this.stopLabel = ln.label;
      return [{ kind: 'flow', what: 'stop', line: ln.lineNo, label: ln.label }];
    }
    if (m === 'goto') {
      this.advance();
      const target = this.advance();
      if (!target || (target.type !== 'num' && target.type !== 'id')) {
        this.fail('E_EXPECTED', ln.lineNo, ln.label, { what: 'basamak numarası' });
      }
      return [{ kind: 'goto', target: target!.raw, line: ln.lineNo, label: ln.label }];
    }
    if (m === 'cikis') {
      this.advance();
      return [this.parsePrint(ln)];
    }
    if (m === 'giris') {
      this.advance();
      return [this.parseInput(ln)];
    }
    if (m === 'dizi' || m === 'int') {
      return [this.parseDecl(ln)];
    }

    // Atama: X = ..., X++, X-- , A[i] = ...
    if (t.type === 'id') {
      return [this.parseAssign(ln)];
    }

    this.fail('E_UNEXPECTED_TOKEN', ln.lineNo, ln.label, { tok: t.raw });
  }

  private parsePrint(ln: LexLine): Stmt {
    const args: Expr[] = [];
    if (this.peek()?.type === 'lp') {
      this.advance();
      if (this.peek()?.type !== 'rp') {
        args.push(this.parseExpr());
        while (this.peek()?.type === 'comma') {
          this.advance();
          args.push(this.parseExpr());
        }
      }
      this.closeParen(ln);
    } else if (!this.eol() && !this.isElseStart(this.peek())) {
      args.push(this.parseExpr());
    }
    return { kind: 'print', args, line: ln.lineNo, label: ln.label };
  }

  private parseInput(ln: LexLine): Stmt {
    const targets: Target[] = [];
    if (this.peek()?.type === 'lp') {
      this.advance();
      if (this.peek()?.type !== 'rp') {
        targets.push(this.parseTarget());
        while (this.peek()?.type === 'comma') {
          this.advance();
          targets.push(this.parseTarget());
        }
      }
      this.closeParen(ln);
    } else {
      targets.push(this.parseTarget());
      while (this.peek()?.type === 'comma') {
        this.advance();
        targets.push(this.parseTarget());
      }
    }
    return { kind: 'input', targets, line: ln.lineNo, label: ln.label };
  }

  private parseDecl(ln: LexLine): Stmt {
    this.advance(); // Dizi / int
    const nameTok = this.advance();
    if (!nameTok || nameTok.type !== 'id') {
      this.fail('E_EXPECTED', ln.lineNo, ln.label, { what: 'dizi adı' });
    }
    let size: number | null = null;
    if (this.peek()?.type === 'lb') {
      this.advance();
      const sz = this.advance();
      if (!sz || sz.type !== 'num') {
        this.fail('E_EXPECTED', ln.lineNo, ln.label, { what: 'dizi boyutu' });
      }
      size = Number(sz!.value);
      if (this.peek()?.type === 'rb') this.advance();
      else this.warn(ln.lineNo, ln.label, 'W_MISSING_PAREN');
    }
    return { kind: 'decl', name: String(nameTok!.value), size, line: ln.lineNo, label: ln.label };
  }

  private parseAssign(ln: LexLine): Stmt {
    const target = this.parseTarget();
    const op = this.advance();
    if (!op || op.type !== 'op') {
      this.fail('E_EXPECTED', ln.lineNo, ln.label, { what: '= , ++ veya --' });
    }
    if (op!.value === '++') {
      return { kind: 'assign', target, expr: null, inc: true, dec: false, line: ln.lineNo, label: ln.label };
    }
    if (op!.value === '--') {
      return { kind: 'assign', target, expr: null, inc: false, dec: true, line: ln.lineNo, label: ln.label };
    }
    if (op!.value !== '=') {
      this.fail('E_EXPECTED', ln.lineNo, ln.label, { what: '=' });
    }
    const expr = this.parseExpr();
    return { kind: 'assign', target, expr, inc: false, dec: false, line: ln.lineNo, label: ln.label };
  }

  private parseTarget(): Target {
    const t = this.advance();
    if (!t || t.type !== 'id') {
      this.fail('E_BAD_TARGET', t?.line ?? 0, null);
    }
    const name = String(t!.value);
    if (this.peek()?.type === 'lb') {
      this.advance();
      const index = this.parseExpr();
      if (this.peek()?.type === 'rb') this.advance();
      else this.warn(t!.line, null, 'W_MISSING_PAREN');
      return { kind: 'index', name, index };
    }
    return { kind: 'var', name };
  }

  /*────────────────────────── if / else ──────────────────────────*/

  /** `if` anahtar kelimesi henüz tüketilmediyse alreadyIf=false. */
  private parseIf(ln: LexLine, alreadyIf: boolean): Stmt {
    if (!alreadyIf) this.advance();
    if (++this.depth > MAX_DEPTH) {
      this.fail('E_DEPTH', ln.lineNo, ln.label);
    }

    const cond = this.parseCondition(ln);

    // Then / ise
    if (this.meaning(this.peek()) === 'ise') {
      this.advance();
    } else {
      this.warn(ln.lineNo, ln.label, 'W_MISSING_THEN');
    }

    // Dal etiketi: Then 5.1 ...
    const branchLabel = this.takeSubLabel();
    const thenBranch: Stmt[] = [];

    // Aynı satırdaki deyimler
    while (!this.eol() && !this.isElseStart(this.peek())) {
      thenBranch.push(...this.parseStmt(ln));
      if (this.peek()?.type === 'comma') { this.advance(); continue; }
      break;
    }

    if (branchLabel && thenBranch.length) thenBranch[0].label = branchLabel;

    // Sonraki girintili satırlar (Then'den sonra blok)
    this.consumeIndentedBlock(ln.indent, thenBranch);

    // else aynı satırda mı?
    const elseBranch: Stmt[] = [];
    if (!this.eol() && this.isElseStart(this.peek())) {
      elseBranch.push(...this.parseElse(ln));
    } else {
      const ni = this.nextNonEmpty(this.pos);
      if (ni >= 0) {
        const nl = this.lines[ni];
        if (this.isElseStart(nl.tokens[0]) && nl.indent >= ln.indent) {
          this.pos = ni + 1;
          this.setLine(nl);
          elseBranch.push(...this.parseElse(nl));
        }
      }
    }

    this.depth--;
    return {
      kind: 'if', cond, then: thenBranch, else: elseBranch,
      line: ln.lineNo, label: ln.label,
    };
  }

  /** Then/else sonrasındaki 5.1 gibi alt etiketi tüketir. */
  private takeSubLabel(): string | null {
    const t = this.peek();
    if (!t || t.type !== 'num') return null;
    if (!/^\d+(?:\.\d+)+$/.test(t.raw)) return null;
    // Etiketten sonra bir deyim gelmeli; aksi halde bu bir ifadedir.
    const nxt = this.peek(1);
    if (!nxt || (nxt.type !== 'id' && nxt.type !== 'num' && nxt.type !== 'str')) return null;
    this.advance();
    return t.raw;
  }

  /**
   * if satırından sonra gelen ve daha derin girintili deyimleri dala ekler.
   * `else` satırında durur.
   */
  private consumeIndentedBlock(parentIndent: number, into: Stmt[]): void {
    while (true) {
      const ni = this.nextNonEmpty(this.pos);
      if (ni < 0) return;
      const nl = this.lines[ni];
      if (nl.indent <= parentIndent) return;
      if (this.isElseStart(nl.tokens[0])) return;
      this.pos = ni + 1;
      this.setLine(nl);
      into.push(...this.parseLine(nl));
    }
  }

  private parseElse(ln: LexLine): Stmt[] {
    const t = this.advance();
    const m = this.meaning(t);

    if (m === 'degilse_eger') {
      // "else if" tek token; aynı satırdaki if'i çöz.
      const ifStmt = this.parseIf(ln, true);
      return [ifStmt];
    }

    // Tek "else": alt etiket + satırdaki deyimler + girintili blok.
    const branchLabel = this.takeSubLabel();
    const out: Stmt[] = [];
    while (!this.eol() && !this.isElseStart(this.peek())) {
      out.push(...this.parseStmt(ln));
      if (this.peek()?.type === 'comma') { this.advance(); continue; }
      break;
    }
    if (branchLabel && out.length) out[0].label = branchLabel;
    this.consumeIndentedBlock(ln.indent, out);
    return out;
  }

  /*────────────────────────── Koşul / ifade ──────────────────────────*/

  private parseCondition(ln: LexLine): Expr {
    if (this.peek()?.type === 'lp') {
      this.advance();
      const e = this.parseExpr();
      this.closeParen(ln);
      return e;
    }
    // Parantezsiz koşul toleransı: if A < 0 Then
    return this.parseExpr();
  }

  private closeParen(ln: LexLine): void {
    if (this.peek()?.type === 'rp') { this.advance(); return; }
    this.warn(ln.lineNo, ln.label, 'W_MISSING_PAREN');
  }

  private parseExpr(): Expr { return this.parseOr(); }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.meaning(this.peek()) === 'veya') {
      this.advance();
      left = { kind: 'bin', op: 'or', left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseEq();
    while (this.meaning(this.peek()) === 've') {
      this.advance();
      left = { kind: 'bin', op: 'and', left, right: this.parseEq() };
    }
    return left;
  }

  private parseEq(): Expr {
    let left = this.parseCmp();
    while (true) {
      const t = this.peek();
      if (!t || t.type !== 'op') break;
      const op = String(t.value);
      if (op === '=') {
        this.warn(t.line, this.cur?.line.label ?? null, 'W_SINGLE_EQ');
        this.advance();
        left = { kind: 'bin', op: '==', left, right: this.parseCmp() };
      } else if (op === '==' || op === '!=') {
        this.advance();
        left = { kind: 'bin', op, left, right: this.parseCmp() };
      } else break;
    }
    return left;
  }

  private parseCmp(): Expr {
    let left = this.parseAdd();
    while (true) {
      const t = this.peek();
      if (!t || t.type !== 'op') break;
      const op = String(t.value);
      if (op === '<' || op === '>' || op === '<=' || op === '>=') {
        this.advance();
        left = { kind: 'bin', op, left, right: this.parseAdd() };
      } else break;
    }
    return left;
  }

  private parseAdd(): Expr {
    let left = this.parseMul();
    while (true) {
      const t = this.peek();
      if (!t || t.type !== 'op') break;
      const op = String(t.value);
      if (op === '+' || op === '-') {
        this.advance();
        left = { kind: 'bin', op, left, right: this.parseMul() };
      } else break;
    }
    return left;
  }

  private parseMul(): Expr {
    let left = this.parsePow();
    while (true) {
      const t = this.peek();
      if (!t) break;
      if (t.type === 'op') {
        const op = String(t.value);
        if (op === '*' || op === '/' || op === '%') {
          this.advance();
          left = { kind: 'bin', op: op === '%' ? 'mod' : '/', left, right: this.parsePow() };
          if (op === '%') { /* mod olarak temsil edilir */ }
          continue;
        }
        break;
      }
      if (t.type === 'id') {
        const k = this.meaning(t);
        if (k === 'mod' || k === 'div') {
          this.advance();
          left = { kind: 'bin', op: k, left, right: this.parsePow() };
          continue;
        }
      }
      // A (mod 2)  →  A mod 2
      if (t.type === 'lp' && this.meaning(this.peek(1)) === 'mod') {
        this.advance(); this.advance();
        const right = this.parseExpr();
        if (this.peek()?.type === 'rp') this.advance();
        left = { kind: 'bin', op: 'mod', left, right };
        continue;
      }
      break;
    }
    return left;
  }

  private parsePow(): Expr {
    const base = this.parseUnary();
    const t = this.peek();
    if (t && t.type === 'op' && t.value === '^') {
      this.advance();
      return { kind: 'bin', op: '^', left: base, right: this.parsePow() };
    }
    return base;
  }

  private parseUnary(): Expr {
    const t = this.peek();
    if (!t) this.fail('E_EMPTY_EXPR', this.cur?.line.lineNo ?? 0, this.cur?.line.label ?? null);
    if (t.type === 'op' && t.value === '-') {
      this.advance();
      return { kind: 'unary', op: '-', expr: this.parseUnary() };
    }
    if (this.meaning(t) === 'degil') {
      this.advance();
      return { kind: 'not', expr: this.parseUnary() };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let node = this.parsePrimary();
    while (true) {
      const t = this.peek();
      if (!t) break;

      if (t.type === 'lb') {
        if (node.kind !== 'var') {
          this.fail('E_NOT_ARRAY', t.line, this.cur?.line.label ?? null, {
            name: node.kind === 'index' ? node.name : 'ifade',
          });
        }
        this.advance();
        const index = this.parseExpr();
        if (this.peek()?.type === 'rb') this.advance();
        else this.warn(t.line, this.cur?.line.label ?? null, 'W_MISSING_PAREN');
        node = { kind: 'index', name: node.name, index };
        continue;
      }

      if (t.type === 'lp') {
        // A (mod 2) bir çağrı değildir.
        if (this.meaning(this.peek(1)) === 'mod') break;
        if (node.kind !== 'var') {
          this.fail('E_UNKNOWN_FUNC', t.line, this.cur?.line.label ?? null, { name: 'ifade' });
        }
        const fn = this.meaning({ ...t, type: 'id', value: node.name } as Token);
        if (fn !== 'sqrt' && fn !== 'abs') {
          this.fail('E_UNKNOWN_FUNC', t.line, this.cur?.line.label ?? null, { name: node.name });
        }
        this.advance();
        const arg = this.parseExpr();
        if (this.peek()?.type === 'rp') this.advance();
        else this.warn(t.line, this.cur?.line.label ?? null, 'W_MISSING_PAREN');
        node = { kind: 'call', fn: fn as 'sqrt' | 'abs', arg };
        continue;
      }
      break;
    }
    return node;
  }

  private parsePrimary(): Expr {
    const t = this.peek();
    if (!t) this.fail('E_EMPTY_EXPR', this.cur?.line.lineNo ?? 0, this.cur?.line.label ?? null);
    if (t!.type === 'lp') {
      this.advance();
      const e = this.parseExpr();
      if (this.peek()?.type === 'rp') this.advance();
      else this.warn(t!.line, this.cur?.line.label ?? null, 'W_MISSING_PAREN');
      return e;
    }
    if (t!.type === 'num') { this.advance(); return { kind: 'num', value: Number(t!.value) }; }
    if (t!.type === 'str') { this.advance(); return { kind: 'str', value: String(t!.value) }; }
    if (t!.type === 'id') {
      // Anahtar kelime ifade içinde değişken olamaz (mod/div vb. zaten tüketildi).
      this.advance();
      return { kind: 'var', name: String(t!.value) };
    }
    this.fail('E_UNEXPECTED_TOKEN', t!.line, this.cur?.line.label ?? null, { tok: t!.raw });
  }
}

export function parse(source: string): ParseResult {
  return new Parser().parseSource(source);
}
