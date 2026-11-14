# Dry Run Raven — Mimari Plan

## Teknoloji seçimi
**Svelte 5** (Vue 3 yerine). Neden: sanal DOM yok, bileşenler derleme anında saf JS'e derlenir → çalışma zamanı yükü ve JS paketi daha küçük (hedef <150 KB gzip), boşta CPU sıfıra yakın.

## Yığın
Tauri 2 + Svelte 5 (runes) + TypeScript + Vite (+ Vitest, TypeScript devDependencies). Tauri CLI komutları `pnpm tauri dev/build` ile. Rust tarafı sadece pencere/CSP/menü kipi, mantık tamamen TS (Web Worker içinde).

## Renk sistemi (3 ana renk + tonları)
CSS değişkenleri: `--mor-100..900` (#6B4FBB tabanı), `--murekkep-100..900` (#1F1A2E tabanı), `--kagit-100..900` (#F6F3FB tabanı). Kenar/hover/pasif/seçili/panel bu üç renk tonundan karışım. Yeşil/kırmızı sadece başarılı/başarısız ayrımında hafif tonla. Açık/koyu tema (Mürekkep↔Kâğıt yer değiştir), sistem temasını izler + el ile seçici.

## Arayüz kısıtlamaları
Yok: gradient, glassmorphism/blur, gölge, neon, pill buton, hero, kart-İçinde-kart, emoji, ikon kitaplığı, dekoratif animasyon. Var: 1px düz kenar, 0-3px köşe, 4/8px ızgara, inline SVG/metin ikon, en fazla 80ms geçiş.

## Yerleşim
- Üst: ince çubuk (Çalıştır F5, Test, Adım F10, Durdur, dosya menüsü, TR/EN, tema)
- Sol: kod editörü (satır numarası + ince sözdizimi katmanı)
- Sağ: sekmeler (Konsol | Bellek | Test | Akış Şeması | Sorular)
- Alt: dosya adı, satır, durum (hazır/çalışıyor/hata)

## Katmanlar (UI'dan bağımsız saf TS)
- `src/lib/lang` : keyword tablosu (JSON), lexer, parser, hata nesnesi `{satır, basamak, kod, ipucu}`, i18n mesajları
- `src/lib/interp` : yorumlayıcı + Web Worker sarmalayıcı (adım limiti 1.000.000, çıktı limiti 10.000)
- `src/lib/cfg` : kontrol akış grafiği üretimi
- `src/lib/flow` : SVG yerleşim + çizim (dış kütüphane yok), PNG export
- `src/lib/tests` : test senaryosu motoru (1e-9 tolerans, büyük/küçük harf/boşluk duyarsız)
- `src/lib/problems` : 27 soru JSON (TR/EN metin + test senaryoları + gizli referans)
- `src/ui` : Svelte bileşenleri
- `src-tauri` : Rust (menü, dosya aç/kaydet, CSP, pencere)

## Dil spesifikasyonu (özet)
Toleranslı lexer: `+ +`→`++`, `= =`→`==`, `< =`→`<=`, `> =`→`>=`, `! =`→`!=`, Türkçe tırnak → `"`, `→` ve `/...` yorum. Basamak etiketleri `1-`, `2)`, `3.`, `3.2.1`. Virgül parantez dışında deyim ayırıcısı. `Başla`/`Dur` zorunlu (uyarı). `if..Then..else..else if` (dangling else). `goto`, dizi `A[say]` (0 tabanlı), atanmamış değişken hata, `//` ve `#` yorumlar. Anahtar kelime eşlemesi `i/İ/ı/I` 무시, değişkenler büyük/küçük harf duyarsız.

## Dosya formatı
`.alg` (düz metin algoritma) + yan `.alg.json` (test senaryoları + ayarlar). Son çalışma localStorage taslak.

## Kalite
Vitest: lexer toleransı, dangling else, iç içe if, virgüllü deyim, dizi sınırı, atanmamış değişken, sonsuz döngü limiti, soru çözümlerinin kendi testlerini geçmesi. Erişilebilirlik: F5/F10/Ctrl+Enter/Ctrl+S/O/Ctrl+Shift+F, odak halkası, kontrast.

## Aşamalar
1. dil katmanı + yorumlayıcı + worker + Vitest (UI yok)
2. editör + konsol + Çalıştır
3. Test paneli + soru bankası
4. adım adım + Bellek paneli
5. akış şeması (SVG)
6. tema/cilalama, çift dil, bundle ve bellek raporu

Her aşama sonunda çalışması doğrulanır ve özetlenir.