-- Başlangıç verisi: risk profilleri, standart fonlar ve ilk yayınlanmış
-- model versiyonu. Bilinçli olarak seed EDİLMEYENLER:
--   * admin_users  -> bootstrap script ile, gerçek bir auth.users kaydına
--                     bağlı olarak oluşturulur (bkz. scripts/bootstrap-admin.mjs)
--   * fund_prices  -> fiyat uydurulmaz; ilk TEFAS senkronizasyonu veya
--                     admin'in manuel girişiyle oluşur.
--
-- BKY (döviz katılım fonu): referans veri kaynağı bu fonu USD olarak
-- etiketlemişti, ancak 2026-09-05'te canlı TEFAS API'sinden doğrudan
-- doğrulandı — fiyat gerçekten TL cinsinden ilan ediliyor (ör. 50.25 TL),
-- TEFAS platformunun genel kuralıyla tutarlı. currency='TRY' teyit edilmiştir.

insert into public.risk_profiles (id, key, name, description, sort_order, is_active) values
  ('00000000-0000-0000-0001-000000000001', 'dusuk_1', 'Düşük 1',
   'Ana para istikrarını önceliklendiren, mevduat ağırlıklı düşük riskli model.', 1, true),
  ('00000000-0000-0000-0001-000000000002', 'dusuk_2', 'Düşük 2',
   'Düşük 1 ile aynı fonları kullanan, biraz daha fazla çeşitlendirme içeren düşük riskli model.', 2, true),
  ('00000000-0000-0000-0001-000000000003', 'orta', 'Orta',
   'Mevduat ve fon dağılımını dengeleyen orta riskli model.', 3, true),
  ('00000000-0000-0000-0001-000000000004', 'yuksek', 'Yüksek',
   'BIST katılım hisse fonu ağırlıklı, yüksek riskli model.', 4, true)
on conflict (id) do update set
  name = excluded.name, description = excluded.description,
  sort_order = excluded.sort_order, is_active = excluded.is_active;

insert into public.funds
  (id, code, name, management_company, asset_class, fund_type, currency, tefas_fetch_code, is_active, verification_needed, verification_note)
values
  ('00000000-0000-0000-0002-000000000001', 'PKT',
   'Yapı Kredi Portföy Para Piyasası Katılım Serbest (TL) Fon',
   'Yapı Kredi Portföy', 'MONEY_MARKET', 'Serbest', 'TRY', 'PKT', true, false, null),
  ('00000000-0000-0000-0002-000000000002', 'ZKP',
   'Ziraat Portföy BIST Katılım 30 Endeksi Hisse Senedi Yoğun Borsa Yatırım Fonu',
   'Ziraat Portföy', 'BIST_EQUITY', 'BYF', 'TRY', 'ZKP', true, false, null),
  ('00000000-0000-0000-0002-000000000003', 'ZGD',
   'Ziraat Portföy Altın Katılım Borsa Yatırım Fonu',
   'Ziraat Portföy', 'GOLD', 'BYF', 'TRY', 'ZGD', true, false, null),
  ('00000000-0000-0000-0002-000000000004', 'BKY',
   'Yapı Kredi Portföy Birinci Katılım Serbest (Döviz) Fon',
   'Yapı Kredi Portföy', 'FX', 'Serbest', 'TRY', 'BKY', true, false, null)
on conflict (id) do update set
  code = excluded.code, name = excluded.name, management_company = excluded.management_company,
  asset_class = excluded.asset_class, fund_type = excluded.fund_type, currency = excluded.currency,
  tefas_fetch_code = excluded.tefas_fetch_code, is_active = excluded.is_active,
  verification_needed = excluded.verification_needed, verification_note = excluded.verification_note;

insert into public.model_versions (id, status, effective_date, published_at, notes) values
  ('00000000-0000-0000-0003-000000000001', 'published', current_date, now(),
   'İlk yayınlanmış model versiyonu (seed).')
on conflict (id) do nothing;

insert into public.model_profile_allocations (model_version_id, profile_id, asset_class, percentage) values
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000001', 'DEPOSIT', 85),
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000001', 'MONEY_MARKET', 7),
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000001', 'BIST_EQUITY', 3),
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000001', 'GOLD', 3),
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000001', 'FX', 2),

  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000002', 'DEPOSIT', 80),
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000002', 'MONEY_MARKET', 9),
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000002', 'BIST_EQUITY', 4),
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000002', 'GOLD', 4),
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000002', 'FX', 3),

  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000003', 'DEPOSIT', 50),
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000003', 'MONEY_MARKET', 10),
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000003', 'BIST_EQUITY', 20),
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000003', 'GOLD', 10),
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000003', 'FX', 10),

  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000004', 'DEPOSIT', 15),
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000004', 'MONEY_MARKET', 5),
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000004', 'BIST_EQUITY', 65),
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000004', 'GOLD', 10),
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000004', 'FX', 5)
on conflict (model_version_id, profile_id, asset_class) do update set percentage = excluded.percentage;

-- Tüm profillerde kullanılan varsayılan (profile_id = null) standart fonlar.
insert into public.model_preferred_funds (model_version_id, profile_id, asset_class, fund_id) values
  ('00000000-0000-0000-0003-000000000001', null, 'MONEY_MARKET', '00000000-0000-0000-0002-000000000001'),
  ('00000000-0000-0000-0003-000000000001', null, 'BIST_EQUITY', '00000000-0000-0000-0002-000000000002'),
  ('00000000-0000-0000-0003-000000000001', null, 'GOLD', '00000000-0000-0000-0002-000000000003'),
  ('00000000-0000-0000-0003-000000000001', null, 'FX', '00000000-0000-0000-0002-000000000004')
on conflict do nothing;

-- Örnek vade dilimi kırılımı: Düşük 1'in mevduat payı (%85), 10.000.000 TL'lik
-- bir portföyde 4.000.000 TL (101 gün) + 4.500.000 TL (32 gün) şeklinde
-- bölünebilir. Yüzdeler mevduat tahsisinin payı olarak saklanır:
-- 4.000.000/8.500.000 = %47,059 ve 4.500.000/8.500.000 = %52,941.
insert into public.model_deposit_buckets (model_version_id, profile_id, label, weight_percent, sort_order) values
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000001', '101 gün', 47.059, 1),
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000001', '32 gün', 52.941, 2)
on conflict do nothing;
