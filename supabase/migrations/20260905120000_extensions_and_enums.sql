-- Uzantılar ve sabit enum tipleri.
-- asset_class enum'u kasıtlı olarak sadece 5 değer içerir; yabancı hisse
-- veya başka bir sınıf buraya EKLENEMEZ (uygulama kuralı: "yabancı hisse
-- sınıfı kesinlikle olmayacak"). Yeni bir sınıf gerekirse bilinçli bir
-- migration ile enum genişletilmelidir.

create extension if not exists pgcrypto;

create type public.asset_class as enum (
  'DEPOSIT',
  'MONEY_MARKET',
  'BIST_EQUITY',
  'GOLD',
  'FX'
);

create type public.model_version_status as enum ('draft', 'published', 'archived');

create type public.sync_status as enum ('running', 'success', 'partial', 'failed');

create type public.sync_trigger as enum ('cron', 'manual');

create type public.price_source as enum ('TEFAS', 'MANUAL');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
