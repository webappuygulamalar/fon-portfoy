import { describe, expect, it } from "vitest";
import { buildFundUpdate, type FundForKapSync } from "./decideFundUpdate.ts";

const FUND: FundForKapSync = { id: "fund-1", code: "BKY", management_company: "Yapı Kredi Portföy" };
const NOW = "2026-09-06T12:00:00.000Z";

describe("buildFundUpdate — null-üzerine-yazma koruması", () => {
  it("not_found durumunda risk_value alanına HİÇ dokunmaz (mevcut değer korunur)", () => {
    const payload = buildFundUpdate(FUND, { kind: "not_found" }, NOW);
    expect(payload).not.toHaveProperty("risk_value");
    expect(payload).not.toHaveProperty("risk_source");
    expect(payload.kap_lookup_status).toBe("not_found");
    expect(payload.kap_checked_at).toBe(NOW);
  });

  it("ambiguous_search_match durumunda risk_value alanına dokunmaz", () => {
    const payload = buildFundUpdate(FUND, { kind: "ambiguous_search_match" }, NOW);
    expect(payload).not.toHaveProperty("risk_value");
    expect(payload.kap_lookup_status).toBe("ambiguous_search_match");
  });

  it("founder_mismatch durumunda risk_value'ya dokunmaz ama inceleme bayrağını kaldırır ve nedenini yazar", () => {
    const payload = buildFundUpdate(FUND, { kind: "founder_mismatch", kapFounderTitle: "GARANTİ PORTFÖY A.Ş." }, NOW);
    expect(payload).not.toHaveProperty("risk_value");
    expect(payload.risk_verification_needed).toBe(true);
    expect(payload.risk_verification_note).toMatch(/kurucu unvanı uyuşmadı/);
    expect(payload.risk_verification_note).toMatch(/GARANTİ PORTFÖY/);
  });

  it("fon KAP'ta bulundu ama risk verisi hiç yoksa (no_risk_field) risk_value'ya dokunmaz, yalnızca eşleşme bilgisini kaydeder", () => {
    const payload = buildFundUpdate(
      FUND,
      { kind: "matched", kapFundId: "OID-1", risk: { status: "no_risk_field", riskValue: null, sourceDetail: null, note: null } },
      NOW,
    );
    expect(payload).not.toHaveProperty("risk_value");
    expect(payload.kap_fund_id).toBe("OID-1");
    expect(payload.kap_lookup_status).toBe("matched");
  });

  it("risk belirsizse (ambiguous) risk_value'ya dokunmaz, yalnızca inceleme notunu kaydeder", () => {
    const payload = buildFundUpdate(
      FUND,
      { kind: "matched", kapFundId: "OID-1", risk: { status: "ambiguous", riskValue: null, sourceDetail: null, note: "çelişkili veri" } },
      NOW,
    );
    expect(payload).not.toHaveProperty("risk_value");
    expect(payload.risk_verification_needed).toBe(true);
    expect(payload.risk_verification_note).toBe("çelişkili veri");
  });

  it("error durumunda kap_checked_at'e BİLE dokunmaz (bir sonraki çalışma yeniden dener)", () => {
    const payload = buildFundUpdate(FUND, { kind: "error" }, NOW);
    expect(payload).not.toHaveProperty("kap_checked_at");
    expect(payload).not.toHaveProperty("risk_value");
    expect(payload.kap_lookup_status).toBe("error");
  });

  it("risk güvenle bulunduğunda TÜM risk alanlarını doğru şekilde yazar", () => {
    const payload = buildFundUpdate(
      FUND,
      { kind: "matched", kapFundId: "OID-1", risk: { status: "found", riskValue: 3, sourceDetail: "kap_currency_group_usd", note: null } },
      NOW,
    );
    expect(payload.risk_value).toBe(3);
    expect(payload.risk_source).toBe("kap_currency_group_usd");
    expect(payload.risk_source_url).toBe("https://www.kap.org.tr/tr/fon-bilgileri/genel/OID-1");
    expect(payload.risk_verified).toBe(true);
    expect(payload.risk_updated_at).toBe(NOW);
    expect(payload.risk_verification_needed).toBe(false);
    expect(payload.risk_verification_note).toBeNull();
  });
});

describe("buildFundUpdate — idempotency", () => {
  it("aynı girdiyle her zaman aynı çıktıyı üretir", () => {
    const outcome = { kind: "matched", kapFundId: "OID-1", risk: { status: "found", riskValue: 6, sourceDetail: "kap_single_value", note: null } } as const;
    const p1 = buildFundUpdate(FUND, outcome, NOW);
    const p2 = buildFundUpdate(FUND, outcome, NOW);
    expect(p1).toEqual(p2);
  });

  it("bir fonu iki kez arka arkaya 'matched + found' ile işlemek aynı sonucu verir (tekrar çalıştırma güvenli)", () => {
    const outcome = { kind: "matched", kapFundId: "OID-1", risk: { status: "found", riskValue: 6, sourceDetail: "kap_single_value", note: null } } as const;
    const first = buildFundUpdate(FUND, outcome, NOW);
    const second = buildFundUpdate(FUND, outcome, "2026-09-07T12:00:00.000Z");
    expect(second.risk_value).toBe(first.risk_value);
    expect(second.kap_fund_id).toBe(first.kap_fund_id);
  });
});
