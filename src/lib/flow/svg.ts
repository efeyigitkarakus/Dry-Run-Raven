/**
 * Akış şeması → saf SVG metni. Harici çizim kütüphanesi yok.
 * Renkler dışarıdan verilir; hem ekranda hem dışa aktarmada aynı çizim kullanılır.
 */

import type { FlowLayout, FlowNodeBox } from './layout';

export interface FlowPalette {
  bg: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function textEl(x: number, y: number, s: string, fill: string, size = 12, weight = 400): string {
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" `
    + `font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="${size}" `
    + `font-weight="${weight}" fill="${fill}">${esc(s)}</text>`;
}

function labelEl(x: number, y: number, s: string, pal: FlowPalette, hex: boolean): string {
  if (hex) {
    const w = Math.max(34, s.length * 7 + 16);
    const h = 18;
    const p = [
      [x - w / 2, y], [x - w / 2 + 7, y - h / 2], [x + w / 2 - 7, y - h / 2],
      [x + w / 2, y], [x + w / 2 - 7, y + h / 2], [x - w / 2 + 7, y + h / 2],
    ].map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
    return `<g><polygon points="${p}" fill="${pal.bg}" stroke="${pal.accent}" stroke-width="1"/>`
      + textEl(x, y + 4, s, pal.accent, 11) + '</g>';
  }
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" `
    + `font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="11" `
    + `fill="${pal.muted}" stroke="${pal.bg}" stroke-width="3" paint-order="stroke">${esc(s)}</text>`;
}

function shape(n: FlowNodeBox, pal: FlowPalette): string {
  const stroke = n.active ? pal.accent : pal.border;
  const fill = n.active ? pal.accentSoft : pal.bg;
  const sw = n.active ? 2.5 : 1.2;
  const attrs = `fill="${fill}" stroke="${stroke}" stroke-width="${sw}"`;
  const cx = n.x + n.w / 2;
  const cy = n.y + n.h / 2;

  if (n.kind === 'start' || n.kind === 'end') {
    return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(n.w / 2).toFixed(1)}" ry="${(n.h / 2).toFixed(1)}" ${attrs}/>`;
  }
  if (n.kind === 'merge') {
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(n.w / 2).toFixed(1)}" ${attrs}/>`;
  }
  if (n.kind === 'decision') {
    const pts = [
      `${cx.toFixed(1)},${n.y.toFixed(1)}`,
      `${(n.x + n.w).toFixed(1)},${cy.toFixed(1)}`,
      `${cx.toFixed(1)},${(n.y + n.h).toFixed(1)}`,
      `${n.x.toFixed(1)},${cy.toFixed(1)}`,
    ].join(' ');
    return `<polygon points="${pts}" ${attrs}/>`;
  }
  if (n.kind === 'input' || n.kind === 'output') {
    const k = 14;
    const pts = [
      `${(n.x + k).toFixed(1)},${n.y.toFixed(1)}`,
      `${(n.x + n.w).toFixed(1)},${n.y.toFixed(1)}`,
      `${(n.x + n.w - k).toFixed(1)},${(n.y + n.h).toFixed(1)}`,
      `${n.x.toFixed(1)},${(n.y + n.h).toFixed(1)}`,
    ].join(' ');
    return `<polygon points="${pts}" ${attrs}/>`;
  }
  return `<rect x="${n.x.toFixed(1)}" y="${n.y.toFixed(1)}" width="${n.w.toFixed(1)}" height="${n.h.toFixed(1)}" rx="2" ${attrs}/>`;
}

export function renderFlowSvg(layout: FlowLayout, pal: FlowPalette): string {
  const body: string[] = [];
  body.push(`<rect x="0" y="0" width="${layout.width}" height="${layout.height}" fill="${pal.bg}"/>`);

  // Kenarlar düğümlerin altında kalır.
  for (const e of layout.edges) {
    const pts = e.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const color = e.back ? pal.accent : pal.muted;
    const marker = e.back ? 'arrowAccent' : 'arrow';
    body.push(`<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.2" `
      + `marker-end="url(#${marker})"/>`);
    if (e.label) body.push(labelEl(e.labelX, e.labelY, e.label, pal, e.back && layout.loopHex));
  }

  for (const n of layout.nodes) {
    body.push(shape(n, pal));
    if (n.lines.length > 0) {
      const lineH = 15;
      const startY = n.y + n.h / 2 - ((n.lines.length - 1) * lineH) / 2 + 4;
      n.lines.forEach((ln, i) => {
        body.push(textEl(n.x + n.w / 2, startY + i * lineH, ln, pal.text, 12));
      });
    }
  }

  const defs = `<defs>`
    + `<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">`
    + `<path d="M 0 0 L 10 5 L 0 10 z" fill="${pal.muted}"/></marker>`
    + `<marker id="arrowAccent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">`
    + `<path d="M 0 0 L 10 5 L 0 10 z" fill="${pal.accent}"/></marker>`
    + `</defs>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(layout.width)}" height="${Math.ceil(layout.height)}" `
    + `viewBox="0 0 ${Math.ceil(layout.width)} ${Math.ceil(layout.height)}" role="img">`
    + defs + body.join('') + '</svg>';
}
