/**
 * Kullanıcı ayarları. localStorage'da tutulur; internet yok.
 */

import { addKeywordAlias, clearKeywordAliases } from './lang/keywords';

export interface Settings {
  autoNumber: boolean;
  theme: 'system' | 'light' | 'dark';
  lang: 'tr' | 'en';
  maxSteps: number;
  maxOutput: number;
  /** "Sayı Gir" yerine kabul edilecek ek adlar. */
  inputAliases: string[];
  /** Akış şeması varsayılan gösterimi. */
  flowMode: 'number' | 'expr';
  /** Geri dönüş etiketini altıgen içinde çiz. */
  loopHex: boolean;
  compareTrials: number;
}

export const DEFAULT_SETTINGS: Settings = {
  autoNumber: true,
  theme: 'system',
  lang: 'tr',
  maxSteps: 1_000_000,
  maxOutput: 10_000,
  inputAliases: [],
  flowMode: 'number',
  loopHex: false,
  compareTrials: 20,
};

const KEY = 'drr:settings:v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* kota dolu olabilir */ }
}

/** Dil katmanına ek giriş adlarını uygular (uygulama açılışında ve ayarda). */
export function applyInputAliases(aliases: string[]): void {
  clearKeywordAliases();
  for (const a of aliases) {
    const w = a.trim();
    if (w) addKeywordAlias('giris', w);
  }
}
