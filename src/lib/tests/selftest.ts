/**
 * Kendi kendini test etme: beklenen çıktı veya referans çözüm olmadan
 * algoritmayı rastgele girdilerle çalıştırır ve çalışma hatalarını toplar.
 *
 * Doğruluk kontrolü yapmaz; yalnızca çökme, sonsuz döngü, dizi sınırı,
 * tanımsız değişken, sıfıra bölme gibi durumları yakalar.
 */

import type { AlgoIssue } from '../lang/messages';
import { prepare, runPrepared } from '../interp/run';
import { generateInputs, mulberry32 } from './random';

export interface SelfTestFailure {
  trial: number;
  inputs: string[];
  error: AlgoIssue;
  output: string;
}

export type SelfTestOutcome =
  | { kind: 'invalid'; issues: AlgoIssue[] }
  | {
      kind: 'fuzz';
      trials: number;
      passed: number;
      failures: SelfTestFailure[];
      /** Hatasız biten ama hiç çıktı üretmeyen deneme sayısı. */
      noOutput: number;
    };

/** Tek denemede verilecek taban girdi sayısı. */
const BASE_INPUTS = 40;
/** Girdi yetmezse aynı deneme için verilecek ek girdi sayısı. */
const EXTRA_INPUTS = 460;

export function fuzzAlgorithm(
  source: string,
  trials: number,
  seed: number,
  maxSteps: number,
  maxOutput: number,
): SelfTestOutcome {
  const prepared = prepare(source);
  if (!prepared.ok) return { kind: 'invalid', issues: prepared.errors };

  const rng = mulberry32(seed || 1);
  const failures: SelfTestFailure[] = [];
  let noOutput = 0;

  for (let t = 0; t < trials; t++) {
    let inputs = generateInputs(rng, BASE_INPUTS);
    let result = runPrepared(prepared, inputs, { maxSteps, maxOutput });

    // Algoritma daha fazla girdi istiyorsa denemeyi büyütüp yinele.
    if (result.status === 'error' && result.error?.code === 'E_INPUT_EOF') {
      inputs = [...inputs, ...generateInputs(rng, EXTRA_INPUTS)];
      result = runPrepared(prepared, inputs, { maxSteps, maxOutput });
    }

    if (result.status === 'error') {
      failures.push({
        trial: t + 1,
        inputs,
        error: result.error ?? { line: 1, label: null, code: 'E_UNKNOWN' },
        output: result.output.join('\n'),
      });
      continue;
    }
    if (result.output.length === 0) noOutput++;
  }

  return { kind: 'fuzz', trials, passed: trials - failures.length, failures, noOutput };
}
