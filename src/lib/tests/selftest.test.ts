import { describe, expect, it } from 'vitest';
import { fuzzAlgorithm } from './selftest';

describe('self-test', () => {
  it('passes a simple algorithm with random inputs', () => {
    const src = '1- Başla\n2- Sayı Gir (n)\n3- Print (n * 2)\n4- Dur.';
    const o = fuzzAlgorithm(src, 8, 7, 50_000, 1_000);
    expect(o.kind).toBe('fuzz');
    if (o.kind !== 'fuzz') return;
    expect(o.failures).toEqual([]);
    expect(o.passed).toBe(8);
  });

  it('reports an infinite loop', () => {
    const src = '1- Başla\n2- say = 0\n3- say = say + 1\n4- Goto 3\n5- Dur.';
    const o = fuzzAlgorithm(src, 3, 1, 5_000, 1_000);
    expect(o.kind).toBe('fuzz');
    if (o.kind !== 'fuzz') return;
    expect(o.failures).toHaveLength(3);
    expect(o.failures[0].error.code).toBe('E_STEP_LIMIT');
  });

  it('reports out-of-range array access', () => {
    const src = '1- Başla\n2- Dizi A[10]\n3- Sayı Gir (j)\n4- Sayı Gir (i)\n5- A[i] = 1\n6- Print (A[i])\n7- Dur.';
    const o = fuzzAlgorithm(src, 30, 9, 50_000, 1_000);
    expect(o.kind).toBe('fuzz');
    if (o.kind !== 'fuzz') return;
    expect(o.failures.some((f) =>
      f.error.code === 'E_INDEX_RANGE' || f.error.code === 'E_INDEX_NEGATIVE')).toBe(true);
  });

  it('reports a syntax error instead of running', () => {
    const o = fuzzAlgorithm('1- Başla\n2- x = \n3- Dur.', 3, 1, 1_000, 100);
    expect(o.kind).toBe('invalid');
  });
});
