import type { Decimal } from "../../lib/decimal";
import type { AssetClass } from "../../lib/constants";

export interface AllocationInput {
  assetClass: AssetClass;
  /** Tam sayı, 0-100 aralığında. */
  percentage: number;
}

export type FundAssetClass = Exclude<AssetClass, "DEPOSIT">;

export interface FundPriceInput {
  fundId: string;
  fundCode: string;
  assetClass: FundAssetClass;
  /** `currency` cinsinden birim fiyat. */
  price: Decimal.Value;
  currency: string;
  /** YYYY-MM-DD */
  priceDate: string;
  /** ISO datetime — fiyatın sisteme çekildiği an. */
  fetchedAt: string;
}

export interface FxRateInput {
  currency: string;
  rateToTry: Decimal.Value;
  rateDate: string;
  source: string;
}

export interface PortfolioCalculationInput {
  totalAmount: Decimal.Value;
  allocations: AllocationInput[];
  fundPrices: Partial<Record<FundAssetClass, FundPriceInput>>;
  fxRates?: FxRateInput[];
  now?: Date;
}

export type CalculationBlockReason =
  | { type: "MISSING_PRICE"; assetClass: FundAssetClass }
  | {
      type: "MISSING_FX_RATE";
      assetClass: FundAssetClass;
      fundCode: string;
      currency: string;
    };

export interface FxRateUsed {
  rate: Decimal;
  rateDate: string;
  source: string;
}

export interface FundLineResult {
  assetClass: FundAssetClass;
  fundId: string;
  fundCode: string;
  percentage: number;
  targetAmount: Decimal;
  /** TL cinsinden efektif birim fiyat (döviz ise dönüştürülmüş). */
  unitPriceTRY: Decimal;
  originalPrice: Decimal;
  originalCurrency: string;
  priceDate: string;
  fetchedAt: string;
  isStalePrice: boolean;
  fxRateUsed?: FxRateUsed;
  shareCount: number;
  actualAmount: Decimal;
  /** Hedef tutar - gerçekleşen tutar (para piyasası fonuna aktarılır). */
  remainder: Decimal;
}

export interface DistributionRow {
  assetClass: AssetClass | "CASH";
  plannedPercentage: number;
  actualAmount: Decimal;
  actualPercentage: Decimal;
}

export interface PortfolioCalculationTotals {
  depositAmount: Decimal;
  investedInFunds: Decimal;
  carriedToMoneyMarket: Decimal;
  cashBalance: Decimal;
  /** mevduat + fonlar + nakit; totalAmount'a eşit olmalıdır. */
  grandTotalCheck: Decimal;
}

export interface PortfolioCalculationResult {
  status: "OK" | "BLOCKED";
  blockReasons: CalculationBlockReason[];
  totalAmount: Decimal;
  depositAmount: Decimal;
  fundLines: FundLineResult[];
  moneyMarketLine: FundLineResult | null;
  carriedToMoneyMarket: Decimal;
  cashBalance: Decimal;
  /** cashBalance >= 0 ve cashBalance < PPF fiyatı. Sadece status OK iken anlamlıdır. */
  isCashBalanceValid: boolean;
  totals: PortfolioCalculationTotals;
  distribution: DistributionRow[];
}
