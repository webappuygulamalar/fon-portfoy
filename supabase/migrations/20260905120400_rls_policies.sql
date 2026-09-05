-- Row Level Security: least-privilege. Anon/authenticated (frontend,
-- anon/publishable key) yalnızca yayınlanmış model ve genel fon
-- verilerini okuyabilir. Tüm yazma işlemleri is_admin() ile sınırlıdır.
-- Edge Function'lar service role kullanır ve RLS'i tamamen atlar.

alter table public.funds enable row level security;
alter table public.fund_prices enable row level security;
alter table public.risk_profiles enable row level security;
alter table public.model_versions enable row level security;
alter table public.model_profile_allocations enable row level security;
alter table public.model_preferred_funds enable row level security;
alter table public.model_deposit_buckets enable row level security;
alter table public.admin_users enable row level security;
alter table public.sync_runs enable row level security;
alter table public.fx_rates enable row level security;

-- funds: herkes okuyabilir, sadece admin yazabilir.
create policy funds_select_all on public.funds
  for select to anon, authenticated using (true);
create policy funds_admin_write on public.funds
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- fund_prices: herkes okuyabilir (fiyatlar gizli değildir),
-- yazma admin'e (manuel fiyat girişi) veya service role'e (TEFAS sync) aittir.
create policy fund_prices_select_all on public.fund_prices
  for select to anon, authenticated using (true);
create policy fund_prices_admin_write on public.fund_prices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- risk_profiles: herkes okuyabilir, sadece admin yazabilir.
create policy risk_profiles_select_all on public.risk_profiles
  for select to anon, authenticated using (true);
create policy risk_profiles_admin_write on public.risk_profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- model_versions: yayınlanmış + geçerlilik tarihi gelmiş olanlar herkese
-- açık; taslak/arşiv sadece admin'e.
create policy model_versions_select_published on public.model_versions
  for select to anon, authenticated
  using (status = 'published' and effective_date <= current_date);
create policy model_versions_select_admin on public.model_versions
  for select to authenticated using (public.is_admin());
create policy model_versions_admin_write on public.model_versions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- model_profile_allocations: yayınlanmış versiyona ait satırlar herkese
-- açık; taslaklar sadece admin'e.
create policy model_profile_allocations_select_published on public.model_profile_allocations
  for select to anon, authenticated
  using (exists (
    select 1 from public.model_versions mv
    where mv.id = model_version_id
      and mv.status = 'published' and mv.effective_date <= current_date
  ));
create policy model_profile_allocations_select_admin on public.model_profile_allocations
  for select to authenticated using (public.is_admin());
create policy model_profile_allocations_admin_write on public.model_profile_allocations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- model_preferred_funds: aynı desen.
create policy model_preferred_funds_select_published on public.model_preferred_funds
  for select to anon, authenticated
  using (exists (
    select 1 from public.model_versions mv
    where mv.id = model_version_id
      and mv.status = 'published' and mv.effective_date <= current_date
  ));
create policy model_preferred_funds_select_admin on public.model_preferred_funds
  for select to authenticated using (public.is_admin());
create policy model_preferred_funds_admin_write on public.model_preferred_funds
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- model_deposit_buckets: aynı desen.
create policy model_deposit_buckets_select_published on public.model_deposit_buckets
  for select to anon, authenticated
  using (exists (
    select 1 from public.model_versions mv
    where mv.id = model_version_id
      and mv.status = 'published' and mv.effective_date <= current_date
  ));
create policy model_deposit_buckets_select_admin on public.model_deposit_buckets
  for select to authenticated using (public.is_admin());
create policy model_deposit_buckets_admin_write on public.model_deposit_buckets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- admin_users: bir admin sadece kendi satırını görebilir. Yazma yalnızca
-- service role ile (bootstrap script) yapılır, bu yüzden authenticated/anon
-- için hiçbir write policy tanımlanmaz (varsayılan: reddedilir).
create policy admin_users_select_self on public.admin_users
  for select to authenticated using (auth.uid() = id);

-- sync_runs: sadece admin görebilir. Edge Function service role ile yazar.
create policy sync_runs_select_admin on public.sync_runs
  for select to authenticated using (public.is_admin());

-- fx_rates: herkes okuyabilir (hesaplama ekranında kur gösterimi için),
-- sadece admin yazabilir (manuel fallback); otomatik güncelleme service role ile.
create policy fx_rates_select_all on public.fx_rates
  for select to anon, authenticated using (true);
create policy fx_rates_admin_write on public.fx_rates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
