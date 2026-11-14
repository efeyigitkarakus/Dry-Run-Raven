/**
 * Dry Run Raven — Lexer.
 *
 * Tolerans kuralları (hocanın PDF'lerindeki yazım farkları):
 *   + +  → ++      = = → ==      < = → <=      > = → >=      ! = → !=
 *   “ ” „ ‘ ’ → "        → ... (satır sonuna kadar yorum)
 *   // ... ve # ... yorum
 *
 * Satır başındaki 1- / 2) / 3. / 3.2 / 3.2.1 etiketleri ayrıştırılır.
 * Sayı okurken virgül yalnızca ondalık ayırıcıysa (3,5) tüketilir; `Print (3, 5)`
 * içindeki virgül deyim ayırıcısı olarak kalır.
 */

import { keywordMeaning, norm, phraseKeywords } from './keywords';

export type TokenType =
  | 'num' | 'str' | 'id' | 'op'
  | 'lp' | 'rp' | 'lb' | 'rb' | 'comma';

export interface Token {
  type: TokenType;
  /** Sayılar için number, diğerleri için string. */
  value: string | number;
  /** Orijinal metin (etiket ve hata mesajları için). */
  raw: string;
  line: number;
  col: number;
}

export interface LexLine {
  lineNo: number;   // 1 tabanlı fiziksel satır
  indent: number;   // baştaki boşluk (tab = 4)
  label: string | null;
  /** Etiketten sonraki kod (renklendirme/yedek metin için). */
  text: string;
  tokens: Token[];
}

export interface LexIssue {
  line: number;
  label: string | null;
  code: string;
  params?: Record<string, string | number>;
}

export interface LexResult {
  lines: LexLine[];
  issues: LexIssue[];
}

/*────────────────────────── Normalizasyon ─────────────────────────*/

const PAIRS: Array<[string, string]> = [
  ['+ +', '++'], ['- -', '--'], ['= =', '=='],
  ['< =', '<='], ['> =', '>='], ['! =', '!='],
];

/**
 * Bir satırı tokenize öncesi normalize eder. Metin literalinin içi korunur.
 * Yorum işaretleri (`//`, `#`, `→`) değiştirilmez; tokenizer onları atlar.
 */
export function normalizeLine(src: string): string {
  const out: string[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];

    // Metin literali: aynen kopyala (Türkçe tırnaklar hariç).
    if (ch === '"') {
      out.push('"');
      i++;
      while (i < n) {
        const c = src[i];
        if (c === '"') { out.push('"'); i++; break; }
        if (c === '\n') break;
        out.push(c);
        i++;
      }
      continue;
    }

    // Yorum: satır sonuna kadar aynen bırak.
    if ((ch === '/' && src[i + 1] === '/') || ch === '#' || ch === '→') {
      out.push(src.slice(i));
      break;
    }

    // Türkçe/akıllı tırnaklar.
    if ('“”„‘’‚'.includes(ch)) { out.push('"'); i++; continue; }

    // Boşluklu operatör birleştirmeleri (yalnızca tam eşleşme).
    let merged = false;
    for (const [from, to] of PAIRS) {
      if (src.startsWith(from, i)) {
        out.push(to);
        i += from.length;
        merged = true;
        break;
      }
    }
    if (merged) continue;

    out.push(ch);
    i++;
  }
  return out.join('');
}

/*────────────────────────── Satır başı etiketi ─────────────────────────*/

/**
 * `1-`, `2)`, `3.`, `3.2`, `3.2.1` biçimlerini ayırır.
 * Etiketten sonra ayırıcı ya da boşluk gelmelidir; "3.5" tek başına sayıdır.
 * `gap`, etiketten sonraki boşluktur: öğrenciler alt satırları etiketten
 * sonra boşluk vererek de girintileyebildiği için bu da girintiye sayılır.
 */
const LABEL_RE = /^(\d+(?:[.-]\d+)*)\s*([-).:]?)([ \t]*)(.*)$/s;

export function extractLabel(text: string): { label: string | null; rest: string; gap: number } {
  const m = text.match(LABEL_RE);
  if (!m) return { label: null, rest: text, gap: 0 };
  const label = m[1].replace(/-/g, '.');
  const sep = m[2];
  const gapRaw = m[3] ?? '';
  const rest = m[4] ?? '';
  // Etiket olduğundan emin ol: ayırıcı var ya da araya boşluk girmiş olmalı.
  if (!sep && !gapRaw) return { label: null, rest: text, gap: 0 };
  // Etiketten sonra sayı geliyorsa bu bir etiket değil, sayı ifadesidir.
  if (rest.length > 0 && /^[0-9]/.test(rest)) return { label: null, rest: text, gap: 0 };
  let gap = 0;
  for (const c of gapRaw) gap += c === '\t' ? 4 : 1;
  return { label, rest, gap };
}

/*────────────────────────── Tokenizer ─────────────────────────*/

const ID_START = /[A-Za-zÇçĞğİıÖöŞşÜü_]/;
const ID_CONT = /[A-Za-z0-9ÇçĞğİıÖöŞşÜü_]/;
const TWO_OPS = new Set(['++', '--', '==', '!=', '<=', '>=']);
const ONE_OPS = new Set(['=', '+', '-', '*', '/', '^', '%', '<', '>']);

/** Türkçe ı/İ dahil tüm harfleri küçük harfe çevirir (yalnızca anahtar kelime testi). */
function isNumberStart(c: string): boolean {
  return c >= '0' && c <= '9';
}

function readNumber(s: string, start: number): { raw: string; value: number; end: number } {
  let j = start;
  while (j < s.length && isNumberStart(s[j])) j++;
  // Kaynak kodda ondalık ayırıcı noktadır. Virgül her zaman deyim/argüman
  // ayırıcısıdır: Print(3,5) iki argümandır. Virgüllü ondalık yalnızca
  // kullanıcı girdisinde (Sayı Gir) kabul edilir.
  if (j < s.length && s[j] === '.' && isNumberStart(s[j + 1] ?? '')) {
    j++;
    while (j < s.length && isNumberStart(s[j])) j++;
  }
  const raw = s.slice(start, j);
  const value = parseFloat(raw);
  return { raw, value: Number.isFinite(value) ? value : 0, end: j };
}

function makeToken(type: TokenType, value: string | number, raw: string, line: number, col: number): Token {
  return { type, value, raw, line, col };
}

function tokenizeRaw(text: string, lineNo: number): Token[] {
  const out: Token[] = [];
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];

    if (/\s/.test(ch)) { i++; continue; }

    // Yorumlar: satır sonuna kadar at.
    if ((ch === '/' && text[i + 1] === '/') || ch === '#' || ch === '→') break;

    if (ch === '"') {
      let j = i + 1;
      const buf: string[] = [];
      while (j < n && text[j] !== '"') { buf.push(text[j]); j++; }
      if (j >= n) {
        throw { line: lineNo, code: 'E_UNTERMINATED_STRING', params: {} };
      }
      out.push(makeToken('str', buf.join(''), text.slice(i, j + 1), lineNo, i + 1));
      i = j + 1;
      continue;
    }

    if (isNumberStart(ch) || (ch === '.' && isNumberStart(text[i + 1] ?? ''))) {
      const r = readNumber(text, i);
      out.push(makeToken('num', r.value, r.raw, lineNo, i + 1));
      i = r.end;
      continue;
    }

    if (ID_START.test(ch)) {
      let j = i;
      while (j < n && ID_CONT.test(text[j])) j++;
      out.push(makeToken('id', text.slice(i, j), text.slice(i, j), lineNo, i + 1));
      i = j;
      continue;
    }

    const two = text.slice(i, i + 2);
    if (TWO_OPS.has(two)) {
      out.push(makeToken('op', two, two, lineNo, i + 1));
      i += 2;
      continue;
    }
    if (ONE_OPS.has(ch)) {
      out.push(makeToken('op', ch, ch, lineNo, i + 1));
      i++;
      continue;
    }
    if (ch === '(') { out.push(makeToken('lp', '(', ch, lineNo, i + 1)); i++; continue; }
    if (ch === ')') { out.push(makeToken('rp', ')', ch, lineNo, i + 1)); i++; continue; }
    if (ch === '[') { out.push(makeToken('lb', '[', ch, lineNo, i + 1)); i++; continue; }
    if (ch === ']') { out.push(makeToken('rb', ']', ch, lineNo, i + 1)); i++; continue; }
    if (ch === ',') { out.push(makeToken('comma', ',', ch, lineNo, i + 1)); i++; continue; }

    // Cümle sonu noktası (Dur.) serbest; operatör olmayan nokta yok sayılır.
    if (ch === '.' || ch === ';') { i++; continue; }

    throw { line: lineNo, code: 'E_LEX_CHAR', params: { ch } };
  }
  return out;
}

/**
 * Çok sözcüklü anahtar kelimeleri tek token'a birleştirir:
 * "Sayı Gir", "else if", "Hedef Sayıyı Gir" ...
 */
function mergePhrases(tokens: Token[]): Token[] {
  const phrases = phraseKeywords().map((p) => ({ norm: norm(p), words: p.split(/\s+/).length }));
  const out: Token[] = [];
  let i = 0;
  while (i < tokens.length) {
    let merged: { token: Token; used: number } | null = null;
    // En uzun eşleşme önce.
    for (let len = 3; len >= 2; len--) {
      if (i + len > tokens.length) continue;
      const slice = tokens.slice(i, i + len);
      if (!slice.every((t) => t.type === 'id')) continue;
      const candidate = slice.map((t) => String(t.value)).join(' ');
      if (phrases.some((p) => p.norm === norm(candidate) && p.words === len)) {
        merged = {
          token: makeToken('id', candidate, candidate, slice[0].line, slice[0].col),
          used: len,
        };
        break;
      }
    }
    if (merged) {
      out.push(merged.token);
      i += merged.used;
    } else {
      out.push(tokens[i]);
      i++;
    }
  }
  return out;
}

/*────────────────────────── Ana giriş ─────────────────────────*/

/** Kaynağı satırlara ayırır, etiketleri ve girintiyi çıkarır, token üretir. */
export function lex(source: string): LexResult {
  const rawLines = source.replace(/\r\n?/g, '\n').split('\n');
  const lines: LexLine[] = [];
  const issues: LexIssue[] = [];

  rawLines.forEach((raw, idx) => {
    const lineNo = idx + 1;
    const normalized = normalizeLine(raw);

    const indentMatch = normalized.match(/^[ \t]*/);
    const indentRaw = indentMatch ? indentMatch[0] : '';
    let indent = 0;
    for (const c of indentRaw) indent += c === '\t' ? 4 : 1;

    const { label, rest, gap } = extractLabel(normalized.slice(indentRaw.length));
    // Etiketten sonraki boşluk da blok girintisi sayılır (öğrenci stili).
    indent += gap;
    const text = rest;

    let tokens: Token[] = [];
    try {
      tokens = mergePhrases(tokenizeRaw(text, lineNo));
    } catch (e) {
      const err = e as LexIssue;
      issues.push({ line: lineNo, label, code: err.code ?? 'E_LEX_CHAR', params: err.params });
      tokens = [];
    }

    lines.push({ lineNo, indent, label, text, tokens });
  });

  return { lines, issues };
}

/** Bir sözcüğün anahtar kelime anlamı (parser kısayolu). */
export function tokenMeaning(t: Token | null | undefined): string | null {
  if (!t || t.type !== 'id') return null;
  return keywordMeaning(String(t.value));
}
