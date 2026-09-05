-- Yardımcı görünümler ve fonksiyonlar.

-- O an geçerli olan tek yayınlanmış model versiyonu (geçerlilik tarihi
-- gelmiş olanların en güncel olanı). Kullanıcı ekranı yalnızca bunu okur.
create or replace view public.current_model_version as
select mv.*
from public.model_versions mv
where mv.status = 'published'
  and mv.effective_date <= current_date
order by mv.effective_date desc, mv.published_at desc nulls last
limit 1;

-- Her fon için en güncel fiyat satırı.
create or replace view public.fund_latest_price as
select distinct on (fp.fund_id) fp.*
from public.fund_prices fp
order by fp.fund_id, fp.price_date desc, fp.fetched_at desc;

-- Verilen tarihte veya ondan önceki en yakın fiyat (getiri hesapları için).
create or replace function public.fund_price_on_or_before(p_fund_id uuid, p_date date)
returns numeric
language sql
stable
as $$
  select fp.price
  from public.fund_prices fp
  where fp.fund_id = p_fund_id and fp.price_date <= p_date
  order by fp.price_date desc
  limit 1;
$$;

-- 1 ay / 3 ay / yılbaşından beri / 1 yıl getirileri, elimizdeki fiyat
-- geçmişinden hesaplanır (TEFAS'ın hazır bir getiri alanına güvenilmez).
-- Yeterli geçmiş yoksa ilgili alan NULL döner; arayüz bunu "—" gösterir.
create or replace view public.fund_returns as
select
  f.id as fund_id,
  lp.price_date as as_of_date,
  lp.price as latest_price,
  case when p1m.price is not null and p1m.price <> 0
       then round((lp.price / p1m.price - 1) * 100, 2) end as return_1m_pct,
  case when p3m.price is not null and p3m.price <> 0
       then round((lp.price / p3m.price - 1) * 100, 2) end as return_3m_pct,
  case when pytd.price is not null and pytd.price <> 0
       then round((lp.price / pytd.price - 1) * 100, 2) end as return_ytd_pct,
  case when p1y.price is not null and p1y.price <> 0
       then round((lp.price / p1y.price - 1) * 100, 2) end as return_1y_pct
from public.funds f
join public.fund_latest_price lp on lp.fund_id = f.id
left join lateral (
  select public.fund_price_on_or_before(f.id, (lp.price_date - interval '1 month')::date) as price
) p1m on true
left join lateral (
  select public.fund_price_on_or_before(f.id, (lp.price_date - interval '3 month')::date) as price
) p3m on true
left join lateral (
  select public.fund_price_on_or_before(f.id, (date_trunc('year', lp.price_date::timestamp) - interval '1 day')::date) as price
) pytd on true
left join lateral (
  select public.fund_price_on_or_before(f.id, (lp.price_date - interval '1 year')::date) as price
) p1y on true;

-- auth.uid() aktif bir admin_users kaydına karşılık geliyor mu?
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.admin_users au
    where au.id = auth.uid() and au.is_active
  );
$$;

grant select on public.current_model_version to anon, authenticated;
grant select on public.fund_latest_price to anon, authenticated;
grant select on public.fund_returns to anon, authenticated;
grant execute on function public.fund_price_on_or_before(uuid, date) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
