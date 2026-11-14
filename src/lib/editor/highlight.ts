/**
 * Editör sözdizimi renklendirmesi (3 renk ailesi):
 * anahtar kelimeler mor, metin/sayılar orta ton, yorumlar soluk.
 * Yalnızca HTML kaçışlı span'ler üretir; harici vurgulama kütüphanesi yok.
 */

import { keywordMeaning, norm, phraseKeywords } from '../lang/keywords';

let PHRASES: { words: number; text: string }[] | null = null;

function phrases(): { words: number; text: string }[] {
  if (PHRASES) return PHRASES;
  PHRASES = phraseKeywords()
    .map((p) => ({ words: p.split(/\s+/).length, text: norm(p) }))
    .sort((a, b) => b.words - a.words);
  return PHRASES;
}

/** Takma adlar değiştiğinde çağrılır; vurgulama önbelleğini temizler. */
export function resetHighlightCache(): void {
  PHRASES = null;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface Piece {
  kind: 'str' | 'num' | 'id' | 'op' | 'plain';
  text: string;
  start: number;
  end: number;
}

const ID_START = /[A-Za-zÇçĞğİıÖöŞşÜü_]/;
const ID_CONT = /[A-Za-z0-9ÇçĞğİıÖöŞşÜü_]/;

function scan(code: string): { pieces: Piece[]; comment: string } {
  const pieces: Piece[] = [];
  let i = 0;
  while (i < code.length) {
    const ch = code[i];

    if (ch === '"') {
      const start = i;
      i++;
      while (i < code.length) {
        if (code[i] === '"') { i++; break; }
        i++;
      }
      pieces.push({ kind: 'str', text: code.slice(start, i), start, end: i });
      continue;
    }

    if ((ch === '/' && code[i + 1] === '/') || ch === '#' || ch === '→') {
      return { pieces, comment: code.slice(i) };
    }

    if (/[0-9]/.test(ch)) {
      const start = i;
      while (i < code.length && /[0-9]/.test(code[i])) i++;
      if (code[i] === '.' && /[0-9]/.test(code[i + 1] ?? '')) {
        i++;
        while (i < code.length && /[0-9]/.test(code[i])) i++;
      }
      pieces.push({ kind: 'num', text: code.slice(start, i), start, end: i });
      continue;
    }

    if (ID_START.test(ch)) {
      const start = i;
      while (i < code.length && ID_CONT.test(code[i])) i++;
      pieces.push({ kind: 'id', text: code.slice(start, i), start, end: i });
      continue;
    }

    if ('=+-*/^%<>!(),[]:.;'.includes(ch)) {
      const start = i;
      i++;
      // iki karakterli operatörler tek parça
      if (i < code.length && '=+-<>!'.includes(code[i])) i++;
      pieces.push({ kind: 'op', text: code.slice(start, i), start, end: i });
      continue;
    }

    const start = i;
    while (i < code.length && !ID_START.test(code[i]) && !/[0-9"#→]/.test(code[i])
      && !'=+-*/^%<>!(),[]:.;'.includes(code[i]) && !(code[i] === '/' && code[i + 1] === '/')) {
      i++;
    }
    if (i === start) i++;
    pieces.push({ kind: 'plain', text: code.slice(start, i), start, end: i });
  }
  return { pieces, comment: '' };
}

/** Tek satırı vurgulanmış HTML'e çevirir. */
export function highlightLine(line: string): string {
  const { pieces, comment } = scan(line);
  let out = '';
  let i = 0;

  while (i < pieces.length) {
    const p = pieces[i];
    if (p.kind !== 'id') {
      out += `<span class="tok-${p.kind}">${escapeHtml(p.text)}</span>`;
      i++;
      continue;
    }

    // Çok sözcüklü anahtar kelime: aradaki yalnızca boşluk olan ardışık sözcükler.
    let matched = false;
    for (const ph of phrases()) {
      if (ph.words < 2) continue;
      if (i + ph.words > pieces.length) continue;
      const slice = pieces.slice(i, i + ph.words);
      if (!slice.every((x) => x.kind === 'id')) continue;
      if (!slice.every((x, k) => (k === 0 ? true : /^[ \t]+$/.test(line.slice(slice[k - 1].end, x.start))))) {
        continue;
      }
      const combined = slice.map((x) => x.text).join(' ');
      if (norm(combined) === ph.text) {
        out += `<span class="tok-kw">${escapeHtml(line.slice(p.start, slice[slice.length - 1].end))}</span>`;
        i += ph.words;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    if (keywordMeaning(p.text)) {
      out += `<span class="tok-kw">${escapeHtml(p.text)}</span>`;
    } else {
      out += `<span class="tok-var">${escapeHtml(p.text)}</span>`;
    }
    i++;
  }

  if (comment) out += `<span class="tok-com">${escapeHtml(comment)}</span>`;
  // Boş satır yüksekliğini koru.
  return out === '' ? '&nbsp;' : out;
}
