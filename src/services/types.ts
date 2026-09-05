import type { AssetClass } from "../lib/constants";

// Bu dosya, Supabase tablolarının satır şekillerini birebir yansıtır
// (snake_case). Hesaplama motoru gibi saf katmanlar bu tiplere bağımlı
// DEĞİLDİR; dönüşüm yalnızca ihtiyaç duyulan noktada yapılır.

export interface FundRow {
  id: string;
  code: string;
  name: string;
  management_company: string;
  asset_class: AssetClass;
  fund_type: string | null;
  currency: string;
  tefas_fetch_code: string;
  is_active: boolean;
  verification_needed: boolean;
  verification_note: string | null;
}

export interface FundPriceRow {
  id: string;
  fund_id: string;
  price_date: string;
  currency: string;
  price: string;
  fund_size: string | null;
  investor_count: number | null;
  source: "TEFAS" | "MANUAL";
  note: string | null;
  fetched_at: string;
}

export interface FundReturnsRow {
  fund_id: string;
  as_of_date: string;
  latest_price: string;
  return_1m_pct: string | null;
  return_3m_pct: string | null;
  return_ytd_pct: string | null;
  return_1y_pct: string | null;
}

export interface RiskProfileRow {
  id: string;
  key: string;
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

export interface ModelVersionRow {
  id: string;
  version_number: number;
  status: "draft" | "published" | "archived";
  effective_date: string | null;
  published_at: string | null;
  published_by: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export interface ModelProfileAllocationRow {
  id: string;
  model_version_id: string;
  profile_id: string;
  asset_class: AssetClass;
  percentage: number;
}

export interface ModelPreferredFundRow {
  id: string;
  model_version_id: string;
  profile_id: string | null;
  asset_class: AssetClass;
  fund_id: string;
}

export interface ModelDepositBucketRow {
  id: string;
  model_version_id: string;
  profile_id: string;
  label: string;
  weight_percent: string;
  sort_order: number;
}

export interface FxRateRow {
  id: string;
  currency: string;
  rate_to_try: string;
  rate_date: string;
  source: string;
  fetched_at: string;
}

export interface SyncRunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "partial" | "failed";
  trigger_type: "cron" | "manual";
  triggered_by_admin_id: string | null;
  funds_checked: number;
  funds_updated: number;
  funds_failed: number;
  failed_fund_codes: string[];
  catalog_synced: boolean;
  error_summary: string | null;
}

export interface AdminUserRow {
  id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
}
