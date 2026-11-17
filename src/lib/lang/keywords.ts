/**
 * Dry Run Raven — anahtar kelime tablosu.
 *
 * Tek kaynak: buradaki tablo. Yeni bir takma ad eklemek için ilgili satıra
 * sözcüğü yazmak yeterlidir. Karşılaştırma `norm()` üzerinden yapılır:
 * i / İ / ı / I aynı kabul edilir, büyük-küçük harf farkı yoktur.
 *
 * `meaning` değerleri yorumlayıcının gördüğü iç kodlardır; UI'da gösterilmez.
 */

export type Meaning =
  | 'basla' | 'dur'
  | 'giris' | 'cikis'
  | 'eger' | 'ise' | 'degilse' | 'degilse_eger'
  | 'goto'
  | 've' | 'veya' | 'degil'
  | 'mod' | 'div'
  | 'dizi' | 'int'
  | 'sqrt' | 'abs';

export interface KeywordEntry {
  meaning: Meaning;
  /** Türkçe yazımlar. */
  tr: string[];
  /** İngilizce yazımlar. */
  en: string[];
}

export const KEYWORDS: KeywordEntry[] = [
  { meaning: 'basla',       tr: ['Başla', 'Basla'],                       en: ['Start', 'Begin'] },
  { meaning: 'dur',         tr: ['Dur', 'Bitir'],                          en: ['Stop', 'End'] },
  { meaning: 'giris',       tr: ['Sayı Gir', 'Sayıları Gir', 'Gir', 'Oku', 'Tahmin Et', 'Hedef Sayıyı Gir'],
                            en: ['Read', 'Input', 'Enter'] },
  { meaning: 'cikis',       tr: ['Yazdır', 'Yaz', 'Print'],                en: ['Print', 'Write', 'Output'] },
  { meaning: 'eger',        tr: ['Eğer', 'İf', 'if'],                      en: ['if'] },
  { meaning: 'ise',         tr: ['ise', 'Then'],                           en: ['Then'] },
  { meaning: 'degilse',     tr: ['değilse', 'yoksa', 'else'],              en: ['else'] },
  { meaning: 'degilse_eger', tr: ['değilse eğer', 'else if'],              en: ['else if', 'elif'] },
  { meaning: 'goto',        tr: ['Git', 'Goto'],                           en: ['Goto'] },
  { meaning: 've',          tr: ['ve'],                                    en: ['and'] },
  { meaning: 'veya',        tr: ['veya'],                                  en: ['or'] },
  { meaning: 'degil',       tr: ['değil'],                                 en: ['not'] },
  { meaning: 'mod',         tr: ['mod'],                                   en: ['mod'] },
  { meaning: 'div',         tr: ['div'],                                   en: ['div'] },
  { meaning: 'dizi',        tr: ['Dizi'],                                  en: ['Array', 'Dim'] },
  { meaning: 'int',         tr: ['int', 'tamsayı', 'float', 'double', 'char'], en: ['int', 'float', 'double', 'char'] },
  { meaning: 'sqrt',        tr: ['sqrt'],                                  en: ['sqrt'] },
  { meaning: 'abs',         tr: ['abs'],                                   en: ['abs'] },
];

/**
 * Karşılaştırma normalizasyonu: Türkçe i/İ/ı/I aynı harfe indirgenir.
 * Değişken adları da aynı fonksiyonla anahtarlanır (ebsay == EBSay).
 */
export function norm(s: string): string {
  return s
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .toLowerCase();
}

/** Ayarlardan gelen ek takma adlar (ör. "Girdi Al" → giriş). */
const extras: { meaning: Meaning; word: string }[] = [];

export function addKeywordAlias(meaning: Meaning, word: string): void {
  const w = word.trim();
  if (!w) return;
  if (!extras.some((e) => e.meaning === meaning && norm(e.word) === norm(w))) {
    extras.push({ meaning, word: w });
  }
}

export function clearKeywordAliases(): void {
  extras.length = 0;
}

/**
 * Ek giriş ("Sayı Gir") takma adlarını verilen listeyle değiştirir.
 *
 * Takma adlar modül durumunda tutulur ve her JavaScript ortamının (ana iş
 * parçacığı, her Worker) kendi kopyası vardır; bu yüzden kaynak kodu
 * ayrıştıran her ortam bu fonksiyonu kendi tarafında çağırmalıdır.
 */
export function setInputAliases(aliases: readonly string[]): void {
  clearKeywordAliases();
  for (const a of aliases) {
    if (typeof a === 'string') addKeywordAlias('giris', a);
  }
}

/** Sözcük (veya çok sözcüklü ifade) anahtar kelimeyse anlamını döndürür. */
export function keywordMeaning(word: string): Meaning | null {
  const key = norm(word.trim());
  for (const e of extras) if (norm(e.word) === key) return e.meaning;
  for (const e of KEYWORDS) {
    for (const w of [...e.tr, ...e.en]) if (norm(w) === key) return e.meaning;
  }
  return null;
}

/** Çok sözcüklü anahtar kelimelerin listesi (lexer birleştirmesi için). */
export function phraseKeywords(): string[] {
  const out: string[] = [];
  for (const e of [...KEYWORDS, ...extras.map((x) => ({ meaning: x.meaning, tr: [x.word], en: [] }))]) {
    for (const w of [...e.tr, ...e.en]) if (/\s/.test(w.trim())) out.push(w.trim());
  }
  return out;
}

/** Tüm tek sözcüklü anahtar kelimeler (editör renklendirmesi için). */
export function singleWordKeywords(): string[] {
  const out = new Set<string>();
  for (const e of [...KEYWORDS, ...extras.map((x) => ({ meaning: x.meaning, tr: [x.word], en: [] }))]) {
    for (const w of [...e.tr, ...e.en]) if (!/\s/.test(w.trim())) out.add(norm(w.trim()));
  }
  return [...out];
}
