import { describe, expect, it } from "vitest";
import { buildCalculationInput, resolveFundSelections } from "./buildInput";
import type { ProfileModel } from "../model/publishedModel";
import type { FundPriceRow, FundRow, FxRateRow } from "../../services/types";

const profile: ProfileModel = {
  profileId: "p1",
  key: "dusuk_2",
  name: "Düşük 2",
  description: "",
  sortOrder: 2,
  allocations: { DEPOSIT: 80, MONEY_MARKET: 9, BIST_EQUITY: 4, GOLD: 4, FX: 3 },
  preferredFundIdByAssetClass: {
    MONEY_MARKET: "fund-pkt",
    BIST_EQUITY: "fund-zkp",
    GOLD: "fund-zgd",
    FX: "fund-bky",
  },
};

const fundsById: Record<string, FundRow> = {
  "fund-pkt": mkFund("fund-pkt", "PKT", "MONEY_MARKET", "TRY"),
  "fund-zkp": mkFund("fund-zkp", "ZKP", "BIST_EQUITY", "TRY"),
  "fund-zgd": mkFund("fund-zgd", "ZGD", "GOLD", "TRY"),
  "fund-bky": mkFund("fund-bky", "BKY", "FX", "USD"),
  "fund-alt-bist": mkFund("fund-alt-bist", "ALTBIST", "BIST_EQUITY", "TRY"),
};

function mkFund(id: string, code: string, assetClass: FundRow["asset_class"], currency: string): FundRow {
  return {
    id,
    code,
    name: code,
    management_company: "Test",
    asset_class: assetClass,
    fund_type: null,
    currency,
    tefas_fetch_code: code,
    is_active: true,
    verification_needed: false,
    verification_note: null,
    is_participation_fund: true,
    catalog_category: null,
    is_substitution_eligible: true,
    risk_value: null,
    risk_source: null,
    risk_updated_at: null,
    currency_source: "tefas_default_try",
    risk_source_url: null,
    risk_verified: false,
    kap_fund_id: null,
    kap_checked_at: null,
    kap_lookup_status: null,
    risk_verification_needed: false,
    risk_verification_note: null,
  };
}

function mkPrice(fundId: string, price: string, currency = "TRY"): FundPriceRow {
  return {
    id: `price-${fundId}`,
    fund_id: fundId,
    price_date: "2026-09-04",
    currency,
    price,
    fund_size: null,
    investor_count: null,
    source: "TEFAS",
    note: null,
    fetched_at: "2026-09-05T04:30:00Z",
  };
}

describe("resolveFundSelections", () => {
  it("override yoksa standart (preferred) fonu seçer", () => {
    const prices: Record<string, FundPriceRow> = {
      "fund-zkp": mkPrice("fund-zkp", "7"),
    };
    const selections = resolveFundSelections(profile, fundsById, prices, {});
    const bist = selections.find((s) => s.assetClass === "BIST_EQUITY")!;
    expect(bist.fundId).toBe("fund-zkp");
    expect(bist.isOverride).toBe(false);
  });

  it("override varsa onu kullanır ve isOverride=true olur", () => {
    const selections = resolveFundSelections(profile, fundsById, {}, { BIST_EQUITY: "fund-alt-bist" });
    const bist = selections.find((s) => s.assetClass === "BIST_EQUITY")!;
    expect(bist.fundId).toBe("fund-alt-bist");
    expect(bist.isOverride).toBe(true);
  });
});

describe("buildCalculationInput", () => {
  it("fiyatı olmayan fonu fundPrices'a eklemez (motor bunu MISSING_PRICE olarak görecek)", () => {
    const prices: Record<string, FundPriceRow> = {
      "fund-zkp": mkPrice("fund-zkp", "7"),
      // GOLD, FX, MONEY_MARKET fiyatı yok
    };
    const input = buildCalculationInput(1000, profile, fundsById, prices, {}, {});
    expect(input.fundPrices.BIST_EQUITY).toBeDefined();
    expect(input.fundPrices.GOLD).toBeUndefined();
  });

  it("döviz cinsinden fiyatlanan fon için gerekli kuru fxRates'e ekler", () => {
    const prices: Record<string, FundPriceRow> = {
      "fund-bky": mkPrice("fund-bky", "1.5", "USD"),
    };
    const fxRatesByCurrency: Record<string, FxRateRow> = {
      USD: {
        id: "fx1",
        currency: "USD",
        rate_to_try: "34.10",
        rate_date: "2026-09-04",
        source: "TCMB",
        fetched_at: "2026-09-05T04:00:00Z",
      },
    };
    const input = buildCalculationInput(1000, profile, fundsById, prices, {}, fxRatesByCurrency);
    expect(input.fundPrices.FX?.currency).toBe("USD");
    expect(input.fxRates).toHaveLength(1);
    expect(input.fxRates?.[0].source).toBe("TCMB");
  });
});
