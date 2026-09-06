import { describe, expect, it } from "vitest";
import { formatCurrencyCode, formatNumber, formatTRY } from "./format";

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

describe("formatCurrencyCode — veritabanı kodu -> kullanıcı gösterimi", () => {
  it("TRY'yi TL olarak gösterir", () => {
    expect(formatCurrencyCode("TRY")).toBe("TL");
  });

  it("USD/EUR'u olduğu gibi bırakır", () => {
    expect(formatCurrencyCode("USD")).toBe("USD");
    expect(formatCurrencyCode("EUR")).toBe("EUR");
  });
});
