/**
 * Akış şeması yerleşimi (saf hesaplama, DOM yok).
 *
 * Katmanlı yerleşim: ileri kenarlar yukarıdan aşağı, geri dönüşler (döngüler)
 * sol kenardan, uzun ileri atlamalar sağ kenardan yönlendirilir.
 */

import type { Cfg, CfgEdge, CfgNode } from '../cfg';
import { wrapText } from './text';

export type FlowMode = 'number' | 'expr';

export interface FlowOptions {
  mode: FlowMode;
  loopHex: boolean;
  yesLabel: string;
  noLabel: string;
  loopLabel: string;
  activeLine?: number | null;
}

export interface FlowNodeBox {
  id: string;
  kind: CfgNode['kind'];
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  active: boolean;
}

export interface FlowEdgeBox {
  from: string;
  to: string;
  kind: CfgEdge['kind'];
  points: { x: number; y: number }[];
  label: string | null;
  labelX: number;
  labelY: number;
  back: boolean;
}

export interface FlowLayout {
  nodes: FlowNodeBox[];
  edges: FlowEdgeBox[];
  width: number;
  height: number;
  /** Döngü etiketi altıgen çizilecek mi? */
  loopHex: boolean;
}

const NODE_W = 210;
const DEC_W = 180;
const OVAL_W = 140;
const MERGE_R = 7;
const V_GAP = 30;
const COL_GAP = 76;
const MARGIN = 56;

function nodeWidth(kind: CfgNode['kind']): number {
  if (kind === 'start' || kind === 'end') return OVAL_W;
  if (kind === 'decision') return DEC_W;
  if (kind === 'merge') return MERGE_R * 2;
  return NODE_W;
}

function nodeLines(node: CfgNode, mode: FlowMode): string[] {
  if (node.kind === 'merge') return [];
  if (node.kind === 'start' || node.kind === 'end') return [node.text];
  const text = mode === 'expr' ? (node.text || node.label || '') : (node.label ?? String(node.line));
  return wrapText(text, node.kind === 'decision' ? 19 : 28);
}

function nodeHeight(kind: CfgNode['kind'], lineCount: number): number {
  if (kind === 'start' || kind === 'end') return 38;
  if (kind === 'merge') return MERGE_R * 2;
  if (kind === 'decision') return Math.max(62, lineCount * 15 + 30);
  return Math.max(38, lineCount * 15 + 16);
}

function sortKey(node: CfgNode): number {
  if (node.id === '__start') return -2;
  if (node.id === '__end') return Number.MAX_SAFE_INTEGER;
  if (node.kind === 'merge') return (node.pc ?? 0) - 0.5;
  return node.pc ?? 0;
}

export function layoutFlow(cfg: Cfg, opts: FlowOptions): FlowLayout {
  const byId = new Map(cfg.nodes.map((n) => [n.id, n]));
  const layers = new Map<string, number>();
  layers.set(cfg.startId, 0);

  const forward = cfg.edges.filter((e) => !e.back);
  // Gevşetme (relaxation): döngüsel olmayan ileri grafikte en uzun yol.
  const limit = cfg.nodes.length + 4;
  for (let pass = 0; pass < limit; pass++) {
    let changed = false;
    for (const e of forward) {
      const a = layers.get(e.from);
      if (a === undefined) continue;
      const want = a + 1;
      const cur = layers.get(e.to);
      if (cur === undefined || want > cur) {
        layers.set(e.to, want);
        changed = true;
      }
    }
    if (!changed) break;
  }
  for (const n of cfg.nodes) if (!layers.has(n.id)) layers.set(n.id, 0);

  const byLayer = new Map<number, CfgNode[]>();
  for (const n of cfg.nodes) {
    const l = layers.get(n.id)!;
    const list = byLayer.get(l) ?? [];
    list.push(n);
    byLayer.set(l, list);
  }

  const ordered = [...byLayer.keys()].sort((a, b) => a - b);
  const yOf = new Map<number, number>();
  const rowH = new Map<number, number>();
  let y = MARGIN;
  for (const l of ordered) {
    const list = byLayer.get(l)!;
    let maxH = 0;
    for (const n of list) {
      const h = nodeHeight(n.kind, nodeLines(n, opts.mode).length);
      if (h > maxH) maxH = h;
    }
    yOf.set(l, y);
    rowH.set(l, maxH);
    y += maxH + V_GAP;
  }
  const contentH = y - V_GAP + MARGIN;

  const boxes = new Map<string, FlowNodeBox>();
  for (const l of ordered) {
    const list = byLayer.get(l)!.slice().sort((a, b) => sortKey(a) - sortKey(b));
    const widths = list.map((n) => nodeWidth(n.kind));
    const total = widths.reduce((s, w) => s + w, 0) + Math.max(0, list.length - 1) * COL_GAP;
    let x = -total / 2;
    const rowY = yOf.get(l)!;
    const maxH = rowH.get(l)!;
    list.forEach((n, i) => {
      const w = widths[i];
      const lines = nodeLines(n, opts.mode);
      const h = nodeHeight(n.kind, lines.length);
      boxes.set(n.id, {
        id: n.id, kind: n.kind, x, y: rowY + (maxH - h) / 2,
        w, h, lines, active: false,
      });
      x += w + COL_GAP;
    });
  }

  // Geri dönüşlerin hepsi sol tarafta kalsın diye ek sol boşluk.
  const backTotal = cfg.edges.filter((e) => e.back).length;
  const extraLeft = backTotal > 1 ? backTotal * 16 : 0;

  // Bounding box → pozitif koordinatlar.
  let minX = Infinity;
  let maxX = -Infinity;
  for (const b of boxes.values()) {
    if (b.x < minX) minX = b.x;
    if (b.x + b.w > maxX) maxX = b.x + b.w;
  }
  if (!Number.isFinite(minX)) { minX = 0; maxX = 0; }
  const shift = MARGIN - minX + extraLeft;

  const outNodes: FlowNodeBox[] = [];
  for (const b of boxes.values()) {
    b.x += shift;
    if (opts.activeLine != null && nodeLine(cfg, b.id) === opts.activeLine) b.active = true;
    outNodes.push(b);
  }
  const contentW = maxX - minX;

  const edges: FlowEdgeBox[] = [];
  let backCount = 0;
  let longCount = 0;
  const minShifted = MARGIN + extraLeft;
  const maxShifted = contentW + MARGIN + extraLeft;

  const centerY = (b: FlowNodeBox): number => b.y + b.h / 2;
  const bottom = (b: FlowNodeBox): { x: number; y: number } => ({ x: b.x + b.w / 2, y: b.y + b.h });
  const top = (b: FlowNodeBox): { x: number; y: number } => ({ x: b.x + b.w / 2, y: b.y });
  const left = (b: FlowNodeBox): { x: number; y: number } => ({ x: b.x, y: centerY(b) });
  const right = (b: FlowNodeBox): { x: number; y: number } => ({ x: b.x + b.w, y: centerY(b) });

  for (const e of cfg.edges) {
    const a = boxes.get(e.from);
    const b = boxes.get(e.to);
    if (!a || !b) continue;
    const layerA = layers.get(e.from) ?? 0;
    const layerB = layers.get(e.to) ?? 0;

    let points: { x: number; y: number }[];
    let label: string | null = null;
    let labelX = 0;
    let labelY = 0;

    if (e.back) {
      backCount++;
      const lx = minShifted - 30 - backCount * 16;
      const p1 = left(a);
      const p2 = left(b);
      const midY = (p1.y + p2.y) / 2;
      points = [p1, { x: lx, y: p1.y }, { x: lx, y: p2.y }, p2];
      label = opts.loopLabel;
      labelX = lx;
      labelY = midY;
    } else if (layerB > layerA + 1) {
      longCount++;
      const rx = maxShifted + 30 + longCount * 16;
      const p1 = right(a);
      const p2 = right(b);
      points = [p1, { x: rx, y: p1.y }, { x: rx, y: p2.y }, p2];
      if (e.kind === 'no') {
        label = opts.noLabel;
        labelX = (p1.x + rx) / 2;
        labelY = p1.y - 5;
      }
    } else {
      const p1 = bottom(a);
      const p2 = top(b);
      points = [p1, p2];
      if (e.kind === 'yes' || e.kind === 'no') {
        label = e.kind === 'yes' ? opts.yesLabel : opts.noLabel;
        labelX = (p1.x + p2.x) / 2 + (e.kind === 'yes' ? -10 : 10);
        labelY = (p1.y + p2.y) / 2 + 4;
      }
    }

    edges.push({
      from: e.from, to: e.to, kind: e.kind, points,
      label, labelX, labelY, back: e.back,
    });
  }

  const width = contentW + MARGIN * 2 + extraLeft + longCount * 16 + 36;
  const height = contentH + 8;
  return { nodes: outNodes, edges, width, height, loopHex: opts.loopHex };
}

function nodeLine(cfg: Cfg, id: string): number | null {
  return cfg.nodes.find((n) => n.id === id)?.line ?? null;
}
