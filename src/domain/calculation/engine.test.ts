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

  it("native USD fiyatı TL'ye YALNIZCA BİR KEZ çevrilir (CKS'de yaşanan çift dönüşüm hatasının regresyon testi)", () => {
    // CKS'nin canlıda düzeltilen hatası: TEFAS'ın A Grubu (TL) fiyatı
    // yanlışlıkla currency='USD' etiketiyle kaydedilmişti; bu, doğru native
    // USD fiyatı TL karşılığına çevrilirken sanki zaten TL'ymiş gibi
    // (kur uygulanmadan) kullanılsaydı ya da tersine iki kez kurla
    // çarpılsaydı ortaya çıkacak sınıf hatasını temsil eder. resolvePrice
    // (engine.ts) her fon için TAM OLARAK bir dal çalıştırır (TRY: olduğu
    // gibi | değilse: price * rate, tek sefer) — burada gerçek CKS
    // büyüklüğünde sayılarla bunu doğrudan doğrular.
    const input: PortfolioCalculationInput = {
      totalAmount: 10_000,
      allocations: dusuk2.allocations,
      now: NOW,
      fundPrices: {
        BIST_EQUITY: priceInput("BIST_EQUITY", "ZKP", 7),
        GOLD: priceInput("GOLD", "ZGD", 11),
        FX: {
          fundId: "fund-CKS",
          fundCode: "CKS",
          assetClass: "FX",
          price: 1.277608,
          currency: "USD",
          priceDate: "2026-09-11",
          fetchedAt: "2026-09-11T05:30:00Z",
        },
        MONEY_MARKET: priceInput("MONEY_MARKET", "PKT", 5),
      },
      fxRates: [{ currency: "USD", rateToTry: 48.5, rateDate: "2026-09-11", source: "TCMB" }],
    };
    const result = calculatePortfolio(input);
    expect(result.status).toBe("OK");
    const fx = result.fundLines.find((l) => l.assetClass === "FX")!;
    // 1.277608 * 48.5 — tek çarpım, ne daha az (kur hiç uygulanmamış) ne
    // daha fazla (iki kez uygulanmış) bir sonuç.
    expect(fx.unitPriceTRY.toNumber()).toBeCloseTo(1.277608 * 48.5, 6);
    expect(fx.originalPrice.toNumber()).toBe(1.277608);
    expect(fx.originalCurrency).toBe("USD");
  });

  it("TRY fiyatlı bir fon, fxRates'te alakasız bir kur bulunsa bile TEKRAR çevrilmez", () => {
    // resolvePrice'ın currency==='TRY' dalı fiyatı OLDUĞU GİBİ döner — bu
    // test, fxRates dizisinde bir USD kuru mevcut olsa bile TRY fiyatlı bir
    // fonun buna hiç dokunmadığını (çift dönüşüm/istenmeyen çarpım
    // olmadığını) doğrudan kanıtlar.
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
      fxRates: [{ currency: "USD", rateToTry: 48.5, rateDate: "2026-09-11", source: "TCMB" }],
    };
    const result = calculatePortfolio(input);
    expect(result.status).toBe("OK");
    const fx = result.fundLines.find((l) => l.assetClass === "FX")!;
    expect(fx.unitPriceTRY.toNumber()).toBe(13);
    expect(fx.fxRateUsed).toBeUndefined();
  });
});

describe("calculatePortfolio — roundingRemainderPolicy: CASH_IF_MONEY_MARKET_ZERO (Özel dağılım)", () => {
  function inputWith(
    allocations: PortfolioCalculationInput["allocations"],
    totalAmount: number,
    policy?: PortfolioCalculationInput["roundingRemainderPolicy"],
  ): PortfolioCalculationInput {
    return {
      totalAmount,
      allocations,
      now: NOW,
      roundingRemainderPolicy: policy,
      fundPrices: {
        BIST_EQUITY: priceInput("BIST_EQUITY", "ZKP", 10),
        GOLD: priceInput("GOLD", "ZGD", 20),
        FX: priceInput("FX", "BKY", 5),
        MONEY_MARKET: priceInput("MONEY_MARKET", "PKT", 1.5),
      },
    };
  }

  const ppfZeroAllocations: PortfolioCalculationInput["allocations"] = [
    { assetClass: "DEPOSIT", percentage: 40 },
    { assetClass: "MONEY_MARKET", percentage: 0 },
    { assetClass: "BIST_EQUITY", percentage: 20 },
    { assetClass: "GOLD", percentage: 20 },
    { assetClass: "FX", percentage: 20 },
  ];

  it("1. PPF %0 ve diğer fonlarda tam pay artığı varsa PPF'ye hiç yatırım yapılmaz", () => {
    const result = calculatePortfolio(
      inputWith(ppfZeroAllocations, 1_000_005, "CASH_IF_MONEY_MARKET_ZERO"),
    );
    expect(result.status).toBe("OK");
    expect(result.carriedToMoneyMarket.toNumber()).toBe(0);
    expect(result.moneyMarketLine!.targetAmount.toNumber()).toBe(0);
    expect(result.moneyMarketLine!.actualAmount.toNumber()).toBe(0);
    expect(result.moneyMarketLine!.shareCount).toBe(0);
  });

  it("2. Aynı senaryoda üç fonun yuvarlama artığı (1+1+1=3 TL) Cari Hesap'ta kalır", () => {
    const result = calculatePortfolio(
      inputWith(ppfZeroAllocations, 1_000_005, "CASH_IF_MONEY_MARKET_ZERO"),
    );
    expect(result.cashBalance.toNumber()).toBe(3);
    expect(result.totals.cashBalance.toNumber()).toBe(3);
  });

  it("3. Toplam portföy kontrolü (mevduat + fonlar + cari hesap) girdi tutarına birebir eşittir", () => {
    const result = calculatePortfolio(
      inputWith(ppfZeroAllocations, 1_000_005, "CASH_IF_MONEY_MARKET_ZERO"),
    );
    expect(result.totals.grandTotalCheck.toNumber()).toBe(1_000_005);
  });

  it("cari hesap bakiyesi geçerlidir (yanlış-pozitif 'beklenen aralıkta değil' uyarısı yok)", () => {
    const result = calculatePortfolio(
      inputWith(ppfZeroAllocations, 1_000_005, "CASH_IF_MONEY_MARKET_ZERO"),
    );
    expect(result.isCashBalanceValid).toBe(true);
  });

  it("4. PPF oranı %0'dan büyükse aynı politika altında mevcut aktarım davranışı sürer", () => {
    const allocations: PortfolioCalculationInput["allocations"] = [
      { assetClass: "DEPOSIT", percentage: 40 },
      { assetClass: "MONEY_MARKET", percentage: 10 },
      { assetClass: "BIST_EQUITY", percentage: 20 },
      { assetClass: "GOLD", percentage: 20 },
      { assetClass: "FX", percentage: 10 },
    ];
    const withCashPolicy = calculatePortfolio(inputWith(allocations, 1_000_005, "CASH_IF_MONEY_MARKET_ZERO"));
    const withDefaultPolicy = calculatePortfolio(inputWith(allocations, 1_000_005, "MONEY_MARKET"));
    // PPF %0 DEĞİLKEN iki politika birbirinden ayırt edilemez — tamamen aynı sonucu verir.
    expect(withCashPolicy.carriedToMoneyMarket.toNumber()).toBeGreaterThan(0);
    expect(withCashPolicy.carriedToMoneyMarket.toNumber()).toBe(withDefaultPolicy.carriedToMoneyMarket.toNumber());
    expect(withCashPolicy.moneyMarketLine!.actualAmount.toNumber()).toBe(
      withDefaultPolicy.moneyMarketLine!.actualAmount.toNumber(),
    );
    expect(withCashPolicy.cashBalance.toNumber()).toBe(withDefaultPolicy.cashBalance.toNumber());
  });

  it("5. Politika belirtilmezse (hazır profillerin gerçek çağrısı) PPF %0 olsa bile eski davranış (artık PPF'ye eklenir) sürer", () => {
    // roundingRemainderPolicy verilmiyor -> motorun varsayılanı "MONEY_MARKET".
    // Hazır profillerde bugün MM %0 olan bir profil yok, ama bu test motorun
    // varsayılanının GERİYE UYUMLU kaldığını (yeni davranışın yalnızca açıkça
    // "CASH_IF_MONEY_MARKET_ZERO" istendiğinde devreye girdiğini) kanıtlar.
    const result = calculatePortfolio(inputWith(ppfZeroAllocations, 1_000_005));
    expect(result.carriedToMoneyMarket.toNumber()).toBe(3);
    expect(result.moneyMarketLine!.actualAmount.toNumber()).toBeGreaterThan(0);
    expect(result.cashBalance.toNumber()).toBeLessThan(3);
  });

  it("6. PPF hedefi ve gerçekleşeni tam sıfırsa (tüm fon sınıfları %0) sonuçta PPF için taşınacak hiçbir tutar yoktur", () => {
    const allZero: PortfolioCalculationInput["allocations"] = [
      { assetClass: "DEPOSIT", percentage: 100 },
      { assetClass: "MONEY_MARKET", percentage: 0 },
      { assetClass: "BIST_EQUITY", percentage: 0 },
      { assetClass: "GOLD", percentage: 0 },
      { assetClass: "FX", percentage: 0 },
    ];
    const result = calculatePortfolio(inputWith(allZero, 1_000_000, "CASH_IF_MONEY_MARKET_ZERO"));
    expect(result.moneyMarketLine!.targetAmount.toNumber()).toBe(0);
    expect(result.moneyMarketLine!.actualAmount.toNumber()).toBe(0);
    expect(result.cashBalance.toNumber()).toBe(0);
    expect(result.isCashBalanceValid).toBe(true);
  });

  it("7. Döviz fonunda bir pay bile alınamayacak kadar küçük hedef tutar, PPF %0 iken TAMAMEN Cari Hesap'a gider", () => {
    const allocations: PortfolioCalculationInput["allocations"] = [
      { assetClass: "DEPOSIT", percentage: 96 },
      { assetClass: "MONEY_MARKET", percentage: 0 },
      { assetClass: "BIST_EQUITY", percentage: 0 },
      { assetClass: "GOLD", percentage: 0 },
      { assetClass: "FX", percentage: 4 },
    ];
    // hedef = 100 * %4 = 4 TL; FX fiyatı 5 TL -> tek pay bile alınamaz.
    const result = calculatePortfolio(inputWith(allocations, 100, "CASH_IF_MONEY_MARKET_ZERO"));
    const fx = result.fundLines.find((l) => l.assetClass === "FX")!;
    expect(fx.shareCount).toBe(0);
    expect(fx.actualAmount.toNumber()).toBe(0);
    expect(fx.remainder.toNumber()).toBe(4);
    expect(result.moneyMarketLine!.actualAmount.toNumber()).toBe(0);
    expect(result.cashBalance.toNumber()).toBe(4);
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
