import { describe, expect, it, vi } from "vitest";
import {
  extractManagementCompany,
  fetchAllParticipationFunds,
  fetchLatestFundPrice,
  fetchParticipationFundPriceHistory,
  parseLatestPriceFromRows,
  parseTefasDate,
  toTitleCaseTR,
} from "./tefasAdapter.ts";

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

describe("toTitleCaseTR", () => {
  it("TÜMÜ BÜYÜK HARF bir unvanı Türkçe kurallarına göre başlık haline getirir", () => {
    expect(toTitleCaseTR("ZİRAAT PORTFÖY ALTIN KATILIM BORSA YATIRIM FONU")).toBe(
      "Ziraat Portföy Altın Katılım Borsa Yatırım Fonu",
    );
  });

  it("bilinen kısaltmaları (BIST, TL) büyük harfte tutar", () => {
    expect(toTitleCaseTR("ZİRAAT PORTFÖY BIST KATILIM 30 ENDEKSİ (TL) FONU")).toBe(
      "Ziraat Portföy BIST Katılım 30 Endeksi (TL) Fonu",
    );
  });

  it("fazla boşlukları tek boşluğa indirger", () => {
    expect(toTitleCaseTR("ZİRAAT PORTFÖY ALTIN KATILIM  BORSA YATIRIM FONU")).toBe(
      "Ziraat Portföy Altın Katılım Borsa Yatırım Fonu",
    );
  });
});

describe("extractManagementCompany", () => {
  it("unvandaki ilk 'PORTFÖY' kelimesine kadarki (dahil) kısmı şirket adı sayar", () => {
    expect(extractManagementCompany("KUVEYT TÜRK PORTFÖY PARA PİYASASI KATILIM (TL) FONU")).toBe(
      "Kuveyt Türk Portföy",
    );
  });

  it("'PORTFÖY' kelimesi yoksa null döner (uydurma yapmaz)", () => {
    expect(extractManagementCompany("TMKŞ EKGYO BİRİNCİ KATILIM VARLIK FİNANSMANI FONU")).toBeNull();
  });
});

describe("fetchAllParticipationFunds — toplu katılım fonu keşfi", () => {
  function bulkResponse(rows: Record<string, unknown>[], toplamSayi: number) {
    return jsonResponse(200, { resultList: rows, toplamSayi, errorMessage: null });
  }

  it("YAT ve BYF fon tiplerini birleştirir, her kod için en güncel tarihli satırı seçer", async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.fonTipi === "YAT") {
        return bulkResponse(
          [
            { fonKodu: "AAA", fonUnvan: "TEST PORTFÖY PARA PİYASASI KATILIM FONU", tarih: "2026-09-03", fiyat: 1.1 },
            { fonKodu: "AAA", fonUnvan: "TEST PORTFÖY PARA PİYASASI KATILIM FONU", tarih: "2026-09-04", fiyat: 1.2 },
          ],
          2,
        );
      }
      return bulkResponse(
        [{ fonKodu: "ZKP", fonUnvan: "ZİRAAT PORTFÖY BIST KATILIM 30 ENDEKSİ FONU", tarih: "2026-09-04", fiyat: 7.5 }],
        1,
      );
    });

    const result = await fetchAllParticipationFunds({ fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(result.errors).toEqual([]);
    const aaa = result.funds.find((f) => f.code === "AAA")!;
    expect(aaa.price).toBe(1.2);
    expect(aaa.priceDate).toBe("2026-09-04");
    expect(aaa.fonTipi).toBe("YAT");
    expect(result.funds.find((f) => f.code === "ZKP")?.fonTipi).toBe("BYF");
  });

  it("bir fon tipi tamamen başarısız olsa bile diğerinin sonuçlarını kaybetmez (kısmi başarı)", async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.fonTipi === "BYF") {
        return jsonResponse(500, {});
      }
      return bulkResponse(
        [{ fonKodu: "OK1", fonUnvan: "TEST PORTFÖY KATILIM FONU", tarih: "2026-09-04", fiyat: 1 }],
        1,
      );
    });

    const result = await fetchAllParticipationFunds({ fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(result.funds.find((f) => f.code === "OK1")).toBeDefined();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/fonTipi=BYF/);
  });

  it("sayfalamayı takip eder ve toplamSayi'ye ulaşınca durur", async () => {
    const calls: Array<{ fonTipi: string; basSira: number; bitSira: number }> = [];
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      calls.push({ fonTipi: body.fonTipi, basSira: body.basSira, bitSira: body.bitSira });
      if (body.fonTipi === "BYF") return bulkResponse([], 0);
      // YAT: toplamSayi 1500, sayfa başına 1000 -> 2 sayfa beklenir.
      const isFirstPage = body.basSira === 1;
      return bulkResponse(
        [
          {
            fonKodu: isFirstPage ? "P1" : "P2",
            fonUnvan: "TEST PORTFÖY KATILIM FONU",
            tarih: "2026-09-04",
            fiyat: 1,
          },
        ],
        1500,
      );
    });

    await fetchAllParticipationFunds({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const yatCalls = calls.filter((c) => c.fonTipi === "YAT");
    expect(yatCalls).toHaveLength(2);
    expect(yatCalls[0]).toMatchObject({ basSira: 1, bitSira: 1000 });
    expect(yatCalls[1]).toMatchObject({ basSira: 1001, bitSira: 2000 });
  });

  it("ayrıştırılamayan tarihli bir satırı sessizce atlar (uydurma yapmaz)", async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.fonTipi === "BYF") return bulkResponse([], 0);
      return bulkResponse(
        [
          { fonKodu: "BAD", fonUnvan: "TEST PORTFÖY KATILIM FONU", tarih: "geçersiz-tarih", fiyat: 1 },
          { fonKodu: "OK1", fonUnvan: "TEST PORTFÖY KATILIM FONU", tarih: "2026-09-04", fiyat: 1 },
        ],
        2,
      );
    });

    const result = await fetchAllParticipationFunds({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result.funds.find((f) => f.code === "BAD")).toBeUndefined();
    expect(result.funds.find((f) => f.code === "OK1")).toBeDefined();
  });
});

describe("fetchParticipationFundPriceHistory — pencere bazlı tarihsel fiyat", () => {
  it("bir pencerede birden fazla fon/tarih satırını TAMAMEN döner (en güncele indirgemez)", async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      expect(body.basTarih).toBe("20260801");
      expect(body.bitTarih).toBe("20260831");
      if (body.fonTipi === "BYF") {
        return jsonResponse(200, { resultList: [], toplamSayi: 0, errorMessage: null });
      }
      return jsonResponse(200, {
        resultList: [
          { fonKodu: "AAA", fonUnvan: "TEST", tarih: "2026-08-01", fiyat: 1.0 },
          { fonKodu: "AAA", fonUnvan: "TEST", tarih: "2026-08-02", fiyat: 1.01 },
          { fonKodu: "BBB", fonUnvan: "TEST2", tarih: "2026-08-01", fiyat: 2.0 },
        ],
        toplamSayi: 3,
        errorMessage: null,
      });
    });

    const result = await fetchParticipationFundPriceHistory("2026-08-01", "2026-08-31", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(3);
    expect(result.rows.filter((r) => r.code === "AAA")).toHaveLength(2);
  });

  it("geçersiz (<=0) fiyatlı satırı atlar, uydurmaz", async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.fonTipi === "BYF") return jsonResponse(200, { resultList: [], toplamSayi: 0, errorMessage: null });
      return jsonResponse(200, {
        resultList: [{ fonKodu: "ZER", fonUnvan: "TEST", tarih: "2026-08-01", fiyat: 0 }],
        toplamSayi: 1,
        errorMessage: null,
      });
    });
    const result = await fetchParticipationFundPriceHistory("2026-08-01", "2026-08-31", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.rows).toHaveLength(0);
  });

  it("bir fon tipi başarısız olsa bile diğerinin satırlarını kaybetmez", async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.fonTipi === "BYF") return jsonResponse(500, {});
      return jsonResponse(200, {
        resultList: [{ fonKodu: "OK1", fonUnvan: "TEST", tarih: "2026-08-01", fiyat: 1 }],
        toplamSayi: 1,
        errorMessage: null,
      });
    });
    const result = await fetchParticipationFundPriceHistory("2026-08-01", "2026-08-31", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/fonTipi=BYF/);
  });
});
