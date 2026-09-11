// Pay grubu geçersiz kılmalarının (bkz. fund_share_class_overrides,
// 20260911130000_fund_share_class_price_overrides.sql) tefas-sync üzerindeki
// etkisini belirleyen SAF fonksiyonlar — ağ/DB bağımlılığı yok, doğrudan
// test edilebilir.
import type { FundCurrency } from "./classifyFund.ts";
import type { ShareClassOverride } from "./types.ts";

export interface ResolvedCurrency {
  currency: FundCurrency;
  currencySource: string;
}

/**
 * Bir fonun currency/currency_source'unu belirler. Aktif bir override
 * varsa (fund_share_class_overrides), referans katalog/başlık sezgisinin
 * ÖNÜNE geçer ve HER ÇALIŞTIRMADA zorla uygulanır — böylece günlük
 * senkronizasyon doğrulanmış bir pay grubu kararını asla eski/yanlış bir
 * değere geri düşürmez ("skip if already set" değil, "her zaman yeniden
 * uygula" deseni — hiçbir ara durumda yanlış değere dönülemez).
 */
export function resolveFundCurrency(
  classified: ResolvedCurrency,
  override: ShareClassOverride | undefined,
): ResolvedCurrency {
  if (!override) return classified;
  return {
    currency: override.nativeCurrency,
    currencySource: `share_class_override:${override.shareClassLabel}`,
  };
}

/**
 * true ise TEFAS'ın ham `fiyat` alanı bu fon için güvenle kullanılabilir
 * (override yok, ya da override var ama TEFAS'ın fiyatı zaten doğru pay
 * grubuna ait — tefas_price_is_native=true). false ise TEFAS'ın fiyatı
 * BAŞKA bir pay grubuna aittir ve fund_prices'a hiç YAZILMAMALIDIR (bkz.
 * managementCompanyPriceAdapter.ts'in native fiyatı ayrıca çekmesi gerekir).
 */
export function shouldTrustTefasPrice(override: ShareClassOverride | undefined): boolean {
  return !override || override.tefasPriceIsNative;
}
