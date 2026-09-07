import { describe, expect, it } from "vitest";
import { toDecimal, ZERO } from "../../lib/decimal";
import { orderFundLinesForDisplay, orderFundSelectionsForDisplay } from "./fundLineOrder";
import type { FundLineResult } from "../../domain/calculation/types";
import type { ResolvedFundSelection } from "../../domain/calculation/buildInput";
import type { ProfileModel } from "../../domain/model/publishedModel";

function mkLine(assetClass: FundLineResult["assetClass"], percentage: number): FundLineResult {
  return {
    assetClass,
    fundId: `fund-${assetClass}`,
    fundCode: assetClass,
    percentage,
    targetAmount: ZERO,
    unitPriceTRY: toDecimal(1),
    originalPrice: toDecimal(1),
    originalCurrency: "TRY",
    priceDate: "2026-09-04",
    fetchedAt: "2026-09-05T04:30:00Z",
    isStalePrice: false,
    shareCount: 0,
    actualAmount: ZERO,
    remainder: ZERO,
  };
}

describe("orderFundLinesForDisplay", () => {
  it("Düşük 2 örneği: PPF önde, kalanlar yüzdeye göre büyükten küçüğe", () => {
    // Model sırası (SHARE_BASED_ASSET_CLASSES): BIST, GOLD, FX
    const bist = mkLine("BIST_EQUITY", 4);
    const gold = mkLine("GOLD", 4);
    const fx = mkLine("FX", 3);
    const ppf = mkLine("MONEY_MARKET", 9);

    const ordered = orderFundLinesForDisplay([bist, gold, fx], ppf);

    expect(ordered.map((l) => l.assetClass)).toEqual(["MONEY_MARKET", "BIST_EQUITY", "GOLD", "FX"]);
  });

  it("eşit yüzdeli fonlarda fon koduna göre A-Z sıralar", () => {
    const gold = mkLine("GOLD", 5);
    const fx = mkLine("FX", 5);
    const bist = mkLine("BIST_EQUITY", 5);
    // mkLine, fundCode'u assetClass ile aynı yapar: "BIST_EQUITY" < "FX" < "GOLD".
    const ordered = orderFundLinesForDisplay([bist, gold, fx], null);
    expect(ordered.map((l) => l.assetClass)).toEqual(["BIST_EQUITY", "FX", "GOLD"]);
  });

  it("eşit yüzdede giriş sırası ters olsa da kod A-Z sırasını uygular", () => {
    const gold = mkLine("GOLD", 5);
    const fx = mkLine("FX", 5);
    // Giriş sırası FX, GOLD — ama kod A-Z'ye göre FX yine önde kalmalı.
    const ordered = orderFundLinesForDisplay([gold, fx], null);
    expect(ordered.map((l) => l.assetClass)).toEqual(["FX", "GOLD"]);
  });

  it("her çağrıda aynı sonucu üretir (kararlı/deterministik)", () => {
    const lines = [mkLine("FX", 10), mkLine("BIST_EQUITY", 65), mkLine("GOLD", 10)];
    const ppf = mkLine("MONEY_MARKET", 5);
    const first = orderFundLinesForDisplay(lines, ppf).map((l) => l.assetClass);
    const second = orderFundLinesForDisplay(lines, ppf).map((l) => l.assetClass);
    expect(second).toEqual(first);
    expect(first).toEqual(["MONEY_MARKET", "BIST_EQUITY", "FX", "GOLD"]);
  });

  it("PPF yoksa (null) yalnızca kalan fonları sıralı döner", () => {
    const ordered = orderFundLinesForDisplay([mkLine("FX", 1), mkLine("BIST_EQUITY", 9)], null);
    expect(ordered.map((l) => l.assetClass)).toEqual(["BIST_EQUITY", "FX"]);
  });
});

function mkSelection(assetClass: ResolvedFundSelection["assetClass"], code: string | null): ResolvedFundSelection {
  return {
    assetClass,
    fundId: code ? `fund-${code}` : null,
    fund: code ? ({ code } as ResolvedFundSelection["fund"]) : null,
    price: null,
    isOverride: false,
  };
}

function mkProfile(allocations: ProfileModel["allocations"]): ProfileModel {
  return {
    profileId: "p1",
    key: "test",
    name: "Test",
    description: "",
    sortOrder: 1,
    allocations,
    preferredFundIdByAssetClass: {},
  };
}

describe("orderFundSelectionsForDisplay", () => {
  it("PPF önde, kalanlar profildeki model yüzdesine göre büyükten küçüğe", () => {
    const profile = mkProfile({ MONEY_MARKET: 9, BIST_EQUITY: 4, GOLD: 4, FX: 3 });
    const selections = [
      mkSelection("BIST_EQUITY", "BKY"),
      mkSelection("GOLD", "ZGD"),
      mkSelection("FX", "ZDK"),
      mkSelection("MONEY_MARKET", "PKT"),
    ];
    const ordered = orderFundSelectionsForDisplay(selections, profile);
    // BIST_EQUITY(4) ve GOLD(4) eşit — kod A-Z: BKY < ZGD.
    expect(ordered.map((s) => s.assetClass)).toEqual(["MONEY_MARKET", "BIST_EQUITY", "GOLD", "FX"]);
  });

  it("eşit yüzdede seçili fonun koduna göre A-Z sıralar", () => {
    const profile = mkProfile({ BIST_EQUITY: 5, GOLD: 5, FX: 5 });
    const selections = [mkSelection("GOLD", "ZGD"), mkSelection("FX", "AAA"), mkSelection("BIST_EQUITY", "MMM")];
    const ordered = orderFundSelectionsForDisplay(selections, profile);
    expect(ordered.map((s) => s.fund?.code)).toEqual(["AAA", "MMM", "ZGD"]);
  });

  it("fon seçilmemişse (fund null) o satır kod sıralamasında en sona düşer", () => {
    const profile = mkProfile({ BIST_EQUITY: 5, GOLD: 5 });
    const selections = [mkSelection("BIST_EQUITY", null), mkSelection("GOLD", "AAA")];
    const ordered = orderFundSelectionsForDisplay(selections, profile);
    expect(ordered.map((s) => s.assetClass)).toEqual(["GOLD", "BIST_EQUITY"]);
  });

  it("MONEY_MARKET seçimi yoksa yalnızca kalanları sıralı döner", () => {
    const profile = mkProfile({ BIST_EQUITY: 9, FX: 1 });
    const selections = [mkSelection("FX", "ZDK"), mkSelection("BIST_EQUITY", "BKY")];
    const ordered = orderFundSelectionsForDisplay(selections, profile);
    expect(ordered.map((s) => s.assetClass)).toEqual(["BIST_EQUITY", "FX"]);
  });
});
