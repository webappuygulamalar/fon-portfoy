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
