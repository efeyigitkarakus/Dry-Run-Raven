/**
 * Değer biçimlendirme. VM'den ayrı tutulur; UI bu modülü import ettiğinde
 * yorumlayıcının tamamını pakete sokmaz.
 */

import type { Scalar } from './types';

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : n < 0 ? '-∞' : 'NaN';
  if (Object.is(n, -0)) return '0';
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toPrecision(12)));
}

export function formatValue(v: Scalar): string {
  if (typeof v === 'number') return formatNumber(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return v;
}

/** Girdi metni → sayı (virgül de ondalık ayırıcı sayılır) veya metin. */
export function parseInputValue(raw: string): Scalar {
  const s = raw.trim();
  if (s === '') return 0;
  const normalized = s.replace(',', '.');
  if (/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(normalized)) {
    const n = Number(normalized);
    if (Number.isFinite(n)) return n;
  }
  return s;
}
