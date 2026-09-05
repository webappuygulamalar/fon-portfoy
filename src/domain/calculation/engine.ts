import { Decimal, toDecimal, ZERO } from "../../lib/decimal";
import { SHARE_BASED_ASSET_CLASSES, type AssetClass } from "../../lib/constants";
import { isPriceStale } from "../../lib/priceFreshness";
import { validateAllocations } from "./validateAllocations";
import type {
  CalculationBlockReason,
  DistributionRow,
  FundAssetClass,
  FundLineResult,
  FxRateInput,
  FxRateUsed,
  PortfolioCalculationInput,
  PortfolioCalculationResult,
} from "./types";

const MONEY_MARKET: FundAssetClass = "MONEY_MARKET";

interface ResolvedPrice {
  unitPriceTRY: Decimal;
  originalPrice: Decimal;
  originalCurrency: string;
  priceDate: string;
  fetchedAt: string;
  fundId: string;
  fundCode: string;
  fxRateUsed?: FxRateUsed;
}

function resolvePrice(
  assetClass: FundAssetClass,
  input: PortfolioCalculationInput,
  blockReasons: CalculationBlockReason[],
): ResolvedPrice | null {
  const priceInput = input.fundPrices[assetClass];
  if (!priceInput) {
    blockReasons.push({ type: "MISSING_PRICE", assetClass });
    return null;
  }

  if (priceInput.currency === "TRY") {
    return {
      unitPriceTRY: toDecimal(priceInput.price),
      originalPrice: toDecimal(priceInput.price),
      originalCurrency: priceInput.currency,
      priceDate: priceInput.priceDate,
      fetchedAt: priceInput.fetchedAt,
      fundId: priceInput.fundId,
      fundCode: priceInput.fundCode,
    };
  }

  const rate: FxRateInput | undefined = input.fxRates?.find(
    (r) => r.currency === priceInput.currency,
  );
  if (!rate) {
    blockReasons.push({
      type: "MISSING_FX_RATE",
      assetClass,
      fundCode: priceInput.fundCode,
      currency: priceInput.currency,
    });
    return null;
  }

  return {
    unitPriceTRY: toDecimal(priceInput.price).mul(toDecimal(rate.rateToTry)),
    originalPrice: toDecimal(priceInput.price),
    originalCurrency: priceInput.currency,
    priceDate: priceInput.priceDate,
    fetchedAt: priceInput.fetchedAt,
    fundId: priceInput.fundId,
    fundCode: priceInput.fundCode,
    fxRateUsed: {
      rate: toDecimal(rate.rateToTry),
      rateDate: rate.rateDate,
      source: rate.source,
    },
  };
}

function blockedResult(
  input: PortfolioCalculationInput,
  blockReasons: CalculationBlockReason[],
  depositAmount: Decimal,
): PortfolioCalculationResult {
  return {
    status: "BLOCKED",
    blockReasons,
    totalAmount: toDecimal(input.totalAmount),
    depositAmount,
    fundLines: [],
    moneyMarketLine: null,
    carriedToMoneyMarket: ZERO,
    cashBalance: ZERO,
    isCashBalanceValid: false,
    totals: {
      depositAmount,
      investedInFunds: ZERO,
      carriedToMoneyMarket: ZERO,
      cashBalance: ZERO,
      grandTotalCheck: depositAmount,
    },
    distribution: [],
  };
}

/**
 * Model portföy pay hesaplama motoru. Saf fonksiyondur; React veya
 * Supabase'e hiçbir bağımlılığı yoktur.
 *
 * Kurallar (spesifikasyona birebir uyar):
 * 1. Mevduat doğrudan tutar olarak ayrılır, pay hesabına girmez.
 * 2. Para piyasası fonu dışındaki fonlar önce hesaplanır (floor ile
 *    tam sayı pay adedi).
 * 3. Bu fonlardan kalan tutarlar para piyasası fonunun hedefine eklenir.
 * 4. Para piyasası fonu en son, artırılmış tutar üzerinden hesaplanır.
 * 5. Kalan her şey cari hesap bakiyesidir.
 */
export function calculatePortfolio(
  input: PortfolioCalculationInput,
): PortfolioCalculationResult {
  const allocationCheck = validateAllocations(input.allocations);
  if (!allocationCheck.valid) {
    throw new Error(
      `Geçersiz model dağılımı, hesaplama yapılamaz: ${allocationCheck.errors.join("; ")}`,
    );
  }

  const now = input.now ?? new Date();
  const total = toDecimal(input.totalAmount);
  const pctOf = (ac: AssetClass): number =>
    input.allocations.find((a) => a.assetClass === ac)!.percentage;

  const depositAmount = total.mul(pctOf("DEPOSIT")).div(100);

  // İlk geçiş: tüm fon fiyatlarını (ve gerekiyorsa döviz kurlarını) çöz.
  // Herhangi biri eksikse hesaplama tamamen engellenir — kısmi/yanıltıcı
  // sonuç üretilmez.
  const blockReasons: CalculationBlockReason[] = [];
  const resolved = new Map<FundAssetClass, ResolvedPrice>();
  for (const ac of [...SHARE_BASED_ASSET_CLASSES, MONEY_MARKET] as FundAssetClass[]) {
    const r = resolvePrice(ac, input, blockReasons);
    if (r) resolved.set(ac, r);
  }

  if (blockReasons.length > 0) {
    return blockedResult(input, blockReasons, depositAmount);
  }

  let carriedToMoneyMarket = ZERO;
  const fundLines: FundLineResult[] = [];

  for (const ac of SHARE_BASED_ASSET_CLASSES as FundAssetClass[]) {
    const price = resolved.get(ac)!;
    const percentage = pctOf(ac);
    const targetAmount = total.mul(percentage).div(100);
    const shareCount = targetAmount.div(price.unitPriceTRY).floor();
    const actualAmount = shareCount.mul(price.unitPriceTRY);
    const remainder = targetAmount.minus(actualAmount);
    carriedToMoneyMarket = carriedToMoneyMarket.plus(remainder);

    fundLines.push({
      assetClass: ac,
      fundId: price.fundId,
      fundCode: price.fundCode,
      percentage,
      targetAmount,
      unitPriceTRY: price.unitPriceTRY,
      originalPrice: price.originalPrice,
      originalCurrency: price.originalCurrency,
      priceDate: price.priceDate,
      fetchedAt: price.fetchedAt,
      isStalePrice: isPriceStale(price.priceDate, now),
      fxRateUsed: price.fxRateUsed,
      shareCount: shareCount.toNumber(),
      actualAmount,
      remainder,
    });
  }

  const mmPrice = resolved.get(MONEY_MARKET)!;
  const mmPercentage = pctOf(MONEY_MARKET);
  const mmTargetAmount = total.mul(mmPercentage).div(100);
  const mmAvailable = mmTargetAmount.plus(carriedToMoneyMarket);
  const mmShareCount = mmAvailable.div(mmPrice.unitPriceTRY).floor();
  const mmActualAmount = mmShareCount.mul(mmPrice.unitPriceTRY);

  const moneyMarketLine: FundLineResult = {
    assetClass: MONEY_MARKET,
    fundId: mmPrice.fundId,
    fundCode: mmPrice.fundCode,
    percentage: mmPercentage,
    targetAmount: mmTargetAmount,
    unitPriceTRY: mmPrice.unitPriceTRY,
    originalPrice: mmPrice.originalPrice,
    originalCurrency: mmPrice.originalCurrency,
    priceDate: mmPrice.priceDate,
    fetchedAt: mmPrice.fetchedAt,
    isStalePrice: isPriceStale(mmPrice.priceDate, now),
    fxRateUsed: mmPrice.fxRateUsed,
    shareCount: mmShareCount.toNumber(),
    actualAmount: mmActualAmount,
    // PPF'nin kendi yuvarlama artığı başka bir fona aktarılmaz; cari
    // hesaba düşer (aşağıdaki cashBalance hesabına dahildir).
    remainder: mmAvailable.minus(mmActualAmount),
  };

  const investedInFunds = fundLines
    .reduce((sum, l) => sum.plus(l.actualAmount), ZERO)
    .plus(mmActualAmount);

  const cashBalance = total.minus(depositAmount).minus(investedInFunds);
  const isCashBalanceValid =
    cashBalance.gte(0) && cashBalance.lt(mmPrice.unitPriceTRY);

  const grandTotalCheck = depositAmount.plus(investedInFunds).plus(cashBalance);

  const distribution: DistributionRow[] = [
    {
      assetClass: "DEPOSIT",
      plannedPercentage: pctOf("DEPOSIT"),
      actualAmount: depositAmount,
      actualPercentage: total.eq(0) ? ZERO : depositAmount.div(total).mul(100),
    },
    ...fundLines.map((l) => ({
      assetClass: l.assetClass as AssetClass,
      plannedPercentage: l.percentage,
      actualAmount: l.actualAmount,
      actualPercentage: total.eq(0) ? ZERO : l.actualAmount.div(total).mul(100),
    })),
    {
      assetClass: MONEY_MARKET,
      plannedPercentage: mmPercentage,
      actualAmount: mmActualAmount,
      actualPercentage: total.eq(0) ? ZERO : mmActualAmount.div(total).mul(100),
    },
    {
      assetClass: "CASH",
      plannedPercentage: 0,
      actualAmount: cashBalance,
      actualPercentage: total.eq(0) ? ZERO : cashBalance.div(total).mul(100),
    },
  ];

  return {
    status: "OK",
    blockReasons: [],
    totalAmount: total,
    depositAmount,
    fundLines,
    moneyMarketLine,
    carriedToMoneyMarket,
    cashBalance,
    isCashBalanceValid,
    totals: {
      depositAmount,
      investedInFunds,
      carriedToMoneyMarket,
      cashBalance,
      grandTotalCheck,
    },
    distribution,
  };
}
