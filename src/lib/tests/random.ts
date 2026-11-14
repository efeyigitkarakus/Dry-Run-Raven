/**
 * Referans karşılaştırma için rastgele girdi üretimi ve iki algoritmanın
 * karşılaştırılması. Tohum verilebilir; aynı tohum aynı denemeleri üretir.
 */

import { prepare, runPrepared } from '../interp/run';
import type { RunResult } from '../interp/types';
import type { AlgoIssue } from '../lang/messages';
import { compareOutputs } from './compare';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Soru tiplerinin çoğunu kapsayacak şekilde 30 değer üretir:
 * sıfırlar, negatifler, tekrarlar ve 0–200 aralığı.
 */
export function generateInputs(rng: () => number, count = 30): string[] {
  const out: string[] = [];
  let prev = 0;
  for (let i = 0; i < count; i++) {
    let v: number;
    if (i % 9 === 0) v = 0;
    else if (i % 7 === 0) v = -1 - Math.floor(rng() * 60);
    else if (i % 11 === 0) v = prev; // eşitlik / tekrar
    else v = Math.floor(rng() * 201) - 40;
    out.push(String(v));
    prev = v;
  }
  return out;
}

export interface CompareSummary {
  outcome:
    | { kind: 'mismatch'; trial: number; inputs: string[]; outA: string; outB: string; errA: string | null; errB: string | null }
    | { kind: 'same'; trials: number; sampleInputs: string[] }
    | { kind: 'invalid'; issues: AlgoIssue[]; which: 'a' | 'b' };
  trialsRun: number;
}

function errCode(r: RunResult): string | null {
  return r.status === 'error' ? (r.error?.code ?? 'E_UNKNOWN') : null;
}

export function compareAlgorithms(
  sourceA: string,
  sourceB: string,
  trials: number,
  seed: number,
  maxSteps: number,
  maxOutput: number,
): CompareSummary {
  const a = prepare(sourceA);
  if (!a.ok) return { outcome: { kind: 'invalid', issues: a.errors, which: 'a' }, trialsRun: 0 };
  const b = prepare(sourceB);
  if (!b.ok) return { outcome: { kind: 'invalid', issues: b.errors, which: 'b' }, trialsRun: 0 };

  const rng = mulberry32(seed);
  let sample: string[] = [];
  for (let t = 0; t < trials; t++) {
    const inputs = generateInputs(rng);
    if (t === 0) sample = inputs;
    const ra = runPrepared(a, inputs, { maxSteps, maxOutput });
    const rb = runPrepared(b, inputs, { maxSteps, maxOutput });
    const ea = errCode(ra);
    const eb = errCode(rb);
    let same: boolean;
    if (ea || eb) {
      same = ea === eb;
    } else {
      same = compareOutputs(ra.output.join('\n'), rb.output.join('\n')).equal;
    }
    if (!same) {
      return {
        outcome: {
          kind: 'mismatch', trial: t + 1, inputs,
          outA: ra.output.join('\n'), outB: rb.output.join('\n'), errA: ea, errB: eb,
        },
        trialsRun: t + 1,
      };
    }
  }
  return { outcome: { kind: 'same', trials, sampleInputs: sample }, trialsRun: trials };
}
