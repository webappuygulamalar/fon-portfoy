-- Tarihsel fiyat geri yükleme (backfill) altyapısı.
--
-- Bağlam: 1/3/6/12 aylık getiri hesaplamaları (bkz. fund_returns view,
-- 20260905120300_views_and_functions.sql — SORGU MANTIĞI DOĞRU, sadece
-- veri eksikti) `fund_prices`'ta yeterli geçmiş ister. TEFAS'ın toplu
-- liste endpoint'i TEK bir istekte en fazla ~1 aylık aralık kabul ediyor
-- ("Geçersiz veri: Tarih aralığı 1 ayı aşamaz" — canlı doğrulandı); bu
-- yüzden 1 yıllık geçmiş TEK bir Edge Function çağrısında alınamaz.
-- Bu migration, checkpoint'li/devam edebilir bir backfill işi için gereken
-- durumu ekler — mevcut günlük tefas-sync akışına DOKUNULMAZ.

create table public.price_backfill_checkpoint (
  id boolean primary key default true,
  -- Şu ana kadar TEFAS'tan istenmiş en eski pencerenin başlangıcı (bir
  -- sonraki çalışma bunun HEMEN ÖNCESİNDEKİ pencereyi ister). Geriye doğru
  -- ilerler.
  oldest_fetched_date date not null,
  -- Ne kadar geriye gidileceği (varsayılan: bugünden ~370 gün önce).
  target_start_date date not null,
  is_complete boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint price_backfill_checkpoint_singleton check (id)
);

insert into public.price_backfill_checkpoint (id, oldest_fetched_date, target_start_date, is_complete)
values (true, current_date, current_date - interval '370 days', false);

create table public.price_backfill_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status public.sync_status not null default 'running',
  trigger_type public.sync_trigger not null,
  triggered_by_admin_id uuid references public.admin_users(id),
  window_start date not null,
  window_end date not null,
  rows_upserted integer not null default 0,
  funds_touched integer not null default 0,
  error_summary text
);

create index price_backfill_runs_started_at_idx on public.price_backfill_runs (started_at desc);

alter table public.price_backfill_checkpoint enable row level security;
alter table public.price_backfill_runs enable row level security;

-- Yalnızca admin görebilir (sync_runs ile aynı desen); yazma yalnızca
-- service role (Edge Function) ile yapılır, bu yüzden write policy yok.
create policy price_backfill_checkpoint_select_admin on public.price_backfill_checkpoint
  for select to authenticated using ((select public.is_admin()));
create policy price_backfill_runs_select_admin on public.price_backfill_runs
  for select to authenticated using ((select public.is_admin()));

-- trigger_price_backfill(): trigger_tefas_sync() ile BİREBİR aynı desen
-- (aynı cron secret'ı kullanır — yeni bir sır oluşturulmaz, yalnızca ayrı
-- bir hedef URL). Fire-and-forget; sonucu price_backfill_runs'tan okunur.
create or replace function public.trigger_price_backfill()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'price_backfill_url';

  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'tefas_sync_secret';

  if v_url is null or v_secret is null then
    raise notice 'price_backfill_url / tefas_sync_secret vault''da tanımlı değil, atlanıyor';
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := jsonb_build_object('trigger', 'backfill'),
    timeout_milliseconds := 30000
  );
end;
$$;

revoke execute on function public.trigger_price_backfill() from public, anon, authenticated;

-- price_backfill_url bir URL'dir, SIR DEĞİLDİR (yetkilendirme yukarıdaki
-- x-cron-secret header'ıyla, mevcut tefas_sync_secret üzerinden yapılır) —
-- bu yüzden değeri doğrudan migration'a yazmak güvenlidir. Zaten varsa
-- (ör. migration tekrar uygulanırsa) yeniden oluşturmaz.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'price_backfill_url') then
    perform vault.create_secret(
      'https://lewccubzcsayqlkkyasb.supabase.co/functions/v1/history-backfill',
      'price_backfill_url'
    );
  end if;
end $$;

-- Risk değeri kaynak izlenebilirliği: kaynak URL'si ve doğrulama bayrağı.
alter table public.funds
  add column risk_source_url text,
  add column risk_verified boolean not null default false;

comment on column public.funds.risk_source_url is
  'risk_value''in geldiği kaynağın URL''si (ör. referans katalog anlık görüntüsü).';
comment on column public.funds.risk_verified is
  'true ise risk_value bilinen, adı belirtilebilir bir kaynaktan doğrulanmıştır (tahmin/türetme değildir).';

update public.funds set
  risk_source_url = 'https://webappuygulamalar.github.io/katilim-fonlari/',
  risk_verified = true
where risk_source is not null;
