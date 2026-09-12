import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CalculationResultPage } from "./CalculationResultPage";
import { CalculatorSelectionProvider } from "../../context/CalculatorSelectionContext";
import type { PublishedModelData } from "../../hooks/usePublishedModel";
import type { FundRow, FundPriceRow, FundReturnsRow } from "../../services/types";

function mkFund(overrides: Partial<FundRow> & Pick<FundRow, "id" | "code">): FundRow {
  return {
    name: overrides.code,
    management_company: "Test Portföy",
    asset_class: null,
    fund_type: "Yatırım Fonu",
    currency: "TRY",
    tefas_fetch_code: overrides.code,
    is_active: true,
    verification_needed: false,
    verification_note: null,
    is_participation_fund: true,
    catalog_category: null,
    is_substitution_eligible: true,
    risk_value: 3,
    risk_source: null,
    risk_updated_at: null,
    currency_source: "tefas_default_try",
    risk_source_url: null,
    risk_verified: true,
    kap_fund_id: null,
    kap_checked_at: null,
    kap_lookup_status: null,
    risk_verification_needed: false,
    risk_verification_note: null,
    ...overrides,
  };
}

function mkPrice(fund_id: string, price: string): FundPriceRow {
  return {
    id: `price-${fund_id}`,
    fund_id,
    price_date: "2026-09-04",
    currency: "TRY",
    price,
    fund_size: null,
    investor_count: null,
    source: "TEFAS",
    note: null,
    fetched_at: "2026-09-05T04:30:00Z",
  };
}

function mkReturn(fund_id: string, return1m: string | null): FundReturnsRow {
  return {
    fund_id,
    as_of_date: "2026-09-04",
    latest_price: "1",
    return_1m_pct: return1m,
    return_3m_pct: null,
    return_ytd_pct: null,
    return_1y_pct: null,
  };
}

// GOLD ve BIST_EQUITY BİLİNÇLİ olarak eşit yüzdeli (%20) — sayfa düzeyinde
// de "eşitlikte kod A-Z" kuralının uygulandığını doğrulamak için: GOLD
// kodu "AAA", BIST_EQUITY kodu "ZZZ" -> GOLD önce gelmeli.
const mockData: PublishedModelData = {
  version: {
    id: "v1",
    version_number: 1,
    status: "published",
    effective_date: "2026-01-01",
    published_at: "2026-01-01T00:00:00Z",
    published_by: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    created_by: null,
  },
  profiles: [
    {
      profileId: "p1",
      key: "test",
      name: "Test Profili",
      description: "Test açıklaması.",
      sortOrder: 1,
      allocations: { DEPOSIT: 40, MONEY_MARKET: 10, BIST_EQUITY: 20, GOLD: 20, FX: 10 },
      preferredFundIdByAssetClass: {
        MONEY_MARKET: "fund-mm",
        BIST_EQUITY: "fund-bist",
        GOLD: "fund-gold",
        FX: "fund-fx",
      },
    },
    // Yalnızca FX yükleme durumu testlerinde kullanılır (BKY gibi USD
    // fiyatlı bir fon içerir) — diğer testleri etkilememesi için "p1"den
    // AYRI, kendi fon id'lerini kullanan bağımsız bir profildir.
    {
      profileId: "p-fx-usd",
      key: "fx-usd-test",
      name: "FX (USD) Test Profili",
      description: "",
      sortOrder: 2,
      allocations: { DEPOSIT: 40, MONEY_MARKET: 10, BIST_EQUITY: 20, GOLD: 20, FX: 10 },
      preferredFundIdByAssetClass: {
        MONEY_MARKET: "fund-mm",
        BIST_EQUITY: "fund-bist",
        GOLD: "fund-gold",
        FX: "fund-fx-usd",
      },
    },
  ],
  fundsById: {
    "fund-mm": mkFund({ id: "fund-mm", code: "PKT" }),
    "fund-bist": mkFund({ id: "fund-bist", code: "ZZZ" }),
    "fund-gold": mkFund({ id: "fund-gold", code: "AAA" }),
    "fund-fx": mkFund({ id: "fund-fx", code: "FXX" }),
    "fund-fx-usd": mkFund({ id: "fund-fx-usd", code: "BKYTEST" }),
  },
  latestPriceByFundId: {
    "fund-mm": mkPrice("fund-mm", "1.5"),
    "fund-bist": mkPrice("fund-bist", "10"),
    "fund-gold": mkPrice("fund-gold", "20"),
    "fund-fx": mkPrice("fund-fx", "5"),
    "fund-fx-usd": { ...mkPrice("fund-fx-usd", "1.05"), currency: "USD" },
  },
  returnsByFundId: {
    "fund-mm": mkReturn("fund-mm", "1.11"),
    "fund-bist": mkReturn("fund-bist", "3.24"), // pozitif
    "fund-gold": mkReturn("fund-gold", "-2.10"), // negatif
    // fund-fx: kayıt yok -> eksik veri (—)
  },
  defaultPreferredFundIdByAssetClass: {
    MONEY_MARKET: "fund-mm",
    BIST_EQUITY: "fund-bist",
    GOLD: "fund-gold",
    FX: "fund-fx",
  },
};

vi.mock("../../hooks/usePublishedModel", () => ({
  usePublishedModel: () => ({ loading: false, error: null, data: mockData }),
}));

// useFxRates çağrılabilir bir mock: varsayılanı TRY-only senaryonun gerçek
// hook'un döneceği değerle (rates:{}, loading:false, error:null) birebir
// aynıdır; FX yükleme/hata durum testleri bunu test başına
// mockReturnValue ile geçici olarak değiştirir (bkz. aşağıdaki beforeEach).
const { useFxRatesMock } = vi.hoisted(() => ({ useFxRatesMock: vi.fn() }));
vi.mock("../../hooks/useFxRates", () => ({
  useFxRates: useFxRatesMock,
}));

function seedSession(overrides: Partial<{ totalAmountInput: string; selectedProfileId: string }> = {}) {
  sessionStorage.setItem(
    "fonPortfoy.calculatorSelection.v1",
    JSON.stringify({ totalAmountInput: "1000000", selectedProfileId: "p1", overrides: {}, ...overrides }),
  );
}

function seedCustomSession(
  customAllocations: Record<string, number>,
  overrides: Partial<{ totalAmountInput: string; overrides: Record<string, string> }> = {},
) {
  sessionStorage.setItem(
    "fonPortfoy.calculatorSelection.v1",
    JSON.stringify({
      totalAmountInput: "1000000",
      selectedProfileId: "custom",
      overrides: {},
      customAllocations,
      ...overrides,
    }),
  );
}

function rowContaining(code: string): HTMLElement | undefined {
  return Array.from(document.querySelectorAll(".data-table tbody tr")).find((r) =>
    r.textContent?.includes(code),
  ) as HTMLElement | undefined;
}

function renderResultPage(initialPath = "/hesaplama/sonuc") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <CalculatorSelectionProvider>
        <Routes>
          <Route path="/" element={<div>HESAPLAMA GİRİŞ SAYFASI</div>} />
          <Route path="/hesaplama/ozel" element={<div>ÖZEL DAĞILIM SAYFASI</div>} />
          <Route path="/hesaplama/sonuc" element={<CalculationResultPage />} />
        </Routes>
      </CalculatorSelectionProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  useFxRatesMock.mockReturnValue({ rates: {}, loading: false, error: null });
});

describe("CalculationResultPage — geçersiz/eksik parametre güvenliği", () => {
  it("hiç durum yokken (boş sessionStorage) hesaplama sayfasına yönlendirir", () => {
    renderResultPage();
    expect(screen.getByText("HESAPLAMA GİRİŞ SAYFASI")).toBeInTheDocument();
  });

  it("tutar eksik/geçersizken hesaplama sayfasına yönlendirir", () => {
    seedSession({ totalAmountInput: "" });
    renderResultPage();
    expect(screen.getByText("HESAPLAMA GİRİŞ SAYFASI")).toBeInTheDocument();
  });

  it("profil seçilmemişken hesaplama sayfasına yönlendirir", () => {
    seedSession({ selectedProfileId: "" });
    renderResultPage();
    expect(screen.getByText("HESAPLAMA GİRİŞ SAYFASI")).toBeInTheDocument();
  });

  it("artık var olmayan (silinmiş/eski) bir profil id'siyle hesaplama sayfasına yönlendirir", () => {
    seedSession({ selectedProfileId: "silinmis-profil-id" });
    renderResultPage();
    expect(screen.getByText("HESAPLAMA GİRİŞ SAYFASI")).toBeInTheDocument();
  });
});

describe("CalculationResultPage — geçerli durumda sonucu gösterir", () => {
  it("geri dön düğmesi, özet, model dağılımı ve pay hesaplama özetini render eder", () => {
    seedSession();
    renderResultPage();
    expect(screen.getByRole("button", { name: /Geri dön/ })).toBeInTheDocument();
    expect(screen.getByText("Model Dağılımı")).toBeInTheDocument();
    expect(screen.getByText("Pay Hesaplama Özeti")).toBeInTheDocument();
    expect(screen.getByText("Test Profili")).toBeInTheDocument();
  });

  it("geri dön düğmesi hesaplama sayfasına döner", () => {
    seedSession();
    renderResultPage();
    fireEvent.click(screen.getByRole("button", { name: /Geri dön/ }));
    expect(screen.getByText("HESAPLAMA GİRİŞ SAYFASI")).toBeInTheDocument();
  });
});

describe("CalculationResultPage — sıralama: Mevduat -> PPF -> azalan % (eşitlikte kod A-Z) -> Cari Hesap", () => {
  it("masaüstü tabloda satır sırası doğrudur", () => {
    seedSession();
    renderResultPage();
    const rows = Array.from(document.querySelectorAll(".data-table tbody tr")).map(
      (r) => r.querySelector("td")?.textContent?.trim(),
    );
    // Mevduat, PKT(PPF), ardından GOLD(AAA,%20) BIST(ZZZ,%20) eşit -> kod A-Z, sonra FX(%10), Cari Hesap.
    expect(rows[0]).toBe("Mevduat");
    expect(rows[1]).toContain("PKT");
    expect(rows[2]).toContain("AAA");
    expect(rows[3]).toContain("ZZZ");
    expect(rows[4]).toContain("FXX");
    expect(rows[5]).toBe("Cari Hesap");
  });
});

describe("CalculationResultPage — Model Dağılımına 1 aylık getiri", () => {
  it("pozitif getiriyi doğru biçimde gösterir", () => {
    seedSession();
    renderResultPage();
    expect(screen.getByText("1 aylık getiri: +%3,24")).toBeInTheDocument();
  });

  it("negatif getiriyi doğru biçimde gösterir", () => {
    seedSession();
    renderResultPage();
    expect(screen.getByText("1 aylık getiri: -%2,1")).toBeInTheDocument();
  });

  it("eksik veride — gösterir, sıfır/tahmini değer üretmez", () => {
    seedSession();
    renderResultPage();
    expect(screen.getByText("1 aylık getiri: —")).toBeInTheDocument();
  });

  it("Mevduat satırında fiyat veya getiri göstermeye çalışmaz", () => {
    seedSession();
    renderResultPage();
    const modelDagilimi = screen.getByText("Model Dağılımı").closest(".card") as HTMLElement;
    const depositCard = Array.from(modelDagilimi.querySelectorAll(".record-card")).find(
      (card) => card.querySelector("strong")?.textContent === "Mevduat",
    ) as HTMLElement;
    expect(depositCard).toBeDefined();
    expect(depositCard.textContent).not.toContain("1 aylık getiri");
    expect(depositCard.textContent).not.toContain("Son fiyat");
  });
});

describe("CalculationResultPage — Özel dağılım", () => {
  it("başlıkta ve Risk Profili alanında 'Özel Dağılım' açıkça gösterilir", () => {
    seedCustomSession({ DEPOSIT: 40, MONEY_MARKET: 10, BIST_EQUITY: 20, GOLD: 20, FX: 10 });
    renderResultPage();
    expect(screen.getByText("Özel Dağılım")).toBeInTheDocument();
    expect(screen.getByText("Özel dağılımınıza göre pay hesaplama özetiniz.")).toBeInTheDocument();
  });

  it("Özel dağılımda 'Geri dön' ana sayfaya değil #/hesaplama/ozel'e döner", () => {
    seedCustomSession({ DEPOSIT: 40, MONEY_MARKET: 10, BIST_EQUITY: 20, GOLD: 20, FX: 10 });
    renderResultPage();
    fireEvent.click(screen.getByRole("button", { name: /Geri dön/ }));
    expect(screen.getByText("ÖZEL DAĞILIM SAYFASI")).toBeInTheDocument();
    expect(screen.queryByText("HESAPLAMA GİRİŞ SAYFASI")).not.toBeInTheDocument();
  });

  it("seçilen özel oranlar sonuç tablosunda doğru gösterilir", () => {
    seedCustomSession({ DEPOSIT: 40, MONEY_MARKET: 10, BIST_EQUITY: 20, GOLD: 20, FX: 10 });
    renderResultPage();

    const depositRow = Array.from(document.querySelectorAll(".data-table tbody tr")).find(
      (r) => r.querySelector("td")?.textContent?.trim() === "Mevduat",
    ) as HTMLElement;
    expect(depositRow.querySelectorAll("td")[1]?.textContent).toBe("%40");
    expect(rowContaining("ZZZ")?.querySelectorAll("td")[1]?.textContent).toBe("%20"); // BIST_EQUITY
    expect(rowContaining("AAA")?.querySelectorAll("td")[1]?.textContent).toBe("%20"); // GOLD
    expect(rowContaining("FXX")?.querySelectorAll("td")[1]?.textContent).toBe("%10"); // FX
  });

  it("%0 verilen kategoriler sonuç satırlarında yer almaz (PPF de dahil, hedefi ve gerçekleşeni tam sıfırsa)", () => {
    seedCustomSession({ DEPOSIT: 100, MONEY_MARKET: 0, BIST_EQUITY: 0, GOLD: 0, FX: 0 });
    renderResultPage();

    expect(rowContaining("ZZZ")).toBeUndefined();
    expect(rowContaining("AAA")).toBeUndefined();
    expect(rowContaining("FXX")).toBeUndefined();
    // PPF hedefi de gerçekleşeni de tam 0 olduğu için (bu senaryoda taşınacak
    // hiçbir artık da yok) PPF satırı da gizlenir.
    expect(rowContaining("PKT")).toBeUndefined();
  });

  it("Özel dağılımda PPF'ye %0 verilip diğer fonlarda tam pay artığı varsa: PPF satırı gizlenir, artık Cari Hesap'a gider, toplam portföy kontrolü birebir tutar", () => {
    // BIST/GOLD/FX %20'şer, fiyatları (10/20/5 TL) 1.000.005'in %20'sini
    // (200.001) tam bölmüyor -> her biri 1 TL artık bırakıyor (toplam 3 TL).
    seedCustomSession(
      { DEPOSIT: 40, MONEY_MARKET: 0, BIST_EQUITY: 20, GOLD: 20, FX: 20 },
      { totalAmountInput: "1000005" },
    );
    renderResultPage();

    // PPF'nin PLANLANAN %0 tercihi korunuyor: artık PPF'ye hiç eklenmiyor,
    // hedefi de gerçekleşeni de 0 kaldığı için satırı gösterilmiyor.
    expect(rowContaining("PKT")).toBeUndefined();

    const cashRow = Array.from(document.querySelectorAll(".data-table tbody tr")).find(
      (r) => r.querySelector("td")?.textContent?.trim() === "Cari Hesap",
    ) as HTMLElement;
    // 1+1+1 = 3 TL, eskiden PPF'ye aktarılırdı; şimdi doğrudan Cari Hesap'ta.
    expect(cashRow.querySelectorAll("td")[5]?.textContent).toBe("₺3");

    // mevduat + fonlara yatırılan gerçek tutar + cari hesap birebir tutara eşit.
    const totalRow = screen.getByText("Toplam Portföy").closest(".kv-row") as HTMLElement;
    expect(totalRow.textContent).toContain("1.000.005");

    // "Cari hesap bakiyesi beklenen aralıkta değil" yanlış-pozitif uyarısı
    // gösterilmemeli — bu artık beklenen/doğru bir durumdur.
    expect(screen.queryByText(/Cari hesap bakiyesi beklenen aralıkta değil/)).not.toBeInTheDocument();
  });

  it("döviz fonunda bir pay bile alınamayacak kadar küçük hedef tutar, PPF %0 iken TAMAMEN Cari Hesap'a gider", () => {
    // FX %4, toplam 100 -> hedef 4 TL; fiyat 5 TL olduğu için TEK bir pay
    // bile alınamıyor (shareCount=0, actualAmount=0) — hedefin TAMAMI (4 TL)
    // artığa dönüşüyor. Eskiden bu PPF'ye aktarılırdı; PPF %0 verildiği için
    // artık doğrudan Cari Hesap'ta kalmalı.
    seedCustomSession(
      { DEPOSIT: 96, MONEY_MARKET: 0, BIST_EQUITY: 0, GOLD: 0, FX: 4 },
      { totalAmountInput: "100" },
    );
    renderResultPage();

    const fxRow = rowContaining("FXX") as HTMLElement;
    expect(fxRow.querySelectorAll("td")[4]?.textContent).toBe("0"); // pay adedi
    expect(fxRow.querySelectorAll("td")[5]?.textContent).toBe("₺0"); // hesaplanan tutar

    expect(rowContaining("PKT")).toBeUndefined();
    const cashRow = Array.from(document.querySelectorAll(".data-table tbody tr")).find(
      (r) => r.querySelector("td")?.textContent?.trim() === "Cari Hesap",
    ) as HTMLElement;
    expect(cashRow.querySelectorAll("td")[5]?.textContent).toBe("₺4");

    const totalRow = screen.getByText("Toplam Portföy").closest(".kv-row") as HTMLElement;
    expect(totalRow.textContent).toContain("₺100");
  });

  it("özel dağılım toplamı %100 değilken (bozuk/eski veri) hesaplama sayfasına yönlendirir", () => {
    seedCustomSession({ DEPOSIT: 40, MONEY_MARKET: 10, BIST_EQUITY: 20, GOLD: 20, FX: 5 }); // toplam 95
    renderResultPage();
    expect(screen.getByText("HESAPLAMA GİRİŞ SAYFASI")).toBeInTheDocument();
  });

  it("sayfa yeniden render edildiğinde (sessionStorage) özel dağılım kaybolmaz", () => {
    seedCustomSession({ DEPOSIT: 40, MONEY_MARKET: 10, BIST_EQUITY: 20, GOLD: 20, FX: 10 });
    const { unmount } = renderResultPage();
    expect(screen.getByText("Özel Dağılım")).toBeInTheDocument();
    unmount();

    renderResultPage();
    expect(screen.getByText("Özel Dağılım")).toBeInTheDocument();
    expect(rowContaining("ZZZ")?.querySelectorAll("td")[1]?.textContent).toBe("%20");
  });

  it("hazır profillerden birine geçilirse özel oranlar hesaplamaya karışmaz", () => {
    // Özel oranlar sessionStorage'da dursa bile selectedProfileId gerçek bir profile işaret ediyorsa yok sayılmalı.
    sessionStorage.setItem(
      "fonPortfoy.calculatorSelection.v1",
      JSON.stringify({
        totalAmountInput: "1000000",
        selectedProfileId: "p1",
        overrides: {},
        customAllocations: { DEPOSIT: 0, MONEY_MARKET: 0, BIST_EQUITY: 0, GOLD: 0, FX: 100 },
      }),
    );
    renderResultPage();
    expect(screen.getByText("Test Profili")).toBeInTheDocument();
    expect(screen.queryByText("Özel Dağılım")).not.toBeInTheDocument();
    // "Test Profili" mockData'sındaki DEPOSIT:40 kullanılmalı, özel FX:100 DEĞİL.
    const depositRow = Array.from(document.querySelectorAll(".data-table tbody tr")).find(
      (r) => r.querySelector("td")?.textContent?.trim() === "Mevduat",
    ) as HTMLElement;
    expect(depositRow.querySelectorAll("td")[1]?.textContent).toBe("%40");
  });

  it("PPF %0 iken bir fon override'ı (fon değiştirmeden dönüş) uygulansa bile PPF baskılama politikası korunur", () => {
    sessionStorage.setItem(
      "fonPortfoy.calculatorSelection.v1",
      JSON.stringify({
        totalAmountInput: "1000005",
        selectedProfileId: "custom",
        overrides: { BIST_EQUITY: "fund-bist" },
        customAllocations: { DEPOSIT: 40, MONEY_MARKET: 0, BIST_EQUITY: 20, GOLD: 20, FX: 20 },
      }),
    );
    renderResultPage();

    expect(rowContaining("PKT")).toBeUndefined();
    const cashRow = Array.from(document.querySelectorAll(".data-table tbody tr")).find(
      (r) => r.querySelector("td")?.textContent?.trim() === "Cari Hesap",
    ) as HTMLElement;
    expect(cashRow.querySelectorAll("td")[5]?.textContent).toBe("₺3");
  });
});

describe("CalculationResultPage — kur yükleniyor/hata durumları (BKY gibi USD fiyatlı bir fon)", () => {
  function seedFxUsdSession(selectedProfileId: string, customAllocations?: Record<string, number>) {
    sessionStorage.setItem(
      "fonPortfoy.calculatorSelection.v1",
      JSON.stringify({
        totalAmountInput: "1000000",
        selectedProfileId,
        overrides: {},
        ...(customAllocations ? { customAllocations } : {}),
      }),
    );
  }

  it("10-11. kur isteği sürerken 'döviz kuru eksik' hatası GÖRÜNMEZ, bunun yerine nötr 'Kur bilgisi yükleniyor…' durumu görünür", () => {
    useFxRatesMock.mockReturnValue({ rates: {}, loading: true, error: null });
    seedFxUsdSession("p-fx-usd");
    renderResultPage();

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Kur bilgisi yükleniyor…");
    expect(screen.queryByText(/Hesaplama yapılamıyor/)).not.toBeInTheDocument();
    expect(screen.queryByText(/döviz kuru eksik/)).not.toBeInTheDocument();
    // Hata görünümünde (banner-danger) DEĞİL.
    expect(document.querySelector(".banner-danger")).not.toBeInTheDocument();
  });

  it("12. kur başarıyla gelince hesaplama doğru sonuçla görüntülenir", () => {
    useFxRatesMock.mockReturnValue({
      rates: {
        USD: {
          id: "fx1",
          currency: "USD",
          rate_to_try: "34.10",
          rate_date: "2026-09-04",
          source: "TCMB",
          fetched_at: "2026-09-05T04:00:00Z",
        },
      },
      loading: false,
      error: null,
    });
    seedFxUsdSession("p-fx-usd");
    renderResultPage();

    expect(screen.getByText("Pay Hesaplama Özeti")).toBeInTheDocument();
    expect(screen.queryByText(/Hesaplama yapılamıyor/)).not.toBeInTheDocument();
    expect(rowContaining("BKYTEST")).toBeDefined();
  });

  it("13. istek başarıyla tamamlanmış ama gerekli kur GERÇEKTEN bulunamamışsa mevcut anlaşılır hata gösterilir", () => {
    // loading:false, error:null (istek başarısız değil) ama rates boş -> gerçekten eksik.
    useFxRatesMock.mockReturnValue({ rates: {}, loading: false, error: null });
    seedFxUsdSession("p-fx-usd");
    renderResultPage();

    expect(screen.getByText("Hesaplama yapılamıyor.")).toBeInTheDocument();
    expect(screen.getByText(/döviz kuru eksik/)).toBeInTheDocument();
  });

  it("14. kur isteği ağ hatasıyla biterse yüklenmede takılı kalmaz, ayrı ve anlaşılır bir hata gösterir", () => {
    useFxRatesMock.mockReturnValue({ rates: {}, loading: false, error: "network down" });
    seedFxUsdSession("p-fx-usd");
    renderResultPage();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText(/Döviz kuru bilgisi alınamadı/)).toBeInTheDocument();
    expect(screen.getByText(/network down/)).toBeInTheDocument();
    // Bu, "gerçekten eksik kur" (MISSING_FX_RATE) mesajıyla KARIŞTIRILMAMALI.
    expect(screen.queryByText(/Hesaplama yapılamıyor\./)).not.toBeInTheDocument();
  });

  it("15. hazır profil ve Özel profil aynı yükleniyor davranışını kullanır", () => {
    useFxRatesMock.mockReturnValue({ rates: {}, loading: true, error: null });
    seedFxUsdSession("custom", { DEPOSIT: 40, MONEY_MARKET: 10, BIST_EQUITY: 20, GOLD: 20, FX: 10 });
    renderResultPage();

    expect(screen.getByRole("status")).toHaveTextContent("Kur bilgisi yükleniyor…");
  });

  it("16. TL portföyü (p1, hiç döviz fonu yok) kur bekleme durumundan hiç etkilenmez", () => {
    // useFxRatesMock varsayılanı zaten { loading:false } - TL profilinin
    // hiçbir zaman bu duruma girmediğini kanıtlamak için burada da AÇIKÇA
    // aynı değeri set ediyoruz; asıl "hiç istek atılmaz" garantisi
    // useFxRates.test.ts'teki hook birim testlerinde doğrulanır.
    useFxRatesMock.mockReturnValue({ rates: {}, loading: false, error: null });
    seedSession(); // p1, tamamı TRY
    renderResultPage();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Pay Hesaplama Özeti")).toBeInTheDocument();
  });
});
