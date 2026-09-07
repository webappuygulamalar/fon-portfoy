import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CalculatorPage } from "./CalculatorPage";
import { CalculatorSelectionProvider } from "../../context/CalculatorSelectionContext";
import type { PublishedModelData } from "../../hooks/usePublishedModel";

const mockProfiles: PublishedModelData["profiles"] = [
  {
    profileId: "p-dusuk-1",
    key: "dusuk_1",
    name: "Düşük 1",
    description: "Mevduat ağırlıklı düşük riskli model.",
    sortOrder: 1,
    allocations: { DEPOSIT: 85, MONEY_MARKET: 7, BIST_EQUITY: 3, GOLD: 3, FX: 2 },
    preferredFundIdByAssetClass: {},
  },
  {
    profileId: "p-yuksek",
    key: "yuksek",
    name: "Yüksek",
    description: "Hisse ağırlıklı yüksek riskli model.",
    sortOrder: 2,
    allocations: { DEPOSIT: 15, MONEY_MARKET: 5, BIST_EQUITY: 65, GOLD: 10, FX: 5 },
    preferredFundIdByAssetClass: {},
  },
];

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
  profiles: mockProfiles,
  fundsById: {},
  latestPriceByFundId: {},
  returnsByFundId: {},
};

vi.mock("../../hooks/usePublishedModel", () => ({
  usePublishedModel: () => ({ loading: false, error: null, data: mockData }),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <CalculatorSelectionProvider>
        <Routes>
          <Route path="/" element={<CalculatorPage />} />
          <Route path="/hesaplama/sonuc" element={<div>SONUÇ SAYFASI</div>} />
        </Routes>
      </CalculatorSelectionProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
});

describe("CalculatorPage — Risk Profili combo box'ının kaldırılması", () => {
  it("artık bir 'Risk Profili' select elemanı yok", () => {
    renderPage();
    expect(document.querySelector("#risk-profile")).not.toBeInTheDocument();
    expect(document.querySelector("select")).not.toBeInTheDocument();
  });
});

describe("CalculatorPage — risk profili kartları", () => {
  it("bütün aktif risk profillerini kart olarak gösterir", () => {
    renderPage();
    expect(screen.getByText("Düşük 1")).toBeInTheDocument();
    expect(screen.getByText("Yüksek")).toBeInTheDocument();
    expect(document.querySelectorAll(".risk-profile-card")).toHaveLength(2);
  });

  it("bir karta tıklamak o profili seçili yapar (aria-pressed + doğru profil)", () => {
    renderPage();
    const cards = document.querySelectorAll(".risk-profile-card");
    fireEvent.click(cards[1]); // "Yüksek"
    expect(cards[1]).toHaveAttribute("aria-pressed", "true");
    expect(cards[0]).toHaveAttribute("aria-pressed", "false");
    expect(cards[1]).toHaveClass("selected");
  });

  it("Mevduat + PPF grafikte tek kategoride birleşir, legend toplamı %100'dür", () => {
    renderPage();
    const firstCard = document.querySelectorAll(".risk-profile-card")[0];
    const legendRows = firstCard.querySelectorAll(".risk-profile-legend-row");
    const pctTexts = Array.from(legendRows).map((r) => r.querySelector(".risk-profile-legend-pct")?.textContent ?? "");
    // "%92", "%3", "%3", "%2" -> Mevduat(85)+PPF(7)=92 birleşik.
    expect(pctTexts).toEqual(["%92", "%3", "%3", "%2"]);
    const total = pctTexts.reduce((sum, t) => sum + Number(t.replace("%", "").replace(",", ".")), 0);
    expect(total).toBe(100);
    expect(firstCard.textContent).toContain("Mevduat/Para Piyasası Fonu");
  });
});

describe("CalculatorPage — hesapla akışı ve doğrulama", () => {
  it("tutar veya profil eksikken 'Portföyü Hesapla' devre dışıdır ve doğrulama mesajı gösterir", () => {
    renderPage();
    const button = screen.getByRole("button", { name: "Portföyü Hesapla" });
    expect(button).toBeDisabled();
    expect(screen.getByText(/Devam etmek için toplam portföy tutarını girin/)).toBeInTheDocument();
  });

  it("yalnızca profil seçiliyken (tutar boş) doğru doğrulama mesajını gösterir", () => {
    renderPage();
    fireEvent.click(document.querySelectorAll(".risk-profile-card")[0]);
    expect(screen.getByText(/Devam etmek için toplam portföy tutarını girin/)).toBeInTheDocument();
  });

  it("tutar girilip profil seçildiğinde buton aktif olur ve tıklanınca /hesaplama/sonuc'a gider", () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Toplam Portföy Tutarı (TL)"), { target: { value: "6000000" } });
    fireEvent.click(document.querySelectorAll(".risk-profile-card")[0]);

    const button = screen.getByRole("button", { name: "Portföyü Hesapla" });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);

    expect(screen.getByText("SONUÇ SAYFASI")).toBeInTheDocument();
  });
});
