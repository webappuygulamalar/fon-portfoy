import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILES } from "./defaultProfiles";
import { validateAllocations } from "./validateAllocations";

describe("DEFAULT_PROFILES", () => {
  it.each(DEFAULT_PROFILES.map((p) => [p.name, p] as const))(
    "%s dağılımı tam sayı yüzdelerle %%100 eder",
    (_name, profile) => {
      const result = validateAllocations(profile.allocations);
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
      expect(result.sum).toBe(100);
      for (const a of profile.allocations) {
        expect(Number.isInteger(a.percentage)).toBe(true);
      }
    },
  );

  it("Düşük 1 ve Düşük 2 aynı varlık sınıflarını kullanır", () => {
    const d1 = DEFAULT_PROFILES.find((p) => p.key === "dusuk_1")!;
    const d2 = DEFAULT_PROFILES.find((p) => p.key === "dusuk_2")!;
    const classes1 = d1.allocations.map((a) => a.assetClass).sort();
    const classes2 = d2.allocations.map((a) => a.assetClass).sort();
    expect(classes2).toEqual(classes1);
  });

  it("hiçbir profilde yabancı hisse sınıfı yoktur (AssetClass tipinde tanımlı değil)", () => {
    const allowed = new Set([
      "DEPOSIT",
      "MONEY_MARKET",
      "BIST_EQUITY",
      "GOLD",
      "FX",
    ]);
    for (const p of DEFAULT_PROFILES) {
      for (const a of p.allocations) {
        expect(allowed.has(a.assetClass)).toBe(true);
      }
    }
  });
});
