-- TEFAS senkronizasyonu için günlük cron job. Gerçek fonksiyon URL'si ve
-- cron secret'ı bu dosyada DEĞİL, Supabase Vault'ta saklanır (proje
-- oluşturulduktan sonra bir defaya mahsus ayarlanır). Bu migration hiçbir
-- gizli değer içermez; vault kayıtları eksikse iş sessizce atlanır.
--
-- Saat: 04:30 UTC = 07:30 Türkiye saati (UTC+3).

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create or replace function public.trigger_tefas_sync()
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
  from vault.decrypted_secrets where name = 'tefas_sync_url';

  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'tefas_sync_secret';

  if v_url is null or v_secret is null then
    raise notice 'tefas_sync_url / tefas_sync_secret vault''da tanımlı değil, atlanıyor';
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := jsonb_build_object('trigger', 'cron'),
    timeout_milliseconds := 20000
  );
end;
$$;

select cron.schedule(
  'tefas-daily-sync',
  '30 4 * * *',
  $$select public.trigger_tefas_sync();$$
);
