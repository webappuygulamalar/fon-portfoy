-- CKS (İş Portföy Birinci Katılım Serbest (Döviz) Fon) tarihsel fiyat
-- düzeltmesi + yeni bir fiyat kaynağı enum değeri.
--
-- Bağlam: bkz. 20260911130000_fund_share_class_price_overrides.sql. CKS'nin
-- TÜM `fund_prices` geçmişi (261 satır, 2025-09-01 – 2026-09-11), TEFAS'ın
-- A Grubu'na (TL) ait ham `fiyat` alanının yanlışlıkla currency='USD'
-- etiketiyle kaydedilmesinden oluşuyordu (canlıda doğrulandı: fiyat aralığı
-- 49,50–61,87 — B Grubu'nun gerçek USD aralığıyla, ~1,27–1,28, uyuşmuyor;
-- TEFAS'ın kendi arayüzü de bu sayıyı "TL" etiketiyle gösteriyor).
--
-- Kapsam (bilerek sınırlı — bkz. kullanıcı talimatı: "veri kaynağı
-- bulunamazsa uydurma veya kurdan geriye dönük tahmin üretme; kapsamı
-- açıkça raporla"):
--   - İş Portföy'ün resmi CKS (USD) sayfası (isportfoy.com.tr), sayfaya
--     gömülü grafik verisiyle (dataset etiketi: "CKS - USD"), yalnızca
--     14.08.2026 – 11.09.2026 (21 iş günü) için doğrulanabilir, resmi,
--     native USD (B Grubu) fiyat sağlıyor. Bu pencere aşağıda düzeltilir.
--   - 2025-09-01 – 2026-08-13 için resmi/doğrulanabilir bir B Grubu USD
--     fiyat kaynağı BULUNAMADI (İş Portföy'ün sitesinde daha uzun bir
--     resmi geçmiş tablosu/API'si tespit edilemedi; TEFAS bu fon kodu
--     için B Grubu USD fiyatı hiç taşımıyor). Bu aralıktaki satırlar
--     UYDURULMAK/kurdan geriye dönük TAHMİN EDİLMEK yerine SİLİNİR —
--     yanlış (TL ölçeğinde) bir "USD" fiyatını olduğu gibi bırakmak, en
--     güncel doğru fiyatla birleştiğinde getiri hesaplarında (bkz.
--     fund_returns view) anlamsız/çok büyük bir sahte kayıp/kazanç
--     sıçraması üretir — bu, hatalı veriyi görünürde tutmaktan daha
--     tehlikelidir. fund_returns VE fund_price_on_or_before (bkz.
--     20260905120300_views_and_functions.sql) eksik geçmişi zaten
--     GÜVENLE null/"—" olarak ele alıyor (yeni eklenen bir fon için de
--     geçerli olan, halihazırda test edilmiş yol) — bu yüzden silme,
--     1/3/6 aylık ve yıllık CKS getirilerinin bir süre (yeterli yeni,
--     doğru geçmiş birikene kadar) "—" göstermesine yol açar; YANLIŞ bir
--     yüzde göstermez. Bu, admin'in ILERLEME-OZETI.md'de göreceği bilinen
--     bir kapsam sınırıdır — daha uzun resmi bir geçmiş kaynağı
--     bulunursa ayrı bir migration ile eklenebilir.
--
-- price_source enumuna 'MANAGEMENT_COMPANY' DEĞERİ EKLENMEZ burada bilerek:
-- bu migration'daki tek seferlik düzeltme 'MANUAL' olarak işaretlenir
-- (gerçekten de manuel/tek seferlik bir backfill'dir). 'MANAGEMENT_COMPANY'
-- yalnızca tefas-sync'in YENİ, otomatik İş Portföy adaptörü (bkz.
-- managementCompanyPriceAdapter.ts) günlük olarak yazdığı satırlar için,
-- ayrı bir migration'da (aynı transaction'da eklenip kullanılmasının
-- güvenli olmayabileceği PostgreSQL kısıtı nedeniyle) eklenir.

update public.fund_prices fp
set
  price = v.price,
  source = 'MANUAL',
  note = 'Düzeltme: önceki değer TEFAS''ın A Grubu (TL) fiyatıydı, yanlışlıkla currency=''USD'' ile kaydedilmişti. Bu değer İş Portföy''ün resmi CKS (USD) sayfasından (B Grubu, native USD, "Fon Birim Fiyatı (USD)" alanı) alınmıştır. Kaynak: https://www.isportfoy.com.tr/is-portfoy-birinci-katilim-serbest-doviz-fon-usd . Düzeltme tarihi: 2026-09-11.',
  fetched_at = now()
from public.funds f,
  (values
    ('2026-08-14'::date, 1.273999::numeric),
    ('2026-08-17'::date, 1.275364::numeric),
    ('2026-08-18'::date, 1.275337::numeric),
    ('2026-08-19'::date, 1.274948::numeric),
    ('2026-08-20'::date, 1.275238::numeric),
    ('2026-08-21'::date, 1.275544::numeric),
    ('2026-08-24'::date, 1.276467::numeric),
    ('2026-08-25'::date, 1.275931::numeric),
    ('2026-08-26'::date, 1.277308::numeric),
    ('2026-08-27'::date, 1.277401::numeric),
    ('2026-08-28'::date, 1.277642::numeric),
    ('2026-08-31'::date, 1.278343::numeric),
    ('2026-09-01'::date, 1.278344::numeric),
    ('2026-09-02'::date, 1.277819::numeric),
    ('2026-09-03'::date, 1.277582::numeric),
    ('2026-09-04'::date, 1.277778::numeric),
    ('2026-09-07'::date, 1.278411::numeric),
    ('2026-09-08'::date, 1.278657::numeric),
    ('2026-09-09'::date, 1.278424::numeric),
    ('2026-09-10'::date, 1.278585::numeric),
    ('2026-09-11'::date, 1.277608::numeric)
  ) as v(price_date, price)
where fp.fund_id = f.id
  and f.code = 'CKS'
  and fp.price_date = v.price_date
  and fp.currency = 'USD';

-- Doğrulanamayan, daha eski satırlar: yanlış (TL ölçeğinde) "USD" fiyatını
-- bırakmak yerine silinir (bkz. yukarıdaki kapsam notu). fund_id + kod
-- eşleşmesiyle YALNIZCA CKS etkilenir; başka hiçbir fonun geçmişine
-- dokunulmaz.
delete from public.fund_prices fp
using public.funds f
where fp.fund_id = f.id
  and f.code = 'CKS'
  and fp.price_date < '2026-08-14'::date;

-- Yeni fiyat kaynağı: tefas-sync'in resmi PYŞ (portföy yönetim şirketi)
-- sayfasından çektiği, TEFAS kaynaklı OLMAYAN ama yine de otomatik/günlük
-- fiyatları ayırt etmek için. Aynı transaction'da KULLANILMAZ (yalnızca
-- Edge Function çalışma zamanında, ayrı bir bağlantı/transaction'da
-- kullanılır) — bu yüzden burada eklenmesi güvenlidir.
alter type public.price_source add value 'MANAGEMENT_COMPANY';

comment on type public.price_source is
  'TEFAS: günlük toplu TEFAS senkronizasyonundan. MANUAL: admin tarafından elle girilmiş veya bir defaya mahsus doğrulanmış düzeltme. MANAGEMENT_COMPANY: tefas-sync''in, fund_share_class_overrides''ta tanımlı bir fon için, TEFAS''ın ham fiyatı yanlış pay grubuna ait olduğunda resmi portföy yönetim şirketi sayfasından otomatik çektiği native fiyat.';
