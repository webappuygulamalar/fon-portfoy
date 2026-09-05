-- Model portföy versiyonlama: taslak oluşturma, önizleme, yayınlama ve
-- geçmiş/audit koruma. Eski bir yayınlanmış model asla düzenlenmez;
-- her değişiklik yeni bir versiyon olarak eklenir.

create table public.model_versions (
  id uuid primary key default gen_random_uuid(),
  version_number bigint generated always as identity,
  status public.model_version_status not null default 'draft',
  effective_date date,
  published_at timestamptz,
  published_by uuid references public.admin_users(id),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.admin_users(id),
  constraint model_versions_published_needs_effective_date
    check (status <> 'published' or effective_date is not null)
);

create index model_versions_status_idx on public.model_versions (status, effective_date desc);

create table public.model_profile_allocations (
  id uuid primary key default gen_random_uuid(),
  model_version_id uuid not null references public.model_versions(id) on delete cascade,
  profile_id uuid not null references public.risk_profiles(id) on delete cascade,
  asset_class public.asset_class not null,
  percentage integer not null check (percentage between 0 and 100),
  unique (model_version_id, profile_id, asset_class)
);

create table public.model_preferred_funds (
  id uuid primary key default gen_random_uuid(),
  model_version_id uuid not null references public.model_versions(id) on delete cascade,
  -- profile_id NULL: bu varlık sınıfı için tüm profillerde kullanılan
  -- varsayılan fon. Dolu ise yalnızca o profil için geçerli bir override.
  profile_id uuid references public.risk_profiles(id) on delete cascade,
  asset_class public.asset_class not null,
  fund_id uuid not null references public.funds(id),
  constraint model_preferred_funds_not_deposit check (asset_class <> 'DEPOSIT')
);

create unique index model_preferred_funds_default_unique
  on public.model_preferred_funds (model_version_id, asset_class)
  where profile_id is null;

create unique index model_preferred_funds_override_unique
  on public.model_preferred_funds (model_version_id, profile_id, asset_class)
  where profile_id is not null;

-- Mevduatın isteğe bağlı vade dilimi kırılımı. Yalnızca gösterim
-- amaçlıdır; pay hesaplama mantığına girmez. Toplamın %100 olması
-- uygulama katmanında (validateDepositBucketWeights) doğrulanır.
create table public.model_deposit_buckets (
  id uuid primary key default gen_random_uuid(),
  model_version_id uuid not null references public.model_versions(id) on delete cascade,
  profile_id uuid not null references public.risk_profiles(id) on delete cascade,
  label text not null,
  weight_percent numeric(6, 3) not null check (weight_percent > 0 and weight_percent <= 100),
  sort_order integer not null default 0
);

create index model_deposit_buckets_scope_idx
  on public.model_deposit_buckets (model_version_id, profile_id);
