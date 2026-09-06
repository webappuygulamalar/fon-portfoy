import { describe, expect, it } from "vitest";
import {
  countDigits,
  formatAmountInputDisplay,
  parseAmountValue,
  positionAfterDigitCount,
  sanitizeAmountInput,
} from "./amountInput";

describe("sanitizeAmountInput", () => {
  it("düz rakam girişini olduğu gibi bırakır", () => {
    expect(sanitizeAmountInput("6000000")).toBe("6000000");
  });

  it("Türkçe binlik noktalı yapıştırılan değeri doğru ayrıştırır", () => {
    expect(sanitizeAmountInput("6.000.000")).toBe("6000000");
  });

  it("ondalık virgüllü ve binlik noktalı değeri ayrıştırır", () => {
    expect(sanitizeAmountInput("100.000,50")).toBe("100000.50");
  });

  it("TL/₺ işaretini ve boşlukları güvenle temizler", () => {
    expect(sanitizeAmountInput("₺ 100.000")).toBe("100000");
    expect(sanitizeAmountInput("100000 TL")).toBe("100000");
  });

  it("boş girişte hata üretmez, boş string döner", () => {
    expect(sanitizeAmountInput("")).toBe("");
  });

  it("yalnızca harf gibi anlamsız girişte boş string döner", () => {
    expect(sanitizeAmountInput("abc")).toBe("");
  });
});

describe("formatAmountInputDisplay", () => {
  it("6000000 ham değerini 6.000.000 olarak gösterir", () => {
    expect(formatAmountInputDisplay("6000000")).toBe("6.000.000");
  });

  it("küçük tutarlarda gruplama eklemez", () => {
    expect(formatAmountInputDisplay("672")).toBe("672");
  });

  it("yazılmakta olan ondalık kısmı olduğu gibi korur (sona sıfır eklemez)", () => {
    expect(formatAmountInputDisplay("100000.")).toBe("100.000,");
    expect(formatAmountInputDisplay("100000.5")).toBe("100.000,5");
  });

  it("boş girişte boş string döner", () => {
    expect(formatAmountInputDisplay("")).toBe("");
  });
});

describe("parseAmountValue", () => {
  it("6000000 girişi sayıya doğru çevrilir", () => {
    expect(parseAmountValue(sanitizeAmountInput("6000000"))).toBe(6_000_000);
  });

  it("6.000.000 yapıştırılması da aynı sayısal değere (6000000) çevrilir", () => {
    expect(parseAmountValue(sanitizeAmountInput("6.000.000"))).toBe(6_000_000);
  });

  it("boş girişte NaN döner, hata fırlatmaz", () => {
    expect(Number.isNaN(parseAmountValue(sanitizeAmountInput("")))).toBe(true);
  });

  it("görsel biçimlendirme hesaplamaya giden sayısal değeri değiştirmez", () => {
    const rawTyped = sanitizeAmountInput("6000000");
    const rawPasted = sanitizeAmountInput("6.000.000");
    expect(parseAmountValue(rawTyped)).toBe(parseAmountValue(rawPasted));
    expect(formatAmountInputDisplay(rawTyped)).toBe("6.000.000");
  });
});

describe("imleç konumlandırma yardımcıları", () => {
  it("countDigits yalnızca rakamları sayar", () => {
    expect(countDigits("6.000.000", 5)).toBe(4); // "6.000" -> 6,0,0,0
  });

  it("positionAfterDigitCount, N. rakamdan hemen sonraki konumu bulur", () => {
    // "6.000.000" - 4 rakamdan sonra (6,0,0,0) index 5'te ("." dahil 5 karakter sonra)
    expect(positionAfterDigitCount("6.000.000", 4)).toBe(5);
  });

  it("yetersiz rakam varsa metnin sonunu döner", () => {
    expect(positionAfterDigitCount("672", 10)).toBe(3);
  });
});
