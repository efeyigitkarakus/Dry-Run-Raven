import { describe, it, expect } from 'vitest';
import { PROBLEMS, splitInputs } from './index';
import { prepare, runSync } from '../interp/run';
import { compareOutputs } from '../tests/compare';

describe('soru bankası', () => {
  it('27 soru içerir ve kimlikler benzersizdir', () => {
    expect(PROBLEMS).toHaveLength(27);
    const ids = new Set(PROBLEMS.map((p) => p.id));
    expect(ids.size).toBe(27);
    for (let i = 1; i <= 27; i++) expect(ids.has(i)).toBe(true);
  });

  it('her sorunun TR/EN metni, testi ve çözümü vardır', () => {
    for (const p of PROBLEMS) {
      expect(p.textTr.length).toBeGreaterThan(10);
      expect(p.textEn.length).toBeGreaterThan(10);
      expect(p.tests.length).toBeGreaterThan(0);
      expect(p.solution).toContain('Başla');
      expect(p.solution).toContain('Dur');
      const prepared = prepare(p.solution);
      expect(prepared.ok, `#${p.id} derlenemedi: ${prepared.errors.map((e) => e.code).join(',')}`).toBe(true);
      expect(prepared.errors).toEqual([]);
    }
  });

  it('tüm referans çözümler kendi testlerini geçer', () => {
    for (const p of PROBLEMS) {
      for (const t of p.tests) {
        const r = runSync(p.solution, splitInputs(t.inputs), {
          maxSteps: 1_000_000, maxOutput: 10_000,
        });
        expect(r.status, `#${p.id} "${t.name}" çalışmadı: ${r.error?.code ?? ''}`).toBe('ok');
        const diff = compareOutputs(t.expected, r.output.join('\n'));
        expect(diff.equal, `#${p.id} "${t.name}" beklenen=${JSON.stringify(t.expected)} gerçek=${JSON.stringify(r.output.join('\n'))}`).toBe(true);
      }
    }
  });
});
