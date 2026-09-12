# Fon Portföy — Güncel Durum Özeti

*Bu dosya, projenin kalıcı dokümantasyonunun bir parçası olarak Git'e
eklenmiştir ve versiyon geçmişiyle birlikte takip edilir. Yeni bir bölüm
eklerken/güncellerken tarihi ve ilgili commit hash'ini belirtin; eski/
geçersiz bilgiyi silmek yerine "ARTIK GEÇERLİ DEĞİL"/"superseded" şeklinde
işaretleyip hangi bölümün yerine geçtiğini belirtin (bkz. Bölüm 8, 9-10).
Parola, token, API anahtarı veya başka bir gizli değer İÇERMEMELİDİR —
commit etmeden önce her zaman kontrol edin.*

## 1. Genel Durum

Uygulama **uçtan uca canlıda ve çalışır durumda**. Kod, veritabanı şeması,
TEFAS senkronizasyonu, admin arayüzü ve GitHub Pages dağıtımı tamamlanmış,
canlı ortamda test edilmiş ve performans optimizasyonları uygulanmıştır.
Admin girişi ve admin RLS yazma yolu gerçek bir admin hesabıyla
(`merterbil@yahoo.com`) uçtan uca doğrulanmıştır. Fon kataloğu, TEFAS'taki
286 katılım fonunun tamamını kapsayacak şekilde genişletilmiş ve model
portföyde kullanıcı bazlı (oturum-özel) fon değişimi eklenmiştir (bkz.
Bölüm 6). TEFAS senkronizasyonundaki hem cron hem de admin panelinden
manuel tetikleme yolu artık gerçek tarayıcıda uçtan uca doğrulanmıştır
(kök neden: eksik CORS preflight yanıtı, düzeltildi — bkz. Bölüm 6).
**Kritik bir veri hatası da bu oturumda düzeltildi:** döviz katılım
fonlarının (ör. BKY) para birimi yanlışlıkla TRY kabul ediliyordu; gerçeği
USD/EUR olan fonlar artık doğru tanınıyor ve TL karşılığı gerçek TCMB
kuruyla hesaplanıyor (bkz. Bölüm 9). 1/3/6/12 aylık getiri geçmişi TEFAS'tan
geriye dönük yüklendi (370 gün, 61.602 fiyat satırı) — Fonlar sayfasındaki
getiri kolonları artık gerçek verilerle dolu (bkz. Bölüm 10).

**Sonraki oturumda eklenenler (bkz. Bölüm 11-15):** PPF gösterim sırasının
"canlıda düzelmemiş görünmesi" sorunu, kod değil PWA service worker'ın
güncellemeleri otomatik uygulamaması yüzündendi — düzeltildi ve mevcut bir
kurulumda ~4 saniyede otomatik güncellendiği kanıtlandı (Bölüm 11). Risk
verisi için "176/286 üst sınır" artık **geçerli değil** — KAP'ın resmi,
güvenlik önlemi olmayan arama API'si üzerinden ayrı, düşük hızlı bir
zenginleştirme job'ı (`kap-risk-sync`) eklendi; kapsam **249/286**'ya çıktı
(Bölüm 12; bu süreçte gerçek bir regresyon da bulunup düzeltildi — bkz.
Bölüm 12.5). Kullanıcıya gösterilen fon listelerine risk/yatırımcı sayısı
asgari uygunluk kuralı eklendi, BYF/ETF istisnasıyla (Bölüm 13). PWA ikonu
ve kullanıcı uygulamasındaki rozet, gerçek pasta grafiği logosuyla
değiştirildi (Bölüm 14). TEFAS senkronizasyon saatleri Türkiye saatine göre
08:30/09:45 olarak güncellendi (Bölüm 15).

**Sonraki oturumda eklenenler (bkz. Bölüm 16-17):** Kullanıcı uygulamasının
mobil navigasyonu, ekranın altındaki sabit sekme çubuğundan kaldırılıp
"Fon Portföy" başlığının hemen altına, üstte sabit iki büyük sekme olarak
taşındı (Bölüm 16). Fonlar sayfasında varlık sınıfı filtresi kaldırıldı,
varsayılan sıralama 3 aylık getiriye (yüksekten düşüğe, eksik olan sonda)
çevrildi, ve mobildeki büyük/boşluklu fon kartları kompakt, sütunları
hizalı bir tabloyla değiştirildi (Bölüm 17).

**Bu oturumda eklenenler (bkz. Bölüm 21-22):** CKS (İş Portföy Birinci
Katılım Serbest Döviz Fon) canlıda risk_value=null olduğu için
listelerden gizliydi VE fiyatı kritik biçimde yanlıştı — B Grubu (native
USD) yerine A Grubu'nun (TL) fiyatı, yanlışlıkla USD etiketiyle
kaydediliyordu (~61,8 "USD" yerine gerçek ~1,28 USD). Her ikisi de KAP +
İş Portföy'ün resmi sitesiyle çapraz doğrulanarak, kalıcı/korunan bir
mekanizmayla (yeni `fund_share_class_overrides` tablosu + resmi PYŞ
sayfasından günlük native fiyat çeken yeni bir adaptör) düzeltildi; CKS'nin
tarihsel fiyat geçmişi de (yalnızca resmi kaynaktan doğrulanabilen aralıkta)
düzeltildi (Bölüm 21). Bu süreçte, TAMAMEN AYRI ve daha geniş bir bulgu da
ortaya çıktı: canlıda CKS dışındaki 52 aktif döviz katılım fonunun
49'unun (fiyatı olan 51 fonun neredeyse tamamı) son fiyatı CKS'nin eski
hatasıyla AYNI büyüklük sınıfında (~15-170 "USD/EUR") — resmi kaynaklarla
doğrulanmadan değiştirilmedi, admin incelemesi için Bölüm 21'de listelendi.
Ayrıca canlıda 52 fonun fiyat geçmişinde 2026-09-04 tarihli, tek seferlik,
yanlış para birimli "başıboş" satırlar bulundu ve (her fon için o tarihte
zaten doğru para biriminde bir kardeş satır bulunduğu doğrulanarak)
temizlendi. Ortak fon listeleme kuralına, risk değeri doğrulanmış olmak
koşuluyla, en az 1 milyar TL büyüklüğündeki fonlar için yatırımcı sayısı
50 şartından muafiyet eklendi (Bölüm 22).

**BKY kritik düzeltmesi (bkz. Bölüm 23):** Bölüm 21.6'daki denetim
adaylarından BKY resmî olarak doğrulandı. TEFAS'ın yaklaşık 50,49 değerinin
A Grubu TL fiyatı olduğu; Yapı Kredi Portföy'ün kendi canlı endpoint'inde
B Grubu native fiyatının 1,043073 USD olarak ayrı yayımlandığı kanıtlandı.
BKY uygulamanın varsayılan Döviz fonu olduğu için bu hata hesaplamaları
yaklaşık kur katsayısı kadar büyütüyordu. BKY mevcut pay-grubu override
mekanizmasına eklendi, günlük fiyat artık doğrudan resmî Yapı Kredi Portföy
kaynağından alınıyor ve fon başlangıcından bugüne doğrulanabilen 235 günlük
USD geçmişi resmî seriyle değiştirildi. Ardışık iki canlı senkronizasyonla
düzeltmenin kalıcı olduğu doğrulandı (commit `18732a5`).

**Sonraki oturumda eklenenler (bkz. Bölüm 18):** Portföy Hesaplama akışı
yeniden tasarlandı — "Risk Profili" combo box'ı kaldırılıp yerine, model
dağılımından üretilen SVG donut grafikli seçilebilir risk profili
kartları geldi; hesaplama artık ayrı bir sonuç sayfasında (`#/hesaplama/
sonuc`) gösteriliyor. Model Dağılımı/Pay Hesaplama Özeti sıralaması tüm
profillerde Mevduat → PPF → azalan yüzde (eşitlikte kod A-Z) → Cari Hesap
oldu; Model Dağılımı'na 1 aylık getiri satırı eklendi (Bölüm 18).

**Sonraki oturumda eklenenler (bkz. Bölüm 19):** Kullanıcı uygulamasındaki
Hesaplama/Fonlar sekmelerinin 📊/📁 emojileri, yeni bağımlılık eklenmeden
yazılmış sade SVG ikonlarla (pasta grafik / iç içe madeni para) değiştirildi
(Bölüm 19) — bu ilk elle çizilmiş ikonlar, aynı oturumda tasarımcının
verdiği gerçek SVG dosyalarıyla (`src/assets/navigation/`) birebir
değiştirildi (Bölüm 20, Bölüm 19'u supersede eder).

BKY'nin varsayılan model fonunu etkileyen kritik fiyat sorunu çözülmüştür.
Bölüm 21.6'da listelenen diğer döviz fonlarının fiyat/pay grubu denetimi ise
uydurma veri üretmemek için resmî PYŞ kaynağı bulunana kadar açık bir veri
kalitesi incelemesi olarak kalır; doğrulanmamış fonlar otomatik değiştirilmez.

**Özel (kullanıcı tanımlı) portföy dağılımı eklendi (bkz. Bölüm 24):** Hazır
4 risk profili kartının sonuna, admin tarafından yayınlanmayan ve Supabase'e
hiçbir zaman yazılmayan beşinci bir "Özel" kart eklendi; seçilince kullanıcı
5 varlık sınıfı için kendi yüzdelerini girip mevcut hesaplama motorunu
(değiştirilmeden) kullanarak sonuç alabiliyor (commit `80a68b7`).

**Özel dağılım ayrı bir sayfaya taşındı (bkz. Bölüm 26):** Özel kartının
aynı sayfada açtığı satır içi düzenleyici, mobilde yüzde alanlarının
ekranın çok altında kalıp kullanıcının kaydırması gerektiğini fark
etmemesine yol açıyordu. Kart artık bir toggle değil, ayrı bir adıma
(`#/hesaplama/ozel`, "Kendi Dağılımını Oluştur") götüren navigasyon; yeni
sayfada yüzde alanları ilk ekranda (hiç kaydırmadan) görünüyor (commit
`c25aa2f`).

- **Canlı uygulama:** https://webappuygulamalar.github.io/fon-portfoy/
- **GitHub deposu:** https://github.com/webappuygulamalar/fon-portfoy (public, `main`)
- **Supabase projesi:** `fon-portfoy` (ref `lewccubzcsayqlkkyasb`, eu-central-1, ACTIVE_HEALTHY)

## 2. Mimari (özet)

```
src/
  domain/calculation/   → Saf fonksiyonlar (React/Supabase bağımlılığı yok)
  domain/model/         → Yayınlanmış model birleştirme mantığı (saf)
  services/             → Supabase repository katmanı (fonlar, model, auth, sync, fx)
  components/, pages/   → UI (kullanıcı + admin)
  lib/                  → Decimal, format, sabitler, fiyat tazelik kontrolü
supabase/
  migrations/              → Şema + RLS + view'lar + cron + güvenlik/performans sertleştirme (13 dosya)
  functions/tefas-sync/    → TEFAS adapteri + katalog/fiyat/kur senkronizasyonu (cron: bkz. Bölüm 15)
  functions/history-backfill/ → Checkpoint'li tarihsel fiyat geri yükleme (bkz. Bölüm 10)
  functions/kap-risk-sync/    → KAP risk değeri zenginleştirme, admin-tetiklemeli (bkz. Bölüm 12)
  functions/_shared/       → 3 fonksiyon arası paylaşılan auth/CORS yardımcıları
  seed.sql
scripts/bootstrap-admin.mjs → İlk admin oluşturma
```

Yığın: Vite + React 19 + TypeScript (strict) + React Router (HashRouter) +
Supabase JS + Decimal.js (tüm parasal hesaplamalar) + `vite-plugin-pwa` +
Vitest.

## 3. Supabase Proje Durumu

| Bileşen | Durum |
|---|---|
| Proje | `fon-portfoy`, eu-central-1, ACTIVE_HEALTHY |
| Migration'lar | 13 dosya, hepsi remote'a uygulanmış (`supabase migration list --linked` ile doğrulanabilir) |
| Seed verisi | 4 model-standart fon (PKT, ZKP, ZGD, BKY); kalan 282 fon TEFAS senkronizasyonuyla geldi |
| Edge Function | `tefas-sync`, ACTIVE, toplu katalog+fiyat keşfi yapan v2 mantığıyla |
| Cron | ~~`tefas-daily-sync`, her gün 04:30 UTC~~ → `tefas-sync-0830-tr` (05:30 UTC=08:30 TR) + `tefas-sync-0945-tr` (06:45 UTC=09:45 TR), ikisi de aktif (`pg_cron`, bkz. Bölüm 15) |
| KAP risk zenginleştirme | `kap-risk-sync` Edge Function, ACTIVE, yalnızca admin panelinden manuel tetiklenir (cron'a bağlı DEĞİL, bkz. Bölüm 12) |
| Auth | E-posta/parola girişi açık (`external_email_enabled=true`, Dashboard'dan; `config.toml`'daki `[auth.email] enabled=true` sadece dokümantasyon amaçlı, tek başına yetmiyor — bkz. README notu) |
| GitHub Pages env değişkenleri | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` repo variable olarak gerçek değerlerle tanımlı |

## 4. TEFAS Senkronizasyon Durumu (canlı veriyle doğrulandı)

`sync_runs` ve `fund_prices` tabloları sorgulanarak (service/postgres rolüyle,
RLS'i atlayarak) doğrulandı — **bu seed verisi değil, gerçek TEFAS API
yanıtlarından gelen veridir** (`fund_prices.source = 'TEFAS'`):

- Son 4 senkronizasyon çalışması: 1 kısmi başarısızlık + 3 tam başarı.
  - **En eski görülen çalışma (cron, kısmi):** 4 fon kontrol edildi, **1
    başarılı / 3 başarısız** (ZKP, ZGD, BKY — o anki TEFAS yanıtında satır
    bulunamadı). Bu geçici bir TEFAS tarafı aksaklıktı, koddan kaynaklanmadı;
    adapter önceki fiyatı silmediği için veri kaybı olmadı.
  - **Sonraki 2 cron çalışması ve en son manuel çalışma:** her biri **4/4
    başarılı, 0 başarısız**.
- **En son çalışma** (manuel tetikleme, admin JWT ile): `funds_checked=4`,
  `funds_updated=4`, `funds_failed=0`, `status=success`.
- Güncel fiyatlar: PKT, ZKP, ZGD, BKY — hepsi `price_date=2026-09-04`,
  `source=TEFAS`, `fetched_at` en son senkronizasyon zamanına eşit.
- Sonuç: TEFAS entegrasyonu canlıda gerçekten çalışıyor; ara sıra tek
  fonluk/geçici TEFAS yanıt hataları olabilir ama adapter bunu doğru
  şekilde `partial` olarak loglayıp bir sonraki çalıştırmada kendini
  toparlıyor.

## 5. RLS Performans Optimizasyonu (bu oturumda yapıldı)

Supabase performans danışmanı (`supabase db advisors --linked`) 9 WARN
seviyesinde uyarı buldu:

- 1× `auth_rls_initplan` (`admin_users_select_self` policy'si `auth.uid()`'yi
  satır başına yeniden değerlendiriyordu)
- 8× `multiple_permissive_policies` (funds, fund_prices, fx_rates,
  risk_profiles, model_versions, model_profile_allocations,
  model_preferred_funds, model_deposit_buckets — `for all` admin yazma
  policy'si ile `select` policy'leri `authenticated` rolü için SELECT
  eyleminde çakışıyordu)

**Çözüm** — yeni migration `20260905140000_rls_performance_optimizations.sql`
(eski migration'lar değiştirilmedi):

- `auth.uid()` → `(select auth.uid())` (InitPlan önbellekleme)
- Her tablodaki `..._admin_write` (`for all`) policy'si `insert`/`update`/
  `delete`'e ayrı ayrı daraltıldı; `select`, zaten adminleri de kapsayan tek
  bir policy'ye bırakıldı
- `model_*` tablolarında `select_published` + `select_admin`, tek bir
  `select` policy'sinde OR ile birleştirildi (permissive policy'ler zaten OR
  ile birleştiği için **etkin yetkide hiçbir değişiklik yok**)

**Canlı doğrulama sonuçları:**

- `supabase db advisors --linked` → **0 uyarı** (önce 9 idi)
- Anon anahtarla `funds`, `fund_prices`, `fund_latest_price` view'ı,
  `model_versions` (published) okuma → **çalışıyor**
- Anon anahtarla `funds` tablosuna INSERT → **RLS tarafından reddedildi**
  (`42501: new row violates row-level security policy`)
- Anon anahtarla mevcut bir satırı UPDATE/DELETE → **0 satır etkilendi**
  (RLS satırı görünmez kıldı, sessiz reddediliş — beklenen PostgREST davranışı)
- `admin_users` tablosu anon'a **boş** dönüyor (RLS ile korunuyor)
- Lint: 0 hata (1 zararsız, önceden bilinen uyarı) · Test: **55/55 geçti**
  · Build: başarılı
- Commit `aa2d6ee` GitHub'a push edildi, Actions deploy'u **başarılı**, canlı
  site HTTP 200 dönüyor

**Not — admin yazma yolunun canlı yeniden testi:** Bu migration `is_admin()`
kontrolünün mantığını değiştirmedi (sadece `for all` yerine 3 ayrı policy
kullanıyor, koşul aynı `(select public.is_admin())`), ancak gerçek bir admin
oturumuyla uçtan uca doğrulama önerilir. Programatik olarak geçici bir test
admin hesabı oluşturma denemesi, prod `admin_users` tablosuna otomatik yazma
olduğu için güvenlik sınıflandırıcısı tarafından engellendi — bu bilinçli bir
sınır, aşılmadı. Kullanıcı bu adımı manuel olarak (tarayıcıdan admin girişi +
küçük bir düzenleme) doğrulamayı tercih etti.

**Manuel doğrulama sonucu (kullanıcı tarafından, 2026-09-05):**
`scripts/bootstrap-admin.mjs` ile `merterbil@yahoo.com` ilk admin hesabı
olarak oluşturuldu. Tarayıcıdan admin girişi başarılı; Risk Profilleri
bölümünde sıralama değiştirilip kaydedildi, sayfa yenilendiğinde değişiklik
kalıcı olarak korundu (RLS admin `update` policy'si çalışıyor), ardından
sıralama eski haline getirilip tekrar kaydedildi. **Admin RLS yazma yolu
uçtan uca canlıda doğrulanmıştır** — 5. bölümdeki bilinçli sınır artık kapanmıştır.

## 6. Fon Kataloğu Genişletme, Model Fon Değişimi, Arayüz Sadeleştirme (bu oturumda yapıldı, 2026-09-05/06)

Kullanıcının canlı inceleme sonrası talep ettiği 5 madde uygulandı:

**a) Mevduat vade dilimi kaldırıldı.** Kullanıcı ekranından ve admin
model editöründen vade dilimi gösterimi/yönetimi tamamen çıkarıldı;
`depositBuckets.ts` (domain) ve admin editördeki `DepositBucketEditor`
silindi. `model_deposit_buckets` tablosu ve RLS policy'leri (eski
migration'lar) **değiştirilmedi** — geriye dönük uyumluluk için şemada
duruyor, uygulama artık okumuyor/yazmıyor.

**b) "Portföyü Hesapla" butonu taşındı.** Artık tutar + risk profili
kartının içinde (masaüstünde iki alan yan yana, buton altında tam
genişlikte; mobilde hepsi alt alta, buton tam genişlikte). Eski
`sticky-action-bar` (mobil sabit alt buton) kaldırıldı.

**c) Teknik yuvarlama detayları arayüzden gizlendi.** "PPF'ye aktarılan
yuvarlama farkı" ve fon satırındaki "Kalan" sütunu kaldırıldı; hesaplama
motoru (`engine.ts`) **değişmedi** — PPF transferi arka planda aynen
çalışıyor, sadece gösterilmiyor. Fon satırlarına gerçek fon adı eklendi
(`FundLineResult.fundName`, yalnızca gösterim amaçlı yeni alan). Eski
"Planlanan/Gerçekleşen Dağılım" karşılaştırma tablosu da kaldırıldı (bkz.
Bölüm 8).

**d) TÜM katılım fonları sisteme alındı.** TEFAS'ın `fonGnlBlgSiraliGetir`
toplu liste endpoint'i (`fonKodu=null`, `aramaMetni="KATILIM"`) canlı
olarak keşfedildi ve doğrulandı — tek bir istekle bir fon tipindeki TÜM
katılım fonlarını (fiyat+tarih+büyüklük+yatırımcı dahil) döndürüyor;
fon başına ayrı istek tamamen kalktı. YAT (menkul kıymet yatırım fonu) +
BYF (borsa yatırım fonu) tipleri taranıyor; EMK/GYF/GSYF (emeklilik/GYO/
girişim sermayesi) bilinçli olarak kapsam dışı bırakıldı — bunlar farklı
bir satın alma modeline sahip, retail fon alım-satımı yapan bu uygulamanın
kapsamına girmiyor.

Sınıflandırma iki katmanlı: `webappuygulamalar/katilim-fonlari` (salt
okunur, yalnızca okundu) referans deposundaki 198 fonluk bağımsız tarama
kod bazında öncelikli kaynak (`referenceCatalog.ts`, 2026-09-04 anlık
görüntüsü); bilinmeyen/yeni fonlar için TEFAS başlığına dayalı sezgisel
kurallar (`classifyFund.ts`) devreye giriyor — yabancı/uluslararası piyasa
ibaresi olan hisse fonları BIST Katılım Hisse'ye kesinlikle dahil edilmiyor.
`funds.asset_class` (5 sabit değerli enum, **değişmedi**) artık nullable —
NULL = "model dışı diğer katılım fonları" (kira sertifikası, çoklu varlık,
fon sepeti, tematik/sektörel, karma). Yeni sütunlar: `catalog_category`,
`is_participation_fund`, `is_substitution_eligible`, `risk_value` (yeni
migration `20260905150000_fund_catalog_expansion.sql`; eski migration'lar
değiştirilmedi).

Fonlar sayfası kategori/portföy şirketi/fon türü/risk filtreleriyle
genişletildi; masaüstünde tablo, mobilde kart.

**e) Ayrı fon seçim sayfası** (`/fon-degistir/:assetClass`): model
dağılımındaki her fon kartına (mevduat hariç) "Fonu değiştir" bağlantısı
eklendi; sayfa yalnızca aynı model sınıfına uygun (`is_substitution_eligible`)
fonları arama/filtreyle listeler, "Standart fon"/"Seçildi" rozetleri
gösterir, fiyatsız fonun seçim butonu devre dışı + nedeni yazılı. Seçim
yeni bir `CalculatorSelectionContext` (sessionStorage) ile tutuluyor —
**veritabanına hiçbir şey yazılmıyor**; sayfalar arası gidiş-gelişte girilen
tutar/profil kaybolmuyor (gerçek tarayıcıda doğrulandı). Admin standart fon
seçimi de artık yalnızca `is_substitution_eligible` fonları listeliyor.

**Canlı senkronizasyon — teşhis edilen ve düzeltilen gerçek hata:**
İlk deploy sonrası kullanıcı admin panelinden manuel senkronizasyonu
tetiklediğinde `"Failed to send a request to the Edge Function"`
(`FunctionsFetchError`) hatası alındı, `sync_runs`'a hiç kayıt düşmedi.
Kök neden: yeni toplu keşif mantığı iki fon tipini (YAT, BYF) **sırayla**,
her biri 20 saniyelik timeout ile çekiyordu; canlı Supabase Edge Function
ortamından TEFAS'a giden gerçek gecikme yerelden farklı olduğundan toplam
süre platformun bağlantı/çalışma süresi sınırını aşıp bağlantının
düşmesine yol açmış olabilir (kesin sunucu logu erişimi yoktu — CLI'de
`functions logs` alt komutu bulunmuyor; teşhis, gerçek Deno çalışma zamanı
ile canlı TEFAS'a karşı yerel tekrar üretim + kod incelemesiyle yapıldı).
Düzeltme: iki fon tipi artık `Promise.allSettled` ile **paralel ve
birbirinden izole** çekiliyor (biri başarısız olursa diğeri kaybolmuyor),
istek başına timeout 12 saniyeye düşürüldü, ve **tüm işleyici** tek bir
try/catch ile sarmalandı — herhangi bir beklenmeyen hata artık
`sync_runs`'ı sonsuza dek "running" bırakmadan `failed` olarak kapatıyor.
Admin panelindeki ham İngilizce SDK hatası yerine anlaşılır Türkçe mesaj
gösteriliyor (`FunctionsFetchError`/`FunctionsRelayError`/`FunctionsHttpError`
ayrımıyla).

**Düzeltme sonrası da hata devam etti — asıl kök neden CORS preflight
eksikliğiydi.** Yukarıdaki paralel/timeout düzeltmesi gerçek ve gerekliydi,
ancak admin panelinden manuel tetikleme hâlâ aynı hatayı veriyordu; cron
yolu (server-to-server, tarayıcı yok) başarılıydı ama bu manuel/JWT yolunu
doğrulamıyordu. Canlı `curl` ile doğrudan kanıtlandı: tarayıcının
`Authorization`/`apikey`/`x-client-info` header'ları nedeniyle önce
gönderdiği CORS preflight (`OPTIONS`) isteği, fonksiyonun `if (method !==
"POST")` kontrolüne takılıp **hiçbir CORS header'ı olmadan 405** dönüyordu
— tarayıcı bunu görünce asıl POST isteğini hiç göndermiyor, sunucuda
sıfır kod çalışıyor, `sync_runs`'a kayıt düşmüyordu. Bu, fonksiyonun
mevcut olduğu tarihten beri (bu oturumdan önce de) var olan bir hataydı;
önceki "manuel, admin JWT ile başarılı" kayıtları gerçek bir tarayıcı
tıklamasından değil, doğrudan sunucu-sunucu test çağrılarından gelmiş
olmalı. Düzeltme: `_shared/jsonResponse.ts`'e paylaşılan `CORS_HEADERS`
eklendi (tüm yanıtlara, 401/403/500/502 dahil, uygulanıyor) ve `index.ts`
artık `OPTIONS` isteğini auth kontrolünden önce koşulsuz yanıtlıyor.
Canlıda doğrulandı: preflight artık `204` + doğru CORS header'larıyla
dönüyor, yetkisiz POST'un `401` yanıtı da aynı header'ları taşıyor (böylece
tarayıcı hata gövdesini okuyabiliyor). Cron yolu regresyon testiyle
(`trigger_tefas_sync()` doğrudan çağrılarak) etkilenmediği doğrulandı.

**Gerçek tarayıcı doğrulaması (kullanıcı tarafından, 2026-09-06):** Admin
panelinden "TEFAS fiyatlarını güncelle" butonuna tıklandı — manuel
senkronizasyon **uçtan uca başarılı** oldu. Çalışma geçmişinde yeni kayıt:
**Manuel / success / 286 kontrol / 268 güncellenen / 0 başarısız.** CORS
preflight, admin JWT doğrulaması ve manuel Edge Function çağrısının tamamı
gerçek bir tarayıcı oturumuyla doğrulanmıştır — bu, TEFAS senkronizasyonu
için hem cron hem de manuel/admin tetikleme yollarının artık ikisinin de
canlıda kanıtlanmış olduğu anlamına gelir.

**Düzeltme sonrası canlı doğrulama (2026-09-06, iki ardışık çalıştırma):**

| Metrik | 1. çalıştırma | 2. çalıştırma (idempotency) |
|---|---|---|
| Süre | 7,9 sn | 3,1 sn |
| `status` | success | success |
| `funds_checked` (toplam benzersiz katılım fonu) | 286 | 286 |
| `funds_updated` (geçerli fiyatla güncellenen) | 268 | 268 |
| `funds_failed` | 0 | 0 |

İki çalıştırma arasında `funds` tablosunda **tekrar/duplicate kod oluşmadı**
(anon anahtarla doğrulandı) — upsert `code` üzerinden idempotent. 18 fonun
o günkü fiyatı TEFAS'ta 0/geçersizdi (askıya alınmış/yeni fon olabilir) —
bu fonlar kataloğa eklendi ama o günün fiyat satırı atlandı (uydurulmadı).

**Model sınıflarına göre seçilebilir (is_substitution_eligible=true) fon sayıları:**

| Model sınıfı | Seçilebilir fon sayısı |
|---|---|
| Para Piyasası Katılım Fonu | 51 |
| BIST Katılım Hisse Fonu | 46 |
| Altın Katılım Fonu | 38 |
| Döviz Katılım/Borçlanma Fonu | 49 |
| **Toplam model-içi** | **184** |
| Model dışı (katalogda görünür, değişimde seçilemez) | 102 |
| — bunlardan "doğrulama gerekli" (belirsiz/yabancı) | 1 |

Gerçek tarayıcıda (Playwright, headless Chromium) uçtan uca doğrulandı:
hesaplama gerçek TEFAS fiyatlarıyla doğru çalışıyor, buton girdi kartının
içinde, yuvarlama/vade dilimi metinleri hiçbir yerde yok, "Fonu değiştir"
→ 46 satırlık BIST listesi → filtre → seçim → geri dönüşte tutar/profil
korunuyor, "Standart model değiştirildi" uyarısı çıkıyor, Fonlar sayfası
286 fonu doğru filtreliyor, masaüstünde/mobilde yatay taşma yok, konsol
hatası yok.

## 7. Test / Lint / Build Sonuçları (en güncel — Bölüm 20 sonrası, aynı 236/236 — ikon değişiklikleri yeni test gerektirmedi, görsel doğrulama Bölüm 19-20'de)

```
Lint:      0 hata, 2 zararsız uyarı (context+hook aynı dosyada — standart pratik, iki context dosyası için)
Typecheck: temiz (tsc -b; supabase/functions/** ayrıca `deno check` ile de temiz)
Test:      236/236 geçti (21 dosya)
Build:     başarılı (dist/, PWA service worker üretildi)
Advisor:   0 şema/RLS uyarısı (2 auth-seviyesi WARN var: leaked-password-protection, MFA — bu oturumun kapsamı dışında, proje geneli Auth ayarları)
```

(Bölüm 6 sonundaki 119/119 ve daha sonraki 179/179, 203/203 rakamları bu
sayının önceki anlık görüntüleridir; o bölümlerdeki diğer detaylar hâlâ
geçerlidir, yalnızca toplam test sayısı sonraki oturumlarda eklenen yeni test
dosyalarıyla arttı.)

## 8. Bilinen/Açık Notlar

- **Cron secret rotasyonu — tamamlandı.** `tefas-sync` fonksiyonunun
  canlıda "Failed to send a request" hatası verdiği kök neden teşhis
  edilirken (bkz. Bölüm 6) test amacıyla bir defaya mahsus rotasyon
  gerekti. Yeni, kriptografik olarak güçlü bir değer üretildi; Edge
  Function `CRON_SECRET` secret'ı ve Supabase Vault'taki `tefas_sync_secret`
  kaydı bu değere eşitlendi. Gerçek cron yetkilendirme yolu
  (`public.trigger_tefas_sync()`) doğrudan tetiklenerek doğrulandı — yeni
  bir `sync_runs` kaydı `trigger_type=cron`, `status=success`,
  `funds_checked=286` ile oluştu. Secret değerinin kendisi hiçbir dosyada,
  komut çıktısında veya sohbette yer almadı.
- ~~BKY (döviz katılım fonu) referans veride başlangıçta "USD" olarak
  etiketlenmişti ancak TEFAS'tan gelen canlı veri TL (`TRY`) cinsinden
  geliyor~~ — **BU YANLIŞTI, düzeltildi.** Bkz. Bölüm 9: BKY'nin gerçek
  para birimi USD'dir, referans veri baştan doğruymuş. Bu notu buradan
  siliyoruz; kayıt için tutuluyor.
- Yeni bir Supabase projesinde e-posta/parola sağlayıcısı
  (`external_email_enabled`) varsayılan kapalı gelebilir; bu `config.toml`
  push'uyla düzeltilemez, Dashboard → Authentication → Providers → Email'den
  açılmalıdır (README'de belgelendi, bu projede zaten açık).
- `dist/assets/index-*.js` ~538 kB (gzip ~156 kB) — Vite büyük chunk uyarısı
  veriyor, işlevsel bir sorun değil; ileride code-splitting ile küçültülebilir.
- ~~`risk_value` için güvenilir bir CANLI toplu kaynak bulunamadı... yalnızca
  176 fon için otomatik uygulanır~~ — **ARTIK GEÇERLİ DEĞİL, bkz. Bölüm 12.**
  KAP'ın (Kamuyu Aydınlatma Platformu) resmi, herkese açık arama API'si
  kaynak olarak bulundu ve ayrı bir `kap-risk-sync` job'ı ile 286 fondan
  **249**'u için gerçek risk değeri elde edildi (176 değil). TEFAS'ın toplu
  endpoint'inin risk döndürmediği bilgisi hâlâ doğru — KAP farklı, ayrı bir
  kaynak. Getiri (1ay/3ay/YBB/1yıl) alanları hâlâ TEFAS'ın kendi değerlerine
  güvenilmeden, uygulamanın kendi topladığı `fund_prices` geçmişinden
  hesaplanıyor (mevcut mimari, değişmedi).
- `management_company` bazı fonlar için (unvanda "PORTFÖY" kelimesi
  geçmeyen ~4 fon, ör. bir ihraççının doğrudan çıkardığı varlık finansmanı
  fonu) çıkarılamaz ve "—" gösterilir; uydurma veri eklenmez.
- Otomatik sınıflandırma sezgiseldir (bilinen fon kodları için referans
  katalog önceliklidir); yabancı/uluslararası piyasa ibaresi taşıyan bir
  hisse fonu tespit edilirse BIST Katılım Hisse sınıfına dahil edilmez,
  "doğrulama gerekli" işaretlenir ve fon değişiminde seçilemez hale gelir.
- Hesaplama sonuç ekranındaki eski "Planlanan / Gerçekleşen Dağılım"
  karşılaştırma tablosu, teknik/kafa karıştırıcı bulunarak kaldırıldı
  (Bölüm 6); aynı bilginin özeti artık yalnızca "Toplamlar" kartında.

## 9. Kritik Veri Düzeltmesi: Döviz Fonu Para Birimi ve Risk Verisi (2026-09-06)

Kullanıcının Fonlar sayfasında yaptığı incelemede üç konu tespit edildi:
(a) gereksiz kolonlar, (b) Risk kolonu her zaman "—" ve Risk 1 filtresi 0
sonuç veriyor, (c) **tüm fonlar TRY görünüyor — BKY gibi döviz fonlarında
bu, pay hesabını yanlış çıkarma riski taşıyan kritik bir sorun.**

**a) Gereksiz kolonlar kaldırıldı.** Fonlar sayfasının masaüstü tablosu ve
mobil kartlarından Portföy Şirketi, Model Sınıfı, Tür kaldırıldı (veride
kalıyor, yalnızca gösterilmiyor). Arama (kod/ad/portföy şirketi) ve Portföy
Şirketi filtresi korundu. Fon türü filtresi kaldırılmadı — "Yatırım Fonu"/
"Borsa Yatırım Fonu" TEFAS'tan gelen, gerçekten farklı iki değer, koşul
sağlanıyor.

**b) Risk verisinin kök nedeni.** TEFAS'ın toplu liste endpoint'i
(`fonGnlBlgSiraliGetir`) risk alanı döndürmüyor. Canlı olarak ayrıca
`fonBilgiGetir` ve `fonDetayGetir` uç noktaları denendi (`fonBilgiGetir`
gerçek veri döndürüyor: fonKodu, sonFiyat, portBuyukluk, fonKategori vb.)
— ikisinde de risk alanı yok. TEFAS'ın genel web sayfaları (FonAnaliz.aspx,
fon-karsilastirma) bot korumasına takıldığı için tarayıcıyla da
doğrulanamadı. **Sonuç: TEFAS'ta güvenilir, toplu bir canlı risk kaynağı
yok.** Risk değeri fon adından ASLA türetilmez (uydurma yok); yalnızca
referans kataloğun (198 fon, TEFAS Fon Getirileri ekranından derlenmiş,
2026-09-04 anlık görüntüsü) `risk_source='reference_catalog_2026-09-04'`
ile işaretli 176 fonu için otomatik uygulanır. Yeni migration
(`risk_source`, `risk_updated_at`) eklendi; günlük senkronizasyon artık
risk verisi OLMAYAN fonlar için `risk_value`/`risk_source` sütunlarını
upsert payload'ına HİÇ DAHİL ETMİYOR (ayrı batch) — böylece gelecekte
başka bir yoldan girilecek bir risk değerini asla null'a ezmez.

**c) Para birimi kök nedeni ve kritik düzeltme.** TEFAS'ın toplu liste
endpoint'i para birimi alanı da döndürmüyor; önceki senkronizasyon TÜM
fonlara varsayılan `currency='TRY'` yazıyordu. Bu, "Döviz katılım serbest"
sınıfındaki fonlar için (BKY dahil) **yanlıştı**.

*Doğrulama yöntemi (kanıta dayalı, tahmine dayalı değil):* Referans
kataloğun 198 fonluk bağımsız verisinde, başlığında "Döviz" geçen 21
fonun TAMAMI USD/EUR etiketli — TL olan yok. Ayrıca getiri karşılaştırması
bunu bağımsız olarak doğruladı: TL para piyasası fonlarının referans
veride ortalama 1 yıllık getirisi ~%45 (Türkiye'nin yüksek TL faiz/enflasyon
ortamıyla tutarlı) iken, USD döviz katılım fonlarının ortalama 1 yıllık
getirisi yalnızca ~%19,5 — bu, TL'ye çevrilmiş bir görünüm değil, gerçekten
USD cinsinden mütevazı bir getiriye işaret ediyor (TL'ye çevrilmiş olsaydı
kur farkı nedeniyle çok daha yüksek görünürdü). "Avro"/"Euro" geçen
başlıklar EUR, geçmeyenler USD — bu ayrım da 198 örnekte istisnasız
doğrulandı.

*Düzeltme:* `classifyFund.ts`'e başlık tabanlı `detectCurrencyFromTitle`
kuralı eklendi (bilinen kodlarda referans kataloğun kendi para birimi
önceliklidir). `fund_prices.currency` artık fonun native para birimi;
fiyat DEĞERİ hiçbir zaman TL'ye çevrilmiyor (TEFAS'ın native sayısı olarak
kalıyor) — TL karşılığı yalnızca hesaplama ANINDA, `fx_rates` ile,
hesaplama motorunun zaten var olan (ama şimdiye kadar hiç veri almamış)
döviz çevrim mantığıyla türetiliyor. Yeni `fxRateAdapter.ts`, TCMB'nin
resmi günlük kur XML'inden (`tcmb.gov.tr/kurlar/today.xml`, kimlik
doğrulama gerektirmez) USD/EUR "döviz alış" kurunu çekip `fx_rates`'e
yazıyor — bu tablo daha önce tamamen boştu.

**Canlı doğrulama (2026-09-06):**

| Metrik | Değer |
|---|---|
| Toplam katılım fonu | 286 |
| TL fon | 233 |
| USD fon | 40 |
| EUR fon | 13 |
| Risk değeri bilinen fon | 176 / 286 |
| Doğrulama gereken fon | 1 |
| Model sınıfına göre seçilebilir | Para Piyasası 51, BIST Hisse 46, Altın 38, Döviz 49 |
| `fx_rates` | USD=48,2326 TL, EUR=56,0571 TL (TCMB, 2026-09-04) |

**BKY doğrulaması (gerçek tarayıcıda, ekran görüntüsüyle teyit edildi):**
native fiyat **50,25 USD**, TCMB kuruyla (1 USD = 48,23 TL) yaklaşık TL
karşılığı **≈2.423,93 TL** — önceki (yanlış) "50,25 TL" varsayımından
**~48 kat** farklı. 120.000 TL'lik bir portföyde %2 BKY tahsisi (2.400 TL
hedef) ile gerçek fiyatta **0 pay** alınabildiği doğrulandı (2.400 / 2.423,93
< 1) — kalan tutar doğru şekilde PPF hedefine aktarıldı, toplamlar
tutarlı kaldı (Mevduat + Fonlar + Cari = Toplam Portföy). Kur eksik olsaydı
hesaplama `MISSING_FX_RATE` ile engellenecekti (mevcut motor mantığı,
değiştirilmedi) — bu oturumda kur her zaman mevcuttu, bu davranış canlıda
ayrıca tetiklenmedi ama motor testleriyle (`engine.test.ts`) zaten kapsanıyor.

**UI:** AllocationEditor ve FundSubstitutionPage'de fiyatın yanında artık
sabit "TL" yerine fonun gerçek para birimi gösteriliyor. CalculationSummary'de
döviz fonu satırlarında "Native fiyat: X USD/EUR" + "≈Y TL (yaklaşık TL
karşılığı)" + kullanılan kur/tarih/kaynak ayrıca gösteriliyor. Fonlar
sayfasındaki Para Birimi filtresi artık gerçek TL/USD/EUR seçenekleri
sunuyor ve her biri gerçek fonlar döndürüyor (USD filtresi → 40, doğrulandı).
Admin panelinde yeni "Veri Kapsamı" kartı: toplam fon, risk bilgili fon,
doğrulama gereken fon, para birimi dağılımı, sınıf başına seçilebilir fon
sayıları.

**Test:** 109/109 (yeni: `fxRateAdapter.test.ts`, `classifyFund.test.ts`'e
para birimi testleri, `format.test.ts`'e `formatCurrencyCode` testleri).
Commit `ef07710`, canlı doğrulandı, GitHub Pages HTTP 200.

## 10. Pay Hesaplama Sırası, Getiri Geçmişi Geri Yükleme, İşaret Düzeltmesi (2026-09-06)

**a) Pay Hesaplama Özeti sırası.** Artık Mevduat → PPF → kalan fonlar
model yüzdesine göre büyükten küçüğe → Cari Hesap. Yeni, test edilebilir
saf fonksiyon: `components/portfolio/fundLineOrder.ts`
(`orderFundLinesForDisplay`, 4 test). **Yalnızca gösterim sırası** —
`calculatePortfolio` motorunun PPF'yi diğer fonların kalanını topladıktan
sonra en son hesaplama sırası hiç değişmedi.

**b) Getiri boşluğunun kök nedeni ve düzeltmesi.** `fund_returns`
view'ının SQL mantığı (sıfıra bölme koruması, hafta sonu/tatil için
"on or before" fiyat arama, YBB için önceki yıl sonu fiyatı) **zaten
doğruydu** — tek sorun `fund_prices`'ta yalnızca 1-2 günlük fiyat geçmişi
olmasıydı. Canlı olarak doğrulandı: TEFAS'ın toplu liste endpoint'i tek
istekte ~1 aydan uzun tarih aralığını **reddediyor**
(`"Geçersiz veri: Tarih aralığı 1 ayı aşamaz"`). Bu yüzden ayrı,
checkpoint'li bir `history-backfill` Edge Function'ı eklendi (yeni
migration: `price_backfill_checkpoint` singleton + `price_backfill_runs`
log + `trigger_price_backfill()` — `trigger_tefas_sync()` ile birebir aynı
desen, aynı cron secret'ı kullanır). Her çağrı yalnızca bir sonraki ~27
günlük pencereyi işler; günlük `tefas-sync` akışına dokunulmadı/yavaşlatılmadı.

**Canlı sonuç (14 çağrıda, hepsi başarılı, 0 hata):**

| Metrik | Değer |
|---|---|
| İşlenen pencere sayısı | 14 (27 gün × 13 + ilk kısmi) |
| Toplam yüklenen fiyat satırı | 61.602 |
| Kapsanan tarih aralığı | 2025-09-01 → 2026-09-04 (370 gün) |
| Geçmişi olan fon sayısı | 270 / 286 |
| 1 ay getirisi dolu | 265/270 (%98,1) |
| 3 ay getirisi dolu | 253/270 (%93,7) |
| YBB getirisi dolu | 238/270 (%88,1) |
| 1 yıl getirisi dolu | 210/270 (%77,8) |

Kalan boşluklar doğrulandı: örneklenen 5 fonun (OMT, GOK, VHK, GLL, VKR)
`fund_prices`'taki en eski kaydı 2026-08-20 ile 2026-09-02 arası — yani
gerçekten yeni fonlar, veri eksikliği değil ("Fon ilgili dönem kadar eski
değilse getiri uydurma" kuralı doğru çalışıyor). **BKY'nin (native USD)
hesaplanan getirileri** (1 ay %2,05, 3 ay %6,40, YBB %16,26) referans
kataloğun bağımsız olarak raporladığı değerlerle (m1 2.0487, m3 6.4011,
yb 16.2908) **eşleşiyor** — bu, döviz fonlarının getirisinin günlük kur
değişimi karıştırılmadan kendi native fiyat serisinden hesaplandığını
bağımsız olarak doğruluyor. Duplicate `(fund_id, price_date, currency)`
kontrolü: 0 satır.

**c) Risk verisi araştırması — sonuç değişmedi, kanıt eklendi.** TEFAS'ın
`fonBilgiGetir` (gerçek veri döner: fonKodu, sonFiyat, portBuyukluk,
fonKategori, kategoriDerece — ama risk yok) ve `fonDetayGetir` uç noktaları
ile birkaç ek olası endpoint adı (fonKarneGetir, fonRiskGostergesiGetir vb.
— hepsi 404) canlı olarak denendi. TEFAS'ın web arayüzü (FonAnaliz.aspx,
fon-karşılaştırma) bot korumasına takılıyor — **bypass edilmeye
çalışılmadı** (talimat gereği). Sonuç (bu bölümdeki araştırma için): 176/286
kapsam o an için maksimumdu; KAP veya 40+ farklı portföy yönetim şirketinin
kendi sitelerini tek tek kazımak güvenilir/tutarlı bir programatik kaynak
değil, bu oturumda denenmedi (yanlış veri üretme riski, "kanıtlamadan
tamamlandı deme" ilkesiyle çelişir). `risk_source_url`, `risk_verified`
sütunları eklendi; admin panelinde eksik risk kodları görüntülenebiliyor
(`DataCoverageCard`). **Not: kullanıcı daha sonra KAP'ın gerçekten resmi bir
risk sayfası olduğuna dair somut kanıt (iki örnek URL) verdi; bu, o zaman
denenmemiş bir kaynak (KAP) ile TEFAS'ın kendisini karıştırmamak kaydıyla
haklı çıktı — bkz. Bölüm 12, kapsam 176'dan 249'a çıktı.**

**d) İşaret hatası düzeltildi.** Getiri yüzdelerinde negatif değerler
`%-3,2` yerine artık doğru sırayla `-%3,2` gösteriliyor
(`formatSignedPercent`, 3 yeni test).

**Ortak yetkilendirme kodu paylaşıldı:** `tefas-sync` ve `history-backfill`
artık `_shared/authenticateSyncRequest.ts`'i kullanıyor (aynı mantığın iki
yerde kopyalanıp zamanla tutarsızlaşması riskini önler); regresyon
testiyle (`trigger_tefas_sync()` doğrudan çağrılarak) `tefas-sync`'in
etkilenmediği doğrulandı.

**Test:** 119/119 geçti (13 dosya). Lint 0 hata, `deno check` (her iki
Edge Function) temiz, build başarılı. Commit `d857fcc`, GitHub Pages
canlıda HTTP 200.

## 11. PWA Service Worker Otomatik Güncelleme Sorunu (2026-09-06)

Kullanıcı, Bölüm 10'daki Pay Hesaplama Özeti sıralama düzeltmesinin canlıda
**uygulanmamış göründüğünü** bildirdi (ekran görüntüsünde eski sıra: Mevduat,
BIST, Altın, Döviz, PPF, Cari — istenen sıra: Mevduat, PPF, BIST, Altın,
Döviz, Cari).

**Teşhis (kodu suçlamadan önce kanıtlandı):** `git show d857fcc:...` ile
kaynak kod kontrol edildi — doğruydu. Ardından **temiz bir tarayıcı
profiliyle** (önceden hiç ziyaret edilmemiş, sıfır önbellek) canlı siteye
gidilip DOM'daki gerçek sıra okundu — **o da doğruydu** (Mevduat → PKT →
ZKP → ZGD → BKY → Cari). Bu, sunucu tarafında hiçbir sorun olmadığını,
kullanıcının SADECE kendi tarayıcısında eski bir önbelleğe takılı kaldığını
kanıtladı.

**Kök neden:** `vite-plugin-pwa`, `registerType: "autoUpdate"` ile
ayarlanmıştı ama istemci tarafında hiç etkinleştirilmemişti — varsayılan
enjekte edilen script yalnızca service worker'ı BİR KEZ kaydediyor, yeni bir
dağıtım olduğunda bunu aktif olarak denetleyip uygulamıyordu. Bu yüzden bir
kullanıcı, sekmesini kapatıp yeniden açana kadar (bazen daha da uzun) eski,
önbelleğe alınmış sürümü görmeye devam edebiliyordu.

**Düzeltme** (`vite.config.ts`, `src/main.tsx`, `tsconfig.app.json`):
`injectRegister: false` + workbox `skipWaiting`/`clientsClaim: true` +
`main.tsx`'te `virtual:pwa-register`'dan `registerSW({ immediate: true })`
çağrısı.

**Canlı doğrulama — gerçek bir "önce/sonra" testi (simülasyon değil):**
kalıcı bir Playwright tarayıcı profili, BU DÜZELTME dağıtılmadan ÖNCE canlı
siteye gidip eski service worker'ı ve eski ikonu (bkz. Bölüm 14, o an hâlâ
4.700 baytlık placeholder) kaydetti. Düzeltme dağıtıldıktan SONRA, AYNI
profil hard refresh YAPILMADAN yeniden ziyaret edildi:

| t (saniye) | `apple-touch-icon` href | Not |
|---|---|---|
| 0 | eski dosya | Sayfa ilk yüklendi |
| 2 | eski dosya | Henüz güncellenmedi |
| ~3,7 | *(otomatik yeniden yönlendirme)* | Yeni service worker devraldı, sayfa kendiliğinden yeniden yüklendi |
| 4 | **yeni dosya** | Güncelleme tamamlandı |

Hiçbir kullanıcı etkileşimi (tıklama, hard refresh, sekme kapatma) olmadan,
sayfa yüklendikten ~4 saniye sonra kendiliğinden güncellendi. Bu mekanizma
daha sonra Bölüm 14'teki ikon değişikliğiyle DE bağımsız olarak yeniden
doğrulandı (aynı sonuç). Commit `5477ba7`.

## 12. KAP Risk Değeri Zenginleştirme (2026-09-06)

Kullanıcı, "risk için üst sınır 176/286'dır" sonucunun (Bölüm 9-10) yanlış
olduğunu belirtti: KAP'ın (Kamuyu Aydınlatma Platformu) resmi fon
sayfalarında doğrudan bir "Fonun Risk Değeri" alanı ve sayısal bir değer
bulunduğunu, iki gerçek örnek URL vererek gösterdi.

**Adım 1 — verilen örnekler incelendi, kapsam dışı çıktı.** İki örnek URL'nin
gömülü verisi (Next.js RSC akışı, `self.__next_f.push` içindeki JSON)
ayrıştırıldı: ikisi de `fundType: "EYF"` (emeklilik fonu), sigorta/emeklilik
şirketleri tarafından kurulmuş, biri açıkça **"Faiz İçerir"** ibaresi
taşıyan fonlardı — yapısal ve dini olarak bu uygulamanın katılım fonu
kapsamı DIŞINDA.

**Adım 2 — KAP'ın gerçek, izinli arama API'si bulundu ve kullanıldı.**
Playwright ağ izlemesiyle KAP'ın kendi arama kutusunun `POST
https://www.kap.org.tr/tr/api/search/combined` (`{"keyword","discClass":
"ALL","lang":"tr","channel":"WEB"}`) çağrısı yaptığı görüldü — güvenlik
önlemi (rate limit dışında) YOK, düz `curl` ile de çalışıyor. Bu, fon
kodunu (`cmpOrFundCode`) doğrudan KAP'ın dahili `memberOrFundOid`'ine
çözüyor.

**Adım 3 — ilk ayrıştırma denemesi HATALIYDI, düzeltildi (kanıtlamadan
"yok" denmedi).** BKY/PKT/AIS gibi 3 gerçek katılım fonu ilk kez kontrol
edildiğinde üst düzey bir "Fonun Risk Değeri" alanı bulunamadı ve
başlangıçta "KAP bu fon türü için risk verisi sağlamıyor" sonucuna
varılacaktı. Daha geniş bir örneklemle (50 fon) devam edilince gerçek
şema ortaya çıktı: risk verisi üst düzeyde DEĞİL, **"Fonun Yatırım Amacı
veya Stratejisi" alanının içine gömülü**, çoğunlukla pay grubu bazlı
serbest metin olarak geliyor (ör. `"TL:6 USD:3"`, `"A grubu paylar için
5"`) — BKY'nin kendisinde de gerçekten vardı, ilk ayrıştırıcı yalnızca üst
düzey alanlara bakıp bunu kaçırmıştı. Bu, oturumun kendi "kanıtlamadan
tamamlandı deme" ilkesinin tam olarak neyi önlediğinin bir örneğidir.

**Ayrıştırma mantığı** (`supabase/functions/kap-risk-sync/kapRiskParser.ts`,
23 test — kullanıcının verdiği risk=7/risk=2 örnek sayfalarının gerçek
verisiyle dahil):

- Önce üst düzey "Fonun Risk Değeri" şeması denenir (emeklilik fonu tipi
  sayfalarda görülen); "Fonun Risk Aralığı" ile çelişiyorsa (ör. aralık
  1-2 ama değer 6) HİÇBİRİ kullanılmaz.
- Yoksa "Fonun Yatırım Amacı veya Stratejisi" içindeki `riskDegeri`
  metinleri taranır (yalnızca bu alt-alan — uzun serbest metin
  açıklamasının kendisi ASLA taranmaz, alakasız bir sayı risk sanılmasın
  diye).
- Para birimi etiketli birden çok pay grubu varsa (`TL:6 USD:3` gibi),
  fonun GERÇEK para birimine (Bölüm 9'da doğrulanmış `funds.currency`)
  göre doğru grup seçilir — BKY (USD) için TL:6 değil USD:3 seçilir.
- Yalnızca harf grubu (A/B) var ama para birimi etiketi YOKSA (ör. KDT: "A
  grubu paylar için 5" / "B grubu paylar için 3"), **tahmin edilmez** —
  `risk_verification_needed=true` ile admin incelemesine bırakılır.
- Sayıya ayrışmayan metin (ör. bir kaldıraç/VaR paragrafı, içinde "%25"
  geçebilir) risk değeri SANILMAZ.

**Fon eşleştirme güvenliği** (`decideFundUpdate.ts`, 9 test): yalnızca fon
kodu TAM eşleşmesi yetmez — KAP'ın "Kurucunun Ünvanı" alanı, bizim
`management_company` alanımızla (jenerik kelimeler hariç, en az bir anlamlı
kelime örtüşmesi) çapraz kontrol edilir. Eşleşmezse `ambiguous_search_match`
olarak işaretlenir, OTOMATİK KAYDEDİLMEZ.

**Canlıda bulunan ve düzeltilen 2 gerçek eşleştirme hatası:** İlk canlı
çalıştırmada "İş Portföy" (CKS) ve "V Portföy" (VFO/VHK/VTL) yanlışlıkla
"kurucu uyuşmuyor" diye reddedildi — kök neden, kurucu adı normalleştirme
fonksiyonunun 2-3 karakterden kısa marka isimlerini ("İş", "V") jenerik
gürültüyle karıştırıp filtrelemesiydi. Düzeltildi (`"A.Ş."` kalıntısı gibi
GERÇEK jenerik tek harfler hâlâ filtreleniyor, ayrı testlerle kilitlendi),
etkilenen fonlar sıfırlanıp yeniden işlendi.

**Mimari:** `kap-risk-sync` Edge Function, günlük TEFAS senkronizasyonundan
TAMAMEN AYRI — **cron'a bağlı DEĞİL**, yalnızca admin panelinden manuel
tetiklenir (üçüncü taraf bir sitede sürekli/gözetimsiz arka plan isteği
oluşturmamak için kasıtlı tercih). KAP'a aynı anda en fazla 3 istek + fon
başına ek gecikme. Her çağrı küçük bir parti (20 fon) işler; `funds.
kap_checked_at` checkpoint görevi görür — risk_value'su olmayan fonlar
önce işlenecek şekilde sıralanır (ayrı bir "aşama" moduna gerek kalmadan
kullanıcının istediği "önce eksikler, sonra tümü" akışını doğal olarak
sağlar). Admin panelinde yeni "KAP Risk Değeri Zenginleştirme" kartı: KAP
doğrulanan/risk elde edilen/referans kalan/eksik/belirsiz sayıları, son
kontrol zamanı, "sıradaki partiyi işle" ve "286'nın tümünü yeniden
doğrula" butonları.

**Canlı sonuç (286 fonun tamamı işlendi):**

| Metrik | Değer |
|---|---|
| KAP'ta doğrulanan fon (kod+kurucu eşleşti) | 249 / 286 |
| KAP'tan risk değeri elde edilen | 224 |
| Referans katalogdan kalan (KAP'tan değil) | 25 |
| Hâlâ eksik | 37 (çoğunlukla Borsa Yatırım Fonu/BYF tipi veya "Varlık Finansmanı Fonu" SPV'leri — KAP'ın bu disclosure kategorisinin kapsamı dışında görünüyor) |
| Belirsiz/çelişkili (admin incelemesi) | 11 |
| Risk 1 / 2 / 3 / 4 / 5 / 6 / 7 dağılımı | 63 / 39 / 18 / 15 / 18 / 84 / 12 |

Fonlar sayfasında Risk 1 filtresi artık **63 sonuç** veriyor (Bölüm 9'da 0
idi). Fon Substitution sayfası aynı temel veriyi kullandığı canlıda çapraz
doğrulandı (VFO örneği her iki sayfada da risk=6). Mevcut 61.602 tarihsel
fiyat satırına dokunulmadı.

### 12.5 Sonradan bulunan gerçek regresyon: tefas-sync KAP değerlerini eziyordu

TEFAS senkronizasyon cron saatlerini güncellerken (Bölüm 15) doğrulama
amacıyla `trigger_tefas_sync()` manuel çağrıldı ve **KAP-kaynaklı risk
sayısı 224'ten 73'e düştü.** Kök neden: `classifyFund()`'un statik referans
kataloğunda (198 fonluk 2026-09-04 anlık görüntüsü) bir risk değeri
bulunan HER fon için `tefas-sync`, `risk_value`/`risk_source`'u koşulsuz
upsert ediyordu — bu, `kap-risk-sync`'in DAHA ÖNCE yazdığı, fon koduna özgü
ve kurucu unvanı çapraz kontrolüyle doğrulanmış KAP değerini her
senkronizasyonda (artık günde İKİ KEZ) sessizce referans kataloğa geri
düşürüyordu.

**Düzeltme** (`classifyFund.ts`'e yeni `shouldSkipReferenceCatalogRisk()`,
5 test): `tefas-sync` artık upsert öncesi ilgili fonların mevcut
`risk_source`'unu okuyor; `kap` ile başlıyorsa risk sütunlarını payload'a
HİÇ dahil etmiyor. Kaynak önceliği artık gerçekten **KAP > referans
katalog** (kullanıcının Bölüm 12 talimatındaki öncelik sırasıyla tutarlı).

**Veri onarımı:** etkilenen 151 fon için `kap_checked_at` sıfırlanıp
`kap-risk-sync` yeniden çalıştırıldı — **151/151** KAP'tan tekrar başarıyla
risk değeri aldı (hepsi gerçekten KAP kaynaklıymış — tahmin değil, gerçek
bir kurtarma). Sayılar tam olarak önceki doğru duruma döndü (224/25/11/37).
`trigger_tefas_sync()` BİR KEZ DAHA çalıştırılıp sayıların DEĞİŞMEDİĞİ
(BKY dahil, `risk_source=kap_currency_group_usd`, değer=3 korundu)
doğrulanarak düzeltmenin kalıcı olduğu kanıtlandı. Commit `906288c` (özellik)
+ `873459d` (regresyon düzeltmesi + onarım).

## 13. Kullanıcı Fon Listelerinde Asgari Uygunluk Kuralı (2026-09-06)

Kullanıcı talebi: risk değeri bilinmeyen VE yatırımcı sayısı (bilinen ve)
50'nin altında olan fonlar, Fonlar kataloğunda ve fon değiştirme seçim
listelerinde gösterilmesin; yatırımcı sayısı bilinmeyen (null) fon bu
kuralla ELENMESİN (tahmin edilmesin).

**Uygulama:** tek bir saf fonksiyon (`domain/calculation/
fundListingEligibility.ts`, `isFundEligibleForListing`, 11 test — sınır
durumları: risk null, yatırımcı 49/50/51/0/null) `useFundsExplorer`
hook'unda (Fonlar SAYFASI + fon değiştirme sayfasının TEK veri kaynağı)
uygulanıyor — arama/filtre/sıralama/sonuç sayısı otomatik olarak yalnızca
uygun fonlar üzerinden çalışıyor, hiçbir sayfada ayrıca kopyalanmadı.
Filtre yalnızca GÖSTERİM katmanında: veritabanından silme veya TEFAS/KAP
senkronizasyonundan çıkarma YOK; yayınlanmış model ve hesaplama motoru
(`usePublishedModel`, ayrı bir veri yolu kullanır) bu filtreden tamamen
bağımsız.

**Canlı veride bulunan ve kullanıcıya sorulan önemli istisna:** kural
harfiyen uygulansaydı, TÜM Borsa Yatırım Fonu (BYF/ETF) tipi fonlar
(12/12) kaybolacaktı — **ZKP ve ZGD dahil, mevcut yayınlanmış modelin
fiilen kullandığı BIST_EQUITY/GOLD standart fonları.** Kök neden: TEFAS'ın
"yatırımcı sayısı" alanı doğrudan katılma payı sahibi sayısını sayar; BYF
payları borsada hisse gibi el değiştirdiğinden bu alan onlar için hiç
anlamlı doldurulmuyor (12 BYF'nin TAMAMI 0/null gösteriyordu). Kullanıcıya
soruldu → **BYF'ler yatırımcı-sayısı kuralından muaf tutulsun (önerilen
seçenek)** onaylandı: BYF tipi fonlarda yalnızca risk değeri kuralı
uygulanır, yatırımcı sayısı null ile aynı (elemeyen) muamele görür.

**Admin uyarısı:** `AdminModelEditorPage`, modelin tercih ettiği bir
standart fon bu kurala uymuyorsa (hesaplama etkilenmeden) admin'i uyarır.

**Canlı doğrulama:** 286 → **204** fon (37 risk-null hariç, geri kalanından
45'i yatırımcı<50 hariç, BYF istisnasıyla 9 BYF geri kazanıldı). Hem yerel
dev sunucuda (gerçek canlı veriye karşı) hem canlı üretimde, masaüstü ve
mobilde doğrulandı — ZKP/ZGD listede, KJK/BI2/TF3 (risk-null veya
yatırımcı<50 normal fonlar) listede değil, konsol hatası yok, yatay taşma
yok. Commit `e88e799`.

## 14. PWA Uygulama İkonu ve Kullanıcı Arayüzü Rozeti (2026-09-06)

Kullanıcı, projeye kaydettiği `fon-portfoy-app-icon-v3.png` (kare,
1254×1254, model dağılımını gösteren bir pasta grafiği: %65/%15/%10/%5/%5)
görselinin geçici "FP" placeholder ikonunun yerini alması istendi.

**PWA ana ekran ikonu (ilk adım):** `icon-192.png`, `icon-512.png`,
`apple-touch-icon.png` (180×180, yeni), `favicon-16/32/48.png` (yeni) —
kaynak zaten kare olduğundan düz orantılı yeniden boyutlandırma, kırpma/
metin/grafik eklenmedi. `icon-maskable-512.png` ayrı ele alındı: pasta
grafiğinin dairesi kaynak tuvalin ölçülen **~%81**'ini kaplıyordu — maskable
"güvenli alan" sınırı olan %80'e çok yakın. Kaynak ~%86,5 küçültülüp kendi
arka plan rengiyle (kenardan örneklenmiş, `#01130D`) dolgulanmış bir tuval
üzerine ortalanarak daire ~%70'e indirildi; tam dairesel maske simülasyonuyla
hiçbir kesilme olmadığı görsel olarak doğrulandı. Eski placeholder
`icon-mask.svg` kaldırıldı. Commit `7e08f8e`.

**Kullanıcı arayüzü rozeti (ikinci, ayrı istek):** Masaüstü sol menü ve
mobil başlıktaki küçük "FP" metin rozeti de aynı `icon-192.png` ile
değiştirildi (yeni görsel kopyası oluşturulmadı, `BASE_URL` ile
referanslandı). **Önemli mimari not:** `.brand-mark` CSS sınıfı, kullanıcı
uygulamasıyla admin panelinin ("Fon Portföy Admin" rozeti) ARASINDA
paylaşılıyor — ilk denemede bu sınıf resim-uyumlu hale getirilmeye
çalışılırken admin'in hâlâ metin olan rozetinin ortalamasının bozulacağı
fark edildi ve CSS'e HİÇ DOKUNULMADI (kaynak görsel zaten kare olduğundan
buna gerek de yoktu). Admin rozeti dokunulmadan aynı "FP" metni olarak
kaldı — canlı tarayıcıda hem admin girişi hem kullanıcı uygulaması ayrı
ayrı kontrol edilerek doğrulandı. Commit `19cb86e`.

Her iki adımda da PWA'nın otomatik güncelleme mekanizması (Bölüm 11)
canlıda uçtan uca yeniden doğrulandı: dağıtımdan önce kurulmuş bir
service worker, dağıtımdan sonra hard refresh olmadan otomatik güncellendi.

## 15. TEFAS Senkronizasyon Saatleri Türkiye Saatine Güncellendi (2026-09-06)

Eski tek cron görevi (`tefas-daily-sync`, 04:30 UTC = 07:30 TR) kaldırıldı;
yerine AYNI, DEĞİŞTİRİLMEMİŞ `trigger_tefas_sync()` fonksiyonunu çağıran iki
görev eklendi: `tefas-sync-0830-tr` (05:30 UTC = 08:30 TR, ilk
senkronizasyon) ve `tefas-sync-0945-tr` (06:45 UTC = 09:45 TR, ikinci
kontrol/tekrar). Vault secret, `CRON_SECRET`, Edge Function ve admin manuel
senkronizasyon yoluna dokunulmadı; eski cron migration'ı da değiştirilmedi
(yalnızca yeni bir migration eklendi, `20260906170000_tefas_sync_schedule.sql`).

İkinci çalışma için ayrı bir "veri güncel mi" kontrolü KASITLI olarak
eklenmedi: `tefas-sync` zaten idempotent (upsert `code` /
`(fund_id,price_date,currency)` üzerinden), bu yüzden günde iki kez
çağrılması güvenli ve zararsız. Hafta sonu/tatilde TEFAS'ın toplu liste
endpoint'i boş dönmediği (yalnızca fiyat tarihi ilerlemediği) için bu durum
zaten mevcut kodda hata sayılmıyor — incelendi, değiştirilmedi.

Admin paneli açıklaması güncellendi: "Fiyatlar her sabah 08:30'da
güncellenir, 09:45'te tekrar kontrol edilir."

**Canlı doğrulama:** `cron.job` tablosunda eski görev yok, iki yeni görev
doğru UTC saatleriyle (`30 5 * * *` / `45 6 * * *`) aktif. Planlanan saat
beklenmeden `trigger_tefas_sync()` doğrudan çağrılarak test edildi —
`sync_runs`'a `trigger_type=cron`, `status=success`, `funds_checked=286`
olarak kaydedildi. (Bu test sırasında Bölüm 12.5'teki regresyon
keşfedildi ve düzeltildi.) Commit `dfeccf7`.

## 16. Mobil Navigasyonun Üst Sekmelere Taşınması (2026-09-07)

Kullanıcı uygulamasındaki mobil navigasyon yeniden düzenlendi: "Hesaplama"
ve "Fonlar" artık ekranın ALTINDA sabit bir sekme çubuğu değil, sayfanın
ÜSTÜNDE, "Fon Portföy" logosunun hemen altında, yan yana eşit genişlikte
iki büyük sekme (min. 52px dokunma alanı). Aktif sekme mint çerçeve +
yumuşak mint arka planla vurgulanıyor. `src/components/layout/UserLayout.tsx`
ve `src/styles/base.css` (`.mobile-tabbar*`) değişti; artık kullanılmayan
`--mobile-bar-height` token'ı kaldırıldı. `.app-topbar` sınıfı admin
panosuyla PAYLAŞILDIĞI için hiç değiştirilmedi — admin, masaüstü sol menü,
rotalar ve PWA ikonu aynı kaldı.

Playwright ile gerçek Chromium üzerinden 320/375/390/428px genişliklerde
(iPhone 14 safe-area/notch, gerçek CDP `Emulation.setSafeAreaInsetsOverride`
ile emüle edilerek) hem Hesaplama hem Fonlar sayfalarında doğrulandı: aktif
sekme doğru değişiyor, yatay taşma yok, içerik üst navigasyon tarafından
kapanmıyor, alt boşluk temizlendi. Commit `2dd9227`.

## 17. Fonlar Sayfası Yeniden Düzenlemesi — Filtre Sadeleştirme, Varsayılan Sıralama, Mobil Kompakt Tablo (2026-09-07)

**Filtre:** "Tüm varlık sınıfları / Para Piyasası Katılım Fonu / ..." combo
box'ı Fonlar sayfasından tamamen kaldırıldı; filtre artık doğrudan "Tüm
kategoriler" ile başlıyor. Kategori seçenekleri artık şu sırada:
Tüm kategoriler → Para Piyasası & Kısa Vade (varsa) → geri kalanı alfabetik
(`sortCatalogCategoriesForFilter`, `src/lib/fundCatalog.ts`). Bu değişiklik
YALNIZCA genel Fonlar kataloğu arayüzünü ilgilendiriyor —
`FundSubstitutionPage.tsx` (fon değiştirme ekranı) hiç dokunulmadı, aynı
model varlık sınıfından fon seçme kısıtı ve ortak asgari uygunluk kuralı
(`isFundEligibleForListing`, Bölüm 13) aynen geçerli.

**Varsayılan sıralama:** Kullanıcı başka bir seçim yapmadıysa fonlar artık
3 aylık getiriye göre yüksekten düşüğe sıralanıyor; 3 aylık getirisi
olmayan fonlar sona düşüyor, eşitlikte fon koduna göre A-Z kararlı sıralama
uygulanıyor. Sıralama dropdown'unun başlangıç etiketi "3 ay getirisi
(yüksekten düşüğe)". Mantık `sortFundRows` (`src/lib/fundCatalog.ts`) içinde
— ortak, test edilebilir, orijinal diziyi değiştirmiyor.

**Mobil kompakt tablo:** Büyük, boşluklu `FundCard`/`record-card` listesi
kaldırıldı; yerine Fon/1 Ay/3 Ay/Büyüklük kolonlu, tek CSS grid'i paylaşan
(`.fund-compact` + `display:contents` satır/gövde sarmalayıcıları) kompakt
bir tablo geldi — bu sayede sütun genişlikleri TÜM satırlar boyunca hizalı
kalıyor (her satır kendi grid'ini oluştursaydı sütunlar kayardı, bu ilk
denemede gerçek veriyle test edilirken ortaya çıktı ve düzeltildi). Fon
büyüklüğü mobilde milyon TL'ye kısaltılıyor (`formatFundSizeShort`,
`src/lib/format.ts`, ör. "343,4 mio ₺"); veri yoksa "—", asla 0/tahmini
değer değil. Sayısal sütunlar (1 Ay/3 Ay: sabit 60px, nowrap; Büyüklük:
70px, gerekirse iki satıra sarar) TEFAS'taki gerçek 204 fonun TAMAMINDA
sıfır taşmayla doğrulandı — masaüstü tablo kolonları ve verileri
değişmedi.

**Doğrulama:** 8 yeni test dosyası/bloğu (`fundCatalog.test.ts`,
`format.test.ts` eklentisi, `FundsPage.test.tsx` — varlık sınıfı filtresinin
yokluğu, kategori sırası, varsayılan sıralama + eksik veri sonda + kod A-Z,
mobil 1 Ay/3 Ay/Büyüklük görünürlüğü, milyon TL kısaltması). Playwright ile
gerçek Chromium + gerçek Supabase verisiyle (204 fon) 320/375/390/428px ve
1280px masaüstünde: yatay taşma yok, filtre/sıralama etkileşimleri
(kategori filtresi, "Ada göre A-Z" sıralaması) doğru çalışıyor,
`fon-degistir/:assetClass` ekranı etkilenmedi. Commit `7a9de1a`.

## 18. Portföy Hesaplama Akışının Yeniden Tasarımı (2026-09-07)

**Risk profili kartları:** "Risk Profili" combo box'ı tamamen kaldırıldı.
Yerine, Toplam Portföy Tutarı alanının altında bütün AKTİF risk
profillerini (`usePublishedModel` → `listActiveRiskProfiles`, filtre
zaten vardı) gösteren, seçilebilir kartlar geldi. Her kart: profil adı,
o profilin GERÇEK model yüzdelerinden üretilen (asla sabit kodlanmayan)
110-140px aralığında bir SVG donut grafik, altında kategori+yüzde legend'i
ve kısa açıklama. Grafik/legend'de Mevduat + Para Piyasası Fonu YALNIZCA
burada tek kategoride birleşiyor ("Mevduat/Para Piyasası Fonu"); diğer
sınıflar kısa adlarla (Hisse, Altın, USD/Döviz) ayrı gösteriliyor; 5 sabit
sınıfın dışında kalan (bugün mümkün olmayan ama ileride eklenebilecek) bir
sınıf da kaybolmuyor — hepsi yeni, saf ve test edilebilir
`src/domain/model/riskProfileChartCategories.ts` içinde. Grafik toplamı
her zaman %100 (10 testle doğrulandı); hesaplama motorunun kullandığı
gerçek dağılım bundan TAMAMEN bağımsız ve değişmedi.

Grafik için yeni ağır bir kütüphane EKLENMEDİ — `stroke-dasharray`/
`stroke-dashoffset` tekniğiyle çizen, bağımlılıksız, ~70 satırlık
`src/components/ui/DonutChart.tsx` yazıldı (grafik dekoratif/aria-hidden,
gerçek bilgi yanındaki legend metninden okunuyor — çift anons yok).
Kartlar `<button aria-pressed>` (radio-group yerine bilinçli olarak daha
basit, tam klavye/focus-visible destekli bu seçenek kullanıldı — Playwright
ile Tab+Enter/Space gerçek tarayıcıda doğrulandı). Masaüstünde
`auto-fit` grid, mobilde scroll-snap'li yatay kart şeridi (sonraki
kartın kenardan taşması, daha fazla profil olduğunu ima ediyor).
İlk açılışta hiçbir profil otomatik seçilmiyor (eski auto-select effect'i
kaldırıldı); tutar/profil eksikken "Portföyü Hesapla" devre dışı ve
altında açık bir doğrulama mesajı var.

**Ayrı sonuç sayfası:** Giriş sayfası artık yalnızca tutar + kartlar +
buton. "Portföyü Hesapla" yeni `#/hesaplama/sonuc` rotasını (yeni
`CalculationResultPage.tsx`) açıyor — orada özet, Model Dağılımı, Pay
Hesaplama Özeti, Toplamlar, Cari Hesap. Girdiler (tutar, profil,
override'lar) zaten var olan `CalculatorSelectionContext`
(sessionStorage) üzerinden taşınıyor — sonuç sayfası kendi state'inde
HİÇBİR ŞEY saklamıyor, her render'da saf `calculatePortfolio` ile
yeniden hesaplıyor; bu sayede sayfa yenilendiğinde de çalışmaya devam
ediyor. Tutar geçersiz/boşsa, profil seçilmemişse VEYA seçili profil
artık güncel yayınlanmış modelde yoksa (silinmiş/eski id) hata
FIRLATMADAN `<Navigate to="/" replace />` ile hesaplama sayfasına
yönlendiriliyor (FundSubstitutionPage'deki mevcut desenle aynı). Üstte
belirgin bir "← Geri dön" düğmesi var. Fon değiştirme akışının başarı/
iptal yönlendirmeleri (`FundSubstitutionPage.tsx`) kökten ("/") sonuç
sayfasına ("/hesaplama/sonuc") çevrildi — artık bir fon değiştirilip
geri dönüldüğünde kullanıcı sonucu görmeye devam ediyor (önceden köke
düşüp "Portföyü Hesapla"ya tekrar basması gerekiyordu).

**Sıralama:** Model Dağılımı ve Pay Hesaplama Özeti'nde satır sırası artık
TÜM risk profillerinde: Mevduat → Para Piyasası Fonu → diğer fonlar model
yüzdesine göre büyükten küçüğe (eşitlikte fon koduna göre A-Z) → Cari
Hesap. Bu kural `fundLineOrder.ts`de merkezileşti: mevcut
`orderFundLinesForDisplay`e kod eşitlik kırıcı eklendi (bir testin ESKİ
"giriş sırasını korur" beklentisi, YENİ "kod A-Z" davranışına
güncellendi — kasıtlı bir davranış değişikliği), ve Model Dağılımı için
aynı kuralı uygulayan yeni `orderFundSelectionsForDisplay` eklendi.
Mevduat/PPF grafikte birleşse de bu iki bölümde HER ZAMAN ayrı satır.

**1 aylık getiri:** Model Dağılımı'ndaki her fon satırında "Son fiyat"/
"Fiyat tarihi"nin altına "1 aylık getiri: +%3,24" (veya eksikse "—")
satırı eklendi. Veri, `usePublishedModel`'in ZATEN yaptığı toplu
sorgulara (`getFundReturns()`, tek `select * from fund_returns`) eklenen
BİR sorguyla geliyor — N+1 yok. Mevduat satırında hiçbir fiyat/getiri
gösterilmiyor (o satır zaten ayrı, fonsuz render ediliyor).

**Değişmeyenler:** `engine.ts`/`buildInput.ts` (hesaplama matematiği),
admin paneli, TEFAS/KAP senkronizasyonları, `isFundEligibleForListing`
uygunluk politikası, PWA — hiçbiri değişmedi. Mevcut 17 `engine.test.ts`
testi (yüzdeler, pay adetleri, PPF'ye aktarılan fark, cari hesap) hâlâ
aynen geçiyor — bu, hesaplama sonuçlarının değişmediğinin regresyon kanıtı.

**Doğrulama:** 46 yeni test (kategori birleşimi/sıralama/toplam %100,
combo box yokluğu, kart seçimi, geçersiz/eksik parametre güvenliği, geri
dönüşte tutar+profil korunması, sıralama, 1 aylık getirinin 3 durumu).
Playwright ile gerçek Chromium + gerçek Supabase verisiyle: uçtan uca akış
(tutar→kart seç→hesapla→sonuç→geri dön→state korunmuş), klavye
gezinmesi (Tab/Enter/Space), fon değiştirme akışının sonuç sayfasına
döndüğü, 320/375/390/428px'de yatay taşma YOK (`docOverflow: 0` — kart
şeridinin kendi içindeki YATAY KAYDIRMA kasıtlı ve bekleniyordu),
sticky mobil navigasyonla çakışma yok. Commit `401734d`.

## 19. Hesaplama/Fonlar Nav İkonlarının Emojiden SVG'ye Çevrilmesi (2026-09-07)

**ARTIK GEÇERLİ DEĞİL — bu bölümdeki elle çizilmiş `PieChartIcon`/
`CoinsIcon` tasarımları, Bölüm 20'de tasarımcının verdiği gerçek SVG
dosyalarıyla DEĞİŞTİRİLDİ (dosyalar silindi).** Aşağıdaki metin, o anki
kararların (emoji kaldırma, currentColor mimarisi, aria-hidden, yeni
bağımlılık eklememe) gerekçesini korumak için olduğu gibi bırakılmıştır
— bu ilkeler Bölüm 20'de de aynen geçerlidir, yalnızca ikonların
GÖRSELİ değişti.

Mobil sekme çubuğu ve masaüstü sol menüdeki 📊/📁 emojileri kaldırılıp
yerine iki küçük, bağımlılıksız, yeniden kullanılabilir SVG bileşeni
kondu: `src/components/ui/PieChartIcon.tsx` (3 dilimli sade çizgisel
pasta grafik) ve `CoinsIcon.tsx` (iki iç içe geçen madeni para dairesi)
— Lucide'ın `PieChart`/`Coins` ikonlarıyla aynı tasarım dilinde (24x24
viewBox, `stroke="currentColor"`, strokeWidth 2, yuvarlak uçlar).
Projede zaten bir ikon kütüphanesi olmadığından (kontrol edildi, yok)
yeni bağımlılık EKLENMEDİ. `currentColor` sayesinde aktif (mint) / pasif
(mevcut gri-yeşil) renk, mevcut `.nav-link`/`.mobile-tabbar-item`
CSS'inden otomatik devralınıyor — ekstra renk kodu gerekmedi, hover/
focus/aktif durumlarında ikon rengi metinle birlikte değişiyor.
Dekoratif oldukları için SVG'nin kendisi `aria-hidden="true"` (erişilebilir
sekme adı, görünen metin, hiç değişmedi). `.mobile-tabbar-icon` ve yeni
`.nav-link-icon`, emoji için kullanılan `font-size` yerine `width`/
`height` ile boyutlandırılıyor (23px mobil, 21px masaüstü — istenen
22-24px/20-22px aralıklarında).

İlk denemede pasta grafik ikonu (merkezden 2 düz çizgi) saat kadranına
benziyordu — 3 eşitsiz açılı çizgiye (peace-sign/Mercedes-logosu izlenimi
vermeyecek şekilde asimetrik açılarla) geçilerek düzeltildi ve gerçek
tarayıcıda tekrar doğrulandı. Metinler, rotalar, aktif sekme davranışı,
buton boyutları, uygulama logosu, PWA ikonu ve admin paneli hiç
değişmedi (`git diff --stat`: yalnızca `UserLayout.tsx` + `base.css` +
2 yeni ikon dosyası).

Playwright ile gerçek Chromium'da 320/375/390/428px ve masaüstünde, her
iki sekmenin aktif/pasif durumunda doğrulandı: emoji kalmadı, yatay
taşma yok, ikon boyutu/rengi beklenen aralık ve tonlarda
(`rgb(46,217,168)` aktif, mevcut muted ton pasif). Commit `766115f`.

## 20. Nav İkonlarının Tasarımcının Gerçek SVG'leriyle Değiştirilmesi (2026-09-07)

Bölüm 19'daki elle çizilmiş `PieChartIcon`/`CoinsIcon` yerine, kullanıcının
proje köküne eklediği `hesaplama-pasta-ikon.svg` ve
`fonlar-madeni-para-ikon.svg` — `src/assets/navigation/`e taşındı —
BİREBİR kullanıldı. Yeni bileşenler (`HesaplamaPastaIcon.tsx`,
`FonlarMadeniParaIcon.tsx`) şekil verisini (path/ellipse koordinatları,
`stroke-width="2.5"`, `stroke-linecap`/`stroke-linejoin="round"`, 32x32
viewBox) hiç değiştirmeden kopyaladı; kaldırılan TEK şey kök `<svg>`
üzerindeki `color="#37d6ad"` niteliğiydi — bu nitelik `currentColor`ı
sabit bir tona kilitleyip aktif/pasif sekme rengine göre otomatik
değişmesini (bu görevin en kritik gereksinimi) engelliyordu; kaldırılınca
renk yine `.nav-link`/`.mobile-tabbar-item`'ın `color`'ından miras alınıyor.
Eski `PieChartIcon.tsx`/`CoinsIcon.tsx` dosyaları (başka yerde
kullanılmadıkları doğrulanarak) tamamen silindi.

`<img>` ile harici SVG göstermenin `currentColor` mirasını kıracağı
(doğru tespit) göz önüne alınarak, yeni paket veya SVG loader
eklenmeden, `dangerouslySetInnerHTML` kullanılmadan, mevcut "inline SVG
React bileşeni" deseni (Bölüm 19'dakiyle aynı mimari) sürdürüldü — CSS
mask alternatifi bilinçli olarak tercih edilmedi çünkü mevcut mimariyle
(zaten kurulu `.nav-link-icon`/`.mobile-tabbar-icon` boyutlandırma
sınıfları) daha az değişiklikle örtüşüyordu ve maskeli öğelerin
zorunlu-renk (forced-colors) modunda daha zayıf davranma riski var.

İkon boyutları yeni istenen aralığa güncellendi: mobil 27px (26-28px),
masaüstü 22px (21-23px) — önceki 23px/21px'ten büyütüldü. Metinler,
rotalar, aktif sekme davranışı, buton boyutları, uygulama logosu, PWA
ikonu ve admin paneli değişmedi.

Playwright ile gerçek Chromium'da 320/375/390/428px ve masaüstünde, her
iki sekmenin aktif/pasif durumunda doğrulandı: emoji/eski ikon kalmadı,
yatay taşma yok, ikon boyutu tam istenen değerlerde (27x27 / 22x22),
`viewBox="0 0 32 32"` korunmuş, renk aktifte `rgb(46,217,168)` (mint),
pasifte mevcut muted ton, konsol hatası yok. Commit `554152c`.

## 21. CKS Risk/Pay Grubu/Fiyat Düzeltmesi ve Diğer Döviz Fonları Denetimi (2026-09-11)

### 21.1 Sorun

Canlı kayıtta CKS (İş Portföy Birinci Katılım Serbest (Döviz) Fon)
mevcut ve aktif, ama iki bağımsız sorunu vardı:

1. **Listelerden gizli:** `risk_value=null` olduğu için ortak listeleme
   filtresi (`isFundEligibleForListing`) onu Fonlar sayfasından ve fon
   değiştirme ekranından eliyordu.
2. **Kritik fiyat hatası:** Son fiyatı ~61,8 "USD" görünüyordu. Bu, TEFAS'ın
   toplu liste endpoint'inin CKS için döndürdüğü ham `fiyat` alanının
   (A Grubu/TL fiyatı) yanlışlıkla `currency='USD'` etiketiyle
   kaydedilmesinden kaynaklanıyordu — gerçek B Grubu (native USD) fiyatı
   ~1,28 USD'dir. Bu, TL karşılığı hesaplanırken (native fiyat × TCMB
   kuru) ~48 kat büyüklüğünde bir hataya yol açardı.

### 21.2 Doğrulama — kaynaklar ve çapraz kontrol

Üç bağımsız resmi kaynak canlı olarak sorgulandı ve birbiriyle tutarlı
çıktı:

- **KAP genel bilgiler sayfası**
  (`https://www.kap.org.tr/tr/fon-bilgileri/genel/4028328d86d233bf01877fb5e99d3c51`):
  "Fonun Yatırım Amacı veya Stratejisi" alanında, para birimi etiketi
  OLMADAN, "A Grubu Paylar: 5 / B Grubu Paylar: 3" metni. Ayrıca A Grubu
  = TL, B Grubu = USD bilgisini taşıyor. (kap-risk-sync bu metni daha
  önce doğru şekilde "belirsiz" sayıp risk_value yazmamıştı — bkz.
  `kapRiskParser.ts` `resolveByCurrency`, yalnızca para birimi KELİMESİ
  geçen adayları çözer, salt "A/B grubu" harfini otomatik bir para
  birimine eşlemez; bu GENEL kural bilerek gevşetilmedi, bkz. 21.6.)
- **İş Portföy'ün resmi CKS (USD) sayfası**
  (`https://www.isportfoy.com.tr/is-portfoy-birinci-katilim-serbest-doviz-fon-usd`):
  "Risk Seviyesi: 3/7" (KAP'ın B Grubu değeriyle birebir), "Fon Birim
  Fiyatı (USD)" alanında 11.09.2026 için 1,277608, fon büyüklüğü
  5.855.446.639,71 TL (canlı DB ile birebir eşleşiyor).
- **TEFAS'ın kendisi** (`tefas.gov.tr`, hem toplu liste API'si hem
  FonAnaliz sayfası): CKS için döndürdüğü fiyatı KENDİSİ "TL" etiketiyle
  gösteriyor (11.09.2026: 61,845028 TL) — B Grubu'na özgü ayrı bir USD
  fiyat alanı YOK. Yani TEFAS'ın kendi arayüzü bile bu sayının TL olduğunu
  doğruluyor; hata TEFAS'ın verisinde değil, uygulamanın bu ham sayıyı
  sorgusuzca "native USD" varsaymasındaydı.

### 21.3 Kalıcı düzeltme — genel pay-grubu/fiyat-kaynağı mekanizması

Tek seferlik/korunmayan bir `UPDATE` yerine, iki parçalı, kalıcı bir
mekanizma kuruldu:

**a) Risk değeri** — mevcut, canlıda kanıtlanmış korumayı (bkz. Bölüm
12.5) aynen kullanır: `funds.risk_value=3`, `risk_source` `'kap'` ile
başlıyor (`kap_share_class_verified_manual`), `risk_verified=true`,
`risk_verification_needed=false`. `shouldSkipReferenceCatalogRisk`
(`classifyFund.ts`) bu satırı her tefas-sync çalıştırmasında otomatik
korur — yeni kod YAZILMADI, var olan mekanizma yeniden kullanıldı.

**b) Para birimi + fiyat kaynağı** — yeni `fund_share_class_overrides`
tablosu (migration `20260911130000_fund_share_class_price_overrides.sql`):
fon kodu, pay grubu etiketi, native para birimi, `tefas_price_is_native`
(false = TEFAS'ın ham fiyatı BAŞKA pay grubuna ait, hiç kullanılmasın),
fiyat kaynağı (kod + URL), doğrulama kaynağı/notu. `tefas-sync/index.ts`
her çalıştırmada bu tabloyu okur ve aktif satırları referans katalog/
başlık sezgisinin ÖNÜNE geçirir (`shareClassOverride.ts`,
`resolveFundCurrency`/`shouldTrustTefasPrice` — saf, test edilebilir
fonksiyonlar). `tefas_price_is_native=false` olan fonlar için TEFAS'ın
fiyatı fund_prices'a HİÇ yazılmaz; bunun yerine yeni bir adaptör
(`managementCompanyPriceAdapter.ts`) resmi PYŞ sayfasından günlük native
fiyatı çeker (`fund_prices.source='MANAGEMENT_COMPANY'`, yeni enum
değeri). İş Portföy'ün fon sayfası düz, sunucu tarafında render edilmiş
HTML'dir (TEFAS'ın aksine bot koruması YOK) — "Fon Birim Fiyatı (USD)"
etiketinin yanındaki tarih+değeri ayrıştırır. **Çekim başarısız olursa
(ağ hatası veya sayfa yapısı beklenmedikse) HİÇBİR SAYI UYDURULMAZ** — o
fonun fiyatı o çalıştırmada atlanır, son bilinen değer korunur,
`sync_runs.error_summary`'ye insan-okunur bir not düşülür.

`history-backfill` fonksiyonu da aynı tabloyu okuyup
`tefas_price_is_native=false` olan fon kodlarını tarihsel yüklemeden
tamamen dışlayacak şekilde güncellendi — aksi halde checkpoint bir gün
sıfırlanıp yeniden çalıştırılırsa CKS'nin (ya da gelecekte eklenecek
başka bir override fonunun) düzeltilmiş geçmişini sessizce yeniden
bozabilirdi.

Bu tasarım kasıtlı olarak CKS'ye özgü değildir — ileride aynı sorunu
yaşayan başka bir fon bulunursa, yeni kod yazmadan, yalnızca
`fund_share_class_overrides`'a bir satır ekleyerek (ve gerekirse
`managementCompanyPriceAdapter.ts`'e o PYŞ'nin sayfa yapısı için yeni bir
`SOURCE_PARSERS` girişi ekleyerek) çözülebilir.

### 21.4 Tarihsel fiyat düzeltmesi — kapsam ve sınır

Migration `20260911130100_cks_price_history_correction.sql`. CKS'nin
`fund_prices` geçmişi (261 satır, 2025-09-01 – 2026-09-11) baştan sona bu
hatayı taşıyordu. İş Portföy'ün resmi sayfası yalnızca son ~1 aylık
(14.08.2026 – 11.09.2026, 21 iş günü) native USD fiyatı, sayfaya gömülü
bir grafik verisi (dataset etiketi "CKS - USD") üzerinden, tam hassasiyetle
sağlıyordu — bu 21 gün gerçek verilerle düzeltildi (`source='MANUAL'`,
kaynağa atıfla). **2025-09-01 – 2026-08-13 için resmi/doğrulanabilir bir
B Grubu USD kaynağı bulunamadı** (İş Portföy'ün sitesinde daha uzun bir
resmi geçmiş API'si/tablosu tespit edilemedi; TEFAS bu veriyi hiç
taşımıyor). Kullanıcı talimatı gereği ("veri kaynağı bulunamazsa uydurma
veya kurdan geriye dönük tahmin üretme") bu ~242 günlük aralık ne
uydurulmadı ne de A Grubu TL fiyatı / güncel TCMB kuruyla geriye dönük
tahmin edilmedi — **silindi**. Gerekçe: yanlış (TL ölçeğinde) bir "USD"
fiyatını olduğu gibi bırakmak, doğru son fiyatla (1,28 USD) birleştiğinde
getiri hesaplarında (`fund_returns`) sahte, çok büyük bir kayıp/kazanç
sıçraması üretirdi; `fund_price_on_or_before`/`fund_returns` eksik
geçmişi zaten güvenle null/"—" olarak ele alıyor (yeni eklenen bir fon
için de geçerli olan, halihazırda test edilmiş yol). **Bilinen sonuç:**
CKS'nin 3/6 aylık ve 1 yıllık getirisi, yeterli doğrulanmış geçmiş
birikene kadar (birkaç ay) Fonlar sayfasında "—" gösterecek; YANLIŞ bir
yüzde göstermeyecek. Daha uzun resmi bir geçmiş kaynağı bulunursa ayrı
bir migration ile eklenebilir.

### 21.5 Bonus bulgu — 52 fonda tek seferlik "başıboş" fiyat satırı (temizlendi)

CKS'nin geçmişi incelenirken, `fund_prices.currency`'nin `funds.currency`
ile UYUŞMADIĞI, beklenmedik bir satır bulundu: 2026-09-04 tarihli,
`currency='TRY'`, `source='TEFAS'`, `fetched_at≈2026-09-06 07:52 UTC`.
Canlı veritabanı tam taranarak bunun CKS'ye özgü olmadığı, AYNI desende
(tek satır, aynı tarih, aynı `fetched_at` civarı, fonun güncel para
biriminden farklı) **tam 52 fonu** etkilediği doğrulandı — büyük
olasılıkla 09-06 sabahı, döviz fonlarının bir kısmı için henüz TL
varsayılanından USD/EUR'a geçiş tamamlanmadan çalışmış bir senkronizasyonun
kalıntısı (bkz. Bölüm 9, `20260906090000_fund_risk_currency_metadata.sql`
"acil düzeltme" notu). Bu, "hangi pay grubu native" BELİRSİZLİĞİ değil
(admin incelemesi gerektiren bir konu), mekanik olarak kanıtlanmış bir
kopya/kalıntı satırdı: her etkilenen fon için o TARİHTE fonun GÜNCEL
(doğru) para biriminde bir kardeş satır zaten mevcuttu. `fund_price_on_
or_before` para birimine bakmadan yalnızca tarihe göre en yakın satırı
seçtiğinden, aynı tarihte iki para birimli satır varlığı getiri
hesaplarında TANIMSIZ/yanlış bir sonuca yol açabilirdi. Migration
`20260911140000_stray_currency_price_row_cleanup.sql`, YALNIZCA bu kanıtlanmış
deseni (aynı tarih + fonun güncel para biriminden farklı + o tarihte
zaten doğru para biriminde bir kardeş satır VAR) silen, kendi kendini
doğrulayan bir `delete ... where exists (...)` kullanır — hiçbir fonun
TEK verisi olan bir satır silinemez. Hiçbiri hiçbir fonun EN GÜNCEL
fiyatı değildi (tümü geçmişte kalan tek bir tarihe ait), bu yüzden hiçbir
fonun güncel fiyat gösterimini etkilemedi.

### 21.6 Diğer USD/EUR katılım fonları — hızlı tutarlılık denetimi (BKY Bölüm 23'te düzeltildi)

Kullanıcı talimatı gereği, CKS dışındaki fonlarda **doğrulama yapılmadan
otomatik değişiklik yapılmadı**. Canlı veritabanı sorgulanarak CKS
dışında `currency IN ('USD','EUR')` olan **52 aktif fon** bulundu. Bunların
**49'unun** (fiyatı olan 51 fonun %96'sı) son fiyatı CKS'nin eski hatasıyla
AYNI büyüklük sınıfında (~15-170 "USD/EUR") — yani A Grubu/TL fiyatının
yanlışlıkla native döviz fiyatı olarak kaydedilmiş OLABİLECEĞİ, ama tek
tek resmi kaynaktan DOĞRULANMAMIŞ fonlar. Yalnızca TRU (1,54 USD) ve KIS
(0,22 USD) zaten native döviz ölçeğinde görünüyor. İlk tarama anında
bunların **14'ünde** `risk_value` de CKS gibi null'dı (KAP'ın
pay-grubu-bazlı, para birimi etiketsiz metni nedeniyle muhtemelen aynı
belirsizlik); BKY Bölüm 23 ile düzeltildikten sonra açık risk adayı sayısı
13'e düştü:

```
risk_value NULL (2026-09-11 ilk tarama; BKY artık Bölüm 23 ile düzeltildi):
  AL5, BDA, BKY, HML, KAV, KDL, KDO,
  KDT, KPD, KTT, NME, NVK, NZU, TRU
risk_value mevcut ama fiyat büyüklüğü şüpheli (orta öncelik): DKL, KKC,
  KLS, NKA, PBK, ZP6, ZP9, EZM, KDK, KSL, KSM, MJE, OFA, OFK, KBZ, KMA,
  KTE, KLL, YSL, ZDK, URD, ZKK, KEU, KHU, KKE, TPZ, ZPF, ZSK, KDS, KDV,
  KDZ, KKB, KSC, ZAD, ZK1, ZK2
```

**Bu bir kanıt değil, bir tarama sonucudur** — büyüklük tek başına
kanıtlayıcı değildir (bazı fonlar gerçekten yüksek nominal değerli
paylarla başlamış olabilir). Her biri, CKS'de yapıldığı gibi, fonun
kendi resmi PYŞ sayfasıyla tek tek doğrulanmadan `fund_share_class_
overrides`'a eklenmemeli veya fiyatı değiştirilmemelidir. TEFAS'ın kendi
FonAnaliz sayfasının TÜM fonlar için (native para birimi ne olursa
olsun) fiyatı hep "(TL)" etiketiyle gösterdiği canlıda doğrulandı (BKY,
TRU, DKL örnekleri) — yani bu etiket, hangi fonların CKS'nin sorununu
paylaştığını ayırt etmek için GÜVENİLİR bir sinyal DEĞİLDİR; tek güvenilir
yöntem, CKS'de yapıldığı gibi her fonun kendi resmi PYŞ sayfasıyla
doğrudan karşılaştırmadır.

**Güncel durum:** Bu ilk taramadaki BKY artık resmî KAP + Yapı Kredi
Portföy verileriyle doğrulanıp Bölüm 23'te düzeltildi; risk değeri `3`,
native USD fiyatı 1,043073'tür. Dolayısıyla şüpheli fiyat adayı sayısı
49'dan **48'e** düşmüştür. Yukarıdaki liste ilk taramanın tarihsel kaydı
olarak korunmuştur; BKY artık açık aday değildir.

### 21.7 Canlı doğrulama sonuçları

Migration'lar canlıya uygulandıktan, Edge Function'lar (`tefas-sync`,
`history-backfill`) deploy edildikten sonra:

- `tefas-sync` **ardışık iki kez** canlıda tetiklendi (`select public.
  trigger_tefas_sync();`); ikisi de `status=success`, `error_summary=null`
  ile tamamlandı. İkinci çalıştırmadan sonra CKS'nin `risk_value=3`,
  `currency='USD'`, `currency_source='share_class_override:B Grubu'`
  değişmeden kaldığı, fiyat satırının (2026-09-11, 1,277608 USD,
  `source='MANAGEMENT_COMPANY'`) tekrarlanmadan (idempotent upsert)
  güncel kaldığı doğrulandı — toplam satır sayısı hâlâ tam 21.
- Gerçek Chromium'da (Playwright), canlı Supabase projesine bağlı yerel
  dev sunucusu üzerinden: Fonlar sayfasında "CKS" araması sonuç veriyor;
  satırda Risk=3, Para birimi=USD, Son fiyat≈1,28 (11.09.2026), Büyüklük=
  5.855.446.639,71, Yatırımcı=2.385 gösteriliyor; 1/3 ay ve 1 yıl
  getirileri "—" (beklenen, bkz. 21.4). `/fon-degistir/FX` sayfasında CKS
  "Bu fonu seç" ile seçilebilir durumda listeleniyor. Hesaplama akışında
  Orta profili + 100.000 TL ile, Döviz kalemi CKS'ye değiştirilip yeniden
  hesaplandığında: "Native fiyat: 1,28 USD / 61,85 TL (yaklaşık TL
  karşılığı) / 1 USD = 48,41 TL (TCMB, 10.09.2026)" gösterildi — bağımsız
  olarak 1,277608 × 48,4069 ≈ 61,84 TL ile eşleşiyor (tek çarpım, çifte
  dönüşüm yok); pay adedi (161) ve hesaplanan tutar (₺9.957,05) bu birim
  fiyatla tutarlı. Tarayıcı konsolunda hata yok.

### 21.8 Yeni/değiştirilen dosyalar

- `supabase/migrations/20260911130000_fund_share_class_price_overrides.sql`
- `supabase/migrations/20260911130100_cks_price_history_correction.sql`
- `supabase/migrations/20260911140000_stray_currency_price_row_cleanup.sql`
- `supabase/functions/tefas-sync/shareClassOverride.ts` (yeni, saf/test edilebilir)
- `supabase/functions/tefas-sync/managementCompanyPriceAdapter.ts` (yeni)
- `supabase/functions/tefas-sync/types.ts` (`ShareClassOverride` eklendi)
- `supabase/functions/tefas-sync/index.ts` (override okuma + uygulama)
- `supabase/functions/history-backfill/index.ts` (override fonlarını dışlama)
- Testler: `shareClassOverride.test.ts`, `managementCompanyPriceAdapter.test.ts`,
  `engine.test.ts`'e 2 yeni çift-dönüşüm regresyon testi.

## 22. Büyük Fon Listeleme İstisnası (2026-09-11)

Ortak `isFundEligibleForListing` kuralına (Bölüm 13), kullanıcı kararıyla
**1.000.000.000 TL (dahil)** eşiği için bir istisna eklendi:
`src/domain/calculation/fundListingEligibility.ts`. Önceki kural
"risk_value biliniyor VE (yatırımcı sayısı bilinmiyor VEYA ≥50 VEYA
BYF)" idi; artık "büyüklük ≥ 1 milyar TL" dördüncü bir OR-koşulu olarak
eklendi. Risk değeri null olan bir fon, büyüklüğü ne olursa olsun (100
milyar TL dahi) HÂLÂ gösterilmez — bu şart değişmedi. `fund_size` null
ise istisna uygulanmaz (büyüklüğü bilinmeyen bir fon "büyük" varsayılıp
muaf tutulmaz). Mevcut BYF istisnası korundu.

`FundListingCandidate` arayüzüne `fundSize: number | null` alanı eklendi;
her iki çağrı noktası da (`useFundsExplorer.ts` — zaten `FundExplorerRow.
fundSize` taşıyordu; `AdminModelEditorPage.tsx`'teki model uyarısı —
`latestPrice.fund_size`'dan `Number(...)` ile türetildi) güncellendi.
Fonlar kataloğu ve fon değiştirme sayfası aynı merkezi `useFundsExplorer`
hook'unu (dolayısıyla aynı kuralı) kullanmaya devam ediyor; fon
değiştirme sayfasındaki ayrı `is_substitution_eligible`/aynı-varlık-sınıfı
kısıtları hiç değişmedi. Bu yalnızca gösterim/seçim katmanında bir
filtredir — hiçbir fon veritabanından silinmedi.

14 yeni/güncellenmiş test eklendi (`fundListingEligibility.test.ts`):
sınır (tam 1 milyar dahil, 1 TL altı hariç), `fund_size=null` istisnasız,
risk null + büyük fon yine uygun değil, BYF istisnası korunuyor, ve
CKS'nin canlı senaryosunu (risk null → uygun değil, risk 3 → uygun)
doğrulayan iki regresyon testi.

## 23. BKY B Grubu Native USD Fiyat Düzeltmesi (2026-09-11)

### 23.1 Resmî doğrulama ve kök neden

Canlı veritabanında BKY `currency='USD'`, `risk_value=3` olmasına rağmen
11.09.2026 fiyatı `50,491927 USD` görünüyordu. Yapı Kredi Portföy'ün resmî
BKY sayfasının kullandığı JSON endpoint'i
(`https://www.yapikrediportfoy.com.tr/getFundDetail/2125`) aynı yanıtta:

- `Fon Birim Değeri (TL) = 50,491927 TL`,
- `Fon Birim Değeri (USD) = 1,043073 USD`,
- `Risk = 3/7` (TL pay grubu için ayrıca `otherRisk=6`)

değerlerini döndürmektedir. KAP BKY genel bilgiler sayfası da A Grubu'nun
TL, B Grubu'nun USD olduğunu ve B Grubu fiyatının A Grubu TL fiyatının TCMB
USD alış kuruna bölünmesiyle hesaplandığını açıklar. Uygulama B Grubu USD
payını takip ettiği için TEFAS'ın A Grubu TL sayısını USD olarak kaydetmesi,
hesaplama motorunun bu değeri TCMB kuruyla yeniden çarpmasına ve yaklaşık 48
kat fazla TL karşılığı üretmesine yol açıyordu.

Bağımsız sayısal çapraz kontrol: 11.09.2026 resmî native fiyatı `1,043073`
ile uygulamadaki son geçerli TCMB kuru `48,4069` çarpıldığında `50,491930 TL`
elde edilir; Yapı Kredi'nin yayımladığı `50,491927 TL` ile yuvarlama düzeyinde
eşleşir.

### 23.2 Kalıcı günlük düzeltme

Migration `20260911150000_bky_share_class_price_correction.sql`, BKY'yi mevcut
`fund_share_class_overrides` mekanizmasına `B Grubu / USD /
tefas_price_is_native=false` olarak ekler. Yeni `yapikredi_resmi_api` adapter'ı
resmî endpoint'i POST ile çağırır; fon kodu `BKY`, `lastUpdateDate` ve açık
`USD` son eki taşıyan `unitAmount.USD` alanı birlikte doğrulanmadan fiyat
yazmaz. HTTP/JSON/alan hatasında tahmin yapılmaz ve TEFAS TL fiyatına geri
düşülmez; o gün fiyat atlanıp son doğru değer korunur.

BKY risk değeri `3`, `risk_source='kap_share_class_verified_manual'` ve
`risk_verified=true` olarak mevcut `kap`-önekli senkronizasyon korumasına
alındı. Para birimi kaynağı da günlük override tarafından
`share_class_override:B Grubu` olarak korunur.

### 23.3 Tarihsel fiyat düzeltmesi ve canlı kanıt

Yapı Kredi Portföy'ün resmî fiyat grafiği, birbiriyle örtüşen 27 günlük özel
tarih pencerelerinde çekildi. Fon başlangıcından 11.09.2026'ya kadar **235**
native USD fiyat satırı bulundu; seri `0,999620–1,043073 USD` aralığındadır.
Migration tüm eski, TL ölçeğindeki BKY fiyatlarını kaldırdı ve resmî seriyi
`source='MANUAL'` + kaynak notuyla yazdı. Resmî kaynakta bulunmayan tek eski
TEFAS tarihi (03.02.2026) tahmin edilmedi ve silindi. Mevcut tarihlerdeki fon
büyüklüğü/yatırımcı sayısı metrikleri korundu.

Canlıda iki ardışık `public.trigger_tefas_sync()` çalıştırıldı; ikisi de
`success / 286 kontrol / 267 güncelleme / 0 başarısız / error_summary=null`
ile bitti. İkinci çalıştırmadan sonra BKY:

- `risk=3`, `currency=USD`, `currency_source=share_class_override:B Grubu`,
- son fiyat `1,043073 USD`, `source=MANAGEMENT_COMPANY`,
- fiyat geçmişi tam `235` satır, min/max `0,999620 / 1,043073`,
- getiriler: 1 ay `%0,41`, 3 ay `%1,20`, YBB `%3,43`, 1 yıl `null`

olarak kaldı. Böylece migration, günlük otomatik senkronizasyon ve idempotent
ikinci çalışma birlikte doğrulanmıştır. Kod/migration commit'i: `18732a5`.

Test sonucu: `managementCompanyPriceAdapter.test.ts` içindeki gerçek Yapı
Kredi yanıt örneği dahil 16 adapter testi ve toplam **269/269** test geçti;
lint 0 hata (önceden var olan 2 Fast Refresh uyarısı), typecheck, `deno check`
ve production build temizdir.

## 24. Özel (Kullanıcı Tanımlı) Portföy Dağılımı (2026-09-11)

### 24.1 Ne eklendi, neden

Kullanıcı, 4 hazır risk profili kartının (Düşük 1/Düşük 2/Orta/Yüksek)
sonuna, "Yatırım dağılımınızı kendiniz oluşturun." alt açıklamalı beşinci
bir **Özel** kartı istedi. Bu kart admin tarafından yayınlanan bir risk
profili DEĞİLDİR — `ProfileModel` listesine (`data.profiles`) hiçbir zaman
girmez ve Supabase'e yeni bir risk profili/pay grubu olarak asla yazılmaz;
tamamen tarayıcı oturumuna (sessionStorage) özel, geçici bir dağılımdır.

Seçildiğinde aynı sayfada, kartların altında bir düzenleyici açılır: 5
varlık sınıfı (Mevduat, Para Piyasası Fonu, Katılım Hisse Fonu, Altın Fonu,
Döviz Fonu — bunlar zaten `lib/constants.ts`'teki `ASSET_CLASSES` ile
birebir aynıdır, yeni bir kategori icat edilmedi) için tam sayı, 0-100
aralığında, doğrudan yazılabilir yüzde alanları (+/- düğmeleriyle
desteklenmiş, yalnızca slider DEĞİL); değiştikçe canlı güncellenen, mevcut
bağımlılıksız `DonutChart` bileşeniyle çizilen bir donut grafik; ve sürekli
görünen "Toplam / Kalan" durumu (uygulamanın yeşil temasına uygun `Banner
variant="info"` ile %100'de olumlu durum, `variant="warning"` ile metinli —
yalnızca renkle değil — uyarı). Toplam tam %100 olmadan "Portföyü Hesapla"
butonu HİÇBİR şekilde (klavye/tıklama/form) aktif olmaz — hem buton
`disabled` olur hem de `CalculationResultPage` aynı koşulu ayrıca kontrol
edip URL doğrudan açılırsa da hesaplama sayfasına yönlendirir.

### 24.2 Mimari: ayrı bir hesaplama yolu YOK

Görev talimatına uyularak özel dağılım için yeni bir hesaplama motoru
YAZILMADI. `src/domain/calculation/customAllocation.ts`'teki
`buildCustomProfileModel(allocations, defaultPreferredFundIdByAssetClass)`,
özel dağılımı mevcut `ProfileModel` şekline dönüştürür (sabit
`profileId="custom"`, veritabanı UUID'leriyle asla çakışmaz). Bu sayede
`buildCalculationInput`, `resolveFundSelections`, `calculatePortfolio`
(engine.ts), `AllocationEditor`, `CalculationSummary` ve
`FundSubstitutionPage` **hiç değiştirilmeden** hem gerçek profiller hem
Özel için aynı kod yoluyla çalışır. Engine matematiği, tam pay (floor)
davranışı ve para piyasası fonuna kalan aktarma mantığı bire bir korundu.

### 24.3 Standart fon çözümü — merkezi, tahmine dayanmayan karar

`ProfileModel.preferredFundIdByAssetClass` profile'a özeldir (bkz.
`buildProfileModels`) — Özel dağılımın bağlı olduğu bir profil yoktur, o
yüzden "hangi profilin fonu kullanılsın" sorusu profil tahminiyle
çözülemezdi. İnceleme sonucu: `model_preferred_funds` tablosu zaten
`profile_id IS NULL` olan, "varsayılan, TÜM profiller" için ayrı bir satır
tutuyor (`model_preferred_funds_default_unique` unique index) ve
`AdminModelEditorPage`, bir modelin yayınlanabilmesi için HER
`FundAssetClass` için bu varsayılanın dolu olmasını zaten zorunlu kılıyor
(`missingPreferredFunds`). Yani bu, profile özel olmayan, her zaman
var olması garanti TEK merkezi kaynaktır.

Yeni `buildDefaultPreferredFundIdByAssetClass` (`domain/model/
publishedModel.ts`), ham `ModelPreferredFundRow[]`'dan yalnızca bu
`profile_id NULL` satırlarını çözümler; `usePublishedModel`, sonucu
`PublishedModelData.defaultPreferredFundIdByAssetClass` olarak dışarı
verir. `buildCustomProfileModel` standart fon kaynağı olarak bunu kullanır
— fon kodu, kategori adı veya profil hard-code edilmedi.

Bu inceleme sırasında **gerçek bir hata** bulunup düzeltildi:
`FundSubstitutionPage.tsx`, Özel seçiliyken `selectedProfileId`
`data.profiles` içinde bulunamadığından yanlışlıkla `data.profiles[0]`'a
(listedeki ilk GERÇEK profile) düşüyor, "standart fon" rozetini o profilin
kendi override'ına göre yanlış gösteriyordu. Artık orada da aynı
`buildCustomProfileModel` + merkezi varsayılan kullanılıyor; canlıda
Playwright ile doğrulandı (bkz. 24.6).

### 24.4 %0 kategoriler ve "yatırım satırı" kuralı

`CalculationSummary.tsx` artık yüzdesi 0 olan bir kategori için (Mevduat
dahil) yatırım satırı GÖSTERMİYOR — engine hâlâ o satır için 0 tutarlı bir
`FundLineResult` üretiyor (hesaplama mantığı değişmedi), yalnızca GÖSTERİM
katmanında filtreleniyor. **İstisna: Para Piyasası Katılım Fonu.** Diğer
fonların yuvarlama kalanı motor tarafından her zaman ona eklendiğinden
(bkz. engine.ts), planlanan yüzdesi %0 olsa bile gerçek bir tutar
taşıyabilir; bu yüzden asla gizlenmez — "Mevduat → PPF → azalan yüzde →
Cari Hesap" sıralaması da bu şekilde korunur. Bu filtre hem Özel hem gerçek
profiller için geçerlidir ama mevcut hiçbir DEFAULT_PROFILES/test
senaryosunda %0'lık bir fon sınıfı olmadığından gerçek profillerde
gözlemlenebilir bir davranış değişikliği YOKTUR (regresyon riski yok).

### 24.5 Durumun korunması

`CalculatorSelectionContext` (sessionStorage, `fonPortfoy.
calculatorSelection.v1`) genişletildi: `customAllocations: Record<AssetClass,
number>` eklendi. `sanitizeCustomAllocations`, bozuk/elle değiştirilmiş
veriye karşı TÜM nesneyi (kısmi onarım yapmadan) güvenli %0 varsayılanına
sıfırlar — CKS/BKY düzeltmelerindeki "sessizce yanlışa geri dönme" karşıtı
prensiple tutarlı. `setSelectedProfileId`'nin mevcut davranışı (profil
değişince fon override'larını sıfırlama) korundu; `customAllocations`
buna DAHİL DEĞİLDİR — kullanıcı Özel'den gerçek bir profile geçip geri
dönerse girdiği yüzdeler kaybolmaz, ama gerçek bir profil seçiliyken
hesaplamaya asla karışmaz (yalnızca `selectedProfileId==="custom"`
olduğunda okunur). Veritabanına hiçbir kullanıcı dağılımı yazılmaz.

### 24.6 Testler ve canlı doğrulama

16 dosyada yeni/güncellenmiş testlerle toplam **306/306** test geçti (lint
0 hata — önceden var olan 2 Fast Refresh uyarısı hariç, typecheck ve
production build temiz). Kapsanan senaryolar: Özel kartın son sırada
görünmesi, ilk seçimde düzenleyicinin açılması, %99/%100/%101 toplam
kontrolleri, negatif/100'den büyük değerlerin 0-100'e kırpılması, tek
kategoriye %100 verilebilmesi, %0 kategorilerin serbest bırakılması ve
sonuç satırlarında görünmemesi (PPF hariç), engine'e doğru yüzdelerin
aktarılması, sayfa yenileme/geri dönme/fon değiştirme sonrası durumun
korunması, gerçek profile geçince özel oranların karışmaması, bozuk
sessionStorage'ın güvenle ele alınması, klavye erişilebilirliği (gerçek
`<button>` semantiği) ve tüm mevcut engine/buildInput/profil testlerinin
hâlâ geçmesi.

Gerçek Supabase verisiyle (yerel dev sunucusu + Playwright, headless
Chromium) canlı doğrulama yapıldı: 5 kart doğru sırada; düzenleyici açılıp
donut/legend/toplam-kalan canlı güncelleniyor; %100'de yeşil banner;
sonuç sayfasında "Özel Dağılım" başlığı, doğru yüzdeler (ör. Altın %20/
BIST %20 eşitliğinde kod sırasına göre ZGD önce, ZKP sonra — mevcut
sıralama kuralı gerçek verilerle de doğru çalışıyor), %0 kategoriler
(Altın/BIST/Döviz) sonuç satırlarında yok, PPF %0 olsa bile satırı kalıyor;
fon değiştirme akışı Özel modda da doğru "standart fon" rozetini gösteriyor
ve geri dönüşte özel dağılım korunuyor. 1280px masaüstünde ve 375px/320px
mobilde `document.documentElement.scrollWidth` hiçbir ekranda
`clientWidth`'i aşmadı (yatay taşma yok); konsolda hata yakalanmadı.

**ARTIK GEÇERLİ DEĞİL — Bölüm 25'te düzeltildi:** Bir önceki oturumda burada
not düşülen "`CalculationResultPage`, kur yüklenirken bir anlığına yanlış
'döviz kuru eksik' hatası gösteriyor" gözlemi artık geçerli değildir;
`useFxRates` yükleniyor/hata/başarı durumlarını ayrıştıracak şekilde
genişletildi ve sayfa artık nötr bir "Kur bilgisi yükleniyor…" durumu
gösteriyor (Bölüm 25).

**Özel dağılımda PPF %0 kuralı ve kur yükleme durumu ayrımı (bkz. Bölüm
25):** Kullanıcı geri bildirimiyle iki UX sorunu düzeltildi: (1) Özel
dağılımda PPF'ye %0 verildiğinde diğer fonların yuvarlama artığı artık PPF'ye
değil doğrudan Cari Hesap'a gidiyor (yeni, geriye uyumlu
`roundingRemainderPolicy` motor seçeneği — hazır profiller etkilenmedi);
(2) yukarıdaki kur yükleme durumu ayrımı.

## 25. Özel Dağılımda PPF %0 Kuralı ve Kur Yükleme Durumu Ayrımı (2026-09-12)

### 25.1 PPF %0 kuralı — motor seviyesinde, UI hilesi değil

**Sorun:** Özel dağılımda kullanıcı Para Piyasası Katılım Fonu'na (PPF)
bilinçli olarak %0 verse bile, diğer fonlardan (BIST/Altın/Döviz) gelen tam
pay yuvarlama artığı `engine.ts` tarafından hâlâ PPF'nin hedefine ekleniyor
ve PPF'ye — kullanıcının açık tercihine rağmen — gerçek bir tutar
yatırılıyordu.

**Çözüm:** `types.ts`'e geriye uyumlu bir `RoundingRemainderPolicy` seçeneği
eklendi:

- `"MONEY_MARKET"` (varsayılan): artık her zaman PPF hedefine eklenir —
  bugüne kadarki davranışın AYNISI.
- `"CASH_IF_MONEY_MARKET_ZERO"`: yalnızca PPF'nin PLANLANAN yüzdesi tam 0
  ise artık PPF'ye hiç eklenmez.

`buildInput.ts`'teki `buildCalculationInput`, profili `profileId ===
CUSTOM_PROFILE_ID` olup olmamasına göre bu politikayı SEÇER — hazır risk
profilleri (gerçek UUID profil id'leri) her zaman `"MONEY_MARKET"` alır ve
bu, hiçbir koşulda değişmez; PPF oranı %0 olan bir hazır profil bugün
olmasa da, ileride olsa bile davranışı AYNI kalır (motorun varsayılanı
budur). `engine.ts`'te tek değişiklik: yuvarlama artığı `PPF hedefine
eklenmeden ÖNCE` `suppressMoneyMarketRemainder = policy ===
"CASH_IF_MONEY_MARKET_ZERO" && mmPercentage === 0` bayrağıyla kontrol
ediliyor; bastırıldığında artık PPF'nin `carriedToMoneyMarket` toplamına
hiç eklenmiyor. Bunun ötesinde HİÇBİR hesaplama adımı değişmedi:
`cashBalance = total - mevduat - yatırılan` formülü zaten var olduğu için
PPF'ye eklenmeyen her TL otomatik olarak Cari Hesap'a düşüyor — ayrı bir
"cari hesaba ekle" adımına gerek kalmadı. `isCashBalanceValid`'in üst sınırı
da yalnızca bu politika devredeyken (aktif, yüzdesi > 0 olan hisse bazlı
fonların birim fiyatları toplamına göre) genişletildi; aksi halde büyük
(ama matematiksel olarak doğru) bir Cari Hesap bakiyesi yanlışlıkla
"beklenen aralıkta değil" uyarısı üretirdi. `CalculationSummary.tsx`'teki
PPF satırı artık yalnızca hedefi VE gerçekleşeni birlikte tam 0 ise
gizleniyor — varsayılan politikada PPF hâlâ artık taşıyabildiği için bu
koşul orada hiçbir zaman sağlanmaz, satır yanlışlıkla gizlenmez.

**Geriye uyumluluk:** `roundingRemainderPolicy` alanı `PortfolioCalculationInput`'a
EKLENEN, opsiyonel bir alandır; verilmezse (`undefined`) motor eskisi gibi
`"MONEY_MARKET"` kullanır. Düşük 1/Düşük 2/Orta/Yüksek dahil tüm gerçek
profillerin hesaplama sonucu, testlerdeki mevcut assertion'lar hiç
değiştirilmeden (`engine.test.ts`'teki 10.000 TL örneği dahil) hâlâ birebir
geçiyor — davranışları YALNIZCA `buildInput.ts`'in onlar için her zaman
`"MONEY_MARKET"` göndermesiyle değil, motorun kendi varsayılanıyla da iki
kat güvence altındadır.

### 25.2 Kur (FX) yükleme durumunun ayrıştırılması

**Sorun:** `useFxRates` yalnızca bir `Record<string, FxRateRow>` dönüyordu;
`CalculationResultPage` kur isteği HENÜZ sürerken de `calculatePortfolio`'yu
çalıştırıyor, boş `fxRates` motor tarafından "gerçekten eksik kur"
(`MISSING_FX_RATE`) sanılıyor ve döviz fiyatlı bir fon (ör. BKY) seçiliyken
sayfa ilk açıldığında bir anlığına yanlış "Hesaplama yapılamıyor: döviz
kuru eksik" hatası görünüyordu.

**Çözüm:** `useFxRates`, `{ rates, loading, error }` döner hale getirildi;
üç durumu KESİN olarak ayırır:

- `loading`: yalnızca gerçek bir istek sürerken `true`. `currencies` TRY
  dışında hiçbir para birimi içermiyorsa (TL portföyü) hiç istek atılmaz,
  bu hep `false` kalır — TL portföyleri hiçbir zaman gereksiz yere beklemez.
- `error`: yalnızca isteğin KENDİSİ (ağ/istisna) başarısız olduğunda dolu.
- `rates`: istek başarıyla tamamlandığında dönen harita — aranan para
  birimi haritada yoksa bu "gerçekten eksik" anlamına gelir (`error`
  DEĞİLDİR) ve motorun mevcut `MISSING_FX_RATE` mekanizmasıyla ayrıca ele
  alınır; burada yeniden icat edilmedi.

`CalculationResultPage`, `usePublishedModel`'in yükleme/hata kontrollerinin
hemen ardından iki yeni erken dönüş ekliyor: `fxLoading` iken hesaplamayı
hiç ÇALIŞTIRMADAN, hata GÖRÜNÜMÜNDE OLMAYAN, `role="status" aria-live="polite"`
ile erişilebilir "Kur bilgisi yükleniyor…" metni gösteriyor; `fxError`
doluysa ayrı bir `Banner variant="danger"` ile (MISSING_FX_RATE mesajıyla
KARIŞTIRILMADAN) gösteriliyor. Sonsuz yüklenme riski yok — `useFxRates`
her koşulda (başarı/boş sonuç/hata) `loading`'i `false`'a çeker. Hazır
profil ve Özel profil TAMAMEN aynı kod yolunu (aynı hook, aynı sayfa)
kullanır; ayrı bir dal yoktur.

### 25.3 Testler ve canlı doğrulama

Test sayısı, önceki (`ffe2c90`, 306/306) ve bu değişikliğin commit'i
(`366f1cd`) arasında dosya bazında `git diff` ile birebir doğrulanmıştır —
toplam **26 net yeni test** eklendi, genel toplam **306 → 332** oldu
(`npm run test` ile ayrıca tekrar çalıştırılıp 332/332 doğrulandı):

- `engine.test.ts`: **+8** — PPF %0 + artık taşınmaması, artığın Cari
  Hesap'ta kalması, toplam portföy kontrolü, cari hesap bakiyesinin
  yanlış-pozitif üretmemesi, PPF>0 iken eski davranışın sürmesi, politika
  verilmezse hazır profil davranışının değişmemesi, PPF hedef+gerçekleşen
  sıfırsa taşınacak tutar olmaması, döviz fonunda tek pay bile alınamayan
  küçük hedefin tamamen Cari Hesap'a gitmesi.
- `buildInput.test.ts`: **+2** — gerçek profil için her zaman
  "MONEY_MARKET", Özel (`CUSTOM_PROFILE_ID`) profili için
  "CASH_IF_MONEY_MARKET_ZERO" politikasının seçilmesi.
- `useFxRates.test.ts` (yeni dosya): **+7** — TL'de hiç istek atılmaması,
  başarılı yükleme (loading→rates), istek başarıyla tamamlanıp kur
  gerçekten bulunamaması, ağ/istisna hatası, hazır/Özel profil
  eşdeğerliği, para birimi listesi değişince yeniden yükleme.
- `CalculationResultPage.test.tsx`: **net +9** — eski "%0 kategoriler (PPF
  hariç)" testi, yeni PPF %0 kuralını doğrulayacak şekilde kapsamı
  genişletilerek yeniden yazıldı (bu tek değişiklik net etkisiz: −1/+1) ve
  ayrıca 8 yeni senaryo eklendi: PPF %0 + tam pay artığı → Cari Hesap +
  toplam portföy kontrolü, döviz fonunda tek pay alınamayan küçük hedef,
  fon değiştirme sonrası PPF politikasının korunması, ve kur
  yükleniyor/başarılı/gerçekten-eksik/ağ-hatası/hazır-Özel-eşdeğerliği/
  TL-portföyü-etkilenmemesi için 6 entegrasyon testi.

Lint/typecheck/build temiz.

Gerçek Supabase verisiyle Playwright doğrulaması: Özel + PPF %0 + tam pay
artığı olan bir hesaplamada artık (₺346,94, canlı fiyatlarla) Cari Hesap'a
gidiyor, PPF satırı Pay Hesaplama Özeti'nden kayboluyor, toplam portföy
kontrolü (₺1.000.005) birebir tutuyor, yanlış-pozitif "beklenen aralıkta
değil" uyarısı çıkmıyor; PPF>0 olan Özel hesaplamada eski davranış
(PPF satırı görünür) sürüyor; hazır "Düşük 1" ve "Yüksek" (BKY/FX
kullanan) profilleri değişmeden çalışıyor; `fx_rates` isteği 1,5sn
yapay gecikmeyle test edildiğinde bu süre boyunca kırmızı hata banner'ı
HİÇ görünmüyor, yalnızca nötr "Kur bilgisi yükleniyor…" görünüyor, istek
tamamlanınca doğru sonuç geliyor; istek 500 ile başarısız olduğunda
sonsuz yüklenmeye düşülmeden "Döviz kuru bilgisi alınamadı" hatası
gösteriliyor. 320/375/390/428px mobil genişliklerde yatay taşma ve
konsol hatası yok. Kod commit'i: `366f1cd`.

## 26. Özel Dağılımı Ayrı Bir Adıma Taşıma (2026-09-12)

### 26.1 Sorun

Canlı mobil kullanımda "Özel" kartına dokunulduğunda kart aynı sayfada
seçili ve büyük (donut grafikli) halde kalıyor, altında satır içi
düzenleyici (5 yüzde alanı + donut + toplam/kalan) açılıyordu. Bu blok
ekranı doldurduğu için kullanıcı, gerçek yüzde giriş alanlarını görmek
için aşağı kaydırması gerektiğini fark etmiyordu — özellik teknik olarak
çalışıyordu ama keşfedilemiyordu. `scrollIntoView`/otomatik kaydırma gibi
bir yama yerine (kullanıcının açıkça istemediği), Özel dağılım TAMAMEN
AYRI, odaklanmış bir adıma taşındı.

### 26.2 Yeni rota ve navigasyon semantiği

`#/hesaplama/ozel` (`CustomAllocationPage.tsx`) eklendi. Ana sayfadaki
(`CalculatorPage.tsx`) "Özel" kartı artık bir TOGGLE değil — tıklanınca
`navigate("/hesaplama/ozel")` çalışır, aynı sayfada hiçbir şey açılmaz.
Bu semantik farkı yansıtmak için `CustomProfileCard` artık `aria-pressed`
KULLANMIYOR (o, "aynı sayfada kalan basılı/basılı-değil" durumunu ifade
eder; burada geçerli değil) — gerçek bir `<button type="button">` olmaya
devam ediyor, böylece Tab ile odaklanma ve hem Enter hem Space ile açılma
(native buton davranışı) korunuyor. Kart, kullanıcının hâlâ Özel'i
kullandığını göstermek için `selected` durumunda GÖRSEL olarak
vurgulanıyor (`.selected` class) ama bu artık salt görsel bir ipucu,
ARIA toggle durumu değil. Küçük bir ">" ok ikonu, kartın "ileri götüren"
bir eylem olduğunu belirtiyor.

`CustomAllocationPage`, ziyaret edildiği anda `selectedProfileId`'yi
kendiliğinden `CUSTOM_PROFILE_ID`'ye sabitler (bozuk/eksik/eski bir
`selectedProfileId` sessionStorage'da olsa bile) — `customAllocations`
zaten güvenli, sanitize edilmiş bir varsayılana (`%0`'lar) sahip olduğu
için doğrudan/bozuk state ile açılışta ayrı bir "ana sayfaya yönlendir"
adımına gerek yoktur; sayfa kendi kendine yeterlidir.

`CalculationResultPage`'deki "← Geri dön" düğmesi artık koşullu: Özel
dağılımda `#/hesaplama/ozel`'e, hazır profillerde (DEĞİŞMEDEN) `/`'e
döner. Tüm yeni navigasyonlar `navigate()` ile PUSH yapıldığından (hiçbir
yerde `replace` kullanılmadı), tarayıcının gerçek geri/ileri düğmeleri de
ayrıca doğru sırada çalışır: Ana hesaplama → Özel dağılım → Sonuç — bu,
canlı Playwright ile `page.goBack()`/`page.goForward()` çağrılarıyla
doğrudan doğrulandı.

### 26.3 Sayfa içeriği ve mobil-öncelikli sıralama

`CustomAllocationEditor.tsx` yeniden sıralandı (`.custom-allocation-layout`
flex kapsayıcı): mobilde (tek sütun) DOM sırası — yüzde alanları → toplam/
kalan durumu (kart içinde) → donut+legend (ayrı blok). Masaüstünde
(`>=768px`) aynı iki blok `flex-direction: row` ile YAN YANA dizilir
(alanlar solda `flex:1 1 360px`, donut sağda `flex:0 0 260px`) — DOM sırası
ve dolayısıyla mobil davranış hiç değişmez, yalnızca akış yönü döner.
Sayfa (`CustomAllocationPage.tsx`) bunun etrafına başlık/açıklama, toplam
tutar alanı (mevcut `AmountInput`, ayrı bir `.card` kullanmadan) ve
"Portföyü Hesapla" butonunu ekler. Dokunma hedefleri: yüzde giriş
kutuları zaten `.input` sınıfından `min-height:44px` alıyordu; +/- artırma/
azaltma düğmeleri (`.custom-allocation-step`) `40px`'ten `44px`'e
büyütüldü.

Gerçek Playwright ölçümü (375×667, iPhone SE boyutu — en kısa yaygın
gerçek cihaz): "Mevduat" yüzde alanının üst kenarı `y≈385px`'te, yani
kaydırma OLMADAN ilk ekranda tamamen görünür durumda. Yeni bir grafik
kütüphanesi eklenmedi; mevcut bağımlılıksız `DonutChart` aynen yeniden
kullanıldı. "ALT İŞLEM ALANI" için önerilen sticky (yapışkan) alt bar
BİLİNÇLİ OLARAK eklenmedi — görev tanımında bu "kullanılabilir" (opsiyonel)
olarak belirtilmişti; sayfa artık zaten kısa ve tüm içerik (yüzde alanları,
toplam/kalan, donut, buton) kaydırma sonrası hızla erişilebilir olduğundan
sticky pozisyonlamanın (iOS Safari klavye/safe-area tuzakları dahil) ek
riskini üstlenmeye gerek görülmedi. Kullanıcı isterse ayrı bir istek
olarak eklenebilir.

### 26.4 Korunan davranışlar

Motor politikası (`roundingRemainderPolicy`), standart fon çözümü
(`buildDefaultPreferredFundIdByAssetClass`), FX loading/error ayrımı, fon
değiştirme akışı (`FundSubstitutionPage`), `CalculatorSelectionContext`/
sessionStorage yapısı, hazır risk profillerinin tüm davranışları ve admin/
Supabase/TEFAS-KAP/BKY-CKS/PWA hiç değiştirilmedi — bu görevde yalnızca
kullanıcı arayüzü/navigasyon katmanına dokunuldu.

### 26.5 Testler ve canlı doğrulama

Dosya bazında net değişim (`8390406` → `c25aa2f`, `git diff`'teki
`+`/`-` `it(` satırlarıyla doğrulandı): `CalculatorPage.test.tsx` **-7**
(20→13; satır içi düzenleyiciye özel 12 test kaldırıldı — çoğu
`CustomAllocationPage.test.tsx`'e taşındı/genişletildi — 5 yeni test
eklendi: navigasyon, aria-pressed'siz erişilebilirlik, tamamlanmış bir
özel dağılımla dönüş senaryoları), `CalculationResultPage.test.tsx` **+1**
(26→27; Özel'de "Geri dön"ün `#/hesaplama/ozel`'e gitmesi),
`CustomAllocationPage.test.tsx` (yeni dosya) **+17**. Toplam **net +11**,
genel toplam **332 → 343** (`npm run test` ile ayrıca doğrulandı, 343/343
geçiyor). Lint (0 hata, önceki 2 Fast Refresh uyarısı hariç), typecheck ve
production build temiz.

Gerçek Supabase verisiyle canlı Playwright doğrulaması (yerel dev sunucusu,
headless Chromium, ekran görüntüleriyle): Özel karta tıklayınca
`#/hesaplama/ozel`'e gidiyor, ana sayfada hiçbir inline düzenleyici
kalmıyor; 375×667 ve 375×812'de yüzde alanları ilk ekranda görünüyor;
320/375/390/428px'te `scrollWidth === clientWidth` (yatay taşma yok);
doğrudan `#/hesaplama/ozel` URL'sine gidiş çökmeden çalışıyor; ana sayfada
girilen tutar Özel sayfasına taşınıyor, Geri dön sonrası ana sayfada aynı
tutar korunuyor ve daha önce tamamlanmış bir özel dağılımla dönüldüğünde
Portföyü Hesapla doğrudan aktif; tarayıcı `goBack()`/`goForward()` sırası
Ana hesaplama → Özel dağılım → Sonuç → (geri) Özel dağılım → (geri) Ana
sayfa → (ileri) Özel dağılım olarak doğrulandı; fon değiştirme akışından
dönüldüğünde hem özel dağılım hem yeni rota korunuyor (Geri dön
`#/hesaplama/ozel`'e gidiyor, yüzdeler aynı kalıyor); masaüstünde iki
sütunlu yerleşim dengeli görünüyor; hiçbir adımda konsol/sayfa hatası
yakalanmadı. Kod commit'i: `c25aa2f`.

## 27. Güncel Commit Geçmişi (en yeniden en eskiye, bu özetin kapsadığı aralık)

```
c25aa2f Özel dağılımı ayrı bir #/hesaplama/ozel adımına taşı
8390406 docs: Bölüm 25'teki yanlış test sayısını düzelt
5b81dbf İlerleme özetine PPF %0 kuralı ve kur yükleme durumu düzeltmesini ekle
366f1cd Özel dağılımda PPF %0 kuralını düzelt, kur yükleme durumunu ayrıştır
80a68b7 Portföy hesaplamaya kullanıcı tanımlı "Özel" dağılım seçeneği ekle
18732a5 BKY B Grubu USD fiyatını resmi kaynaktan düzelt
554152c Nav ikonlarını tasarımcının verdiği gerçek SVG'lerle değiştir
766115f Hesaplama/Fonlar nav ikonlarını emojiden sade SVG ikonlara çevir
401734d Portföy Hesaplama akışını risk profili kartları + ayrı sonuç sayfasıyla yeniden tasarla
7a9de1a Fonlar sayfasında filtreyi sadeleştir, varsayılan sıralamayı 3 ay getirisine çevir, mobilde kompakt tablo ekle
2dd9227 Mobil navigasyonu alt sekmelerden üst sekmelere taşı
c07fa4e ILERLEME-OZETI.md dosyasını kalıcı proje dokümantasyonu olarak ekle
873459d tefas-sync'in KAP kaynaklı risk değerlerini sessizce ezmesini düzelt
dfeccf7 TEFAS senkronizasyon cron saatlerini Türkiye saatine güncelle
19cb86e Kullanıcı uygulamasındaki "FP" rozetini gerçek Fon Portföy ikonuyla değiştir
7e08f8e Geçici "FP" PWA ikonunu gerçek pasta grafiği logosuyla değiştir
e88e799 Kullanıcı fon listelerine ortak asgari uygunluk kuralı ekle
906288c KAP'tan risk değeri zenginleştirme: yeni, düşük hızlı, checkpoint'li iş ekle
5477ba7 PWA service worker güncellemelerini otomatik uygulama sorunu düzelt
d857fcc Pay hesaplama sırasını düzelt, 1/3/6/12 aylık getiri geçmişini geri yükle
```

Tümü `main`'e push edildi, her biri için GitHub Actions "Deploy to GitHub
Pages" workflow'u başarıyla tamamlandı ve canlı site (https://
webappuygulamalar.github.io/fon-portfoy/) HTTP 200 ile doğrulandı.
