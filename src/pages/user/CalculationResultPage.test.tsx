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
  ],
  fundsById: {
    "fund-mm": mkFund({ id: "fund-mm", code: "PKT" }),
    "fund-bist": mkFund({ id: "fund-bist", code: "ZZZ" }),
    "fund-gold": mkFund({ id: "fund-gold", code: "AAA" }),
    "fund-fx": mkFund({ id: "fund-fx", code: "FXX" }),
  },
  latestPriceByFundId: {
    "fund-mm": mkPrice("fund-mm", "1.5"),
    "fund-bist": mkPrice("fund-bist", "10"),
    "fund-gold": mkPrice("fund-gold", "20"),
    "fund-fx": mkPrice("fund-fx", "5"),
  },
  returnsByFundId: {
    "fund-mm": mkReturn("fund-mm", "1.11"),
    "fund-bist": mkReturn("fund-bist", "3.24"), // pozitif
    "fund-gold": mkReturn("fund-gold", "-2.10"), // negatif
    // fund-fx: kayıt yok -> eksik veri (—)
  },
};

vi.mock("../../hooks/usePublishedModel", () => ({
  usePublishedModel: () => ({ loading: false, error: null, data: mockData }),
}));

// Test fonlarının tamamı TRY olduğundan gerçek useFxRates zaten {} dönerdi;
// burada mock'lanması yalnızca gerçek Supabase istemcisinin (supabaseClient.ts)
// bu birim testinde hiç yüklenmemesini sağlar.
vi.mock("../../hooks/useFxRates", () => ({
  useFxRates: () => ({}),
}));

function seedSession(overrides: Partial<{ totalAmountInput: string; selectedProfileId: string }> = {}) {
  sessionStorage.setItem(
    "fonPortfoy.calculatorSelection.v1",
    JSON.stringify({ totalAmountInput: "1000000", selectedProfileId: "p1", overrides: {}, ...overrides }),
  );
}

function renderResultPage(initialPath = "/hesaplama/sonuc") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <CalculatorSelectionProvider>
        <Routes>
          <Route path="/" element={<div>HESAPLAMA GİRİŞ SAYFASI</div>} />
          <Route path="/hesaplama/sonuc" element={<CalculationResultPage />} />
        </Routes>
      </CalculatorSelectionProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
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
