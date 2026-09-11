import { describe, expect, it } from "vitest";
import { resolveFundCurrency, shouldTrustTefasPrice } from "./shareClassOverride.ts";
import type { ShareClassOverride } from "./types.ts";

const CKS_OVERRIDE: ShareClassOverride = {
  fundCode: "CKS",
  shareClassLabel: "B Grubu",
  nativeCurrency: "USD",
  tefasPriceIsNative: false,
  priceFetchSource: "isportfoy_resmi_sayfa",
  priceFetchUrl: "https://www.isportfoy.com.tr/is-portfoy-birinci-katilim-serbest-doviz-fon-usd",
};

describe("resolveFundCurrency", () => {
  it("override yoksa sınıflandırmadan gelen currency/currency_source'u olduğu gibi döner", () => {
    const result = resolveFundCurrency({ currency: "TRY", currencySource: "tefas_default_try" }, undefined);
    expect(result).toEqual({ currency: "TRY", currencySource: "tefas_default_try" });
  });

  it("CKS için B Grubu/USD eşleştirmesi: override varsa referans katalog/başlık sezgisinin ÖNÜNE geçer", () => {
    const result = resolveFundCurrency({ currency: "USD", currencySource: "reference_catalog" }, CKS_OVERRIDE);
    expect(result.currency).toBe("USD");
    expect(result.currencySource).toBe("share_class_override:B Grubu");
  });

  it("sınıflandırma yanlış bir currency önerse bile (ör. TRY) override kazanır", () => {
    // Bu, tefas-sync'in her çalıştırmada (referans katalog/başlık sezgisi ne
    // derse desin) doğrulanmış değeri zorla uyguladığını kanıtlar — "skip if
    // already set" değil, "her zaman yeniden uygula" deseni.
    const result = resolveFundCurrency({ currency: "TRY", currencySource: "tefas_default_try" }, CKS_OVERRIDE);
    expect(result.currency).toBe("USD");
  });
});

describe("shouldTrustTefasPrice", () => {
  it("override yoksa true döner (TEFAS'ın ham fiyatı normal şekilde kullanılır)", () => {
    expect(shouldTrustTefasPrice(undefined)).toBe(true);
  });

  it("override var ama tefasPriceIsNative=true ise true döner", () => {
    expect(shouldTrustTefasPrice({ ...CKS_OVERRIDE, tefasPriceIsNative: true })).toBe(true);
  });

  it("CKS override'ı (tefasPriceIsNative=false) için false döner — A Grubu TL fiyatı asla USD diye kullanılmaz", () => {
    expect(shouldTrustTefasPrice(CKS_OVERRIDE)).toBe(false);
  });
});
