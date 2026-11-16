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
