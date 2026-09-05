import { describe, expect, it } from "vitest";
import { classifyFund, classifyFundTitle } from "./classifyFund.ts";

describe("classifyFundTitle — isim tabanlı sezgisel kurallar", () => {
  it("Para piyasası katılım fonunu MONEY_MARKET olarak sınıflandırır", () => {
    const result = classifyFundTitle("AK PORTFÖY PARA PİYASASI KATILIM FONU");
    expect(result.modelAssetClass).toBe("MONEY_MARKET");
    expect(result.needsVerification).toBe(false);
  });

  it("BIST katılım hisse fonunu BIST_EQUITY olarak sınıflandırır", () => {
    const result = classifyFundTitle(
      "ZİRAAT PORTFÖY BIST KATILIM 30 ENDEKSİ HİSSE SENEDİ YOĞUN BORSA YATIRIM FONU",
    );
    expect(result.modelAssetClass).toBe("BIST_EQUITY");
  });

  it("yabancı piyasa ibaresi içeren hisse fonunu BIST_EQUITY'e dahil ETMEZ, doğrulama ister", () => {
    const result = classifyFundTitle("XYZ PORTFÖY ULUSLARARASI KATILIM HİSSE SENEDİ FONU");
    expect(result.modelAssetClass).toBeNull();
    expect(result.needsVerification).toBe(true);
  });

  it("altın katılım fonunu GOLD olarak sınıflandırır", () => {
    expect(classifyFundTitle("BV PORTFÖY ALTIN KATILIM FONU").modelAssetClass).toBe("GOLD");
  });

  it("kıymetli maden katılım fonunu da GOLD olarak sınıflandırır", () => {
    expect(classifyFundTitle("YAPI KREDİ PORTFÖY KIYMETLİ MADENLER KATILIM FONU").modelAssetClass).toBe(
      "GOLD",
    );
  });

  it("döviz katılım fonunu FX olarak sınıflandırır", () => {
    expect(classifyFundTitle("ALBARAKA PORTFÖY KATILIM SERBEST (DÖVİZ) FON").modelAssetClass).toBe("FX");
  });

  it("kira sertifikası fonunu model dışı bırakır (belirsiz değil, kesin model dışı)", () => {
    const result = classifyFundTitle("ASTRA PORTFÖY KİRA SERTİFİKASI KATILIM (TL) FONU");
    expect(result.modelAssetClass).toBeNull();
    expect(result.needsVerification).toBe(false);
    expect(result.catalogCategory).toBe("Kira Sertifikası (Sukuk)");
  });

  it("çoklu varlık katılım fonunu model dışı bırakır", () => {
    expect(classifyFundTitle("BULLS PORTFÖY ÇOKLU VARLIK KATILIM FONU").modelAssetClass).toBeNull();
  });

  it("hiçbir kurala uymayan fonu 'Karma / Diğer Katılım' olarak model dışı bırakır", () => {
    const result = classifyFundTitle("TMKŞ EKGYO BİRİNCİ KATILIM VARLIK FİNANSMANI FONU");
    expect(result.modelAssetClass).toBeNull();
    expect(result.catalogCategory).toBe("Karma / Diğer Katılım");
  });
});

describe("classifyFund — referans katalog önceliği", () => {
  it("referans kataloğunda olan bir kod için doğrudan referans sınıfını kullanır", () => {
    // BKY referans kataloğunda FX olarak yer alır (seed.sql ile de tutarlı).
    const result = classifyFund("BKY", "ALAKASIZ BİR BAŞLIK OLSA BİLE ÖNEMLİ DEĞİL");
    expect(result.modelAssetClass).toBe("FX");
    expect(result.needsVerification).toBe(false);
  });

  it("referans kataloğunda olmayan bir kod için isim sezgisine düşer", () => {
    const result = classifyFund("YENI99", "TEST PORTFÖY ALTIN KATILIM FONU");
    expect(result.modelAssetClass).toBe("GOLD");
  });
});
