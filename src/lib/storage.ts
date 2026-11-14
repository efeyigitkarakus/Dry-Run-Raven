/**
 * Son çalışma taslağı. localStorage'da tek anahtar; internet/telemetri yok.
 */

import type { TestScenario } from './tests/types';
import type { Problem } from './problems';

export interface Draft {
  version: 1;
  source: string;
  tests: TestScenario[];
  problemId: number | null;
  inputQueue: string;
  path: string | null;
  fileName: string;
  savedAt: number;
}

const KEY = 'drr:draft:v1';

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    if (d.version !== 1 || typeof d.source !== 'string') return null;
    return {
      version: 1,
      source: d.source,
      tests: Array.isArray(d.tests) ? d.tests : [],
      problemId: typeof d.problemId === 'number' ? d.problemId : null,
      inputQueue: typeof d.inputQueue === 'string' ? d.inputQueue : '',
      path: typeof d.path === 'string' ? d.path : null,
      fileName: typeof d.fileName === 'string' ? d.fileName : '',
      savedAt: typeof d.savedAt === 'number' ? d.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function saveDraft(d: Omit<Draft, 'version' | 'savedAt'>): void {
  try {
    const full: Draft = { ...d, version: 1, savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(full));
  } catch {
    /* kota dolabilir; sessizce geç */
  }
}

const USER_KEY = 'drr:user-problems:v1';

export function loadUserProblems(): Problem[] {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Problem[];
    return Array.isArray(list) ? list.filter((p) => p && typeof p.id === 'number') : [];
  } catch {
    return [];
  }
}

export function saveUserProblems(list: Problem[]): void {
  try { localStorage.setItem(USER_KEY, JSON.stringify(list)); } catch { /* kota */ }
}
