/**
 * Test çıktısı karşılaştırma.
 * Kural: boşluk ve büyük/küçük harf duyarsız; sayılar 1e-9 toleransla.
 */

export interface OutputDiff {
  equal: boolean;
  /** İlk farklı tokenın sırası (0 tabanlı). */
  index: number;
  expectedToken: string | null;
  actualToken: string | null;
  /** Karşılaştırılan token dizileri (UI'da işaretleme için). */
  expectedTokens: string[];
  actualTokens: string[];
}

const NUM_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

export function tokenizeOutput(s: string): string[] {
  const t = s.trim();
  return t === '' ? [] : t.split(/\s+/);
}

function lower(s: string): string {
  return s.toLocaleLowerCase();
}

function numeric(s: string): number | null {
  if (!NUM_RE.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function tokensEqual(a: string, b: string): boolean {
  const na = numeric(a);
  const nb = numeric(b);
  if (na !== null && nb !== null) return Math.abs(na - nb) <= 1e-9;
  return lower(a) === lower(b);
}

export function compareOutputs(expected: string, actual: string): OutputDiff {
  const et = tokenizeOutput(expected);
  const at = tokenizeOutput(actual);
  const n = Math.min(et.length, at.length);
  for (let i = 0; i < n; i++) {
    if (!tokensEqual(et[i], at[i])) {
      return {
        equal: false, index: i,
        expectedToken: et[i], actualToken: at[i],
        expectedTokens: et, actualTokens: at,
      };
    }
  }
  if (et.length !== at.length) {
    return {
      equal: false, index: n,
      expectedToken: et[n] ?? null, actualToken: at[n] ?? null,
      expectedTokens: et, actualTokens: at,
    };
  }
  return {
    equal: true, index: -1, expectedToken: null, actualToken: null,
    expectedTokens: et, actualTokens: at,
  };
}
