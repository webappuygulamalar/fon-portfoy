import { describe, expect, it } from "vitest";
import { canSubstituteFund } from "./fundSubstitution";

describe("canSubstituteFund", () => {
  it("aynı varlık sınıfında, aktif ve uygun işaretli fona izin verir", () => {
    expect(
      canSubstituteFund("BIST_EQUITY", {
        assetClass: "BIST_EQUITY",
        isActive: true,
        isSubstitutionEligible: true,
      }),
    ).toBe(true);
  });

  it("farklı varlık sınıfındaki fona izin vermez", () => {
    expect(
      canSubstituteFund("GOLD", { assetClass: "FX", isActive: true, isSubstitutionEligible: true }),
    ).toBe(false);
  });

  it("model dışı (asset_class=null) fona izin vermez", () => {
    expect(
      canSubstituteFund("MONEY_MARKET", {
        assetClass: null,
        isActive: true,
        isSubstitutionEligible: true,
      }),
    ).toBe(false);
  });

  it("is_substitution_eligible=false ise (belirsiz sınıflandırma) izin vermez", () => {
    expect(
      canSubstituteFund("BIST_EQUITY", {
        assetClass: "BIST_EQUITY",
        isActive: true,
        isSubstitutionEligible: false,
      }),
    ).toBe(false);
  });

  it("pasif fona izin vermez", () => {
    expect(
      canSubstituteFund("GOLD", { assetClass: "GOLD", isActive: false, isSubstitutionEligible: true }),
    ).toBe(false);
  });
});
