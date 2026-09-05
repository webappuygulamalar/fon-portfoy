-- Çekirdek tablolar: fonlar, fiyatlar, risk profilleri, admin, sync
-- kayıtları ve döviz kurları. Bu uygulama kesinlikle işlem yapmaz;
-- burada müşteri adı, TC kimlik no, hesap no gibi kişisel veri YOKTUR.

create table public.funds (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  management_company text not null,
  asset_class public.asset_class not null,
  fund_type text,
  currency text not null default 'TRY',
  tefas_fetch_code text not null,
  is_active boolean not null default true,
  verification_needed boolean not null default false,
  verification_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint funds_asset_class_not_deposit check (asset_class <> 'DEPOSIT')
);

create trigger funds_set_updated_at
  before update on public.funds
  for each row execute function public.set_updated_at();

create table public.fund_prices (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  price_date date not null,
  currency text not null,
  price numeric(20, 6) not null check (price > 0),
  fund_size numeric(20, 2),
  investor_count integer,
  source public.price_source not null default 'TEFAS',
  note text,
  fetched_at timestamptz not null default now(),
  unique (fund_id, price_date, currency)
);

create index fund_prices_fund_id_price_date_idx
  on public.fund_prices (fund_id, price_date desc);

create table public.risk_profiles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger risk_profiles_set_updated_at
  before update on public.risk_profiles
  for each row execute function public.set_updated_at();

-- admin_users.id, Supabase Auth kullanıcısına 1:1 karşılık gelir.
-- Public signup KAPALIDIR; satırlar yalnızca bootstrap script/SQL ile eklenir.
create table public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status public.sync_status not null default 'running',
  trigger_type public.sync_trigger not null,
  triggered_by_admin_id uuid references public.admin_users(id),
  funds_checked integer not null default 0,
  funds_updated integer not null default 0,
  funds_failed integer not null default 0,
  failed_fund_codes text[] not null default '{}',
  catalog_synced boolean not null default false,
  error_summary text
);

create index sync_runs_started_at_idx on public.sync_runs (started_at desc);

create table public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  currency text not null,
  rate_to_try numeric(20, 6) not null check (rate_to_try > 0),
  rate_date date not null,
  source text not null,
  fetched_at timestamptz not null default now(),
  unique (currency, rate_date, source)
);

create index fx_rates_currency_date_idx on public.fx_rates (currency, rate_date desc);
