-- Risk değeri ve para birimi için kaynak/tarih izlenebilirliği ekler.
-- Bağlam: TEFAS'ın toplu liste endpoint'i ne risk değeri ne de para birimi
-- alanı döner; önceki senkronizasyon TÜM fonları varsayılan olarak
-- currency='TRY' kaydediyordu. Bu, döviz katılım fonları (ör. BKY) için
-- YANLIŞTIR — bağımsız bir referans taramasında (198 fon) "Döviz katılım
-- serbest" kategorisindeki 21 fonun TAMAMI USD/EUR'dur, TL olan yoktur.
-- Bu sütunlar, hangi değerin nereden geldiğini izlenebilir kılar ve
-- gelecekteki senkronizasyonların düşük güvenilirlikli/varsayılan bir
-- değerle daha güvenilir, önceden doğrulanmış bir değerin üzerine
-- sessizce yazmasını önlemeye yardımcı olur.

alter table public.funds
  add column risk_source text,
  add column risk_updated_at timestamptz,
  add column currency_source text not null default 'tefas_default_try';

comment on column public.funds.risk_source is
  'Risk değerinin kaynağı (ör. reference_catalog_2026-09-04). NULL ise risk_value de NULL olmalıdır — uydurulmaz.';
comment on column public.funds.currency_source is
  'Para birimi belirleme yöntemi: reference_catalog (bağımsız referans taramasından doğrulanmış) | title_pattern_doviz (başlıkta "döviz" ibaresine dayalı, 198 fonluk örneklemde %100 doğrulanmış kural) | tefas_default_try (başlıkta döviz ibaresi yok, varsayılan TL).';

-- Bilinen (referans taramasında doğrulanmış) döviz fonları için acil
-- düzeltme: bir sonraki tam senkronizasyon evrensel olarak düzeltecek
-- olsa da, bu satır BKY gibi hâlâ AKTİF KULLANILAN model standart fonunun
-- yanlış TRY etiketiyle tek bir hesaplama için bile kalmasını önler.
update public.funds set
  currency = 'USD',
  currency_source = 'reference_catalog'
where code in (
  'BKY','KDL','ZP6','CKS','KTT','KDT','ZPF','YSL','DKL','KPD','TRU','NKA',
  'PBK','TPZ','NVK','KIS','NME','NZU','HML','KLS'
);

update public.funds set
  currency = 'EUR',
  currency_source = 'reference_catalog'
where code in ('KAV','BDA','ZP9','KDO','KKC');
