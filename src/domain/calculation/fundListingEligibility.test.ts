import { describe, expect, it } from "vitest";
import { isFundEligibleForListing, LARGE_FUND_SIZE_THRESHOLD_TRY } from "./fundListingEligibility";

const YAT = "Yatırım Fonu";
const BYF = "Borsa Yatırım Fonu";

describe("isFundEligibleForListing", () => {
  it("risk değeri null ise uygun DEĞİLDİR (yatırımcı sayısı/büyüklük ne olursa olsun)", () => {
    expect(isFundEligibleForListing({ riskValue: null, investorCount: 1000, fundType: YAT, fundSize: null })).toBe(
      false,
    );
    expect(isFundEligibleForListing({ riskValue: null, investorCount: null, fundType: YAT, fundSize: null })).toBe(
      false,
    );
  });

  it("risk değeri null ise fon büyüklüğü 10 milyar TL olsa dahi uygun DEĞİLDİR", () => {
    expect(
      isFundEligibleForListing({ riskValue: null, investorCount: null, fundType: YAT, fundSize: 10_000_000_000 }),
    ).toBe(false);
  });

  it("yatırımcı sayısı 49 (50'nin altı) ve büyüklük eşiğin altındaysa uygun DEĞİLDİR", () => {
    expect(isFundEligibleForListing({ riskValue: 4, investorCount: 49, fundType: YAT, fundSize: null })).toBe(false);
    expect(
      isFundEligibleForListing({ riskValue: 4, investorCount: 49, fundType: YAT, fundSize: 999_999_999 }),
    ).toBe(false);
  });

  it("yatırımcı sayısı tam 50 ise uygundur (sınır dahil, altı değil)", () => {
    expect(isFundEligibleForListing({ riskValue: 4, investorCount: 50, fundType: YAT, fundSize: null })).toBe(true);
  });

  it("yatırımcı sayısı 51 ise uygundur", () => {
    expect(isFundEligibleForListing({ riskValue: 4, investorCount: 51, fundType: YAT, fundSize: null })).toBe(true);
  });

  it("yatırımcı sayısı null (bilinmiyor) ise TAHMİN EDİLMEZ — risk değeri varsa uygun kalır", () => {
    expect(isFundEligibleForListing({ riskValue: 4, investorCount: null, fundType: YAT, fundSize: null })).toBe(
      true,
    );
  });

  it("hem risk değeri hem yatırımcı sayısı geçerliyse uygundur", () => {
    expect(
      isFundEligibleForListing({ riskValue: 1, investorCount: 100000, fundType: YAT, fundSize: null }),
    ).toBe(true);
    expect(isFundEligibleForListing({ riskValue: 7, investorCount: 50, fundType: YAT, fundSize: null })).toBe(
      true,
    );
  });

  it("yatırımcı sayısı 0 ise (bilinen ve 50'nin altında) ve büyüklük eşiğin altındaysa uygun DEĞİLDİR", () => {
    expect(isFundEligibleForListing({ riskValue: 4, investorCount: 0, fundType: YAT, fundSize: null })).toBe(
      false,
    );
  });

  it("fundType null iken de normal (Yatırım Fonu gibi) 50 kuralı uygulanır", () => {
    expect(isFundEligibleForListing({ riskValue: 4, investorCount: 10, fundType: null, fundSize: null })).toBe(
      false,
    );
  });

  describe("büyük fon istisnası — yatırımcı sayısı 50'nin altında olsa bile fon büyükse gösterilir", () => {
    it("risk mevcut + yatırımcı 49 + büyüklük tam 1.000.000.000 TL → uygundur (sınır dahil)", () => {
      expect(
        isFundEligibleForListing({
          riskValue: 4,
          investorCount: 49,
          fundType: YAT,
          fundSize: LARGE_FUND_SIZE_THRESHOLD_TRY,
        }),
      ).toBe(true);
    });

    it("risk mevcut + yatırımcı 49 + büyüklük 1 milyarın üzerinde → uygundur", () => {
      expect(
        isFundEligibleForListing({ riskValue: 4, investorCount: 49, fundType: YAT, fundSize: 5_855_446_639.71 }),
      ).toBe(true);
    });

    it("büyüklük 999.999.999 TL (eşiğin 1 TL altı) → uygun DEĞİLDİR", () => {
      expect(
        isFundEligibleForListing({ riskValue: 4, investorCount: 49, fundType: YAT, fundSize: 999_999_999 }),
      ).toBe(false);
    });

    it("fund_size null ise büyük fon istisnası UYGULANMAZ", () => {
      expect(isFundEligibleForListing({ riskValue: 4, investorCount: 49, fundType: YAT, fundSize: null })).toBe(
        false,
      );
    });

    it("yatırımcı sayısı zaten 50+ ise büyüklük bilgisine gerek kalmadan uygundur", () => {
      expect(isFundEligibleForListing({ riskValue: 4, investorCount: 50, fundType: YAT, fundSize: null })).toBe(
        true,
      );
    });
  });

  describe("Borsa Yatırım Fonu (BYF) istisnası — TEFAS bu tip için yatırımcı sayısını anlamlı doldurmuyor", () => {
    it("BYF'de yatırımcı sayısı 0 olsa bile risk değeri varsa uygundur (ZKP/ZGD gerçek verisi)", () => {
      expect(isFundEligibleForListing({ riskValue: 6, investorCount: 0, fundType: BYF, fundSize: null })).toBe(
        true,
      );
    });

    it("BYF'de yatırımcı sayısı null olsa bile risk değeri varsa uygundur", () => {
      expect(isFundEligibleForListing({ riskValue: 6, investorCount: null, fundType: BYF, fundSize: null })).toBe(
        true,
      );
    });

    it("BYF'de de risk değeri null ise yine uygun DEĞİLDİR (yalnızca yatırımcı kuralından muaf, risk kuralından değil)", () => {
      expect(isFundEligibleForListing({ riskValue: null, investorCount: 1000, fundType: BYF, fundSize: null })).toBe(
        false,
      );
    });

    it("BYF'de yatırımcı sayısı zaten 50+ ise (varsayımsal) normal şekilde uygundur", () => {
      expect(isFundEligibleForListing({ riskValue: 6, investorCount: 100, fundType: BYF, fundSize: null })).toBe(
        true,
      );
    });

    it("BYF'de yatırımcı sayısı 0 VE büyüklük de null ise (ikisi de bilinmiyor gibi davranılır) yine uygundur", () => {
      expect(isFundEligibleForListing({ riskValue: 6, investorCount: 0, fundType: BYF, fundSize: null })).toBe(
        true,
      );
    });
  });

  describe("CKS (İş Portföy Birinci Katılım Serbest Döviz Fon) — canlı senaryo regresyonu", () => {
    it("risk doğrulanmadan önceki durum (risk null, büyüklük ~5.9 milyar) uygun DEĞİLDİR", () => {
      expect(
        isFundEligibleForListing({ riskValue: null, investorCount: 2385, fundType: YAT, fundSize: 5_855_446_639.71 }),
      ).toBe(false);
    });

    it("risk doğrulandıktan sonra (risk 3, yatırımcı 2385) uygundur", () => {
      expect(
        isFundEligibleForListing({ riskValue: 3, investorCount: 2385, fundType: YAT, fundSize: 5_855_446_639.71 }),
      ).toBe(true);
    });
  });
});
