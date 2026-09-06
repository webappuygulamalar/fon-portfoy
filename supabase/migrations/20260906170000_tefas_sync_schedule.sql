-- TEFAS senkronizasyon cron saatlerini Türkiye saatine göre günceller.
--
-- Eski: 04:30 UTC = 07:30 TR (UTC+3), tek çalışma ('tefas-daily-sync',
-- bkz. 20260905120500_cron.sql — O MİGRATION DEĞİŞTİRİLMEDİ, yalnızca
-- oradaki cron görevi burada kaldırılıp yerine iki yenisi eklendi).
--
-- Yeni:
--   - 05:30 UTC = 08:30 TR: ilk (günlük ana) senkronizasyon.
--   - 06:45 UTC = 09:45 TR: ikinci kontrol/tekrar.
-- İkisi de AYNI, DEĞİŞTİRİLMEMİŞ public.trigger_tefas_sync() fonksiyonunu
-- çağırır — bu fonksiyon (vault'tan url/secret okuma, x-cron-secret
-- header'ı, tefas-sync Edge Function'ına POST) BİREBİR AYNI kalır; hiçbir
-- secret/Edge Function/admin manuel senkronizasyon yoluna dokunulmadı.
--
-- İkinci çalışma için ayrı bir "veri zaten güncel mi" kontrolü EKLENMEDİ
-- (bilinçli tercih, kullanıcı talimatında da bu basitlik açıkça tercih
-- edilebilir kılınmıştı):
--   - tefas-sync zaten idempotent'tir (funds: code üzerinden, fund_prices:
--     (fund_id,price_date,currency) üzerinden ON CONFLICT DO UPDATE — bkz.
--     tefas-sync/index.ts). İkinci çağrı ya eksik/başarısız ilk çalışmayı
--     tamamlar, ya da veri zaten güncelse aynı satırları zararsızca yeniden
--     yazar; hiçbir durumda yinelenen satır veya bozulma oluşturmaz.
--   - Ayrı bir "son senkronizasyon ne zamandı" kontrol katmanı (ör. sync_runs
--     üzerinden bugünün başarılı bir çalışması var mı diye bakmak) somut bir
--     kazanç sağlamadan (TEFAS'a günde bir ekstra POST isteği zaten ucuz)
--     karmaşıklık ve yeni hata yüzeyi (saat dilimi sınırları, "başarı"nın
--     ne sayılacağı, hafta sonu/tatil istisnası vb.) eklerdi.
--
-- Hafta sonu/tatilde "yeni fiyat yok" durumu ZATEN bir hata SAYILMIYOR ve bu
-- migration/Edge Function'da bunun için özel bir istisna gerekmiyor: TEFAS'ın
-- toplu liste endpoint'i hafta sonu/tatilde BOŞ sonuç dönmez, o günün MEVCUT
-- (en son işlem gününe ait) fiyatını döner — bu yüzden catalog.length>0
-- kalır ve çalışma "success"/"partial" olarak kapanır. tefas-sync/index.ts
-- yalnızca TEFAS'a hiç ulaşılamadığında/gerçekten boş liste döndüğünde
-- "failed" işaretler — bu davranış incelendi, DEĞİŞTİRİLMEDİ.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'tefas-daily-sync') then
    perform cron.unschedule('tefas-daily-sync');
  end if;
end $$;

-- cron.schedule(jobname, ...) aynı isimle çağrıldığında var olan görevi
-- GÜNCELLER (pg_cron'un doğal upsert davranışı) — bu migration'ın tekrar
-- uygulanması yeni bir kopya görev oluşturmaz.
select cron.schedule(
  'tefas-sync-0830-tr',
  '30 5 * * *',
  $$select public.trigger_tefas_sync();$$
);

select cron.schedule(
  'tefas-sync-0945-tr',
  '45 6 * * *',
  $$select public.trigger_tefas_sync();$$
);
