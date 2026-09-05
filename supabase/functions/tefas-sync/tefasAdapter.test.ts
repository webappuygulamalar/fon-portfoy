import { describe, expect, it, vi } from "vitest";
import { fetchLatestFundPrice, parseLatestPriceFromRows, parseTefasDate } from "./tefasAdapter.ts";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
  } as Response;
}

describe("parseTefasDate", () => {
  it("YYYY-MM-DD biçimini olduğu gibi tanır", () => {
    expect(parseTefasDate("2026-09-04")).toBe("2026-09-04");
  });

  it("YYYY-MM-DDTHH:mm:ss biçiminden tarihi çıkarır", () => {
    expect(parseTefasDate("2026-09-04T00:00:00")).toBe("2026-09-04");
  });

  it("DD.MM.YYYY biçimini çevirir", () => {
    expect(parseTefasDate("04.09.2026")).toBe("2026-09-04");
  });

  it("epoch milisaniyeyi çevirir", () => {
    const epoch = Date.UTC(2026, 8, 4);
    expect(parseTefasDate(epoch)).toBe("2026-09-04");
  });

  it("/Date(...)/ .NET biçimini çevirir", () => {
    const epoch = Date.UTC(2026, 8, 4);
    expect(parseTefasDate(`/Date(${epoch})/`)).toBe("2026-09-04");
  });

  it("tanınmayan biçimde hata fırlatır (sessizce yanlış tarih üretmez)", () => {
    expect(() => parseTefasDate("geçersiz-tarih")).toThrow(/Ayrıştırılamayan/);
  });
});

describe("parseLatestPriceFromRows", () => {
  const rows = [
    { fonKodu: "ZKP", tarih: "2026-09-01", fiyat: 6.8, kisiSayisi: 100, portfoyBuyukluk: 1000 },
    { fonKodu: "ZKP", tarih: "2026-09-03", fiyat: 7.0, kisiSayisi: 105, portfoyBuyukluk: 1050 },
    { fonKodu: "ZKP", tarih: "2026-09-02", fiyat: 6.9, kisiSayisi: 102, portfoyBuyukluk: 1020 },
    { fonKodu: "ZGD", tarih: "2026-09-03", fiyat: 11.0, kisiSayisi: 50, portfoyBuyukluk: 500 },
  ];

  it("birden çok satır arasından en güncel tarihli olanı seçer", () => {
    const result = parseLatestPriceFromRows(rows, "ZKP");
    expect(result.priceDate).toBe("2026-09-03");
    expect(result.price).toBe(7.0);
    expect(result.investorCount).toBe(105);
    expect(result.fundSize).toBe(1050);
  });

  it("fon kodu büyük/küçük harf duyarsız eşleşir", () => {
    const result = parseLatestPriceFromRows(rows, "zkp");
    expect(result.fundCode).toBe("zkp");
    expect(result.priceDate).toBe("2026-09-03");
  });

  it("aynı girdi için her zaman aynı sonucu üretir (saf fonksiyon / idempotent ayrıştırma)", () => {
    const first = parseLatestPriceFromRows(rows, "ZKP");
    const second = parseLatestPriceFromRows(rows, "ZKP");
    expect(second).toEqual(first);
  });

  it("eşleşen satır yoksa hata fırlatır", () => {
    expect(() => parseLatestPriceFromRows(rows, "YOKFON")).toThrow(/bulunamadı/);
  });

  it("fiyat 0 veya negatifse hata fırlatır (fiyat uydurmaz)", () => {
    expect(() =>
      parseLatestPriceFromRows(
        [{ fonKodu: "ZKP", tarih: "2026-09-01", fiyat: 0 }],
        "ZKP",
      ),
    ).toThrow(/geçersiz fiyat/);
  });

  it("virgüllü ondalık sayıları da ayrıştırır", () => {
    const result = parseLatestPriceFromRows(
      [{ fonKodu: "ZKP", tarih: "2026-09-01", fiyat: "7,25" }],
      "ZKP",
    );
    expect(result.price).toBe(7.25);
  });
});

describe("fetchLatestFundPrice — fonTipi döngüsü (canlı TEFAS'ta doğrulanan gerçek davranış)", () => {
  it("ilk fonTipi (YAT) veri dönmezse hemen bir sonrakini (BYF) dener, aynısını tekrar denemez", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      calls.push(body.fonTipi);
      if (body.fonTipi === "YAT") {
        return jsonResponse(200, { errorMessage: "Hata:java.lang.NullPointerException", resultList: null });
      }
      return jsonResponse(200, {
        resultList: [{ fonKodu: "ZKP", tarih: "2026-09-04", fiyat: 267.6, kisiSayisi: 0, portfoyBuyukluk: 100 }],
      });
    });

    const result = await fetchLatestFundPrice("ZKP", { fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(calls).toEqual(["YAT", "BYF"]);
    expect(result.price).toBe(267.6);
  });

  it("429 (rate limit) durumunda aynı fonTipi ile bir kez daha dener", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      calls.push(body.fonTipi);
      if (calls.length === 1) {
        return jsonResponse(429, {}, { "retry-after": "0" });
      }
      return jsonResponse(200, {
        resultList: [{ fonKodu: "PKT", tarih: "2026-09-04", fiyat: 5, kisiSayisi: 10, portfoyBuyukluk: 100 }],
      });
    });

    const result = await fetchLatestFundPrice("PKT", { fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(calls).toEqual(["YAT", "YAT"]);
    expect(result.price).toBe(5);
  });

  it("hiçbir fonTipi veri döndürmezse anlamlı bir hata fırlatır", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { errorMessage: "Index 0 out of bounds for length 0", resultList: null }),
    );

    await expect(
      fetchLatestFundPrice("YOKFON", { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/TEFAS hatası/);
  });
});
