import type { AssetClass } from "../../lib/constants";
import type { FundAssetClass } from "./types";

export interface SubstitutionCandidate {
  assetClass: AssetClass | null;
  isActive: boolean;
  isSubstitutionEligible: boolean;
}

/**
 * Bir fon, yalnızca hedef model varlık sınıfıyla eşleşen VE fon değişimi
 * için uygun işaretlenmiş (is_substitution_eligible) bir aday olabilir.
 * Model dışı (asset_class=null) veya sınıflandırması belirsiz fonlar hiçbir
 * zaman aday olamaz — bu, ayrı fon seçim sayfasındaki tek doğruluk kaynağıdır.
 */
export function canSubstituteFund(
  targetAssetClass: FundAssetClass,
  candidate: SubstitutionCandidate,
): boolean {
  return (
    candidate.isActive &&
    candidate.isSubstitutionEligible &&
    candidate.assetClass === targetAssetClass
  );
}
