import { describe, expect, it, vi } from "vitest";
import { fetchKapFundDetailHtml, mapWithConcurrency, searchKapFundByCode, withRetry } from "./kapClient.ts";

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

describe("withRetry — yeniden deneme / geri çekilme", () => {
  it("ilk denemede başarılıysa hiç tekrar denemez", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, 3, 1);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("başarısız olursa tekrar dener ve sonunda başarılı olursa sonucu döner", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("geçici hata"))
      .mockRejectedValueOnce(new Error("geçici hata"))
      .mockResolvedValue("ok");
    const result = await withRetry(fn, 3, 1);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("tüm denemeler başarısız olursa son hatayı fırlatır (sessizce yutmaz)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("kalıcı hata"));
    await expect(withRetry(fn, 2, 1)).rejects.toThrow("kalıcı hata");
    expect(fn).toHaveBeenCalledTimes(3); // ilk deneme + 2 tekrar
  });
});

describe("searchKapFundByCode — fon eşleştirme güvenliği", () => {
  it("yalnızca searchType='F' VE cmpOrFundCode TAM eşleşen sonuçları döner (isim benzerliğine güvenmez)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        { category: "companyOrFunds", results: [
          { searchType: "F", cmpOrFundCode: "bky", memberOrFundOid: "OID-BKY", searchValue: "BKY Fon" },
          { searchType: "F", cmpOrFundCode: "bkz", memberOrFundOid: "OID-BKZ", searchValue: "Benzer İsimli Başka Fon" },
          { searchType: "C", cmpOrFundCode: "bky", memberOrFundOid: "OID-CO", searchValue: "Şirket sonucu" },
        ] },
      ]),
    );
    const matches = await searchKapFundByCode("BKY", { fetchImpl });
    expect(matches).toEqual([{ memberOrFundOid: "OID-BKY", cmpOrFundCode: "bky", searchValue: "BKY Fon" }]);
  });

  it("sonuç yoksa boş dizi döner (hata fırlatmaz)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ category: "companyOrFunds", results: [] }]));
    const matches = await searchKapFundByCode("XYZ", { fetchImpl });
    expect(matches).toEqual([]);
  });

  it("HTTP hatasında yeniden dener", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(null, false, 503))
      .mockResolvedValueOnce(jsonResponse([{ category: "companyOrFunds", results: [] }]));
    const matches = await searchKapFundByCode("XYZ", { fetchImpl, baseDelayMs: 1 });
    expect(matches).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("fetchKapFundDetailHtml", () => {
  it("HTML gövdesini döner", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "<html>ok</html>" } as Response);
    const html = await fetchKapFundDetailHtml("OID-1", { fetchImpl });
    expect(html).toBe("<html>ok</html>");
  });
});

describe("mapWithConcurrency — eşzamanlılık sınırı", () => {
  it("aynı anda en fazla `concurrency` kadar işi çalıştırır", async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);
    await mapWithConcurrency(items, 3, async (item) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return item;
    });
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it("sonuçları tamamlanma sırasına değil, giriş sırasına göre döner", async () => {
    const items = [30, 5, 20];
    const results = await mapWithConcurrency(items, 3, async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms;
    });
    expect(results).toEqual([30, 5, 20]);
  });

  it("boş dizi için boş dizi döner", async () => {
    const results = await mapWithConcurrency([], 3, async (x) => x);
    expect(results).toEqual([]);
  });
});
