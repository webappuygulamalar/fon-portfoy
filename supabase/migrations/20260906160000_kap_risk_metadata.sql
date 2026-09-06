-- KAP (Kamuyu Aydınlatma Platformu) resmi fon sayfalarından risk değeri
-- zenginleştirmesi için altyapı.
--
-- Bağlam: kullanıcı, risk_value için üst sınırın referans katalogla
-- (176/286, bkz. 20260906120000) sınırlı olmadığını; KAP'ın resmi fon
-- sayfalarında da bir risk verisi bulunduğunu belirtti ve iki örnek KAP
-- URL'si verdi. Araştırma KAP'ın normal, güvenlik önlemi OLMAYAN halka açık
-- arama API'si (POST /tr/api/search/combined) ve fon detay sayfaları
-- (Next.js RSC akışına gömülü `fundDetail` dizisi) üzerinden, düşük istek
-- hızıyla yapıldı — hiçbir güvenlik/hız sınırlaması aşılmadı.
--
-- Bulgular:
--  - Kullanıcının verdiği iki örnek URL emeklilik fonuydu (fundType=EYF),
--    kapsamımız dışında; biri açıkça "Faiz İçerir" ibaresi taşıyordu.
--  - Gerçek katılım (yatırım) fonlarında risk verisi TEK bir üst düzey
--    "Fonun Risk Değeri" alanı olarak DEĞİL, çoğunlukla "Fonun Yatırım
--    Amacı veya Stratejisi" alanının içine GÖMÜLÜ, pay grubu bazlı serbest
--    metin olarak geliyor (ör. "TL:6 USD:3", "A grubu paylar için 5").
--  - Bazı fonlarda (BKY, PKT, AIS gibi) bu alan tamamen boş / risk içermiyor.
--  - Bu nedenle günlük TEFAS senkronizasyonundan TAMAMEN AYRI, düşük
--    yoğunluklu, checkpoint'li/devam edebilir, YALNIZCA admin tarafından
--    manuel tetiklenen bir zenginleştirme işi olarak tasarlandı — otomatik
--    cron'a BAĞLANMADI (üçüncü taraf bir sitede sürekli/gözetimsiz arka
--    plan isteği oluşturmamak için kasıtlı tercih).

alter table public.funds
  add column kap_fund_id text,
  add column kap_checked_at timestamptz,
  add column kap_lookup_status text
    check (kap_lookup_status is null or kap_lookup_status in ('matched', 'ambiguous_search_match', 'not_found', 'error')),
  add column risk_verification_needed boolean not null default false,
  add column risk_verification_note text;

comment on column public.funds.kap_fund_id is
  'KAP''ın dahili fon OID''si (kap.org.tr/tr/fon-bilgileri/genel/{oid}). Fon kodu (TEFAS ile birebir) VE kurucu unvanı çakışmadan yazılmaz.';
comment on column public.funds.kap_checked_at is
  'Son KAP arama/eşleştirme denemesinin zamanı. NULL = hiç denenmedi. kap-risk-sync bir sonraki partiyi bu alana göre seçer (checkpoint); ''error'' durumundakiler bu alandan bağımsız her zaman yeniden denenir.';
comment on column public.funds.kap_lookup_status is
  'matched: KAP''ta kod+kurucu ile tekil, güvenle doğrulanan fon bulundu (risk verisi olsun ya da olmasın). ambiguous_search_match: arama sonucu birden fazla/kurucu uyuşmuyor, otomatik eşleştirilmedi. not_found: KAP aramasında kod eşleşmesi yok. error: geçici ağ/ayrıştırma hatası, bir sonraki çalışmada tekrar denenir.';
comment on column public.funds.risk_verification_needed is
  'true ise KAP''ta fon güvenle bulundu ve bir risk metni VAR ama çelişkili/belirsiz (ör. para birimi etiketsiz birden çok pay grubu farklı değer veriyor, ya da metin sayısal bir risk değerine ayrıştırılamıyor) — risk_value OTOMATİK YAZILMADI, admin incelemesi gerekir.';
comment on column public.funds.risk_verification_note is
  'risk_verification_needed=true olduğunda, çelişkinin/belirsizliğin insan tarafından okunabilir açıklaması (ham KAP metniyle birlikte).';

create table public.risk_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status public.sync_status not null default 'running',
  trigger_type public.sync_trigger not null,
  triggered_by_admin_id uuid references public.admin_users(id),
  funds_checked integer not null default 0,
  funds_matched integer not null default 0,
  funds_risk_obtained integer not null default 0,
  funds_ambiguous integer not null default 0,
  funds_not_found integer not null default 0,
  funds_error integer not null default 0,
  failed_fund_codes text[] not null default '{}',
  error_summary text
);

create index risk_sync_runs_started_at_idx on public.risk_sync_runs (started_at desc);

alter table public.risk_sync_runs enable row level security;

-- sync_runs / price_backfill_runs ile aynı desen: yalnızca admin görebilir,
-- yazma yalnızca service role (Edge Function) ile yapılır.
create policy risk_sync_runs_select_admin on public.risk_sync_runs
  for select to authenticated using ((select public.is_admin()));
