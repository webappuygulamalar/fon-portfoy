import type { AssetClass } from "../lib/constants";

// Bu dosya, Supabase tablolarının satır şekillerini birebir yansıtır
// (snake_case). Hesaplama motoru gibi saf katmanlar bu tiplere bağımlı
// DEĞİLDİR; dönüşüm yalnızca ihtiyaç duyulan noktada yapılır.

export interface FundRow {
  id: string;
  code: string;
  name: string;
  /** Fon başlığından çıkarılamadıysa null ("—" gösterilir). */
  management_company: string | null;
  /**
   * Fonun ait olduğu model varlık sınıfı. NULL, bu fonun 5 model sınıfından
   * hiçbirine uymadığı (ör. kira sertifikası, çoklu varlık, fon sepeti) veya
   * sınıflandırmanın belirsiz olduğu anlamına gelir — bu tür fonlar
   * kataloğda görünür ama model fon değişiminde seçilemez.
   */
  asset_class: AssetClass | null;
  fund_type: string | null;
  currency: string;
  tefas_fetch_code: string;
  is_active: boolean;
  verification_needed: boolean;
  verification_note: string | null;
  /** TEFAS fon başlığında "katılım" tespit edildi mi. */
  is_participation_fund: boolean;
  /** TEFAS/referans kataloğundan türetilen, gösterim amaçlı ince kategori. */
  catalog_category: string | null;
  /**
   * true ise bu fon, model portföyde kendi asset_class'ı için kullanıcı
   * tarafından fon değişimi amacıyla seçilebilir (asset_class dolu VE
   * sınıflandırma güvenilir olmalı — bkz. verification_needed).
   */
  is_substitution_eligible: boolean;
  /** TEFAS resmi risk değeri (1-7). Doğrulanmış kaynağı yoksa null ("—"). */
  risk_value: number | null;
  /** risk_value nereden geldi (ör. reference_catalog_2026-09-04). risk_value null ise bu da null'dur. */
  risk_source: string | null;
  risk_updated_at: string | null;
  /** currency alanının nasıl belirlendiği: reference_catalog | title_pattern_doviz | tefas_default_try. */
  currency_source: string;
  /** risk_value'in geldiği kaynağın URL'si. risk_value null ise bu da null'dur. */
  risk_source_url: string | null;
  /** true ise risk_value bilinen bir kaynaktan doğrulanmıştır (tahmin değildir). */
  risk_verified: boolean;
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

export interface PriceBackfillCheckpointRow {
  id: boolean;
  oldest_fetched_date: string;
  target_start_date: string;
  is_complete: boolean;
  updated_at: string;
}

export interface PriceBackfillRunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "partial" | "failed";
  trigger_type: "cron" | "manual";
  triggered_by_admin_id: string | null;
  window_start: string;
  window_end: string;
  rows_upserted: number;
  funds_touched: number;
  error_summary: string | null;
}

export interface AdminUserRow {
  id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
}
