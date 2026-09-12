import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useFxRates } from "./useFxRates";
import type { FxRateRow } from "../services/types";

const { getLatestFxRateMock } = vi.hoisted(() => ({ getLatestFxRateMock: vi.fn() }));

vi.mock("../services/fxRepository", () => ({
  getLatestFxRate: getLatestFxRateMock,
}));

function mkRate(currency: string): FxRateRow {
  return {
    id: `fx-${currency}`,
    currency,
    rate_to_try: "34.10",
    rate_date: "2026-09-04",
    source: "TCMB",
    fetched_at: "2026-09-05T04:00:00Z",
  };
}

beforeEach(() => {
  getLatestFxRateMock.mockReset();
});

describe("useFxRates — TL portföyü (para birimi gerekmiyor)", () => {
  it("hiç isteğe çıkmadan hemen loading=false, error=null, rates={} döner", () => {
    const { result } = renderHook(() => useFxRates([]));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.rates).toEqual({});
    expect(getLatestFxRateMock).not.toHaveBeenCalled();
  });

  it("yalnızca 'TRY' içeren bir liste de istek atmaz", () => {
    const { result } = renderHook(() => useFxRates(["TRY"]));
    expect(result.current.loading).toBe(false);
    expect(getLatestFxRateMock).not.toHaveBeenCalled();
  });
});

describe("useFxRates — başarılı yükleme", () => {
  it("istek sürerken loading=true, error=null olur; tamamlanınca rates dolar ve loading=false olur", async () => {
    let resolvePromise!: (v: FxRateRow) => void;
    getLatestFxRateMock.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    const { result } = renderHook(() => useFxRates(["USD"]));

    // İstek henüz tamamlanmadı: yükleniyor, hata YOK.
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.rates).toEqual({});

    resolvePromise(mkRate("USD"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.rates.USD?.currency).toBe("USD");
  });
});

describe("useFxRates — istek başarıyla tamamlanır ama kur gerçekten bulunamaz", () => {
  it("loading=false, error=null, rates boş kalır (bu MISSING_FX_RATE ile ayrıca ele alınır, hata DEĞİLDİR)", async () => {
    getLatestFxRateMock.mockResolvedValue(null);
    const { result } = renderHook(() => useFxRates(["USD"]));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.rates).toEqual({});
  });
});

describe("useFxRates — ağ/istisna hatası", () => {
  it("loading sonsuza kadar takılı kalmaz; error dolar, rates boşalır", async () => {
    getLatestFxRateMock.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useFxRates(["USD"]));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("network down");
    expect(result.current.rates).toEqual({});
  });
});

describe("useFxRates — hazır profil ve Özel profil aynı hook'u aynı şekilde kullanır", () => {
  it("aynı para birimi listesiyle çağrıldığında davranış (loading/error/rates) profil tipinden bağımsızdır", async () => {
    getLatestFxRateMock.mockResolvedValue(mkRate("USD"));
    const realProfileCall = renderHook(() => useFxRates(["USD"]));
    const customProfileCall = renderHook(() => useFxRates(["USD"]));

    await waitFor(() => expect(realProfileCall.result.current.loading).toBe(false));
    await waitFor(() => expect(customProfileCall.result.current.loading).toBe(false));

    expect(realProfileCall.result.current.rates.USD?.currency).toBe("USD");
    expect(customProfileCall.result.current.rates.USD?.currency).toBe("USD");
    expect(realProfileCall.result.current.error).toBeNull();
    expect(customProfileCall.result.current.error).toBeNull();
  });
});

describe("useFxRates — para birimi listesi değişimi", () => {
  it("TRY'den USD'ye geçince yeni bir istek başlatır ve loading'i doğru yönetir", async () => {
    getLatestFxRateMock.mockResolvedValue(mkRate("USD"));
    const { result, rerender } = renderHook(({ currencies }) => useFxRates(currencies), {
      initialProps: { currencies: [] as string[] },
    });

    expect(result.current.loading).toBe(false);

    rerender({ currencies: ["USD"] });
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rates.USD?.currency).toBe("USD");
  });
});
