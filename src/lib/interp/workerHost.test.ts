import { describe, it, expect } from 'vitest';
import { createWorkerHost } from './workerHost';
import { clearKeywordAliases } from '../lang/keywords';
import type { FromWorker, StartMsg } from './protocol';

/**
 * Gerçek bir Worker ayrı bir modül örneğiyle başlar; ana iş parçacığında
 * ayarlanan takma adlar orada yoktur. Bunu taklit etmek için her test,
 * takma adları boşaltılmış bir dil katmanıyla başlar.
 */
function freshHost() {
  clearKeywordAliases();
  const out: FromWorker[] = [];
  return { out, handle: createWorkerHost((m) => { out.push(m); }) };
}

const ALIAS_SRC = `1- Başla
2- Veri Al (n)
3- Print (n)
4- Dur.`;

const LIMITS = { maxSteps: 10_000, maxOutput: 1_000 };

function startMsg(source: string, over: Partial<StartMsg> = {}): StartMsg {
  return {
    cmd: 'start', source, inputs: [], ...LIMITS,
    stepMode: false, allowPrompt: false, breakpoints: [], inputAliases: [],
    ...over,
  };
}

function doneResult(out: FromWorker[]) {
  const done = out.find((m) => m.kind === 'done');
  if (!done || done.kind !== 'done') throw new Error('done mesajı yok');
  return done.result;
}

describe('worker: çalıştırma', () => {
  it('basit bir programı çalıştırıp sonucu gönderir', () => {
    const { out, handle } = freshHost();
    handle(startMsg(`1- Başla
2- Print (1 + 2)
3- Dur.`));
    expect(doneResult(out).status).toBe('ok');
    expect(doneResult(out).output).toEqual(['3']);
  });
});

describe('worker: ek giriş takma adları', () => {
  it('çalıştırmada mesajla gelen takma adı tanır', () => {
    const { out, handle } = freshHost();
    handle(startMsg(ALIAS_SRC, { inputs: ['7'], inputAliases: ['Veri Al'] }));
    const r = doneResult(out);
    expect(r.error).toBe(null);
    expect(r.status).toBe('ok');
    expect(r.output).toEqual(['7']);
  });

  it('test partisinde mesajla gelen takma adı tanır', () => {
    const { out, handle } = freshHost();
    handle({
      cmd: 'testBatch', source: ALIAS_SRC, ...LIMITS, inputAliases: ['Veri Al'],
      cases: [{ name: 't1', inputs: ['7'] }],
    });
    const results = out.filter((m) => m.kind === 'testResult');
    expect(results).toHaveLength(1);
    expect(out[out.length - 1]).toEqual({ kind: 'testDone', count: 1 });
  });

  it('kendi kendini testte mesajla gelen takma adı tanır', () => {
    const { out, handle } = freshHost();
    handle({
      cmd: 'selfTest', source: ALIAS_SRC, referenceSource: null,
      trials: 3, seed: 1, ...LIMITS, inputAliases: ['Veri Al'],
    });
    const done = out.find((m) => m.kind === 'selfTestDone');
    expect(done && done.kind === 'selfTestDone' ? done.outcome.kind : 'yok').toBe('fuzz');
  });

  it('karşılaştırmada mesajla gelen takma adı tanır', () => {
    const { out, handle } = freshHost();
    handle({
      cmd: 'compare', sourceA: ALIAS_SRC, sourceB: ALIAS_SRC,
      trials: 3, seed: 1, ...LIMITS, inputAliases: ['Veri Al'],
    });
    const done = out.find((m) => m.kind === 'compareDone');
    expect(done && done.kind === 'compareDone' ? done.outcome.kind : 'yok').toBe('same');
  });

  it('takma ad gönderilmezse sözcük anahtar kelime sayılmaz', () => {
    const { out, handle } = freshHost();
    handle(startMsg(ALIAS_SRC, { inputs: ['7'], inputAliases: ['Veri Al'] }));
    out.length = 0;
    handle(startMsg(ALIAS_SRC, { inputs: ['7'], inputAliases: [] }));
    expect(doneResult(out).status).toBe('error');
  });
});

describe('worker: konsol çıktısı toplu gönderilir', () => {
  const LOOP = (n: number) => `1- Başla
2- i = 0
3- i++
4- Print (i)
5- if (i < ${n}) Then goto 3
6- Dur.`;

  function hostWithClock(clock: () => number) {
    clearKeywordAliases();
    const out: FromWorker[] = [];
    return { out, handle: createWorkerHost((m) => { out.push(m); }, clock) };
  }

  const printed = (out: FromWorker[]): string[] =>
    out.flatMap((m) => (m.kind === 'prints' ? m.texts : []));

  it('2000 satır, satır başına değil birkaç mesajla gider', () => {
    const { out, handle } = hostWithClock(() => 0);
    handle(startMsg(LOOP(2000), { maxSteps: 100_000, maxOutput: 10_000 }));
    const batches = out.filter((m) => m.kind === 'prints');
    expect(batches.length).toBeGreaterThan(0);
    expect(batches.length).toBeLessThanOrEqual(6);
    expect(out.some((m) => m.kind === 'event' && m.event.type === 'print')).toBe(false);
  });

  it('hiçbir satır kaybolmaz ve sıra korunur', () => {
    const { out, handle } = hostWithClock(() => 0);
    handle(startMsg(LOOP(2000), { maxSteps: 100_000, maxOutput: 10_000 }));
    expect(printed(out)).toEqual(Array.from({ length: 2000 }, (_, i) => String(i + 1)));
    expect(out[out.length - 1].kind).toBe('done');
  });

  it('süre dolmuşsa satır bekletilmeden gönderilir', () => {
    let t = 0;
    const { out, handle } = hostWithClock(() => (t += 100));
    handle(startMsg(LOOP(3)));
    expect(out.filter((m) => m.kind === 'prints')).toHaveLength(3);
    expect(printed(out)).toEqual(['1', '2', '3']);
  });

  it('adım modunda çıktı, sonraki duraklamadan önce ulaşır', () => {
    const { out, handle } = hostWithClock(() => 0);
    handle(startMsg(`1- Başla
2- Print ("a")
3- Print ("b")
4- Dur.`, { stepMode: true }));
    for (let i = 0; i < 10 && out[out.length - 1].kind !== 'done'; i++) {
      handle({ cmd: 'resume', resume: { cmd: 'step', breakpoints: [] } });
    }
    const kinds = out.map((m) => (m.kind === 'event' ? m.event.type : m.kind));
    const lastPrint = kinds.lastIndexOf('prints');
    expect(printed(out)).toEqual(['a', 'b']);
    expect(kinds[kinds.length - 1]).toBe('done');
    // "b" yazdırıldıktan sonra en az bir olay (duraklama veya bitiş) gelir; çıktı ondan önce gönderilmiştir.
    expect(lastPrint).toBeLessThan(kinds.length - 1);
    // her çıktı partisinden hemen sonra gelen mesaj bir duraklama ya da bitiştir
    kinds.forEach((k, i) => { if (k === 'prints') expect(['pause', 'done', 'prints']).toContain(kinds[i + 1]); });
  });

  it('çıktı limiti hatasında o ana kadarki satırlar yine gönderilir', () => {
    const { out, handle } = hostWithClock(() => 0);
    handle(startMsg(LOOP(2000), { maxSteps: 100_000, maxOutput: 10 }));
    const r = doneResult(out);
    expect(r.error?.code).toBe('E_OUTPUT_LIMIT');
    expect(printed(out)).toEqual(r.output);
  });
});
