import { describe, expect, it } from "vitest";
import { parseTcmbRates } from "./fxRateAdapter.ts";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="04.09.2026" Date="09/04/2026" Bulten_No="2026/166">
  <Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">
    <Unit>1</Unit>
    <Isim>ABD DOLARI</Isim>
    <ForexBuying>48.2326</ForexBuying>
    <ForexSelling>48.3195</ForexSelling>
  </Currency>
  <Currency CrossOrder="9" Kod="EUR" CurrencyCode="EUR">
    <Unit>1</Unit>
    <Isim>EURO</Isim>
    <ForexBuying>56.1234</ForexBuying>
    <ForexSelling>56.3456</ForexSelling>
  </Currency>
</Tarih_Date>`;

describe("parseTcmbRates", () => {
  it("USD ve EUR kurlarını doğru ayrıştırır", () => {
    const rates = parseTcmbRates(SAMPLE_XML, ["USD", "EUR"]);
    expect(rates).toEqual([
      { currency: "USD", rateToTry: 48.2326, rateDate: "2026-09-04" },
      { currency: "EUR", rateToTry: 56.1234, rateDate: "2026-09-04" },
    ]);
  });

  it("yalnızca istenen para birimlerini döner", () => {
    const rates = parseTcmbRates(SAMPLE_XML, ["USD"]);
    expect(rates).toHaveLength(1);
    expect(rates[0].currency).toBe("USD");
  });

  it("tarih bulunamazsa hata fırlatır, uydurma tarih üretmez", () => {
    expect(() => parseTcmbRates("<foo></foo>", ["USD"])).toThrow(/tarih/);
  });

  it("istenen para birimi XML'de yoksa sessizce atlar (hata fırlatmaz)", () => {
    const rates = parseTcmbRates(SAMPLE_XML, ["USD", "GBP" as never]);
    expect(rates).toEqual([{ currency: "USD", rateToTry: 48.2326, rateDate: "2026-09-04" }]);
  });
});
