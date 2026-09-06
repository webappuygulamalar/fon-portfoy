# Fon Portföy

Katılım fonlarını tanıtan ve admin tarafından tanımlanan model portföylere göre
**pay hesaplama** (bilgilendirme amaçlı) yapan bir web uygulaması. Kullanıcı
uygulaması ve "Fon Portföy Admin" yönetim bölümü aynı kod tabanındadır.

> **Bilgilendirme ve hesaplama amaçlıdır; yatırım tavsiyesi değildir.**
> Uygulama hiçbir işlem (alım-satım emri, onay, para transferi) yapmaz ve
> müşteri adı, TC kimlik no, hesap no gibi kişisel veri saklamaz. Girilen
> portföy tutarı yalnızca tarayıcıda hesaplanır, hiçbir yere kaydedilmez.

## Yerel çalıştırma

```bash
npm install
cp .env.example .env   # Supabase URL/anon key ile doldurun
npm run dev
```

Admin bölümüne `/#/admin` üzerinden erişilir.

## Test, lint, build

```bash
npm run lint
npm test
npm run build
```

## Supabase migration ve seed

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push          # supabase/migrations/*.sql
psql "$DATABASE_URL" -f supabase/seed.sql   # veya supabase db execute ile
```

Şema: `funds`, `fund_prices`, `risk_profiles`, `model_versions` (taslak/yayın
versiyonlama), `model_profile_allocations`, `model_preferred_funds`,
`model_deposit_buckets`, `admin_users`, `sync_runs`, `fx_rates`. Tüm tablolarda
RLS açıktır; herkes yalnızca **yayınlanmış** model ve genel fon verilerini
okuyabilir, yazma yalnızca `admin_users` içindeki yetkili kullanıcılara açıktır.

## Ortam değişkenleri

`.env.example` dosyasına bakın. Frontend'de yalnızca `VITE_SUPABASE_URL` ve
`VITE_SUPABASE_ANON_KEY` (publishable/anon anahtar) kullanılır. Service role
anahtarı **hiçbir zaman** frontend'e veya repoya konmaz; yalnızca Edge
Function ortam değişkeni ve `scripts/bootstrap-admin.mjs` çalıştırılırken
kullanılır.

## TEFAS senkronizasyonu

`supabase/functions/tefas-sync` her gün 07:30 (TR, 04:30 UTC) `pg_cron` +
`pg_net` ile otomatik çalışır. TEFAS erişim bilgisi ve secret, migration
dosyasına **değil**, Supabase Vault'a yazılır:

```bash
supabase functions deploy tefas-sync
supabase secrets set CRON_SECRET=<rastgele-güçlü-değer>

# Vault'a bir defaya mahsus (proje SQL editöründe veya psql ile):
select vault.create_secret('https://<ref>.functions.supabase.co/tefas-sync', 'tefas_sync_url');
select vault.create_secret('<CRON_SECRET ile aynı değer>', 'tefas_sync_secret');
```

Admin panelinde "TEFAS fiyatlarını güncelle" ile manuel de tetiklenebilir.
TEFAS erişilemezse admin, kaynak/tarih bilgisiyle **manuel fiyat girişi**
yapabilir (senkronizasyon sayfasında).

## Admin bootstrap

Public kayıt kapalıdır. İlk admin:

```bash
SUPABASE_URL="https://<ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service-role-anahtarı>" \
node scripts/bootstrap-admin.mjs admin@ornek.com
```

Parola terminalde gizli sorulur, hiçbir yere yazılmaz.

> **Not:** Yeni bir Supabase projesinde e-posta/parola sağlayıcısı
> (`external_email_enabled`) varsayılan olarak kapalı gelebilir ve bu,
> `supabase config push` ile `config.toml`'daki `[auth.email]` ayarlarından
> **farklı** bir anahtardır (config push'un "up to date" demesi bunun açık
> olduğu anlamına gelmez). Admin girişi "Email logins are disabled" hatası
> verirse: Dashboard → Authentication → Sign In / Providers → **Email** →
> Enable Sign in with Email.

## GitHub Pages dağıtımı

`main` dalına push, `.github/workflows/deploy.yml` ile otomatik build+deploy
yapar. Repo → Settings → Pages → Source: "GitHub Actions" seçili olmalı.
Repo değişkenleri (Settings → Secrets and variables → Actions → Variables):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Vite `base`, router ve PWA `scope`/`start_url` otomatik olarak `/fon-portfoy/`
kullanır.

## PWA ikonu

Kaynak görsel repo kökünde `fon-portfoy-app-icon-v3.png` (kare, 1254×1254;
`public/` DIŞINDA tutulur ki dağıtılan siteye gereksiz yere yayınlanmasın).
`public/icons/*` altındaki ikonlar bundan üretilmiştir: `icon-192.png`,
`icon-512.png`, `apple-touch-icon.png` (180×180) ve `favicon-16/32/48.png`
düz orantılı yeniden boyutlandırmadır. `icon-maskable-512.png` ayrıdır —
maskable "güvenli alan" (içteki %80'lik daire) korunsun diye kaynak görsel
~%86,5 oranında küçültülüp kendi arka plan rengiyle (kenar pikselinden
örneklenmiş, yaklaşık `#01130D`) dolgulanmış 512×512'lik bir tuval üzerine
ortalanmıştır. İkonu güncellemek isterseniz kaynak görseli (kare, aynı
en-boy oranıyla) değiştirip aynı üretim adımlarını tekrarlayın ve aynı
dosya adlarıyla `public/icons/*` altına yazın; `index.html`/`vite.config.ts`'de
başka bir yer güncellenmesi gerekmez.

## Bilinen gerçek kısıtlamalar

- TEFAS'ın resmi bir genel API dokümantasyonu yoktur; `tefasAdapter.ts`
  canlı senkronizasyonda doğrudan doğrulanan endpoint/alan adlarını kullanır.
  TEFAS yapısını değiştirirse yalnızca bu dosyanın güncellenmesi gerekir.
  Fon kategorisine göre değişen zorunlu `fonTipi` parametresi için bilinen
  değerler (YAT, BYF, EMK, GYF, GSYF) sırayla denenir.
- BKY (döviz katılım fonu) için `currency='TRY'` canlı TEFAS verisiyle teyit
  edilmiştir (fiyatı gerçekten TL cinsinden ilan ediliyor, platformun genel
  kuralıyla tutarlı) — `verification_needed=false`.
- Fon getiri yüzdeleri (1 ay/3 ay/YBB/1 yıl) TEFAS'ın hazır bir alanına değil,
  sistemin kendi topladığı fiyat geçmişine dayanır; senkronizasyon yeni
  başladığında yeterli geçmiş birikene kadar "—" gösterilir.
- Katılım fonu kataloğunun otomatik keşfi (yeni fon ekleme) uygulanmamıştır;
  şu an yalnızca `funds` tablosundaki tanımlı fonların fiyatı senkronize
  edilir. Admin yeni fonu elle ekleyebilir.
- Admin panelinde varlık sınıfı başına tercih edilen fon **tüm profiller için
  ortaktır**; profile özel override veri modelinde desteklenir ama admin
  arayüzünde bu override'ı düzenleyen bir ekran yoktur (gerekirse SQL ile
  eklenebilir).
- RLS ve TEFAS senkronizasyon idempotency testleri canlı bir Supabase projesi
  gerektirir; bu depoda pure/unit testler vardır, canlı doğrulama dağıtım
  sonrası ayrıca yapılmalıdır.
