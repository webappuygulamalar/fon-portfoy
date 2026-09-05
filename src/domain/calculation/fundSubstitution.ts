import type { FundAssetClass } from "./types";

export interface SubstitutableFund {
  assetClass: FundAssetClass;
}

/**
 * Bir fon yalnızca aynı varlık sınıfındaki başka bir fonla
 * değiştirilebilir (ör. bir BIST katılım fonu, başka bir BIST katılım
 * fonuyla değiştirilebilir; altın fonuyla değiştirilemez).
 */
export function canSubstituteFund(
  current: SubstitutableFund,
  candidate: SubstitutableFund,
): boolean {
  return current.assetClass === candidate.assetClass;
}
