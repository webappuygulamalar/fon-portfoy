import { describe, expect, it } from "vitest";
import { canSubstituteFund } from "./fundSubstitution";

describe("canSubstituteFund", () => {
  it("aynı varlık sınıfındaki fonlar arasında değişime izin verir", () => {
    expect(
      canSubstituteFund({ assetClass: "BIST_EQUITY" }, { assetClass: "BIST_EQUITY" }),
    ).toBe(true);
  });

  it("farklı varlık sınıfındaki fonlar arasında değişime izin vermez", () => {
    expect(canSubstituteFund({ assetClass: "GOLD" }, { assetClass: "FX" })).toBe(false);
    expect(
      canSubstituteFund({ assetClass: "MONEY_MARKET" }, { assetClass: "BIST_EQUITY" }),
    ).toBe(false);
  });
});
