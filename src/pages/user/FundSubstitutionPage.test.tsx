import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FundSubstitutionPage } from "./FundSubstitutionPage";
import { CalculatorSelectionProvider } from "../../context/CalculatorSelectionContext";
import type { PublishedModelData } from "../../hooks/usePublishedModel";
import type { FundExplorerRow } from "../../hooks/useFundsExplorer";

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
      description: "",
      sortOrder: 1,
      allocations: { DEPOSIT: 40, MONEY_MARKET: 10, BIST_EQUITY: 20, GOLD: 20, FX: 10 },
      // p1'in KENDİ override'ı — Özel modda bu ASLA kullanılmamalı
      // (yanlışlıkla data.profiles[0]'a düşülürse bu fon "standart" görünür).
      preferredFundIdByAssetClass: { BIST_EQUITY: "fund-bist-p1-override" },
    },
  ],
  fundsById: {},
  latestPriceByFundId: {},
  returnsByFundId: {},
  defaultPreferredFundIdByAssetClass: {
    MONEY_MARKET: "fund-mm-default",
    BIST_EQUITY: "fund-bist-default",
    GOLD: "fund-gold-default",
    FX: "fund-fx-default",
  },
};

vi.mock("../../hooks/usePublishedModel", () => ({
  usePublishedModel: () => ({ loading: false, error: null, data: mockData }),
}));

const mockRows: FundExplorerRow[] = [
  {
    id: "fund-bist-default",
    code: "DEF",
    name: "Varsayılan Hisse Fonu",
    managementCompany: "Test Portföy",
    assetClass: "BIST_EQUITY",
    catalogCategory: null,
    fundType: "Yatırım Fonu",
    currency: "TRY",
    riskValue: 4,
    isSubstitutionEligible: true,
    price: 10,
    priceDate: "2026-09-10",
    fundSize: null,
    investorCount: null,
    return1m: null,
    return3m: null,
    returnYtd: null,
    return1y: null,
    verificationNeeded: false,
  },
  {
    id: "fund-bist-p1-override",
    code: "OVR",
    name: "P1'e Özel Hisse Fonu",
    managementCompany: "Test Portföy",
    assetClass: "BIST_EQUITY",
    catalogCategory: null,
    fundType: "Yatırım Fonu",
    currency: "TRY",
    riskValue: 4,
    isSubstitutionEligible: true,
    price: 10,
    priceDate: "2026-09-10",
    fundSize: null,
    investorCount: null,
    return1m: null,
    return3m: null,
    returnYtd: null,
    return1y: null,
    verificationNeeded: false,
  },
];

vi.mock("../../hooks/useFundsExplorer", () => ({
  useFundsExplorer: () => ({ loading: false, error: null, rows: mockRows }),
}));

function seedSession(selectedProfileId: string) {
  sessionStorage.setItem(
    "fonPortfoy.calculatorSelection.v1",
    JSON.stringify({
      totalAmountInput: "1000000",
      selectedProfileId,
      overrides: {},
      customAllocations: { DEPOSIT: 40, MONEY_MARKET: 10, BIST_EQUITY: 20, GOLD: 20, FX: 10 },
    }),
  );
}

function renderPage(assetClass = "BIST_EQUITY") {
  return render(
    <MemoryRouter initialEntries={[`/fon-degistir/${assetClass}`]}>
      <CalculatorSelectionProvider>
        <Routes>
          <Route path="/fon-degistir/:assetClass" element={<FundSubstitutionPage />} />
          <Route path="/hesaplama/sonuc" element={<div>SONUÇ SAYFASI</div>} />
        </Routes>
      </CalculatorSelectionProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
});

describe("FundSubstitutionPage — Özel dağılım standart fon çözümü", () => {
  it("Özel seçiliyken standart fon, ilk gerçek profilin override'ı DEĞİL, admin'in varsayılan (profile_id NULL) fonudur", () => {
    seedSession("custom");
    renderPage();

    // fund-bist-default = admin'in tüm profiller için varsayılanı -> "Standart fon" rozeti bunda olmalı.
    const rows = screen.getAllByText("Standart fon");
    expect(rows.length).toBeGreaterThan(0);

    // p1'e özel override (fund-bist-p1-override) Özel modda hiçbir zaman "standart" görünmemeli.
    expect(screen.getAllByText("P1'e Özel Hisse Fonu").length).toBeGreaterThan(0); // listede var...
    // ...ama "standart" olarak işaretli DEĞİL: aynı satırda rozet yok.
    const overrideCards = Array.from(document.querySelectorAll(".record-card, tr")).filter((el) =>
      el.textContent?.includes("OVR"),
    );
    for (const el of overrideCards) {
      expect(el.textContent).not.toContain("Standart fon");
    }
  });

  it("gerçek bir profil seçiliyken standart fon o profilin kendi override'ıdır (davranış değişmedi)", () => {
    seedSession("p1");
    renderPage();
    const overrideCards = Array.from(document.querySelectorAll(".record-card, tr")).filter((el) =>
      el.textContent?.includes("OVR"),
    );
    expect(overrideCards.length).toBeGreaterThan(0);
    for (const el of overrideCards) {
      expect(el.textContent).toContain("Standart fon");
    }
  });

  it("başlık metni Özel modda bir profil adı değil 'Özel dağılımınız için' der", () => {
    seedSession("custom");
    renderPage();
    expect(screen.getByText(/Özel dağılımınız için/)).toBeInTheDocument();
    expect(screen.queryByText(/Test Profili profili için/)).not.toBeInTheDocument();
  });
});
