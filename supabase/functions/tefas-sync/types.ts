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
