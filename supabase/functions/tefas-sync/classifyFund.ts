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

export interface FundClassification {
  modelAssetClass: ModelAssetClass;
  catalogCategory: string;
  needsVerification: boolean;
  verificationNote: string | null;
}

const FOREIGN_MARKET_KEYWORDS =
  /YABANCI|ULUSLARARASI|GLOBAL|DÜNYA\b|BRIC|AVRASYA|GELİŞEN ÜLKELER|GELİŞMEKTE OLAN|AMERİKA(?!N DOLARI)|AVRUPA\b|ASYA\b|AVUSTRALYA|\bÇİN\b|HİNDİSTAN|JAPON/;

function confident(modelAssetClass: ModelAssetClass, catalogCategory: string): FundClassification {
  return { modelAssetClass, catalogCategory, needsVerification: false, verificationNote: null };
}

/** Bilinmeyen (referans kataloğunda olmayan) bir fon başlığını sınıflandırır. */
export function classifyFundTitle(fonUnvan: string): FundClassification {
  const title = fonUnvan.toLocaleUpperCase("tr-TR");

  if (/ALTIN|KIYMETLİ MADEN/.test(title)) {
    return confident("GOLD", "Altın & Kıymetli Maden");
  }
  if (/DÖVİZ/.test(title)) {
    return confident("FX", "Döviz Katılım Serbest");
  }
  if (/HİSSE/.test(title)) {
    if (FOREIGN_MARKET_KEYWORDS.test(title)) {
      return {
        modelAssetClass: null,
        catalogCategory: "Hisse Senedi (Yabancı/Belirsiz)",
        needsVerification: true,
        verificationNote:
          "Fon adında yabancı/uluslararası piyasa ibaresi tespit edildi; BIST Katılım Hisse sınıfına otomatik dahil edilmedi, elle doğrulama gerekir.",
      };
    }
    return confident("BIST_EQUITY", "Hisse Senedi");
  }
  if (/PARA PİYASASI/.test(title)) {
    return confident("MONEY_MARKET", "Para Piyasası & Kısa Vade");
  }
  if (/KİRA SERTİFİKA/.test(title)) {
    return confident(null, "Kira Sertifikası (Sukuk)");
  }
  if (/FON SEPETİ/.test(title)) {
    return confident(null, "Fon Sepeti");
  }
  if (/ÇOKLU VARLIK|DENGELİ/.test(title)) {
    return confident(null, "Çoklu Varlık & Dengeli");
  }
  if (/TEMATİK|SEKTÖR/.test(title)) {
    return confident(null, "Tematik & Sektörel");
  }
  return confident(null, "Karma / Diğer Katılım");
}

/**
 * Bir fon kodu + başlığı için nihai sınıflandırmayı döner. Kod, bağımsız
 * referans taramasında (referenceCatalog.ts) varsa o kullanılır — güncel
 * TEFAS kategorisi/fon türü ile isim sezgisinin tek başına yeterli
 * olmadığı durumlarda ek bir doğrulama sinyali sağlar. Yoksa isim tabanlı
 * sezgisel kurallara düşülür.
 */
export function classifyFund(code: string, fonUnvan: string): FundClassification {
  const reference = REFERENCE_CATALOG[code.toUpperCase()];
  if (reference) {
    return confident(reference.modelAssetClass, reference.catalogCategory);
  }
  return classifyFundTitle(fonUnvan);
}
