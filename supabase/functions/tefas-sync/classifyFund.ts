// Bir katılım fonunun hangi MODEL varlık sınıfına (varsa) girdiğini
// belirler. Uygulamanın model portföyü kesinlikle sabit 5 sınıfa
// dayanır (bkz. asset_class enum) — bu dosya yalnızca bir fonun bu 4
// (mevduat hariç) sınıftan birine mi girdiğini, yoksa "model dışı" mı
// olduğunu belirler. Model dışı fonlar katalogda görünür ama fon
// değişiminde seçilemez.
//
// Öncelik sırası: önce bilinen fon kodları için `referenceCatalog.ts`'teki
// bağımsız referans taraması kontrol edilir (varsa doğrudan güvenilir kabul
// edilir). Bilinmeyen/yeni fonlar için TEFAS başlığına dayalı sezgisel
// kurallar uygulanır. Yabancı hisse fonlarının BIST Katılım Hisse sınıfına
// kesinlikle girmemesi için açık bir dışlama listesi kullanılır — bu, tek
// bir "HİSSE" kelimesine güvenmekten daha güvenlidir.
import { REFERENCE_CATALOG } from "./referenceCatalog.ts";

export type ModelAssetClass = "MONEY_MARKET" | "BIST_EQUITY" | "GOLD" | "FX" | null;
export type FundCurrency = "TRY" | "USD" | "EUR";

export interface FundClassification {
  modelAssetClass: ModelAssetClass;
  catalogCategory: string;
  needsVerification: boolean;
  verificationNote: string | null;
  currency: FundCurrency;
  currencySource: string;
  riskValue: number | null;
  riskSource: string | null;
}

const FOREIGN_MARKET_KEYWORDS =
  /YABANCI|ULUSLARARASI|GLOBAL|DÜNYA\b|BRIC|AVRASYA|GELİŞEN ÜLKELER|GELİŞMEKTE OLAN|AMERİKA(?!N DOLARI)|AVRUPA\b|ASYA\b|AVUSTRALYA|\bÇİN\b|HİNDİSTAN|JAPON/;

/**
 * Bir fonun işlem para birimini başlığından belirler. 198 fonluk bağımsız
 * bir referans taramasında (referenceCatalog.ts'teki not) başlığında
 * "DÖVİZ" geçen fonların TAMAMI (istisnasız) USD veya EUR olarak
 * doğrulanmıştır, TL olan YOKTUR — bu bir tahmin değil, TEFAS/CMB'nin
 * katılım fonu unvanlandırma kuralına dayalı, 198 örnekte %100 doğrulanmış
 * bir kuraldır. "AVRO"/"EURO" geçenler EUR, geçmeyenler USD'dir (yine aynı
 * örneklemde istisnasız doğrulanmıştır).
 */
export function detectCurrencyFromTitle(fonUnvan: string): { currency: FundCurrency; source: string } {
  const title = fonUnvan.toLocaleUpperCase("tr-TR");
  if (/DÖVİZ/.test(title)) {
    if (/AVRO|EURO/.test(title)) return { currency: "EUR", source: "title_pattern_doviz" };
    return { currency: "USD", source: "title_pattern_doviz" };
  }
  return { currency: "TRY", source: "tefas_default_try" };
}

function confident(
  modelAssetClass: ModelAssetClass,
  catalogCategory: string,
  currency: { currency: FundCurrency; source: string },
): FundClassification {
  return {
    modelAssetClass,
    catalogCategory,
    needsVerification: false,
    verificationNote: null,
    currency: currency.currency,
    currencySource: currency.source,
    riskValue: null,
    riskSource: null,
  };
}

/** Bilinmeyen (referans kataloğunda olmayan) bir fon başlığını sınıflandırır. */
export function classifyFundTitle(fonUnvan: string): FundClassification {
  const title = fonUnvan.toLocaleUpperCase("tr-TR");
  const currency = detectCurrencyFromTitle(fonUnvan);

  if (/ALTIN|KIYMETLİ MADEN/.test(title)) {
    return confident("GOLD", "Altın & Kıymetli Maden", currency);
  }
  if (/DÖVİZ/.test(title)) {
    return confident("FX", "Döviz Katılım Serbest", currency);
  }
  if (/HİSSE/.test(title)) {
    if (FOREIGN_MARKET_KEYWORDS.test(title)) {
      return {
        modelAssetClass: null,
        catalogCategory: "Hisse Senedi (Yabancı/Belirsiz)",
        needsVerification: true,
        verificationNote:
          "Fon adında yabancı/uluslararası piyasa ibaresi tespit edildi; BIST Katılım Hisse sınıfına otomatik dahil edilmedi, elle doğrulama gerekir.",
        currency: currency.currency,
        currencySource: currency.source,
        riskValue: null,
        riskSource: null,
      };
    }
    return confident("BIST_EQUITY", "Hisse Senedi", currency);
  }
  if (/PARA PİYASASI/.test(title)) {
    return confident("MONEY_MARKET", "Para Piyasası & Kısa Vade", currency);
  }
  if (/KİRA SERTİFİKA/.test(title)) {
    return confident(null, "Kira Sertifikası (Sukuk)", currency);
  }
  if (/FON SEPETİ/.test(title)) {
    return confident(null, "Fon Sepeti", currency);
  }
  if (/ÇOKLU VARLIK|DENGELİ/.test(title)) {
    return confident(null, "Çoklu Varlık & Dengeli", currency);
  }
  if (/TEMATİK|SEKTÖR/.test(title)) {
    return confident(null, "Tematik & Sektörel", currency);
  }
  return confident(null, "Karma / Diğer Katılım", currency);
}

/**
 * Bir fon kodu + başlığı için nihai sınıflandırmayı döner.
 *
 * Kod, bağımsız referans taramasında (referenceCatalog.ts, 198 fon) varsa:
 * model sınıfı/kategori/para birimi/risk değeri doğrudan oradan alınır —
 * bunlar TEFAS'ın kendi ekranlarından derlenmiş, doğrulanmış değerlerdir.
 *
 * Yoksa (bilinmeyen/yeni fon): model sınıfı/kategori/para birimi TEFAS
 * başlığına dayalı sezgisel kurallarla belirlenir (classifyFundTitle).
 * Risk değeri İÇİN başlık tabanlı bir sezgi YOKTUR — TEFAS'ın toplu
 * endpoint'i risk değeri döndürmez ve fon adından risk tahmin edilmez;
 * bilinmeyen fonlarda risk_value her zaman null kalır ("—" gösterilir).
 */
export function classifyFund(code: string, fonUnvan: string): FundClassification {
  const reference = REFERENCE_CATALOG[code.toUpperCase()];
  if (reference) {
    return {
      modelAssetClass: reference.modelAssetClass,
      catalogCategory: reference.catalogCategory,
      needsVerification: false,
      verificationNote: null,
      currency: reference.currency,
      currencySource: "reference_catalog",
      riskValue: reference.riskValue,
      riskSource: reference.riskValue !== null ? "reference_catalog_2026-09-04" : null,
    };
  }
  return classifyFundTitle(fonUnvan);
}
