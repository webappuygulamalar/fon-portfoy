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
  /** Yalnızca gösterim amaçlı; hesaplama mantığını etkilemez. */
  fundName?: string;
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

/**
 * Para piyasası fonu (PPF) dışındaki fonların tam pay yuvarlama artığının
 * nereye aktarılacağını belirler.
 * - "MONEY_MARKET" (varsayılan, GERİYE UYUMLU): artık her zaman PPF
 *   hedefine eklenir — tüm hazır risk profillerinin bugüne kadarki
 *   davranışı budur ve bu politika seçiliyken hiçbir koşulda değişmez.
 * - "CASH_IF_MONEY_MARKET_ZERO": yalnızca PPF'nin PLANLANAN yüzdesi tam
 *   olarak 0 ise artık PPF'ye eklenmez, doğrudan cari hesapta bırakılır
 *   (kullanıcının PPF'ye bilinçli olarak %0 verdiği Özel dağılım için).
 *   PPF yüzdesi 0'dan büyükse bu politika "MONEY_MARKET" ile birebir
 *   aynı şekilde davranır — davranış farkı SADECE PPF tam %0 olduğunda
 *   ortaya çıkar.
 */
export type RoundingRemainderPolicy = "MONEY_MARKET" | "CASH_IF_MONEY_MARKET_ZERO";

export interface PortfolioCalculationInput {
  totalAmount: Decimal.Value;
  allocations: AllocationInput[];
  fundPrices: Partial<Record<FundAssetClass, FundPriceInput>>;
  fxRates?: FxRateInput[];
  now?: Date;
  /** Belirtilmezse "MONEY_MARKET" (mevcut/eski davranış) kullanılır. */
  roundingRemainderPolicy?: RoundingRemainderPolicy;
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
  fundName?: string;
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
