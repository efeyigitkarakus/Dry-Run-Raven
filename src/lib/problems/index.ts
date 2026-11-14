/**
 * Soru bankası: 27 hazır soru (TR/EN metin, test senaryoları, gizli çözüm).
 * Veri `problems.json` içindedir; kullanıcı soruları localStorage'da tutulur.
 */

import raw from './problems.json';

export interface ProblemTest {
  name: string;
  /** Boşluk/satır ayrılmış girdiler. */
  inputs: string;
  /** Beklenen çıktı (satırlar \n ile). */
  expected: string;
}

export interface Problem {
  id: number;
  titleTr: string;
  titleEn: string;
  textTr: string;
  textEn: string;
  tests: ProblemTest[];
  solution: string;
  /** Kullanıcı tarafından eklendiyse true. */
  user?: boolean;
}

export const PROBLEMS: Problem[] = raw as Problem[];

export function getProblem(id: number): Problem | undefined {
  return PROBLEMS.find((p) => p.id === id);
}

/** Soru seçildiğinde editöre yüklenen iskelet. */
export function skeletonFor(_problem: Problem): string {
  return ['1- Başla', '2- // Çözümünüzü buraya yazın', '3- Dur.'].join('\n');
}

export function splitInputs(s: string): string[] {
  const t = s.trim();
  return t === '' ? [] : t.split(/\s+/);
}
