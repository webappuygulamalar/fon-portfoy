-- Genel veri temizliği: 2026-09-04 tarihli, fonun GÜNCEL para biriminden
-- FARKLI bir para birimiyle yazılmış, tek seferlik "başıboş" fund_prices
-- satırları.
--
-- Bağlam: CKS'nin fiyat geçmişini düzeltirken (bkz. 20260911130100_
-- cks_price_history_correction.sql) canlıda beklenmedik bir satır bulundu:
-- CKS için 2026-09-04 tarihinde, currency='TRY', source='TEFAS',
-- fetched_at≈2026-09-06 07:52 UTC olan bir satır — funds.currency='USD'
-- olduğu halde. Bu, CKS'ye özgü değil: canlı veritabanı sorgulanarak TÜM
-- fon kataloğu tarandı ve AYNI desende (tek satır, aynı tarih, fonun
-- güncel para biriminden farklı, aynı fetched_at civarı) 52 fonun
-- etkilendiği doğrulandı — 09-06 sabahı, döviz katılım fonlarının bir kısmı
-- için henüz TL varsayılanından USD/EUR'a geçiş tamamlanmadan (bkz.
-- 20260906090000_fund_risk_currency_metadata.sql'in "acil düzeltme" notu)
-- çalışmış bir senkronizasyonun tek seferlik bir kalıntısı olduğu açık.
--
-- Bu, "hangi pay grubu native" belirsizliği (bkz. fund_share_class_
-- overrides, admin incelemesi gerektiren, TAHMİN EDİLMEYEN konu) DEĞİLDİR
-- — mekanik olarak kanıtlanmış, tek tarihli bir kopya/kalıntı satırdır: her
-- etkilenen fon için AYNI tarihte fonun GÜNCEL (doğru) para biriminde bir
-- kardeş satır zaten mevcuttur (aşağıdaki `exists` koşulu bunu ZORUNLU
-- kılar — bir fonun o tarih için TEK verisi bu yanlış-para-birimli satırsa
-- SİLİNMEZ). Neden önemli: `fund_price_on_or_before` (bkz.
-- 20260905120300_views_and_functions.sql) para birimine bakmadan yalnızca
-- `price_date`'e göre en yakın satırı seçer — aynı tarihte iki para
-- biriminde satır varsa hangisinin seçileceği TANIMSIZDIR; bu, getiri
-- hesaplarında (fund_returns) sessizce yanlış/anlamsız bir yüzde
-- üretebilir. Bu satırlar hiçbir fonun EN GÜNCEL fiyatı değildir (hepsi
-- 2026-09-04 tarihli, en güncel veri çok daha yakın tarihlidir) — bu
-- yüzden silinmeleri hiçbir fonun güncel fiyat gösterimini etkilemez.
delete from public.fund_prices fp
using public.funds f
where fp.fund_id = f.id
  and fp.price_date = '2026-09-04'
  and fp.currency <> f.currency
  and exists (
    select 1 from public.fund_prices good
    where good.fund_id = fp.fund_id
      and good.price_date = fp.price_date
      and good.currency = f.currency
  );
