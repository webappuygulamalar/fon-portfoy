-- Fon kataloğunu TEFAS'taki TÜM katılım fonlarını kapsayacak şekilde
-- genişletir. Önceki tasarımda `funds.asset_class` (5 sabit değerli enum)
-- her fon için ZORUNLUYDU — bu, yalnızca modelin 4 fon sınıfına bire bir
-- karşılık gelen 4 seed fonu varken doğruydu. Artık kataloğa kira
-- sertifikası, çoklu varlık, fon sepeti gibi model dışı yüzlerce katılım
-- fonu da eklendiğinden asset_class NULL olabilmelidir ("model dışı diğer
-- katılım fonları"). asset_class enum'unun KENDİSİ değişmez — hâlâ yalnızca
-- 5 sabit değer içerir (bkz. 20260905120000_extensions_and_enums.sql); bu
-- migration sadece funds.asset_class sütununu nullable yapar. Yabancı hisse
-- veya başka bir sınıf enum'a EKLENEMEZ kuralı aynen geçerlidir.
--
-- management_company da artık nullable: TEFAS'ın toplu listesi ayrı bir
-- "kurucu/portföy şirketi" alanı vermiyor, bu bilgi fon unvanından
-- çıkarılıyor (bkz. Edge Function); çıkarılamazsa NULL kalır ve arayüzde
-- "—" gösterilir.

alter table public.funds
  alter column asset_class drop not null,
  alter column management_company drop not null;

alter table public.funds
  add column catalog_category text,
  add column is_participation_fund boolean not null default true,
  add column is_substitution_eligible boolean not null default false,
  add column risk_value smallint;

alter table public.funds
  add constraint funds_risk_value_range check (risk_value is null or risk_value between 1 and 7);

comment on column public.funds.asset_class is
  'Model varlık sınıfı (5 sabit değer). NULL = model dışı katılım fonu.';
comment on column public.funds.catalog_category is
  'TEFAS başlığından/referans kataloğundan türetilen, yalnızca gösterim amaçlı ince kategori.';
comment on column public.funds.is_substitution_eligible is
  'true ise kullanıcı bu fonu kendi asset_class''ı için model fon değişiminde seçebilir. Yalnızca asset_class dolu VE sınıflandırma güvenilir olan fonlarda true olmalıdır.';

-- Mevcut 4 seed fonu zaten bilinçli ve güvenilir biçimde sınıflandırılmıştı
-- (bkz. seed.sql) — bir sonraki TEFAS senkronizasyonu bunu zaten yeniden
-- teyit edip aynı sonuca varacaktır, ancak geçiş penceresinde (migration
-- uygulandıktan hemen sonra, ilk senkronizasyon çalışmadan önce) model fon
-- değişimi ekranının boş görünmemesi için burada da belirtiyoruz.
update public.funds set
  is_participation_fund = true,
  is_substitution_eligible = true,
  catalog_category = case asset_class
    when 'MONEY_MARKET' then 'Para Piyasası & Kısa Vade'
    when 'BIST_EQUITY' then 'Hisse Senedi'
    when 'GOLD' then 'Altın & Kıymetli Maden'
    when 'FX' then 'Döviz Katılım Serbest'
    else catalog_category
  end
where code in ('PKT', 'ZKP', 'ZGD', 'BKY');
