import { describe, expect, it } from "vitest";
import { calculatePortfolio } from "./engine";
import { DEFAULT_PROFILES } from "./defaultProfiles";
import type { PortfolioCalculationInput } from "./types";

const NOW = new Date("2026-09-05T07:00:00Z");

function priceInput(
  assetClass: "BIST_EQUITY" | "GOLD" | "FX" | "MONEY_MARKET",
  code: string,
  price: number,
  priceDate = "2026-09-04",
) {
  return {
    fundId: `fund-${code}`,
    fundCode: code,
    assetClass,
    price,
    currency: "TRY",
    priceDate,
    fetchedAt: "2026-09-05T04:30:00Z",
  } as const;
}

describe("calculatePortfolio — spesifikasyondaki 10.000 TL örneği (Düşük 2)", () => {
  const dusuk2 = DEFAULT_PROFILES.find((p) => p.key === "dusuk_2")!;

  const input: PortfolioCalculationInput = {
    totalAmount: 10_000,
    allocations: dusuk2.allocations,
    now: NOW,
    fundPrices: {
      BIST_EQUITY: priceInput("BIST_EQUITY", "ZKP", 7),
      GOLD: priceInput("GOLD", "ZGD", 11),
      FX: priceInput("FX", "BKY", 13),
      MONEY_MARKET: priceInput("MONEY_MARKET", "PKT", 5),
    },
  };

  const result = calculatePortfolio(input);

  it("durumu OK döner", () => {
    expect(result.status).toBe("OK");
  });

  it("mevduatı 8.000 TL olarak doğrudan ayırır", () => {
    expect(result.depositAmount.toNumber()).toBe(8000);
  });

  it("BIST fonu için 57 pay / 399 TL / 1 TL kalan hesaplar", () => {
    const bist = result.fundLines.find((l) => l.assetClass === "BIST_EQUITY")!;
    expect(bist.targetAmount.toNumber()).toBe(400);
    expect(bist.shareCount).toBe(57);
    expect(bist.actualAmount.toNumber()).toBe(399);
    expect(bist.remainder.toNumber()).toBe(1);
  });

  it("Altın fonu için 36 pay / 396 TL / 4 TL kalan hesaplar", () => {
    const gold = result.fundLines.find((l) => l.assetClass === "GOLD")!;
    expect(gold.targetAmount.toNumber()).toBe(400);
    expect(gold.shareCount).toBe(36);
    expect(gold.actualAmount.toNumber()).toBe(396);
    expect(gold.remainder.toNumber()).toBe(4);
  });

  it("Döviz fonu için 23 pay / 299 TL / 1 TL kalan hesaplar", () => {
    const fx = result.fundLines.find((l) => l.assetClass === "FX")!;
    expect(fx.targetAmount.toNumber()).toBe(300);
    expect(fx.shareCount).toBe(23);
    expect(fx.actualAmount.toNumber()).toBe(299);
    expect(fx.remainder.toNumber()).toBe(1);
  });

  it("diğer fonların kalanlarını (1+4+1=6 TL) PPF hedefine ekler", () => {
    expect(result.carriedToMoneyMarket.toNumber()).toBe(6);
    expect(result.moneyMarketLine!.targetAmount.toNumber()).toBe(900);
  });

  it("PPF kullanılabilir tutarını 906 TL, payını 181 / 905 TL hesaplar", () => {
    const mm = result.moneyMarketLine!;
    const available = mm.targetAmount.plus(result.carriedToMoneyMarket);
    expect(available.toNumber()).toBe(906);
    expect(mm.shareCount).toBe(181);
    expect(mm.actualAmount.toNumber()).toBe(905);
  });

  it("cari hesap bakiyesini tam olarak 1 TL bulur", () => {
    expect(result.cashBalance.toNumber()).toBe(1);
  });

  it("cari hesap 0 ile PPF fiyatı arasındadır (>=0 ve < fiyat)", () => {
    expect(result.isCashBalanceValid).toBe(true);
    expect(result.cashBalance.gte(0)).toBe(true);
    expect(result.cashBalance.lt(5)).toBe(true);
  });

  it("genel toplam kontrolü giriş tutarına eşittir", () => {
    expect(result.totals.grandTotalCheck.toNumber()).toBe(10_000);
  });

  it("tüm pay adetleri tam sayıdır", () => {
    for (const line of [...result.fundLines, result.moneyMarketLine!]) {
      expect(Number.isInteger(line.shareCount)).toBe(true);
    }
  });
});

describe("calculatePortfolio — floor davranışı (yuvarlama değil)", () => {
  it("100 / 6 = 16.67 iken 17'ye değil 16'ya yuvarlar (floor)", () => {
    const input: PortfolioCalculationInput = {
      totalAmount: 1000,
      now: NOW,
      allocations: [
        { assetClass: "DEPOSIT", percentage: 0 },
        { assetClass: "MONEY_MARKET", percentage: 90 },
        { assetClass: "BIST_EQUITY", percentage: 10 },
        { assetClass: "GOLD", percentage: 0 },
        { assetClass: "FX", percentage: 0 },
      ],
      fundPrices: {
        BIST_EQUITY: priceInput("BIST_EQUITY", "ZKP", 6),
        GOLD: priceInput("GOLD", "ZGD", 11),
        FX: priceInput("FX", "BKY", 13),
        MONEY_MARKET: priceInput("MONEY_MARKET", "PKT", 5),
      },
    };
    const result = calculatePortfolio(input);
    // hedef = 1000 * %10 = 100; 100/6 = 16.666... -> floor = 16
    const bist = result.fundLines.find((l) => l.assetClass === "BIST_EQUITY")!;
    expect(bist.shareCount).toBe(16);
    expect(bist.actualAmount.toNumber()).toBe(96);
    expect(bist.remainder.toNumber()).toBe(4);
  });
});

describe("calculatePortfolio — eksik fiyat davranışı", () => {
  it("bir fonun fiyatı eksikse hesaplamayı engeller ve nedeni bildirir", () => {
    const dusuk2 = DEFAULT_PROFILES.find((p) => p.key === "dusuk_2")!;
    const input: PortfolioCalculationInput = {
      totalAmount: 10_000,
      allocations: dusuk2.allocations,
      now: NOW,
      fundPrices: {
        BIST_EQUITY: priceInput("BIST_EQUITY", "ZKP", 7),
        GOLD: priceInput("GOLD", "ZGD", 11),
        // FX fiyatı eksik
        MONEY_MARKET: priceInput("MONEY_MARKET", "PKT", 5),
      },
    };
    const result = calculatePortfolio(input);
    expect(result.status).toBe("BLOCKED");
    expect(result.fundLines).toEqual([]);
    expect(result.blockReasons).toContainEqual({
      type: "MISSING_PRICE",
      assetClass: "FX",
    });
  });

  it("birden fazla eksik fiyatın tümünü bildirir", () => {
    const dusuk2 = DEFAULT_PROFILES.find((p) => p.key === "dusuk_2")!;
    const input: PortfolioCalculationInput = {
      totalAmount: 10_000,
      allocations: dusuk2.allocations,
      now: NOW,
      fundPrices: {
        BIST_EQUITY: priceInput("BIST_EQUITY", "ZKP", 7),
      },
    };
    const result = calculatePortfolio(input);
    expect(result.status).toBe("BLOCKED");
    expect(result.blockReasons).toHaveLength(3);
    expect(result.blockReasons.map((b) => b.assetClass).sort()).toEqual(
      ["FX", "GOLD", "MONEY_MARKET"].sort(),
    );
  });
});

describe("calculatePortfolio — döviz cinsinden fiyatlanan fon", () => {
  const dusuk2 = DEFAULT_PROFILES.find((p) => p.key === "dusuk_2")!;

  it("kur bulunamazsa hesaplamayı engeller, fiyat uydurmaz", () => {
    const input: PortfolioCalculationInput = {
      totalAmount: 10_000,
      allocations: dusuk2.allocations,
      now: NOW,
      fundPrices: {
        BIST_EQUITY: priceInput("BIST_EQUITY", "ZKP", 7),
        GOLD: priceInput("GOLD", "ZGD", 11),
        FX: {
          fundId: "fund-USDFON",
          fundCode: "USDFON",
          assetClass: "FX",
          price: 1.5,
          currency: "USD",
          priceDate: "2026-09-04",
          fetchedAt: "2026-09-05T04:30:00Z",
        },
        MONEY_MARKET: priceInput("MONEY_MARKET", "PKT", 5),
      },
      fxRates: [],
    };
    const result = calculatePortfolio(input);
    expect(result.status).toBe("BLOCKED");
    expect(result.blockReasons).toContainEqual({
      type: "MISSING_FX_RATE",
      assetClass: "FX",
      fundCode: "USDFON",
      currency: "USD",
    });
  });

  it("kur mevcutsa TL karşılığını doğru hesaplar ve kur bilgisini saklar", () => {
    const input: PortfolioCalculationInput = {
      totalAmount: 10_000,
      allocations: dusuk2.allocations,
      now: NOW,
      fundPrices: {
        BIST_EQUITY: priceInput("BIST_EQUITY", "ZKP", 7),
        GOLD: priceInput("GOLD", "ZGD", 11),
        FX: {
          fundId: "fund-USDFON",
          fundCode: "USDFON",
          assetClass: "FX",
          price: 1,
          currency: "USD",
          priceDate: "2026-09-04",
          fetchedAt: "2026-09-05T04:30:00Z",
        },
        MONEY_MARKET: priceInput("MONEY_MARKET", "PKT", 5),
      },
      fxRates: [
        { currency: "USD", rateToTry: 13, rateDate: "2026-09-04", source: "TCMB" },
      ],
    };
    const result = calculatePortfolio(input);
    expect(result.status).toBe("OK");
    const fx = result.fundLines.find((l) => l.assetClass === "FX")!;
    expect(fx.unitPriceTRY.toNumber()).toBe(13);
    expect(fx.fxRateUsed?.rate.toNumber()).toBe(13);
    expect(fx.fxRateUsed?.source).toBe("TCMB");
  });
});

describe("calculatePortfolio — geçersiz model dağılımı", () => {
  it("toplam %100 olmayan dağılımda hata fırlatır (admin tarafında engellenmesi gereken durum)", () => {
    const input: PortfolioCalculationInput = {
      totalAmount: 1000,
      allocations: [
        { assetClass: "DEPOSIT", percentage: 50 },
        { assetClass: "MONEY_MARKET", percentage: 10 },
        { assetClass: "BIST_EQUITY", percentage: 10 },
        { assetClass: "GOLD", percentage: 10 },
        { assetClass: "FX", percentage: 10 },
      ],
      fundPrices: {},
    };
    expect(() => calculatePortfolio(input)).toThrow(/Geçersiz model dağılımı/);
  });
});
