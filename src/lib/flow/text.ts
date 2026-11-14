/** Akış şeması metin sarma (yaklaşık karakter genişliğine göre). */

export function wrapText(text: string, maxChars: number): string[] {
  const t = text.trim();
  if (t === '') return [];
  if (t.length <= maxChars) return [t];
  const words = t.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (w.length > maxChars) {
      if (cur) { lines.push(cur); cur = ''; }
      for (let i = 0; i < w.length; i += maxChars) lines.push(w.slice(i, i + maxChars));
      continue;
    }
    if (cur === '') cur = w;
    else if (cur.length + 1 + w.length <= maxChars) cur += ` ${w}`;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
