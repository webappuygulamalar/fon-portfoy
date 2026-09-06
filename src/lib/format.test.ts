import { describe, expect, it } from "vitest";
import { formatCurrencyCode, formatFundSizeShort, formatNumber, formatSignedPercent, formatTRY } from "./format";

describe("formatTRY", () => {
  it("küsüratı tam sıfır olan tutarlarda ,00 göstermez", () => {
    expect(formatTRY("5100000.00")).toBe("₺5.100.000");
    expect(formatTRY("180000")).toBe("₺180.000");
    expect(formatTRY("420000.00")).toBe("₺420.000");
  });

  it("gerçek kuruşu olan tutarlarda iki basamak gösterir", () => {
    expect(formatTRY("179846.63")).toBe("₺179.846,63");
    expect(formatTRY("1.20")).toBe("₺1,20");
  });

  it("tam sayıya yuvarlanan tek basamaklı tutarda ,00 göstermez", () => {
    expect(formatTRY("1.00")).toBe("₺1");
  });

  it("0 tutarında da ,00 göstermez", () => {
    expect(formatTRY("0")).toBe("₺0");
  });
});

describe("formatNumber — pay adedi gibi tam sayılar için binlik ayırıcı", () => {
  it("büyük tam sayıları Türkçe binlik ayırıcıyla gösterir", () => {
    expect(formatNumber(260026)).toBe("260.026");
    expect(formatNumber(2387)).toBe("2.387");
  });

  it("küçük tam sayılarda gruplama eklemez", () => {
    expect(formatNumber(672)).toBe("672");
  });

  it("tam sayılarda sahte ondalık basamak (,00) eklemez", () => {
    expect(formatNumber(260026)).not.toContain(",");
  });
});

describe("formatSignedPercent — getiri gibi işaretli yüzdeler", () => {
  it("pozitif değerde işaret % işaretinden önce, + önekiyle gösterilir", () => {
    expect(formatSignedPercent(12.4)).toBe("+%12,4");
  });

  it("negatif değerde eksi işareti % işaretinden ÖNCE gelir (%- değil)", () => {
    expect(formatSignedPercent(-3.2)).toBe("-%3,2");
  });

  it("sıfırda işaret eklenmez", () => {
    expect(formatSignedPercent(0)).toBe("%0");
  });
});

describe("formatCurrencyCode — veritabanı kodu -> kullanıcı gösterimi", () => {
  it("TRY'yi TL olarak gösterir", () => {
    expect(formatCurrencyCode("TRY")).toBe("TL");
  });

  it("USD/EUR'u olduğu gibi bırakır", () => {
    expect(formatCurrencyCode("USD")).toBe("USD");
    expect(formatCurrencyCode("EUR")).toBe("EUR");
  });
});

describe("formatFundSizeShort — mobilde fon büyüklüğünün milyon TL kısaltması", () => {
  it("ham TL tutarını milyon TL cinsinden bir ondalıkla gösterir", () => {
    expect(formatFundSizeShort(343_400_000)).toBe("343,4 mio ₺");
  });

  it("milyar mertebesindeki büyüklüklerde de Türkçe binlik ayırıcı kullanır", () => {
    expect(formatFundSizeShort(12_345_678_900)).toBe("12.345,7 mio ₺");
  });

  it("veri yoksa (null) tahmini değer üretmez, — gösterir", () => {
    expect(formatFundSizeShort(null)).toBe("—");
  });

  it("küçük fon büyüklüklerinde de mio birimini korur", () => {
    expect(formatFundSizeShort(1_200_000)).toBe("1,2 mio ₺");
  });
});
