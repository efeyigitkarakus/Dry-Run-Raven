/**
 * Yorumlayıcının kaynak sınırları.
 *
 * Adım ve çıktı limitleri ayarlardan gelir; buradakiler ise tek bir komutun
 * belleği tüketmesini önleyen sabit üst sınırlardır.
 */

/**
 * Bir dizinin en fazla eleman sayısı (bildirilen boyut ve en büyük indis + 1).
 *
 * Bellek görüntüsü dizinin tamamı kadar hücre ürettiği için bu sınır olmadan
 * `Dizi A[1000000000]` gibi tek bir satır, adım limitine hiç takılmadan
 * Worker'ı kilitler.
 */
export const MAX_ARRAY_SIZE = 100_000;
