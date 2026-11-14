/**
 * Kontrol akış grafiği (CFG).
 *
 * Düz komut listesinden düğüm/kenar grafiği üretir. `if` kararları, `goto`
 * sıçramaları ve geri dönüşler (döngüler) burada tek yerde çözülür. Akış
 * şeması yerleşimi bu grafiği kullanır.
 */

import type { Compiled, Instr } from '../lang/compiler';

export type CfgKind = 'start' | 'end' | 'decision' | 'process' | 'input' | 'output' | 'merge';

export interface CfgNode {
  id: string;
  kind: CfgKind;
  /** Komut sırası; sentetik düğümlerde null. */
  pc: number | null;
  /** Kaynak satır numarası. */
  line: number;
  /** Basamak etiketi. */
  label: string | null;
  /** Akış şemasında ifade modunda gösterilecek metin. */
  text: string;
}

export type CfgEdgeKind = 'seq' | 'yes' | 'no' | 'jump' | 'loop';

export interface CfgEdge {
  from: string;
  to: string;
  kind: CfgEdgeKind;
  /** Geri dönüş (döngü) kenarı mı? */
  back: boolean;
}

export interface Cfg {
  nodes: CfgNode[];
  edges: CfgEdge[];
  startId: string;
  endId: string;
}

const START = '__start';
const END = '__end';

function instrKind(ins: Instr): CfgKind {
  switch (ins.op) {
    case 'jf': return 'decision';
    case 'print': return 'output';
    case 'input': return 'input';
    default: return 'process';
  }
}

export function buildCfg(compiled: Compiled, startText = 'Başla', endText = 'Dur'): Cfg {
  const code = compiled.code;
  const nodes: CfgNode[] = [];
  const edges: CfgEdge[] = [];
  const byPc = new Map<number, CfgNode>();

  const startNop = code.findIndex((i) => i.op === 'nop' && i.what === 'start');
  const endNop = code.findIndex((i) => i.op === 'nop' && i.what === 'stop');

  nodes.push({ id: START, kind: 'start', pc: null, line: code[startNop]?.line ?? 1, label: null, text: startText });
  nodes.push({ id: END, kind: 'end', pc: null, line: code[endNop]?.line ?? code[code.length - 1]?.line ?? 1, label: null, text: endText });

  code.forEach((ins, pc) => {
    if (ins.op === 'nop' && (ins.what === 'start' || ins.what === 'stop' || ins.what === 'empty')) return;
    const node: CfgNode = {
      id: `n${pc}`, kind: instrKind(ins), pc, line: ins.line, label: ins.label,
      text: ins.text,
    };
    nodes.push(node);
    byPc.set(pc, node);
  });

  const nodeId = (pc: number): string => {
    if (pc >= code.length) return END;
    if (pc < 0) return START;
    if (pc === startNop) return START;
    if (pc === endNop) return END;
    // Boş/başla/dur komutlarını atlayarak bir sonraki gerçek düğüme geç.
    for (let i = pc; i < code.length; i++) {
      const n = byPc.get(i);
      if (n) return n.id;
    }
    return END;
  };

  edges.push({ from: START, to: nodeId(startNop >= 0 ? startNop + 1 : 0), kind: 'seq', back: false });

  code.forEach((ins, pc) => {
    const from = nodeId(pc);
    if (ins.op === 'nop' && (ins.what === 'start' || ins.what === 'stop' || ins.what === 'empty')) return;

    if (ins.op === 'jf') {
      const fall = nodeId(pc + 1);
      const target = nodeId(ins.target);
      edges.push({ from, to: fall, kind: 'yes', back: false });
      edges.push({ from, to: target, kind: 'no', back: ins.target <= pc });
      return;
    }
    if (ins.op === 'jmp' || ins.op === 'goto') {
      const target = nodeId(ins.target);
      edges.push({ from, to: target, kind: 'jump', back: ins.target <= pc });
      return;
    }
    if (pc === code.length - 1) {
      edges.push({ from, to: END, kind: 'seq', back: false });
      return;
    }
    edges.push({ from, to: nodeId(pc + 1), kind: 'seq', back: false });
  });

  // Aynı düğüme gelen çoklu ileri kenarlar için birleşme (merge) düğümü.
  const forwardIn = new Map<string, CfgEdge[]>();
  for (const e of edges) {
    if (e.back) continue;
    const list = forwardIn.get(e.to) ?? [];
    list.push(e);
    forwardIn.set(e.to, list);
  }
  for (const [targetId, list] of forwardIn) {
    if (list.length < 2) continue;
    if (targetId === START || targetId === END) continue;
    const target = nodes.find((n) => n.id === targetId);
    if (!target) continue;
    const mergeId = `m_${targetId}`;
    for (const e of list) e.to = mergeId;
    edges.push({ from: mergeId, to: targetId, kind: 'seq', back: false });
    nodes.push({
      id: mergeId, kind: 'merge', pc: target.pc, line: target.line,
      label: target.label, text: '',
    });
  }

  return { nodes, edges, startId: START, endId: END };
}
