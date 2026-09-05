import { SHARE_BASED_ASSET_CLASSES, type AssetClass } from "../../lib/constants";
import type { FundPriceRow, FundRow, FxRateRow } from "../../services/types";
import type { ProfileModel } from "../model/publishedModel";
import type { FundAssetClass, FxRateInput, PortfolioCalculationInput } from "./types";

const MONEY_MARKET: FundAssetClass = "MONEY_MARKET";

export interface ResolvedFundSelection {
  assetClass: FundAssetClass;
  fundId: string | null;
  fund: FundRow | null;
  price: FundPriceRow | null;
  isOverride: boolean;
}

/** Bir profil için, override varsa onu, yoksa standart fonu seçer. */
export function resolveFundSelections(
  profile: ProfileModel,
  fundsById: Record<string, FundRow>,
  latestPriceByFundId: Record<string, FundPriceRow>,
  overrides: Partial<Record<FundAssetClass, string>>,
): ResolvedFundSelection[] {
  return [...SHARE_BASED_ASSET_CLASSES, MONEY_MARKET].map((ac) => {
    const assetClass = ac as FundAssetClass;
    const overrideId = overrides[assetClass];
    const fundId = overrideId ?? profile.preferredFundIdByAssetClass[assetClass] ?? null;
    const fund = fundId ? (fundsById[fundId] ?? null) : null;
    const price = fundId ? (latestPriceByFundId[fundId] ?? null) : null;
    return {
      assetClass,
      fundId,
      fund,
      price,
      isOverride: Boolean(overrideId && overrideId !== profile.preferredFundIdByAssetClass[assetClass]),
    };
  });
}

/**
 * Seçili profil, fon override'ları, fiyatlar ve döviz kurlarından
 * hesaplama motoruna verilecek girdiyi oluşturur. Saf fonksiyondur.
 * Fiyatı bulunamayan bir fon burada ATLANIR (eklenmez) — motor bunu
 * MISSING_PRICE olarak algılayıp hesaplamayı engeller; sessizce yanlış
 * hesap yapılmaz.
 */
export function buildCalculationInput(
  totalAmount: string | number,
  profile: ProfileModel,
  fundsById: Record<string, FundRow>,
  latestPriceByFundId: Record<string, FundPriceRow>,
  overrides: Partial<Record<FundAssetClass, string>>,
  fxRatesByCurrency: Record<string, FxRateRow>,
  now?: Date,
): PortfolioCalculationInput {
  const allocations = (Object.entries(profile.allocations) as [AssetClass, number][]).map(
    ([assetClass, percentage]) => ({ assetClass, percentage }),
  );

  const selections = resolveFundSelections(profile, fundsById, latestPriceByFundId, overrides);
  const fundPrices: PortfolioCalculationInput["fundPrices"] = {};
  const fxRatesUsed = new Map<string, FxRateInput>();

  for (const sel of selections) {
    if (!sel.fund || !sel.price) continue;

    fundPrices[sel.assetClass] = {
      fundId: sel.fund.id,
      fundCode: sel.fund.code,
      assetClass: sel.assetClass,
      price: sel.price.price,
      currency: sel.price.currency,
      priceDate: sel.price.price_date,
      fetchedAt: sel.price.fetched_at,
    };

    if (sel.price.currency !== "TRY" && !fxRatesUsed.has(sel.price.currency)) {
      const rate = fxRatesByCurrency[sel.price.currency];
      if (rate) {
        fxRatesUsed.set(sel.price.currency, {
          currency: rate.currency,
          rateToTry: rate.rate_to_try,
          rateDate: rate.rate_date,
          source: rate.source,
        });
      }
    }
  }

  return {
    totalAmount,
    allocations,
    fundPrices,
    fxRates: [...fxRatesUsed.values()],
    now,
  };
}
