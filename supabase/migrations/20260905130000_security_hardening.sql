-- Supabase güvenlik danışmanının (db advisors --type security) canlı
-- projede bulduğu gerçek sorunları düzeltir:
--
-- 1. Görünümler varsayılan olarak oluşturucunun (yüksek yetkili migration
--    rolü) izinleriyle çalışabilir ve alttaki tabloların RLS'ini es geçebilir.
--    security_invoker=true, sorguyu yapan kullanıcının kendi izinleriyle
--    (ve dolayısıyla RLS ile) çalışmasını garanti eder.
-- 2. search_path belirtilmeyen fonksiyonlar, şema ele geçirme saldırılarına
--    karşı savunmasız olabilir; sabit bir search_path zorunlu kılınır.
-- 3. trigger_tefas_sync() SECURITY DEFINER olduğundan (Vault'a erişmek için
--    gerekli), varsayılan olarak PUBLIC'e (dolayısıyla anon/authenticated'e)
--    açık kalmamalı — yalnızca pg_cron (postgres rolüyle) çalıştırmalı.

alter view public.current_model_version set (security_invoker = true);
alter view public.fund_latest_price set (security_invoker = true);
alter view public.fund_returns set (security_invoker = true);

alter function public.is_admin() set search_path = public, pg_temp;
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.fund_price_on_or_before(uuid, date) set search_path = public, pg_temp;
alter function public.trigger_tefas_sync() set search_path = public, extensions, pg_temp;

revoke execute on function public.trigger_tefas_sync() from public, anon, authenticated;
