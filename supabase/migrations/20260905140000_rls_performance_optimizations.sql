-- Supabase performans danışmanının (db advisors) bulduğu iki uyarı sınıfını
-- düzeltir. Hiçbir etkin yetki değişmez; sadece planlayıcının aynı sonucu
-- daha ucuza üretmesini sağlar.
--
-- 1. auth_rls_initplan: `admin_users_select_self` policy'si auth.uid()'yi
--    doğrudan çağırıyordu, bu da her satır için yeniden değerlendirilir.
--    `(select auth.uid())` biçimi planlayıcının değeri sorgu başına bir kez
--    hesaplayıp InitPlan olarak önbelleğe almasını sağlar.
-- 2. multiple_permissive_policies: `for all`/`for select` policy'leri
--    `authenticated` rolü için SELECT eyleminde üst üste biniyordu (ör.
--    funds_select_all + funds_admin_write). Postgres permissive policy'leri
--    OR ile birleştirdiğinden bu, aynı sonucu üretmek için gereğinden fazla
--    policy'nin değerlendirilmesi anlamına geliyordu. Çözüm: SELECT'i tek bir
--    policy'de birleştirmek (admin koşulunu OR ile ekleyerek) ve yazma
--    policy'lerini `for all` yerine insert/update/delete'e daraltmak — böylece
--    aynı roller için aynı satırlara aynı erişim, tek policy üzerinden.

-- ---------------------------------------------------------------------
-- admin_users: auth.uid() InitPlan optimizasyonu
-- ---------------------------------------------------------------------
drop policy admin_users_select_self on public.admin_users;
create policy admin_users_select_self on public.admin_users
  for select to authenticated using ((select auth.uid()) = id);

-- ---------------------------------------------------------------------
-- funds / fund_prices / fx_rates / risk_profiles: aynı desen.
-- select_all (anon+authenticated, true) zaten adminleri de kapsıyor;
-- admin_write'ı sadece insert/update/delete'e daraltıyoruz.
-- ---------------------------------------------------------------------
drop policy funds_admin_write on public.funds;
create policy funds_admin_insert on public.funds
  for insert to authenticated with check ((select public.is_admin()));
create policy funds_admin_update on public.funds
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy funds_admin_delete on public.funds
  for delete to authenticated using ((select public.is_admin()));

drop policy fund_prices_admin_write on public.fund_prices;
create policy fund_prices_admin_insert on public.fund_prices
  for insert to authenticated with check ((select public.is_admin()));
create policy fund_prices_admin_update on public.fund_prices
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy fund_prices_admin_delete on public.fund_prices
  for delete to authenticated using ((select public.is_admin()));

drop policy fx_rates_admin_write on public.fx_rates;
create policy fx_rates_admin_insert on public.fx_rates
  for insert to authenticated with check ((select public.is_admin()));
create policy fx_rates_admin_update on public.fx_rates
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy fx_rates_admin_delete on public.fx_rates
  for delete to authenticated using ((select public.is_admin()));

drop policy risk_profiles_admin_write on public.risk_profiles;
create policy risk_profiles_admin_insert on public.risk_profiles
  for insert to authenticated with check ((select public.is_admin()));
create policy risk_profiles_admin_update on public.risk_profiles
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy risk_profiles_admin_delete on public.risk_profiles
  for delete to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- model_versions / model_profile_allocations / model_preferred_funds /
-- model_deposit_buckets: select_published + select_admin tek policy'de
-- OR ile birleştirilir (permissive policy'lerin zaten OR ile birleşmesiyle
-- birebir aynı sonuç); admin_write insert/update/delete'e daraltılır.
-- ---------------------------------------------------------------------
drop policy model_versions_select_published on public.model_versions;
drop policy model_versions_select_admin on public.model_versions;
drop policy model_versions_admin_write on public.model_versions;
create policy model_versions_select on public.model_versions
  for select to anon, authenticated
  using (
    (status = 'published' and effective_date <= current_date)
    or (select public.is_admin())
  );
create policy model_versions_admin_insert on public.model_versions
  for insert to authenticated with check ((select public.is_admin()));
create policy model_versions_admin_update on public.model_versions
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy model_versions_admin_delete on public.model_versions
  for delete to authenticated using ((select public.is_admin()));

drop policy model_profile_allocations_select_published on public.model_profile_allocations;
drop policy model_profile_allocations_select_admin on public.model_profile_allocations;
drop policy model_profile_allocations_admin_write on public.model_profile_allocations;
create policy model_profile_allocations_select on public.model_profile_allocations
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.model_versions mv
      where mv.id = model_version_id
        and mv.status = 'published' and mv.effective_date <= current_date
    )
    or (select public.is_admin())
  );
create policy model_profile_allocations_admin_insert on public.model_profile_allocations
  for insert to authenticated with check ((select public.is_admin()));
create policy model_profile_allocations_admin_update on public.model_profile_allocations
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy model_profile_allocations_admin_delete on public.model_profile_allocations
  for delete to authenticated using ((select public.is_admin()));

drop policy model_preferred_funds_select_published on public.model_preferred_funds;
drop policy model_preferred_funds_select_admin on public.model_preferred_funds;
drop policy model_preferred_funds_admin_write on public.model_preferred_funds;
create policy model_preferred_funds_select on public.model_preferred_funds
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.model_versions mv
      where mv.id = model_version_id
        and mv.status = 'published' and mv.effective_date <= current_date
    )
    or (select public.is_admin())
  );
create policy model_preferred_funds_admin_insert on public.model_preferred_funds
  for insert to authenticated with check ((select public.is_admin()));
create policy model_preferred_funds_admin_update on public.model_preferred_funds
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy model_preferred_funds_admin_delete on public.model_preferred_funds
  for delete to authenticated using ((select public.is_admin()));

drop policy model_deposit_buckets_select_published on public.model_deposit_buckets;
drop policy model_deposit_buckets_select_admin on public.model_deposit_buckets;
drop policy model_deposit_buckets_admin_write on public.model_deposit_buckets;
create policy model_deposit_buckets_select on public.model_deposit_buckets
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.model_versions mv
      where mv.id = model_version_id
        and mv.status = 'published' and mv.effective_date <= current_date
    )
    or (select public.is_admin())
  );
create policy model_deposit_buckets_admin_insert on public.model_deposit_buckets
  for insert to authenticated with check ((select public.is_admin()));
create policy model_deposit_buckets_admin_update on public.model_deposit_buckets
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy model_deposit_buckets_admin_delete on public.model_deposit_buckets
  for delete to authenticated using ((select public.is_admin()));
