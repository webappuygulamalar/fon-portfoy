// Bir fon için KAP arama/ayrıştırma sonucunu, `funds` tablosuna yazılacak
// KISMİ bir güncelleme nesnesine çevirir. SAF fonksiyon — ağ/DB bağımlılığı
// yok, bu yüzden Vitest'ten doğrudan test edilebilir.
//
// KRİTİK İLKE: Dönen nesne yalnızca EMİN OLDUĞUMUZ alanları içerir. Belirsiz/
// bulunamayan durumlarda `risk_value` (ve kardeş alanları) nesneye HİÇ
// eklenmez — çağıran taraf bunu `.update()` ile uygular, bu da yalnızca
// nesnede AÇIKÇA bulunan sütunları değiştirir. Böylece daha önce (ör.
// referans katalogdan) doğru şekilde yazılmış bir risk_value, KAP'ta
// bulunamama/belirsizlik durumunda ASLA null'a düşürülmez.
import type { RiskExtractionResult } from "./kapRiskParser.ts";

export interface FundForKapSync {
  id: string;
  code: string;
  management_company: string | null;
}

export type KapLookupOutcome =
  | { kind: "not_found" }
  | { kind: "ambiguous_search_match" }
  | { kind: "founder_mismatch"; kapFounderTitle: string | null }
  | { kind: "matched"; kapFundId: string; risk: RiskExtractionResult }
  | { kind: "error" };

export interface FundUpdatePayload {
  id: string;
  kap_fund_id?: string;
  kap_checked_at?: string;
  kap_lookup_status?: "matched" | "ambiguous_search_match" | "not_found" | "error";
  risk_verification_needed?: boolean;
  risk_verification_note?: string | null;
  risk_value?: number;
  risk_source?: string;
  risk_source_url?: string;
  risk_updated_at?: string;
  risk_verified?: boolean;
}

export function kapFundDetailUrl(oid: string): string {
  return `https://www.kap.org.tr/tr/fon-bilgileri/genel/${oid}`;
}

export function buildFundUpdate(
  fund: FundForKapSync,
  outcome: KapLookupOutcome,
  nowIso: string,
): FundUpdatePayload {
  if (outcome.kind === "error") {
    // kap_checked_at BİLİNÇLİ OLARAK ayarlanmaz: bir sonraki çalışma bu
    // fonu (kap_lookup_status='error' filtresiyle) yine de yeniden dener,
    // ama bu satırın "en son ne zaman denendiği" izlenebilir kalsın diye
    // durumu yine de kaydederiz.
    return { id: fund.id, kap_lookup_status: "error" };
  }

  if (outcome.kind === "not_found") {
    return { id: fund.id, kap_checked_at: nowIso, kap_lookup_status: "not_found" };
  }

  if (outcome.kind === "ambiguous_search_match") {
    return { id: fund.id, kap_checked_at: nowIso, kap_lookup_status: "ambiguous_search_match" };
  }

  if (outcome.kind === "founder_mismatch") {
    return {
      id: fund.id,
      kap_checked_at: nowIso,
      kap_lookup_status: "ambiguous_search_match",
      risk_verification_needed: true,
      risk_verification_note:
        `KAP'ta fon kodu (${fund.code}) eşleşti ama kurucu unvanı uyuşmadı ` +
        `(KAP: "${outcome.kapFounderTitle ?? "bilinmiyor"}", kayıtlı kurucu: "${fund.management_company ?? "bilinmiyor"}") ` +
        `— yanlış fon eşleştirmesi riski nedeniyle otomatik kaydedilmedi, manuel inceleme gerekir.`,
    };
  }

  // outcome.kind === "matched": doğru fon KAP'ta güvenle bulundu.
  const base: FundUpdatePayload = {
    id: fund.id,
    kap_fund_id: outcome.kapFundId,
    kap_checked_at: nowIso,
    kap_lookup_status: "matched",
  };

  const risk = outcome.risk;
  if (risk.status === "found" && risk.riskValue !== null) {
    return {
      ...base,
      risk_value: risk.riskValue,
      risk_source: risk.sourceDetail ?? "kap",
      risk_source_url: kapFundDetailUrl(outcome.kapFundId),
      risk_updated_at: nowIso,
      risk_verified: true,
      risk_verification_needed: false,
      risk_verification_note: null,
    };
  }

  if (risk.status === "ambiguous") {
    return {
      ...base,
      risk_verification_needed: true,
      risk_verification_note: risk.note,
    };
  }

  // risk.status === "no_risk_field": fon KAP'ta bulundu ama risk verisi
  // hiç yayınlanmamış. risk_value alanına DOKUNULMAZ — daha önce başka bir
  // kaynaktan (ör. referans katalog) gelmiş olabilecek bir değeri SİLMEZ.
  return base;
}
