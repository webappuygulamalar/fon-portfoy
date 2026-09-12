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
  fundName?: string;
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
      fundName: priceInput.fundName,
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
    fundName: priceInput.fundName,
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

  // PPF'nin PLANLANAN yüzdesi bilinmeden artığın nereye gideceğine karar
  // verilemez — bu yüzden PPF yüzdesi, fon döngüsünden ÖNCE okunur.
  const mmPercentage = pctOf(MONEY_MARKET);
  const roundingRemainderPolicy = input.roundingRemainderPolicy ?? "MONEY_MARKET";
  // Yalnızca Özel dağılımın kullandığı "CASH_IF_MONEY_MARKET_ZERO"
  // politikasında VE PPF tam %0 iken devreye girer. Hazır risk profilleri
  // her zaman "MONEY_MARKET" politikasını kullanır (bkz. buildInput.ts) —
  // bu bayrak onlar için asla true olmaz, davranışları değişmez.
  const suppressMoneyMarketRemainder =
    roundingRemainderPolicy === "CASH_IF_MONEY_MARKET_ZERO" && mmPercentage === 0;

  let carriedToMoneyMarket = ZERO;
  const fundLines: FundLineResult[] = [];

  for (const ac of SHARE_BASED_ASSET_CLASSES as FundAssetClass[]) {
    const price = resolved.get(ac)!;
    const percentage = pctOf(ac);
    const targetAmount = total.mul(percentage).div(100);
    const shareCount = targetAmount.div(price.unitPriceTRY).floor();
    const actualAmount = shareCount.mul(price.unitPriceTRY);
    const remainder = targetAmount.minus(actualAmount);
    // Varsayılan politikada bu artık her zaman PPF'ye eklenir. Kullanıcı
    // Özel dağılımda PPF'ye bilinçli olarak %0 verdiyse (suppress=true) bu
    // artık PPF'nin hedefine hiç eklenmez; aşağıdaki cashBalance hesabı
    // (total - mevduat - yatırılan) bunu otomatik olarak Cari Hesap'a
    // yansıtır — ayrı bir "cari hesaba ekle" adımına gerek yoktur.
    if (!suppressMoneyMarketRemainder) {
      carriedToMoneyMarket = carriedToMoneyMarket.plus(remainder);
    }

    fundLines.push({
      assetClass: ac,
      fundId: price.fundId,
      fundCode: price.fundCode,
      fundName: price.fundName,
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
  const mmTargetAmount = total.mul(mmPercentage).div(100);
  const mmAvailable = mmTargetAmount.plus(carriedToMoneyMarket);
  const mmShareCount = mmAvailable.div(mmPrice.unitPriceTRY).floor();
  const mmActualAmount = mmShareCount.mul(mmPrice.unitPriceTRY);

  const moneyMarketLine: FundLineResult = {
    assetClass: MONEY_MARKET,
    fundId: mmPrice.fundId,
    fundCode: mmPrice.fundCode,
    fundName: mmPrice.fundName,
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
  // Varsayılan politikada tüm hisse bazlı artıklar PPF'de tek bir pay
  // hesabında birleşir, bu yüzden geçerli cari hesap bakiyesi her zaman PPF
  // biriminden küçüktür (mevcut/eski davranış — DEĞİŞMEDİ). PPF artığı
  // bastırılmışsa (suppressMoneyMarketRemainder) her aktif (yüzdesi > 0)
  // hisse bazlı fonun kendi artığı BAĞIMSIZ olarak cari hesapta kalabilir;
  // üst sınır o fonların birim fiyatları toplamıdır. Aktif fon yoksa (tüm
  // yüzdeler 0) artık da matematiksel olarak tam 0'dır.
  const cashUpperBound = suppressMoneyMarketRemainder
    ? (SHARE_BASED_ASSET_CLASSES as FundAssetClass[])
        .filter((ac) => pctOf(ac) > 0)
        .reduce((sum, ac) => sum.plus(resolved.get(ac)!.unitPriceTRY), ZERO)
    : mmPrice.unitPriceTRY;
  const isCashBalanceValid =
    cashBalance.gte(0) &&
    (cashUpperBound.eq(0) ? cashBalance.eq(0) : cashBalance.lt(cashUpperBound));

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
