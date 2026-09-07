import { describe, expect, it } from "vitest";
import { buildRiskProfileChartCategories } from "./riskProfileChartCategories";
import { DEFAULT_PROFILES } from "../calculation/defaultProfiles";
import type { AssetClass } from "../../lib/constants";

function allocationsOf(key: (typeof DEFAULT_PROFILES)[number]["key"]): Partial<Record<AssetClass, number>> {
  const profile = DEFAULT_PROFILES.find((p) => p.key === key)!;
  return Object.fromEntries(profile.allocations.map((a) => [a.assetClass, a.percentage]));
}

describe("buildRiskProfileChartCategories — Mevduat/PPF birleşimi", () => {
  it("Mevduat ve Para Piyasası Fonu yüzdelerini tek kategoride toplar", () => {
    // Düşük 1: DEPOSIT 85 + MONEY_MARKET 7 = 92
    const categories = buildRiskProfileChartCategories(allocationsOf("dusuk_1"));
    const merged = categories.find((c) => c.label === "Mevduat/Para Piyasası Fonu");
    expect(merged).toBeDefined();
    expect(merged!.percentage).toBe(92);
  });

  it("diğer sınıfları kısa, kullanıcı dostu adlarla ayrı ayrı listeler", () => {
    const categories = buildRiskProfileChartCategories(allocationsOf("orta"));
    const labels = categories.map((c) => c.label);
    expect(labels).toEqual(["Mevduat/Para Piyasası Fonu", "Hisse", "Altın", "USD/Döviz"]);
  });
});

describe("buildRiskProfileChartCategories — toplam ve sıra", () => {
  it.each(DEFAULT_PROFILES.map((p) => p.key))("%s profilinde kategori yüzdeleri toplamı 100'dür", (key) => {
    const categories = buildRiskProfileChartCategories(allocationsOf(key));
    const total = categories.reduce((sum, c) => sum + c.percentage, 0);
    expect(total).toBe(100);
  });

  it("kanonik sırayı korur: Mevduat/PPF, Hisse, Altın, USD/Döviz", () => {
    const categories = buildRiskProfileChartCategories(allocationsOf("yuksek"));
    expect(categories.map((c) => c.key)).toEqual(["DEPOSIT_MONEY_MARKET", "BIST_EQUITY", "GOLD", "FX"]);
  });

  it("yüzdesi 0 olan kategorileri listelemez", () => {
    const categories = buildRiskProfileChartCategories({ DEPOSIT: 100, MONEY_MARKET: 0, BIST_EQUITY: 0, GOLD: 0, FX: 0 });
    expect(categories).toEqual([
      { key: "DEPOSIT_MONEY_MARKET", label: "Mevduat/Para Piyasası Fonu", percentage: 100, color: "var(--color-mint)" },
    ]);
  });

  it("her kategori 0-100 aralığında tam sayı bir yüzde taşır", () => {
    for (const p of DEFAULT_PROFILES) {
      const categories = buildRiskProfileChartCategories(allocationsOf(p.key));
      for (const c of categories) {
        expect(Number.isInteger(c.percentage)).toBe(true);
        expect(c.percentage).toBeGreaterThan(0);
        expect(c.percentage).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("buildRiskProfileChartCategories — bilinmeyen/gelecekteki varlık sınıfı", () => {
  it("5 sabit sınıfın dışındaki bir anahtarı kaybetmez, alfabetik sona ekler", () => {
    const allocations = {
      DEPOSIT: 40,
      MONEY_MARKET: 10,
      BIST_EQUITY: 20,
      GOLD: 10,
      FX: 5,
      // Bugün ASSET_CLASSES'ta yok — ileride model şemasına eklenirse
      // diye kaybolmadığını doğrulamak için burada zorla eklendi.
      CRYPTO: 15,
    } as unknown as Partial<Record<AssetClass, number>>;

    const categories = buildRiskProfileChartCategories(allocations);
    const extra = categories.find((c) => c.key === "CRYPTO");
    expect(extra).toBeDefined();
    expect(extra!.percentage).toBe(15);
    expect(extra!.color).toBe("var(--color-text-faint)");
    // Bilinen kategorilerden SONRA gelir.
    expect(categories[categories.length - 1].key).toBe("CRYPTO");
  });
});
