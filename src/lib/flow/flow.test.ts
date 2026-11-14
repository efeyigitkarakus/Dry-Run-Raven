import { describe, expect, it } from 'vitest';
import { parse } from '../lang/parser';
import { compile } from '../lang/compiler';
import { buildCfg } from '../cfg';
import { layoutFlow } from './layout';
import { renderFlowSvg } from './svg';
import { wrapText } from './text';

function cfgOf(source: string) {
  const p = parse(source);
  expect(p.issues.filter((i) => i.code.startsWith('E_'))).toEqual([]);
  const c = compile(p.program);
  return buildCfg(c);
}

const LOOP = [
  '1- Başla',
  '2- i = 0',
  '3- if (i < 3) Then',
  '4-     Print (i)',
  '5-     i++',
  '6-     Goto 3',
  '7- Dur.',
].join('\n');

const BRANCH = [
  '1- Başla',
  '2- Sayı Gir (n)',
  '3- if (n > 0) Then',
  '4-     Print ("artı")',
  '5- else',
  '6-     Print ("eksi")',
  '7- Print ("bitti")',
  '8- Dur.',
].join('\n');

describe('CFG', () => {
  it('start ve end düğümlerini üretir', () => {
    const cfg = cfgOf(LOOP);
    const start = cfg.nodes.find((n) => n.id === cfg.startId);
    const end = cfg.nodes.find((n) => n.id === cfg.endId);
    expect(start?.kind).toBe('start');
    expect(end?.kind).toBe('end');
  });

  it('geri dönüş goto kenarını döngü olarak işaretler', () => {
    const cfg = cfgOf(LOOP);
    expect(cfg.edges.some((e) => e.back && e.kind === 'jump')).toBe(true);
  });

  it('if/else kararında iki etiketli kenar vardır', () => {
    const cfg = cfgOf(BRANCH);
    const decision = cfg.nodes.find((n) => n.kind === 'decision');
    expect(decision).toBeTruthy();
    const edges = cfg.edges.filter((e) => e.from === decision!.id);
    expect(edges.map((e) => e.kind).sort()).toEqual(['no', 'yes']);
    expect(cfg.nodes.some((n) => n.kind === 'merge')).toBe(true);
  });

  it('her düğüm başlangıçtan erişilebilir', () => {
    const cfg = cfgOf(BRANCH);
    const seen = new Set<string>([cfg.startId]);
    const queue = [cfg.startId];
    while (queue.length) {
      const id = queue.shift()!;
      for (const e of cfg.edges) {
        if (e.from === id && !seen.has(e.to)) { seen.add(e.to); queue.push(e.to); }
      }
    }
    expect(seen.size).toBe(cfg.nodes.length);
  });
});

describe('akış şeması yerleşimi', () => {
  it('sonlu koordinatlar ve geri kenar üretir', () => {
    const layout = layoutFlow(cfgOf(LOOP), {
      mode: 'number', loopHex: true, yesLabel: 'E', noLabel: 'H', loopLabel: 'Döngü',
    });
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
    for (const n of layout.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
      expect(Number.isFinite(n.w)).toBe(true);
      expect(Number.isFinite(n.h)).toBe(true);
    }
    for (const e of layout.edges) {
      for (const p of e.points) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }
    }
    expect(layout.edges.some((e) => e.back)).toBe(true);
  });

  it('birden çok döngü kenarı sol boşlukta kalır', () => {
    const twoLoops = [
      '1- Başla',
      '2- i = 0',
      '3- if (i < 2) Then',
      '4-     i++',
      '5-     Goto 3',
      '6- j = 0',
      '7- if (j < 2) Then',
      '8-     j++',
      '9-     Goto 7',
      '10- Dur.',
    ].join('\n');
    const layout = layoutFlow(cfgOf(twoLoops), {
      mode: 'number', loopHex: true, yesLabel: 'E', noLabel: 'H', loopLabel: 'Döngü',
    });
    const backs = layout.edges.filter((e) => e.back);
    expect(backs.length).toBeGreaterThanOrEqual(2);
    for (const e of backs) {
      expect(e.label).toBe('Döngü');
      expect(e.labelX).toBeGreaterThan(20);
      for (const p of e.points) expect(p.x).toBeGreaterThanOrEqual(0);
    }
  });

  it('SVG çıktısı şekilleri ve oku içerir', () => {
    const layout = layoutFlow(cfgOf(BRANCH), {
      mode: 'expr', loopHex: false, yesLabel: 'Y', noLabel: 'N', loopLabel: 'Loop',
    });
    const svg = renderFlowSvg(layout, {
      bg: '#fff', border: '#000', text: '#000', muted: '#444',
      accent: '#6B4FBB', accentSoft: '#eee',
    });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('marker-end');
    expect(svg).toContain('<polygon');
    expect(svg).toContain('artı');
  });

  it('ifade modu komut metnini kullanır', () => {
    const cfg = cfgOf(LOOP);
    const num = layoutFlow(cfg, { mode: 'number', loopHex: false, yesLabel: 'E', noLabel: 'H', loopLabel: 'D' });
    const expr = layoutFlow(cfg, { mode: 'expr', loopHex: false, yesLabel: 'E', noLabel: 'H', loopLabel: 'D' });
    expect(num.nodes.some((n) => n.lines.includes('Print (i)'))).toBe(false);
    expect(expr.nodes.some((n) => n.lines.includes('Print (i)'))).toBe(true);
  });
});

describe('metin sarma', () => {
  it('boş metni boş dizi yapar', () => {
    expect(wrapText('', 10)).toEqual([]);
  });
  it('uzun metni satırlara böler', () => {
    const lines = wrapText('bu uzun bir açıklama metnidir', 12);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(12);
  });
});
