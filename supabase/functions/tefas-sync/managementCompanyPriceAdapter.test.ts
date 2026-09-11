import { describe, expect, it, vi } from "vitest";
import { fetchManagementCompanyPrice, parseIsPortfoyNativePrice } from "./managementCompanyPriceAdapter.ts";
import type { ShareClassOverride } from "./types.ts";

// Canlı İş Portföy CKS (USD) sayfasından alınan, ilgili bloğu çevreleyen
// gerçek HTML yapısı (2026-09-11 doğrulandı) — başka gürültü (script/stil)
// kasıtlı olarak eklenir, ayrıştırıcının yalnızca ilgili bloğu bulduğunu
// kanıtlamak için.
const REAL_FRAGMENT = `
<div class="fund-detail-bar">
  <div class="col">
    <div class="fund-detail-bar-item">
      <div class="title flex-column">
        <span>Fon Birim Fiyatı (USD)</span>
        <span class="date m-0">11.09.2026</span>
      </div>
      <span class="content">1,277608</span>
    </div>
  </div>
  <div class="col">
    <div class="fund-detail-bar-item">
      <div class="title">
        <span>Risk Seviyesi</span>
      </div>
      <span class="content">3/7</span>
    </div>
  </div>
</div>
`;

function jsonOkResponse(html: string) {
  return { ok: true, status: 200, text: async () => html } as Response;
}

describe("parseIsPortfoyNativePrice", () => {
  it("gerçek sayfa yapısından tarih ve fiyatı doğru ayrıştırır", () => {
    const result = parseIsPortfoyNativePrice(REAL_FRAGMENT, "USD");
    expect(result).toEqual({ price: 1.277608, priceDate: "2026-09-11" });
  });

  it("istenen para birimi sayfada yoksa null döner (uydurmaz)", () => {
    expect(parseIsPortfoyNativePrice(REAL_FRAGMENT, "EUR")).toBeNull();
  });

  it("beklenen blok hiç yoksa null döner", () => {
    expect(parseIsPortfoyNativePrice("<html><body>alakasız içerik</body></html>", "USD")).toBeNull();
  });

  it("tarih ayrıştırılamıyorsa null döner (hata fırlatmaz, uydurmaz)", () => {
    const broken = REAL_FRAGMENT.replace("11.09.2026", "geçersiz-tarih");
    expect(parseIsPortfoyNativePrice(broken, "USD")).toBeNull();
  });

  it("fiyat sıfır veya negatifse null döner", () => {
    const zero = REAL_FRAGMENT.replace("1,277608", "0");
    expect(parseIsPortfoyNativePrice(zero, "USD")).toBeNull();
  });
});

describe("fetchManagementCompanyPrice", () => {
  const override: ShareClassOverride = {
    fundCode: "CKS",
    shareClassLabel: "B Grubu",
    nativeCurrency: "USD",
    tefasPriceIsNative: false,
    priceFetchSource: "isportfoy_resmi_sayfa",
    priceFetchUrl: "https://www.isportfoy.com.tr/is-portfoy-birinci-katilim-serbest-doviz-fon-usd",
  };

  it("price_fetch_source/url tanımsızsa (null) ağa hiç çıkmadan null döner", async () => {
    const fetchImpl = vi.fn();
    const result = await fetchManagementCompanyPrice(
      { ...override, priceFetchSource: null, priceFetchUrl: null },
      { fetchImpl },
    );
    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("bilinmeyen bir price_fetch_source için hata fırlatır (sessizce atlamaz)", async () => {
    const fetchImpl = vi.fn();
    await expect(
      fetchManagementCompanyPrice({ ...override, priceFetchSource: "desteklenmeyen_kaynak" }, { fetchImpl }),
    ).rejects.toThrow(/Bilinmeyen fiyat kaynağı/);
  });

  it("başarılı bir yanıtta doğru fiyatı döner", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonOkResponse(REAL_FRAGMENT));
    const result = await fetchManagementCompanyPrice(override, { fetchImpl });
    expect(result).toEqual({ price: 1.277608, priceDate: "2026-09-11" });
    expect(fetchImpl).toHaveBeenCalledWith(override.priceFetchUrl, expect.objectContaining({ headers: expect.any(Object) }));
  });

  it("HTTP hatası durumunda hata fırlatır (o günün fiyatı atlanır, uydurulmaz)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => "" } as Response);
    await expect(fetchManagementCompanyPrice(override, { fetchImpl })).rejects.toThrow(/HTTP 503/);
  });

  it("sayfa erişilebilir ama beklenen alan yoksa null döner (hata fırlatmaz)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonOkResponse("<html>beklenmedik içerik</html>"));
    const result = await fetchManagementCompanyPrice(override, { fetchImpl });
    expect(result).toBeNull();
  });
});
