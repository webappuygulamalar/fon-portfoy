import { describe, expect, it } from "vitest";
import { isFundEligibleForListing } from "./fundListingEligibility";

const YAT = "Yatırım Fonu";
const BYF = "Borsa Yatırım Fonu";

describe("isFundEligibleForListing", () => {
  it("risk değeri null ise uygun DEĞİLDİR (yatırımcı sayısı ne olursa olsun)", () => {
    expect(isFundEligibleForListing({ riskValue: null, investorCount: 1000, fundType: YAT })).toBe(false);
    expect(isFundEligibleForListing({ riskValue: null, investorCount: null, fundType: YAT })).toBe(false);
  });

  it("yatırımcı sayısı 49 (50'nin altı) ise uygun DEĞİLDİR", () => {
    expect(isFundEligibleForListing({ riskValue: 4, investorCount: 49, fundType: YAT })).toBe(false);
  });

  it("yatırımcı sayısı tam 50 ise uygundur (sınır dahil, altı değil)", () => {
    expect(isFundEligibleForListing({ riskValue: 4, investorCount: 50, fundType: YAT })).toBe(true);
  });

  it("yatırımcı sayısı 51 ise uygundur", () => {
    expect(isFundEligibleForListing({ riskValue: 4, investorCount: 51, fundType: YAT })).toBe(true);
  });

  it("yatırımcı sayısı null (bilinmiyor) ise TAHMİN EDİLMEZ — risk değeri varsa uygun kalır", () => {
    expect(isFundEligibleForListing({ riskValue: 4, investorCount: null, fundType: YAT })).toBe(true);
  });

  it("hem risk değeri hem yatırımcı sayısı geçerliyse uygundur", () => {
    expect(isFundEligibleForListing({ riskValue: 1, investorCount: 100000, fundType: YAT })).toBe(true);
    expect(isFundEligibleForListing({ riskValue: 7, investorCount: 50, fundType: YAT })).toBe(true);
  });

  it("yatırımcı sayısı 0 ise (bilinen ve 50'nin altında) uygun DEĞİLDİR", () => {
    expect(isFundEligibleForListing({ riskValue: 4, investorCount: 0, fundType: YAT })).toBe(false);
  });

  it("fundType null iken de normal (Yatırım Fonu gibi) 50 kuralı uygulanır", () => {
    expect(isFundEligibleForListing({ riskValue: 4, investorCount: 10, fundType: null })).toBe(false);
  });

  describe("Borsa Yatırım Fonu (BYF) istisnası — TEFAS bu tip için yatırımcı sayısını anlamlı doldurmuyor", () => {
    it("BYF'de yatırımcı sayısı 0 olsa bile risk değeri varsa uygundur (ZKP/ZGD gerçek verisi)", () => {
      expect(isFundEligibleForListing({ riskValue: 6, investorCount: 0, fundType: BYF })).toBe(true);
    });

    it("BYF'de yatırımcı sayısı null olsa bile risk değeri varsa uygundur", () => {
      expect(isFundEligibleForListing({ riskValue: 6, investorCount: null, fundType: BYF })).toBe(true);
    });

    it("BYF'de de risk değeri null ise yine uygun DEĞİLDİR (yalnızca yatırımcı kuralından muaf, risk kuralından değil)", () => {
      expect(isFundEligibleForListing({ riskValue: null, investorCount: 1000, fundType: BYF })).toBe(false);
    });

    it("BYF'de yatırımcı sayısı zaten 50+ ise (varsayımsal) normal şekilde uygundur", () => {
      expect(isFundEligibleForListing({ riskValue: 6, investorCount: 100, fundType: BYF })).toBe(true);
    });
  });
});
