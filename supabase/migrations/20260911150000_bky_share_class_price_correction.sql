-- BKY (Yapı Kredi Portföy Birinci Katılım Serbest (Döviz) Fon) B Grubu
-- native USD fiyat düzeltmesi ve günlük resmî fiyat kaynağı.
--
-- Kök neden: TEFAS toplu liste endpoint'i BKY için A Grubu TL fiyatını
-- döndürüyor (11.09.2026: 50,491927). Fon `currency='USD'` olarak takip
-- edildiği için bu sayı native USD sanılıp hesaplama sırasında TCMB kuruyla
-- bir kez daha çarpılıyordu. Yapı Kredi Portföy'ün resmî fon detay sayfası
-- aynı tarih için iki pay grubunu açıkça ayırır:
--   - Fon Birim Değeri (TL):  50,491927 TL
--   - Fon Birim Değeri (USD):  1,043073 USD
-- KAP da A Grubu'nun TL, B Grubu'nun USD olduğunu ve B Grubu fiyatının TL
-- fiyatının TCMB USD alış kuruna bölünmesiyle hesaplandığını açıklar.
--
-- Günlük senkronizasyon bundan sonra Yapı Kredi Portföy'ün kendi sayfasının
-- kullandığı resmî JSON endpoint'inden B Grubu USD alanını çeker. Endpoint
-- fon kodunu, tarihi ve TL/USD fiyatlarını birlikte döndürür; adapter bunların
-- üçünü de doğrulamadan fiyat yazmaz. Kaynak erişilemez veya biçim değişirse
-- yanlış TEFAS fiyatına geri dönülmez, o günün BKY fiyatı atlanır.

insert into public.fund_share_class_overrides (
  fund_code, share_class_label, native_currency, tefas_price_is_native,
  price_fetch_source, price_fetch_url,
  verification_source, verification_source_url, verification_note,
  verified_at, is_active
) values (
  'BKY', 'B Grubu', 'USD', false,
  'yapikredi_resmi_api', 'https://www.yapikrediportfoy.com.tr/getFundDetail/2125',
  'kap_genel_bilgiler_ve_resmi_pys_api',
  'https://kap.org.tr/tr/fon-bilgileri/genel/bky-yapi-kredi-portfoy-birinci-katilim-serbest-doviz-fon',
  'KAP: A Grubu TL, B Grubu USD; B Grubu fiyatı A Grubu TL fiyatının TCMB USD alış kuruna bölünmesiyle hesaplanır. Yapı Kredi Portföy resmî fon detay endpoint''i 11.09.2026 için TL=50,491927 ve USD=1,043073 değerlerini aynı yanıtta yayımlar; risk B Grubu için 3/7''dir. TEFAS toplu fiyatı A Grubu TL değeridir ve native USD olarak kullanılamaz. Doğrulama tarihi: 2026-09-11.',
  now(), true
)
on conflict (fund_code) do update set
  share_class_label = excluded.share_class_label,
  native_currency = excluded.native_currency,
  tefas_price_is_native = excluded.tefas_price_is_native,
  price_fetch_source = excluded.price_fetch_source,
  price_fetch_url = excluded.price_fetch_url,
  verification_source = excluded.verification_source,
  verification_source_url = excluded.verification_source_url,
  verification_note = excluded.verification_note,
  verified_at = excluded.verified_at,
  is_active = excluded.is_active;

-- Risk ve para birimi, mevcut `kap`-önekli koruma yoluyla tefas-sync'in
-- referans katalog upsert'lerinden korunur.
update public.funds set
  risk_value = 3,
  risk_source = 'kap_share_class_verified_manual',
  risk_source_url = 'https://kap.org.tr/tr/fon-bilgileri/genel/bky-yapi-kredi-portfoy-birinci-katilim-serbest-doviz-fon',
  risk_updated_at = now(),
  risk_verified = true,
  risk_verification_needed = false,
  risk_verification_note = null,
  currency = 'USD',
  currency_source = 'share_class_override_verified'
where code = 'BKY';

-- Yapı Kredi Portföy'ün resmî fiyat grafiği özel tarih aralıklarıyla 27
-- günlük pencereler halinde çağrıldı. Pencere sınırları örtüştürülerek ilk
-- günün atlanmadığı ayrıca doğrulandı. Aşağıdaki 235 satır, fonun ilk resmî
-- fiyatından (03.10.2025) 11.09.2026'ya kadar yayımlanan B Grubu native USD
-- serisidir. Hiçbir değer TEFAS TL fiyatından veya kurdan tahmin edilmedi.
create temporary table bky_verified_usd_history (
  price_date date primary key,
  price numeric not null check (price > 0)
) on commit drop;

insert into bky_verified_usd_history (price_date, price) values
  ('2025-10-03', 0.999620),
  ('2025-10-06', 0.999739),
  ('2025-10-07', 0.999793),
  ('2025-10-08', 0.999813),
  ('2025-10-09', 0.999843),
  ('2025-10-10', 0.999913),
  ('2025-10-13', 0.999962),
  ('2025-10-14', 0.999962),
  ('2025-10-15', 1.000101),
  ('2025-10-16', 1.000195),
  ('2025-10-17', 1.000306),
  ('2025-10-20', 1.000639),
  ('2025-10-21', 1.000745),
  ('2025-10-22', 1.000839),
  ('2025-10-23', 1.000941),
  ('2025-10-24', 1.001054),
  ('2025-10-27', 1.001376),
  ('2025-10-28', 1.001487),
  ('2025-10-30', 1.001712),
  ('2025-10-31', 1.001805),
  ('2025-11-03', 1.001978),
  ('2025-11-04', 1.002039),
  ('2025-11-05', 1.002146),
  ('2025-11-06', 1.002263),
  ('2025-11-07', 1.002379),
  ('2025-11-10', 1.002725),
  ('2025-11-11', 1.002851),
  ('2025-11-12', 1.002851),
  ('2025-11-13', 1.003062),
  ('2025-11-14', 1.003172),
  ('2025-11-17', 1.003513),
  ('2025-11-18', 1.003310),
  ('2025-11-19', 1.003695),
  ('2025-11-20', 1.003816),
  ('2025-11-21', 1.003936),
  ('2025-11-24', 1.004287),
  ('2025-11-25', 1.004392),
  ('2025-11-26', 1.004512),
  ('2025-11-27', 1.004631),
  ('2025-11-28', 1.004631),
  ('2025-12-01', 1.005010),
  ('2025-12-02', 1.005189),
  ('2025-12-03', 1.005319),
  ('2025-12-04', 1.005434),
  ('2025-12-05', 1.005555),
  ('2025-12-08', 1.005896),
  ('2025-12-09', 1.006018),
  ('2025-12-10', 1.006124),
  ('2025-12-11', 1.006247),
  ('2025-12-12', 1.006364),
  ('2025-12-15', 1.006737),
  ('2025-12-16', 1.006852),
  ('2025-12-17', 1.006977),
  ('2025-12-18', 1.007100),
  ('2025-12-19', 1.007207),
  ('2025-12-22', 1.007516),
  ('2025-12-23', 1.007633),
  ('2025-12-24', 1.007754),
  ('2025-12-25', 1.007870),
  ('2025-12-26', 1.007870),
  ('2025-12-29', 1.007870),
  ('2025-12-30', 1.008471),
  ('2025-12-31', 1.008500),
  ('2026-01-02', 1.008618),
  ('2026-01-05', 1.008975),
  ('2026-01-06', 1.009099),
  ('2026-01-07', 1.009220),
  ('2026-01-08', 1.009341),
  ('2026-01-09', 1.009460),
  ('2026-01-12', 1.009808),
  ('2026-01-13', 1.009757),
  ('2026-01-14', 1.010037),
  ('2026-01-15', 1.010159),
  ('2026-01-16', 1.010269),
  ('2026-01-19', 1.010623),
  ('2026-01-20', 1.010623),
  ('2026-01-21', 1.010858),
  ('2026-01-22', 1.010957),
  ('2026-01-23', 1.011097),
  ('2026-01-26', 1.011467),
  ('2026-01-27', 1.011595),
  ('2026-01-28', 1.011700),
  ('2026-01-29', 1.011863),
  ('2026-01-30', 1.012025),
  ('2026-02-02', 1.012320),
  ('2026-02-04', 1.012697),
  ('2026-02-05', 1.012883),
  ('2026-02-06', 1.013018),
  ('2026-02-09', 1.013363),
  ('2026-02-10', 1.013560),
  ('2026-02-11', 1.013684),
  ('2026-02-12', 1.013833),
  ('2026-02-13', 1.014000),
  ('2026-02-16', 1.014358),
  ('2026-02-17', 1.014358),
  ('2026-02-18', 1.014649),
  ('2026-02-19', 1.014789),
  ('2026-02-20', 1.014932),
  ('2026-02-23', 1.015315),
  ('2026-02-24', 1.015486),
  ('2026-02-25', 1.015624),
  ('2026-02-26', 1.015766),
  ('2026-02-27', 1.015904),
  ('2026-03-02', 1.016577),
  ('2026-03-03', 1.016733),
  ('2026-03-04', 1.016834),
  ('2026-03-05', 1.017000),
  ('2026-03-06', 1.017093),
  ('2026-03-09', 1.017529),
  ('2026-03-10', 1.017668),
  ('2026-03-11', 1.017814),
  ('2026-03-12', 1.017958),
  ('2026-03-13', 1.018083),
  ('2026-03-16', 1.018473),
  ('2026-03-17', 1.018626),
  ('2026-03-18', 1.018765),
  ('2026-03-19', 1.018907),
  ('2026-03-23', 1.019414),
  ('2026-03-24', 1.019553),
  ('2026-03-25', 1.019688),
  ('2026-03-26', 1.019829),
  ('2026-03-27', 1.019971),
  ('2026-03-30', 1.020350),
  ('2026-03-31', 1.020451),
  ('2026-04-01', 1.020447),
  ('2026-04-02', 1.020604),
  ('2026-04-03', 1.020747),
  ('2026-04-06', 1.020747),
  ('2026-04-07', 1.020747),
  ('2026-04-08', 1.021433),
  ('2026-04-09', 1.021680),
  ('2026-04-10', 1.021770),
  ('2026-04-13', 1.022187),
  ('2026-04-14', 1.022346),
  ('2026-04-15', 1.022516),
  ('2026-04-16', 1.022667),
  ('2026-04-17', 1.022835),
  ('2026-04-20', 1.023235),
  ('2026-04-21', 1.023434),
  ('2026-04-22', 1.023588),
  ('2026-04-24', 1.023884),
  ('2026-04-27', 1.024316),
  ('2026-04-28', 1.024506),
  ('2026-04-29', 1.024647),
  ('2026-04-30', 1.024810),
  ('2026-05-04', 1.025365),
  ('2026-05-05', 1.025365),
  ('2026-05-06', 1.025699),
  ('2026-05-07', 1.025864),
  ('2026-05-08', 1.026025),
  ('2026-05-11', 1.026409),
  ('2026-05-12', 1.026579),
  ('2026-05-13', 1.026736),
  ('2026-05-14', 1.026911),
  ('2026-05-15', 1.027053),
  ('2026-05-18', 1.027435),
  ('2026-05-20', 1.027740),
  ('2026-05-21', 1.027891),
  ('2026-05-22', 1.028032),
  ('2026-05-25', 1.028433),
  ('2026-05-26', 1.028433),
  ('2026-06-01', 1.029237),
  ('2026-06-02', 1.029402),
  ('2026-06-03', 1.029553),
  ('2026-06-04', 1.029694),
  ('2026-06-05', 1.029835),
  ('2026-06-08', 1.030238),
  ('2026-06-09', 1.030389),
  ('2026-06-10', 1.030531),
  ('2026-06-11', 1.030672),
  ('2026-06-12', 1.030818),
  ('2026-06-15', 1.031216),
  ('2026-06-16', 1.031361),
  ('2026-06-17', 1.031499),
  ('2026-06-18', 1.031644),
  ('2026-06-19', 1.031792),
  ('2026-06-22', 1.031792),
  ('2026-06-23', 1.032306),
  ('2026-06-24', 1.032453),
  ('2026-06-25', 1.032599),
  ('2026-06-26', 1.032739),
  ('2026-06-29', 1.033107),
  ('2026-06-30', 1.033253),
  ('2026-07-01', 1.033364),
  ('2026-07-02', 1.033462),
  ('2026-07-03', 1.033609),
  ('2026-07-06', 1.033609),
  ('2026-07-07', 1.034152),
  ('2026-07-08', 1.034290),
  ('2026-07-09', 1.034434),
  ('2026-07-10', 1.034576),
  ('2026-07-13', 1.034962),
  ('2026-07-14', 1.035109),
  ('2026-07-16', 1.035395),
  ('2026-07-17', 1.035547),
  ('2026-07-20', 1.035939),
  ('2026-07-21', 1.036086),
  ('2026-07-22', 1.036228),
  ('2026-07-23', 1.036365),
  ('2026-07-24', 1.036508),
  ('2026-07-27', 1.036898),
  ('2026-07-28', 1.037048),
  ('2026-07-29', 1.037181),
  ('2026-07-30', 1.037325),
  ('2026-07-31', 1.037378),
  ('2026-08-03', 1.037706),
  ('2026-08-04', 1.037859),
  ('2026-08-05', 1.037994),
  ('2026-08-06', 1.038141),
  ('2026-08-07', 1.038284),
  ('2026-08-10', 1.038685),
  ('2026-08-11', 1.038845),
  ('2026-08-12', 1.038990),
  ('2026-08-13', 1.039144),
  ('2026-08-14', 1.039288),
  ('2026-08-17', 1.039683),
  ('2026-08-18', 1.039852),
  ('2026-08-19', 1.040004),
  ('2026-08-20', 1.040150),
  ('2026-08-21', 1.040302),
  ('2026-08-24', 1.040705),
  ('2026-08-25', 1.040860),
  ('2026-08-26', 1.041003),
  ('2026-08-27', 1.041149),
  ('2026-08-28', 1.041297),
  ('2026-08-31', 1.041611),
  ('2026-09-01', 1.041687),
  ('2026-09-02', 1.041832),
  ('2026-09-03', 1.041974),
  ('2026-09-04', 1.042120),
  ('2026-09-07', 1.042513),
  ('2026-09-08', 1.042513),
  ('2026-09-09', 1.042787),
  ('2026-09-10', 1.042933),
  ('2026-09-11', 1.043073);

-- Resmî seriyle eşleşmeyen bütün BKY satırlarını (yanlış TL ölçeğinde USD
-- etiketli geçmiş ve olası farklı-para-birimli kalıntılar) kaldır. Kapsam
-- fund code ile sınırlandırılmıştır; başka hiçbir fon etkilenmez.
delete from public.fund_prices fp
using public.funds f
where fp.fund_id = f.id
  and f.code = 'BKY'
  and not exists (
    select 1
    from bky_verified_usd_history h
    where h.price_date = fp.price_date
      and fp.currency = 'USD'
  );

-- Mevcut tarihlerin TEFAS'tan gelen fon büyüklüğü/yatırımcı sayısını korur;
-- yalnızca fiyat, kaynak ve doğrulama notu değiştirilir. Resmî seride olup
-- eski tabloda bulunmayan tarihler güvenle NULL metriklerle eklenir.
insert into public.fund_prices (
  fund_id, price_date, currency, price, fund_size, investor_count,
  source, fetched_at, note
)
select
  f.id,
  h.price_date,
  'USD',
  h.price,
  old.fund_size,
  old.investor_count,
  'MANUAL',
  now(),
  'BKY B Grubu native USD fiyatı. Kaynak: Yapı Kredi Portföy resmî fon detay API''si (https://www.yapikrediportfoy.com.tr/getFundDetail/2125). 27 günlük özel tarih pencereleriyle alınmıştır; TEFAS TL fiyatından veya kurdan türetilmemiştir. Doğrulama tarihi: 2026-09-11.'
from public.funds f
cross join bky_verified_usd_history h
left join public.fund_prices old
  on old.fund_id = f.id
  and old.price_date = h.price_date
  and old.currency = 'USD'
where f.code = 'BKY'
on conflict (fund_id, price_date, currency) do update set
  price = excluded.price,
  source = excluded.source,
  fetched_at = excluded.fetched_at,
  note = excluded.note;
