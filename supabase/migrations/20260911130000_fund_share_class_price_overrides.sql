-- Çoklu pay grubuna (A/B grubu gibi) sahip katılım fonları için genel bir
-- doğrulanmış pay-grubu/fiyat-kaynağı geçersiz kılma (override) mekanizması.
--
-- Bağlam: CKS (İş Portföy Birinci Katılım Serbest (Döviz) Fon) canlıda
-- risk_value=null olduğu için ortak listeleme filtresinden (bkz.
-- isFundEligibleForListing) eleniyordu. KAP'ın fon genel bilgiler sayfası
-- (https://www.kap.org.tr/tr/fon-bilgileri/genel/{kap_fund_id}) risk verisini
-- "A Grubu Paylar: 5 / B Grubu Paylar: 3" biçiminde, PARA BİRİMİ ETİKETİ
-- OLMADAN veriyor — kap-risk-sync bunu bilinçli olarak (bkz. kapRiskParser.ts
-- resolveByCurrency) belirsiz sayıp risk_value yazmadı, risk_verification_needed
-- işaretledi (canlıda doğrulandı, bkz. funds.risk_verification_note geçmişi).
-- KAP sayfasının kendisi ayrıca "A Grubu Paylar: TL, B Grubu Paylar: USD"
-- bilgisini taşıyor. Uygulama CKS'yi currency='USD' olarak (B Grubu) takip
-- ediyor; bu nedenle B Grubu'nun risk değeri olan 3 kullanılmalıdır. İş
-- Portföy'ün resmi CKS (USD) sayfası (isportfoy.com.tr) bağımsız olarak
-- "Risk Seviyesi: 3/7" gösterip bu değeri doğrular.
--
-- AYRICA (ve daha kritik): TEFAS'ın toplu liste endpoint'inin CKS için
-- döndürdüğü `fiyat` alanı (ör. 11.09.2026: 61,845028) GERÇEKTE TL
-- cinsindendir — TEFAS'ın kendi genel fon sayfası (tefas.gov.tr) bu fiyatı
-- doğrudan "TL" etiketiyle gösteriyor ve bu, KAP'ın "A Grubu Paylar: TL"
-- bilgisiyle tutarlıdır. Ancak funds.currency='USD' olduğundan, önceki
-- tefas-sync bu TL fiyatını YANLIŞLIKLA USD olarak fund_prices'a yazıyordu
-- (currency_source='reference_catalog', bkz. 20260906090000). B Grubu'nun
-- gerçek native USD fiyatı (ör. 11.09.2026: 1,277608 USD) yalnızca İş
-- Portföy'ün resmi fon sayfasında ("Fon Birim Fiyatı (USD)" alanı) mevcuttur
-- — TEFAS'ın toplu/tekil fon endpoint'leri bu fon kodu için B Grubu'na özgü
-- ayrı bir USD fiyat ALANI DÖNDÜRMEZ (canlı doğrulandı: TEFAS'ın hem toplu
-- liste hem FonAnaliz sayfası CKS için tek, TL cinsinden bir fiyat taşır).
--
-- Bu migration, CKS'ye özgü dağınık bir koşul yerine, ileride benzer durumda
-- olan başka fonlar için de kullanılabilecek GENEL bir tablo ekler:
-- fund_share_class_overrides. Bir fon kodu bu tabloda aktif bir satıra
-- sahipse, tefas-sync (bkz. index.ts) o fon için:
--   1. currency/currency_source'u referans katalog/başlık sezgisinden DEĞİL,
--      bu tablodaki native_currency'den alır (her çalıştırmada YENİDEN
--      uygulanır — asla eski/yanlış bir değere geri düşmez).
--   2. tefas_price_is_native=false ise, TEFAS'ın ham `fiyat` alanını o fon
--      için fund_prices'a YAZMAZ (yanlış pay grubunun fiyatı olabileceği
--      için) — bunun yerine (varsa) price_fetch_source/price_fetch_url'de
--      tanımlı resmi kaynaktan native fiyatı çeker; kaynak yoksa veya çekim
--      başarısız olursa o fonun fiyatını o çalıştırmada ATLAR (uydurmaz,
--      son bilinen değeri korur, sync_runs.error_summary'ye not düşer).
--
-- Yalnızca CKS için satır eklenir; başka döviz katılım fonlarında (ör. BKY,
-- TRU, DKL — bkz. ILERLEME-OZETI.md denetim notu) aynı sorunun var olup
-- olmadığı DOĞRULANMADAN satır eklenmez — admin incelemesine bırakılır.

create table public.fund_share_class_overrides (
  id uuid primary key default gen_random_uuid(),
  fund_code text not null unique references public.funds(code) on delete cascade,
  share_class_label text not null,
  native_currency text not null check (native_currency in ('TRY', 'USD', 'EUR')),
  -- true ise TEFAS'ın toplu liste `fiyat` alanı bu fonun takip edilen pay
  -- grubuna aittir ve olduğu gibi kullanılabilir. false ise TEFAS'ın fiyatı
  -- BAŞKA bir pay grubuna (genellikle TL grubuna) aittir ve KULLANILMAMALIDIR.
  tefas_price_is_native boolean not null default false,
  -- tefas_price_is_native=false olduğunda native fiyatın çekileceği kaynak.
  -- NULL ise (henüz otomatik bir kaynak yoksa) tefas-sync o fon için
  -- fiyatı her çalıştırmada atlar — admin manuel fiyat girene kadar fiyat
  -- güncellenmez, ASLA yanlış TEFAS fiyatına geri düşülmez.
  price_fetch_source text,
  price_fetch_url text,
  verification_source text not null,
  verification_source_url text not null,
  verification_note text,
  verified_at timestamptz not null default now(),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.fund_share_class_overrides is
  'Birden fazla pay grubuna (A/B grubu gibi) sahip katılım fonları için, hangi pay grubunun (native para birimi + fiyat kaynağı) takip edildiğini açık ve doğrulanabilir şekilde kaydeder. tefas-sync bu tabloyu her çalıştırmada okur ve aktif satırları referans katalog/TEFAS ham fiyatının önüne geçirir — böylece günlük senkronizasyon doğrulanmış bir değeri asla sessizce ezmez.';
comment on column public.fund_share_class_overrides.share_class_label is
  'İnsan tarafından okunabilir pay grubu adı (ör. "B Grubu"). Yalnızca belgeleme amaçlıdır, kodda eşleştirme için kullanılmaz.';
comment on column public.fund_share_class_overrides.tefas_price_is_native is
  'true: TEFAS''ın ham fiyatı bu pay grubuna aittir, olduğu gibi kullanılır. false: TEFAS''ın fiyatı BAŞKA bir pay grubuna aittir, tefas-sync bu fon için TEFAS fiyatını fund_prices''a YAZMAZ.';
comment on column public.fund_share_class_overrides.price_fetch_source is
  'tefas_price_is_native=false olduğunda native fiyatın çekileceği kaynağın kısa kodu (ör. isportfoy_resmi_sayfa). NULL = otomatik kaynak yok, fiyat güncellemesi atlanır.';
comment on column public.fund_share_class_overrides.verification_source is
  'currency/risk/share_class doğrulamasının dayandığı kaynağın kısa açıklaması (ör. kap_ve_resmi_pys_sitesi).';

create trigger fund_share_class_overrides_set_updated_at
  before update on public.fund_share_class_overrides
  for each row execute function public.set_updated_at();

alter table public.fund_share_class_overrides enable row level security;

-- sync_runs / risk_sync_runs ile aynı desen: yalnızca admin görebilir,
-- yazma yalnızca service role (Edge Function/migration) ile yapılır, bu
-- yüzden authenticated/anon için write policy tanımlanmaz.
create policy fund_share_class_overrides_select_admin on public.fund_share_class_overrides
  for select to authenticated using ((select public.is_admin()));

-- CKS için doğrulanmış eşleştirme. Fiyat kaynağı: İş Portföy'ün resmi CKS
-- (USD) sayfası, "Fon Birim Fiyatı (USD)" alanı (canlı doğrulandı: server-side
-- render edilmiş HTML, bot koruması yok, TEFAS'ın aksine düz HTTP isteğiyle
-- erişilebilir). Doğrulama kaynağı: KAP genel bilgiler sayfası (A/B grubu
-- para birimi ayrımı) + İş Portföy'ün resmi sitesi (bağımsız risk 3/7 teyidi).
insert into public.fund_share_class_overrides (
  fund_code, share_class_label, native_currency, tefas_price_is_native,
  price_fetch_source, price_fetch_url,
  verification_source, verification_source_url, verification_note
) values (
  'CKS', 'B Grubu', 'USD', false,
  'isportfoy_resmi_sayfa', 'https://www.isportfoy.com.tr/is-portfoy-birinci-katilim-serbest-doviz-fon-usd',
  'kap_genel_bilgiler_ve_resmi_pys_sitesi',
  'https://www.kap.org.tr/tr/fon-bilgileri/genel/4028328d86d233bf01877fb5e99d3c51',
  'KAP fon genel bilgiler sayfasında "Fonun Yatırım Amacı veya Stratejisi" alanında para birimi etiketi olmadan "A Grubu Paylar: 5 B Grubu Paylar: 3" metni yer alır (kap-risk-sync bunu doğru şekilde belirsiz sayıp risk_value yazmadı). KAP sayfası ayrıca A Grubu = TL, B Grubu = USD bilgisini taşır. Uygulama CKS''yi USD (B Grubu) olarak takip eder, bu yüzden risk 3 kullanılır. TEFAS''ın toplu liste ve FonAnaliz sayfasındaki CKS fiyatı (ör. 11.09.2026: 61,845028) TEFAS''ın kendi arayüzünde de "TL" etiketiyle gösterilir; bu A Grubu''na ait bir fiyattır, B Grubu''nun native USD fiyatı değildir ve fund_prices''a USD diye yazılmamalıdır. B Grubu native USD fiyatı İş Portföy''ün resmi sayfasında ayrı bir alanda yayınlanır (ör. 11.09.2026: 1,277608 USD). Doğrulama tarihi: 2026-09-11.'
);

-- CKS risk değerini KAP kaynaklı, korunan yola (bkz. classifyFund.ts
-- shouldSkipReferenceCatalogRisk: risk_source 'kap' ile başlıyorsa tefas-sync
-- risk sütunlarına ASLA dokunmaz) manuel doğrulama ile yazar. Bu; tek seferlik,
-- korunmayan bir SQL düzeltmesi DEĞİLDİR - mevcut, canlıda kanıtlanmış
-- korumayı (bkz. 20260906160000_kap_risk_metadata.sql) aynen kullanır.
update public.funds set
  risk_value = 3,
  risk_source = 'kap_share_class_verified_manual',
  risk_source_url = 'https://www.kap.org.tr/tr/fon-bilgileri/genel/4028328d86d233bf01877fb5e99d3c51',
  risk_updated_at = now(),
  risk_verified = true,
  risk_verification_needed = false,
  risk_verification_note = null,
  currency = 'USD',
  currency_source = 'share_class_override_verified'
where code = 'CKS';
