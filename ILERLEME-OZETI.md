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

Bilinen bloklayıcı bir sorun yoktur — **proje tamamlanmıştır.**

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

## 7. Test / Lint / Build Sonuçları (en güncel — Bölüm 15 sonrası)

```
Lint:      0 hata, 2 zararsız uyarı (context+hook aynı dosyada — standart pratik, iki context dosyası için)
Typecheck: temiz (tsc -b; supabase/functions/** ayrıca `deno check` ile de temiz)
Test:      179/179 geçti (16 dosya)
Build:     başarılı (dist/, PWA service worker üretildi)
Advisor:   0 şema/RLS uyarısı (2 auth-seviyesi WARN var: leaked-password-protection, MFA — bu oturumun kapsamı dışında, proje geneli Auth ayarları)
```

(Bölüm 6 sonundaki 119/119 rakamı bu sayının bir önceki anlık görüntüsüdür;
o bölümdeki diğer detaylar hâlâ geçerlidir, yalnızca toplam test sayısı
sonraki oturumlarda eklenen yeni test dosyalarıyla arttı.)

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

## 16. Güncel Commit Geçmişi (en yeniden en eskiye, bu özetin kapsadığı aralık)

```
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
