export interface TefasRawRow {
  fonKodu?: string;
  fonUnvan?: string;
  tarih?: string | number;
  fiyat?: number | string;
  kisiSayisi?: number | string;
  portfoyBuyukluk?: number | string;
  [key: string]: unknown;
}

export interface ParsedFundPrice {
  fundCode: string;
  priceDate: string;
  price: number;
  fundSize: number | null;
  investorCount: number | null;
}

export interface FetchTefasOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: Date;
}

/** TEFAS toplu liste endpoint'inin (fonKodu=null) tek bir satırı. */
export interface TefasBulkRow {
  fonKodu?: string;
  fonUnvan?: string;
  tarih?: string | number;
  fiyat?: number | string;
  kisiSayisi?: number | string | null;
  portfoyBuyukluk?: number | string | null;
  [key: string]: unknown;
}

/** Toplu senkronizasyonda keşfedilen, bir fon koduna ait en güncel satır. */
export interface ParsedCatalogFund {
  code: string;
  rawTitle: string;
  displayName: string;
  managementCompany: string | null;
  fonTipi: "YAT" | "BYF";
  priceDate: string;
  price: number;
  fundSize: number | null;
  investorCount: number | null;
}

/**
 * `fund_share_class_overrides` tablosunun bir satırı (bkz.
 * 20260911130000_fund_share_class_price_overrides.sql) — çoklu pay
 * grubuna sahip bir fon için doğrulanmış native para birimi/fiyat kaynağı.
 */
export interface ShareClassOverride {
  fundCode: string;
  shareClassLabel: string;
  nativeCurrency: "TRY" | "USD" | "EUR";
  /** true: TEFAS'ın ham fiyatı bu pay grubuna aittir. false: değildir, kullanılmamalıdır. */
  tefasPriceIsNative: boolean;
  priceFetchSource: string | null;
  priceFetchUrl: string | null;
}
