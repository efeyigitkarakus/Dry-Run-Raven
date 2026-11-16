import { describe, it, expect } from 'vitest';
import { parse } from './parser';
import { compile } from './compiler';
import { runSync, prepare } from '../interp/run';
import { compareOutputs } from '../tests/compare';

function run(src: string, inputs: string[] = [], maxSteps = 200_000) {
  return runSync(src, inputs, { maxSteps, maxOutput: 1000, history: true });
}

describe('lexer toleransı', () => {
  it('say + + ve = = yazımlarını kabul eder', () => {
    const src = `1- Başla
2- say = 0
3- say + + 
4- if (say = = 1) Then say + + 
5- Print (say)
6- Dur.`;
    const r = run(src);
    expect(r.status).toBe('ok');
    expect(r.output).toEqual(['2']);
  });

  it('İf / IF / if ve Türkçe karakterli değişkenleri eşler', () => {
    const src = `1- Başla
2- EBSay = 3
3- İf (ebsay == 3) Then Print ("ok")
4- IF (EBSAY = = 3) Then Print ("ok2")
5- Dur.`;
    const r = run(src);
    expect(r.status).toBe('ok');
    expect(r.output).toEqual(['ok', 'ok2']);
  });

  it('Türkçe tırnakları ve → yorumunu işler', () => {
    const src = `1- Başla
2- Print (“merhaba”) → bu bir yorum
3- Dur.`;
    const r = run(src);
    expect(r.status).toBe('ok');
    expect(r.output).toEqual(['merhaba']);
  });
});

describe('parser', () => {
  it('virgüllü çok deyimi ve parantez içi virgülleri ayırır', () => {
    const src = `1- Başla
2- A = 1, B = 2
3- Print (A, B)
4- Print (3, 5)
5- Dur.`;
    const r = run(src);
    expect(r.output).toEqual(['1 2', '3 5']);
  });

  it('Then sonrası alt etiketi tanır ve atlar', () => {
    const src = `1- Başla
2- A = -5, T = 0
3- if (A < 0) Then 3.1 T = T + A
4- Print (T)
5- Dur.`;
    const p = parse(src);
    expect(p.issues.filter((i) => i.code.startsWith('E_'))).toEqual([]);
    const c = compile(p.program);
    expect(c.labels.get('3.1')).toBeTypeOf('number');
    expect(run(src).output).toEqual(['-5']);
  });

  it('dangling else en yakın ife bağlanır', () => {
    const src = `1- Başla
2- A = 1
3- if (A == 1) Then
4-    if (A == 2) Then Print ("inner")
5-    else Print ("inner-else")
6- Dur.`;
    expect(run(src).output).toEqual(['inner-else']);
  });

  it('iç içe if bloklarında else doğru ife bağlanır', () => {
    const src = `1- Başla
2- if (1 == 1) Then
3-    if (2 == 2) Then
4-       Print ("A")
5- else
6-    Print ("B")
7- Dur.`;
    expect(run(src).output).toEqual(['A']);
  });

  it('çok satırlı else-if zincirini çözer', () => {
    const src = `1- Başla
2- A = 0
3- if (A > 0) Then
4-    Print ("poz")
5- else if (A < 0) Then
6-    Print ("neg")
7- else
8-    Print ("sifir")
9- Dur.`;
    expect(run(src).output).toEqual(['sifir']);
  });

  it('İngilizce/Türkçe karışık yazımı kabul eder', () => {
    const src = `1- Start
2- Read (A)
3- if (A < 0) Then Print ("Negative")
   else if (A > 0) Then Print ("Positive")
   else Print ("Zero")
4- Stop.`;
    expect(run(src, ['-2']).output).toEqual(['Negative']);
    expect(run(src, ['2']).output).toEqual(['Positive']);
    expect(run(src, ['0']).output).toEqual(['Zero']);
  });

  it('parantezsiz koşulu ve eksik kapanış parantezini tolere eder', () => {
    expect(run(`1- Başla
2- A = 3
3- if A > 2 Then Print ("b")
4- Dur.`).output).toEqual(['b']);

    expect(run(`1- Başla
2- A = 3
3- if (A > 2 Then Print ("b")
4- Dur.`).output).toEqual(['b']);
  });
});

describe('yorumlayıcı', () => {
  it('PDF örneği 1: 10 sayıdan pozitifleri sayar', () => {
    const src = `1- Başla
2- say = 0, psay = 0
3- Sayı Gir (A)
4- say++
5- if (A >= 0) Then psay++
6- if (say < 10) Then goto 3
7- Print (psay)
8- Dur.`;
    const inputs = ['5', '-1', '0', '7', '-3', '2', '9', '-8', '4', '6'];
    expect(run(src, inputs).output).toEqual(['7']);
  });

  it('PDF örneği 2: dizide en büyüğün indisini bulur', () => {
    const src = `1- Başla
2- say = 0
3- Sayı Gir (A[say])
4- say++
5- if (say < 10) Then Goto 3
6- say = 0
7- EB = A[say], ebsay = say
8- say++
9- if (A[say] > EB) Then EB = A[say], ebsay = say
10- if (say < 9) Then Goto 8
11- Print (ebsay)
12- Dur.`;
    const inputs = ['5', '9', '2', '9', '1', '3', '4', '6', '7', '8'];
    expect(run(src, inputs).output).toEqual(['1']);
  });

  it('PDF örneği 3: toplam 1000 olana kadar sayar', () => {
    const src = `1- Başla
2- say = 0, toplam = 0
3- Sayı Gir (A)
4- say++
5- toplam = toplam + A
6- if (Toplam < 1000) Then goto 3
7- Print (say)
8- Dur.`;
    expect(run(src, ['400', '400', '300']).output).toEqual(['3']);
  });

  it('PDF örneği 4: and ile iki koşullu döngü', () => {
    const src = `1- Başla
2- ssay = 0, nsay = 0, i = 0
3- i++
4- if (i == 2) Then nsay = 2
5- if (ssay < 3 and nsay < 2) Then goto 3
6- Print (i)
7- Dur.`;
    expect(run(src).output).toEqual(['2']);
  });

  it('ondalık virgüllü girdiyi kabul eder', () => {
    expect(run(`1- Başla
2- Sayı Gir (A)
3- Print (A)
4- Dur.`, ['3,5']).output).toEqual(['3.5']);
  });

  it('mod, div, sqrt, abs ve ^ çalışır', () => {
    const src = `1- Başla
2- A = 7
3- B = A div 2
4- C = A mod 2
5- D = (A (mod 2)) + 1
6- E = sqrt(16) + abs(-3) + 2^3
7- Print (B, C, D, E)
8- Dur.`;
    expect(run(src).output).toEqual(['3 1 2 15']);
  });

  // Her aritmetik operatör kendi işlemini yapmalı ("*" bir zamanlar "/" olarak derleniyordu).
  it.each([
    ['3 * 4', '12'],
    ['12 / 4', '3'],
    ['7 % 3', '1'],
    ['7 mod 3', '1'],
    ['7 div 2', '3'],
    ['2 + 3 * 4', '14'],
    ['(2 + 3) * 4', '20'],
    ['2 * 3 / 4', '1.5'],
    ['10 - 2 * 3', '4'],
  ])('aritmetik: %s = %s', (expr: string, expected: string) => {
    const r = run(`1- Başla
2- X = ${expr}
3- Print (X)
4- Dur.`);
    expect(r.status).toBe('ok');
    expect(r.output).toEqual([expected]);
  });

  it('çarpma akış şeması metninde de çarpma olarak görünür', () => {
    const p = prepare(`1- Başla
2- X = 2 * 3
3- Dur.`);
    expect(p.ok).toBe(true);
    expect(p.compiled!.code.some((ins) => ins.text.includes('2 * 3'))).toBe(true);
  });

  it('atanmamış değişkeni okumak hatadır', () => {
    const r = run(`1- Başla
2- Y = X + 1
3- Dur.`);
    expect(r.status).toBe('error');
    expect(r.error?.code).toBe('E_UNDEFINED_VAR');
    expect(r.error?.line).toBe(2);
  });

  it('dizi sınırını kontrol eder', () => {
    const r = run(`1- Başla
2- Dizi A[10]
3- A[10] = 1
4- Dur.`);
    expect(r.error?.code).toBe('E_INDEX_RANGE');
    expect(r.error?.params).toEqual({ name: 'A', i: 10, size: 10 });
  });

  it('bildirilmemiş atanmamış dizi elemanı okunamaz', () => {
    const r = run(`1- Başla
2- Print (A[2])
3- Dur.`);
    expect(r.error?.code).toBe('E_UNDEFINED_ARRAY');
  });

  it('sonsuz döngüde adım limiti verir', () => {
    const r = run(`1- Başla
2- goto 2
3- Dur.`, [], 100);
    expect(r.status).toBe('error');
    expect(r.error?.code).toBe('E_STEP_LIMIT');
  });

  it('çıktı limitini uygular', () => {
    const src = `1- Başla
2- say = 0
3- say++
4- Print (say)
5- if (say < 100) Then goto 3
6- Dur.`;
    const r = runSync(src, [], { maxOutput: 10, maxSteps: 10000 });
    expect(r.status).toBe('error');
    expect(r.error?.code).toBe('E_OUTPUT_LIMIT');
  });

  it('tanımsız Print adını uyarıyla metin yazar', () => {
    const r = run(`1- Başla
2- Print (Sıfır)
3- Dur.`);
    expect(r.output).toEqual(['Sıfır']);
    expect(r.warnings[0].code).toBe('W_UNDEFINED_PRINT');
  });

  it('bulunamayan goto hedefini hata olarak verir', () => {
    const p = prepare(`1- Başla
2- goto 99
3- Dur.`);
    expect(p.ok).toBe(false);
    expect(p.errors[0].code).toBe('E_GOTO_TARGET');
  });

  it('bellek geçmişini tutar', () => {
    const r = run(`1- Başla
2- A = 0
3- A = 1
4- A = 2
5- A = 3
6- Dur.`);
    expect(r.memory.vars[0]).toMatchObject({ kind: 'scalar', name: 'A', value: 3 });
    expect((r.memory.vars[0] as any).history).toEqual([0, 1, 2, 3]);
  });

  it('eksik Başla/Dur uyarılarını sonuçla birlikte taşır', () => {
    const r = run(`1- A = 1
2- Print (A)`);
    expect(r.status).toBe('ok');
    expect(r.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining(['W_NO_START', 'W_NO_STOP']),
    );
  });
});

describe('çıktı karşılaştırma', () => {
  it('boşluk ve büyük/küçük harf duyarsızdır', () => {
    expect(compareOutputs('Merhaba   Dünya', 'merhaba dünya').equal).toBe(true);
  });
  it('1e-9 tolerans uygular', () => {
    expect(compareOutputs('3.0000000001', '3').equal).toBe(true);
    expect(compareOutputs('3.0001', '3').equal).toBe(false);
  });
  it('ilk farkı işaretler', () => {
    const d = compareOutputs('1 2 3', '1 5 3');
    expect(d.equal).toBe(false);
    expect(d.index).toBe(1);
  });
});
