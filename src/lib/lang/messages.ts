/**
 * Dil katmanı hata/uyarı mesajları (TR + EN).
 *
 * Hata nesnesi UI'dan bağımsızdır: { line, label, code, params, hint }.
 * Metin, gösterim anında seçili arayüz diline göre bu tablodan üretilir.
 */

export type UILang = 'tr' | 'en';

export interface AlgoIssue {
  line: number;               // dosyadaki 1 tabanlı satır
  label: string | null;       // basamak etiketi
  code: string;               // E_* / W_*
  params?: Record<string, string | number>;
  /** Yorumlayıcının ürettiği ek bağlam (ör. değişken adı). */
  hint?: string;
}

interface MessageDef {
  tr: (p: Record<string, string | number>) => string;
  en: (p: Record<string, string | number>) => string;
  hintTr?: (p: Record<string, string | number>) => string;
  hintEn?: (p: Record<string, string | number>) => string;
}

const P = (p: Record<string, string | number>, k: string): string =>
  p[k] === undefined ? `{${k}}` : String(p[k]);

export const MESSAGES: Record<string, MessageDef> = {
  E_LEX_CHAR: {
    tr: (p) => `Tanınmayan karakter: "${P(p, 'ch')}"`,
    en: (p) => `Unrecognized character: "${P(p, 'ch')}"`,
    hintTr: () => 'Bu karakteri kaldırın ya da yorum satırına alın (// ...).',
    hintEn: () => 'Remove this character or put it in a comment (// ...).',
  },
  E_UNTERMINATED_STRING: {
    tr: () => 'Metin tırnağı kapatılmamış.',
    en: () => 'Unterminated string literal.',
    hintTr: () => 'Metnin sonuna bir çift tırnak (") ekleyin.',
    hintEn: () => 'Add a closing double quote (") at the end of the text.',
  },
  E_EXPECTED: {
    tr: (p) => `Beklenen: ${P(p, 'what')}`,
    en: (p) => `Expected: ${P(p, 'what')}`,
    hintTr: () => 'Bir önceki ifadenin parantezlerini ve virgüllerini kontrol edin.',
    hintEn: () => 'Check parentheses and commas in the previous expression.',
  },
  E_EMPTY_EXPR: {
    tr: () => 'Boş ifade. Burada bir değer bekleniyordu.',
    en: () => 'Empty expression. A value was expected here.',
    hintTr: () => 'Eksik sayı, değişken veya parantezli ifadeyi tamamlayın.',
    hintEn: () => 'Complete the missing number, variable or parenthesized expression.',
  },
  E_UNEXPECTED_TOKEN: {
    tr: (p) => `Burada beklenmeyen ifade: "${P(p, 'tok')}"`,
    en: (p) => `Unexpected token here: "${P(p, 'tok')}"`,
    hintTr: () => 'Deyimin başında atama, Sayı Gir, Print, if veya goto olmalı.',
    hintEn: () => 'A statement must start with an assignment, Read, Print, if or goto.',
  },
  E_NOT_ARRAY: {
    tr: (p) => `"${P(p, 'name')}" bir dizi değil; köşeli parantez kullanılamaz.`,
    en: (p) => `"${P(p, 'name')}" is not an array; indexing is not allowed.`,
    hintTr: () => 'Dizi kullanacaksanız önce Dizi A[10] biçiminde bildirin.',
    hintEn: () => 'Declare the array first, e.g. Array A[10].',
  },
  E_UNKNOWN_FUNC: {
    tr: (p) => `Bilinmeyen fonksiyon: ${P(p, 'name')}`,
    en: (p) => `Unknown function: ${P(p, 'name')}`,
    hintTr: () => 'Desteklenen fonksiyonlar: sqrt(x), abs(x).',
    hintEn: () => 'Supported functions: sqrt(x), abs(x).',
  },
  E_UNDEFINED_VAR: {
    tr: (p) => `"${P(p, 'name')}" değişkeni değer atanmadan okundu.`,
    en: (p) => `Variable "${P(p, 'name')}" was read before it was assigned.`,
    hintTr: () => 'Bu değişkene önce bir değer atayın (ör. say = 0).',
    hintEn: () => 'Assign a value first (e.g. count = 0).',
  },
  E_UNDEFINED_ARRAY: {
    tr: (p) => `"${P(p, 'name')}" dizisi değer atanmadan okundu.`,
    en: (p) => `Array "${P(p, 'name')}" was read before it was assigned.`,
    hintTr: () => 'Önce dizi elemanlarına değer atayın.',
    hintEn: () => 'Assign values to the array elements first.',
  },
  E_INDEX_UNSET: {
    tr: (p) => `${P(p, 'name')}[${P(p, 'i')}] elemanına değer atanmamış.`,
    en: (p) => `${P(p, 'name')}[${P(p, 'i')}] has no value yet.`,
    hintTr: () => 'Dizi elemanını okumadan önce ona değer atayın.',
    hintEn: () => 'Assign a value to the element before reading it.',
  },
  E_INDEX_RANGE: {
    tr: (p) => `${P(p, 'name')}[${P(p, 'i')}] erişimi: dizi ${P(p, 'size')} elemanlı, geçerli indis 0–${Number(P(p, 'size')) - 1}.`,
    en: (p) => `${P(p, 'name')}[${P(p, 'i')}] access: array has ${P(p, 'size')} elements, valid indexes 0–${Number(P(p, 'size')) - 1}.`,
    hintTr: () => 'İndisin dizi sınırları içinde olduğunu kontrol edin (indis 0’dan başlar).',
    hintEn: () => 'Check that the index is in range (indexes start at 0).',
  },
  E_ARRAY_TOO_LARGE: {
    tr: (p) => `"${P(p, 'name')}" dizisi çok büyük: ${P(p, 'size')} eleman gerekiyor, en fazla ${P(p, 'max')} elemana izin verilir.`,
    en: (p) => `Array "${P(p, 'name')}" is too large: ${P(p, 'size')} elements needed, at most ${P(p, 'max')} are allowed.`,
    hintTr: () => 'Dizi boyutunu veya kullandığınız indisi küçültün.',
    hintEn: () => 'Use a smaller array size or index.',
  },
  E_INDEX_NEGATIVE: {
    tr: (p) => `${P(p, 'name')}[${P(p, 'i')}] erişimi: indis negatif olamaz.`,
    en: (p) => `${P(p, 'name')}[${P(p, 'i')}] access: index cannot be negative.`,
    hintTr: () => 'Dizi indisi 0 veya daha büyük olmalıdır.',
    hintEn: () => 'Array index must be 0 or greater.',
  },
  E_INDEX_INT: {
    tr: (p) => `${P(p, 'name')}[${P(p, 'i')}] erişimi: indis tam sayı olmalı.`,
    en: (p) => `${P(p, 'name')}[${P(p, 'i')}] access: index must be an integer.`,
    hintTr: () => 'Ondalıklı bir değer indis olarak kullanılamaz.',
    hintEn: () => 'A fractional value cannot be used as an index.',
  },
  E_BAD_INDEX: {
    tr: (p) => `${P(p, 'name')} dizisinin indisi sayı olmalı; "${P(p, 'val')}" alındı.`,
    en: (p) => `The index of ${P(p, 'name')} must be numeric; got "${P(p, 'val')}".`,
    hintTr: () => 'İndis ifadesinin sayı ürettiğinden emin olun.',
    hintEn: () => 'Make sure the index expression produces a number.',
  },
  E_GOTO_TARGET: {
    tr: (p) => `Goto hedefi ${P(p, 'target')} numaralı basamak bulunamadı.`,
    en: (p) => `Goto target step ${P(p, 'target')} was not found.`,
    hintTr: () => 'Hedef satırın başında 3- ya da 3.1 gibi bir basamak etiketi olduğundan emin olun.',
    hintEn: () => 'Make sure the target line starts with a step label such as 3- or 3.1.',
  },
  E_TYPE_MATH: {
    tr: (p) => `"${P(p, 'op')}" işlemi metinle kullanılamaz.`,
    en: (p) => `Operator "${P(p, 'op')}" cannot be used with text.`,
    hintTr: () => 'Metinleri yalnızca Print içinde yazdırın; matematik için sayı kullanın.',
    hintEn: () => 'Only print text; use numbers for arithmetic.',
  },
  E_TYPE_CMP: {
    tr: (p) => `"${P(p, 'op')}" karşılaştırması bu değerlerle yapılamaz.`,
    en: (p) => `Comparison "${P(p, 'op')}" cannot be applied to these values.`,
    hintTr: () => 'Karşılaştırılan iki değerin de sayı olduğundan emin olun.',
    hintEn: () => 'Make sure both compared values are numbers.',
  },
  E_DIV_ZERO: {
    tr: () => 'Sıfıra bölme yapıldı.',
    en: () => 'Division by zero.',
    hintTr: () => 'Bölmeden önce bölenin sıfır olmadığını kontrol edin.',
    hintEn: () => 'Check that the divisor is not zero before dividing.',
  },
  E_BAD_TARGET: {
    tr: () => 'Atama hedefi geçersiz.',
    en: () => 'Invalid assignment target.',
    hintTr: () => 'Sol tarafta bir değişken veya dizi elemanı olmalı.',
    hintEn: () => 'The left side must be a variable or array element.',
  },
  E_INPUT_EOF: {
    tr: () => 'Girdi bekleniyor ancak kullanılabilir girdi kalmadı.',
    en: () => 'Input requested but no input is available.',
    hintTr: () => 'Konsoldaki "Girdi kuyruğu" kutusuna yeterli değer yazın.',
    hintEn: () => 'Add enough values to the "Input queue" box in the console.',
  },
  E_STEP_LIMIT: {
    tr: (p) => `Adım limiti aşıldı (${P(p, 'max')} adım). Sonsuz döngü olabilir.`,
    en: (p) => `Step limit exceeded (${P(p, 'max')} steps). This may be an infinite loop.`,
    hintTr: () => 'Goto ile geri dönüşte döngüyü bitiren koşulu kontrol edin.',
    hintEn: () => 'Check the condition that ends the loop in your goto structure.',
  },
  E_OUTPUT_LIMIT: {
    tr: (p) => `Çıktı limiti aşıldı (${P(p, 'max')} satır). Sonsuz döngü olabilir.`,
    en: (p) => `Output limit exceeded (${P(p, 'max')} lines). This may be an infinite loop.`,
    hintTr: () => 'Print komutunun döngü içinde her turda çalışıp çalışmadığını kontrol edin.',
    hintEn: () => 'Check whether Print runs on every loop iteration.',
  },
  E_DEPTH: {
    tr: () => 'İç içe blok derinliği çok fazla.',
    en: () => 'Nested block depth is too deep.',
    hintTr: () => 'İç içe if sayısını azaltın.',
    hintEn: () => 'Reduce the number of nested if statements.',
  },
  E_UNKNOWN: {
    tr: () => 'Bilinmeyen bir çalışma hatası oluştu.',
    en: () => 'An unknown runtime error occurred.',
    hintTr: () => 'Algoritmayı adım modunda çalıştırıp hatanın yerini bulun.',
    hintEn: () => 'Run in step mode to locate the failure.',
  },

  /*──── Uyarılar ────*/
  W_NO_START: {
    tr: () => 'Algoritmada "Başla" ifadesi yok.',
    en: () => 'The algorithm has no "Start" statement.',
    hintTr: () => 'İlk satıra 1- Başla yazmanız önerilir.',
    hintEn: () => 'It is recommended to start with 1- Start.',
  },
  W_NO_STOP: {
    tr: () => 'Algoritmada "Dur" ifadesi yok.',
    en: () => 'The algorithm has no "Stop" statement.',
    hintTr: () => 'Son satıra Dur. yazmanız önerilir.',
    hintEn: () => 'It is recommended to end with Stop.',
  },
  W_SINGLE_EQ: {
    tr: () => 'Koşulda tek "=" kullanılmış. Eşitlik olarak kabul edildi.',
    en: () => 'Single "=" used in a condition. Treated as equality.',
    hintTr: () => 'Karşılaştırma için == kullanın.',
    hintEn: () => 'Use == for comparison.',
  },
  W_MISSING_THEN: {
    tr: () => 'if ifadesinden sonra Then yok. Yine de kabul edildi.',
    en: () => 'Missing Then after if. Accepted anyway.',
    hintTr: () => 'Okunabilirlik için if (koşul) Then yazın.',
    hintEn: () => 'For readability write if (condition) Then.',
  },
  W_MISSING_PAREN: {
    tr: () => 'Kapanmayan parantez otomatik tamamlandı.',
    en: () => 'Unclosed parenthesis was completed automatically.',
    hintTr: () => 'Satırdaki açılan ve kapanan parantez sayısını kontrol edin.',
    hintEn: () => 'Check that opened and closed parentheses match.',
  },
  W_UNDEFINED_PRINT: {
    tr: (p) => `Print içindeki "${P(p, 'name')}" tanımlı değil; metin olarak yazdırıldı.`,
    en: (p) => `"${P(p, 'name')}" in Print is not defined; printed as text.`,
    hintTr: () => 'Metin yazdırmak için tırnak kullanın: Print ("Sıfır").',
    hintEn: () => 'Use quotes for text: Print ("Zero").',
  },
};

export function formatIssue(issue: AlgoIssue, lang: UILang): { message: string; hint: string } {
  const def = MESSAGES[issue.code];
  if (!def) return { message: issue.code, hint: '' };
  const params = issue.params ?? {};
  const message = (lang === 'en' ? def.en : def.tr)(params);
  const hintFn = lang === 'en' ? def.hintEn : def.hintTr;
  const baseHint = hintFn ? hintFn(params) : '';
  return { message, hint: issue.hint || baseHint };
}

/** Kısa, tek satırlık gösterim (konsol / test çıktısı için). */
export function issueLine(issue: AlgoIssue, lang: UILang): string {
  const { message } = formatIssue(issue, lang);
  if (lang === 'en') {
    return issue.label
      ? `Line ${issue.line} (step ${issue.label}): ${message}`
      : `Line ${issue.line}: ${message}`;
  }
  return issue.label
    ? `${issue.line}. satır (${issue.label}. basamak): ${message}`
    : `${issue.line}. satır: ${message}`;
}
