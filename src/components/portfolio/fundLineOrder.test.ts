import { describe, expect, it } from "vitest";
import { toDecimal, ZERO } from "../../lib/decimal";
import { orderFundLinesForDisplay } from "./fundLineOrder";
import type { FundLineResult } from "../../domain/calculation/types";

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

  it("eşit yüzdeli fonlarda modeldeki mevcut (giriş) sırasını korur", () => {
    const gold = mkLine("GOLD", 5);
    const fx = mkLine("FX", 5);
    const bist = mkLine("BIST_EQUITY", 5);
    // fundLines modelden geldiği sırayla: BIST, GOLD, FX (SHARE_BASED_ASSET_CLASSES sırası)
    const ordered = orderFundLinesForDisplay([bist, gold, fx], null);
    expect(ordered.map((l) => l.assetClass)).toEqual(["BIST_EQUITY", "GOLD", "FX"]);
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
