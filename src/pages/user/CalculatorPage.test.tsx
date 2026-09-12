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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <CalculatorSelectionProvider>
        <Routes>
          <Route path="/" element={<CalculatorPage />} />
          <Route path="/hesaplama/ozel" element={<div>ÖZEL DAĞILIM SAYFASI</div>} />
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
    // 2 gerçek profil + Özel kart.
    expect(document.querySelectorAll(".risk-profile-card")).toHaveLength(3);
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

function customCard(): HTMLElement {
  const cards = document.querySelectorAll(".risk-profile-card");
  return cards[cards.length - 1] as HTMLElement;
}

describe("CalculatorPage — Özel kartı", () => {
  it("hazır profillerden sonra, aynı tasarım dilinde (aynı sınıf) görünür", () => {
    renderPage();
    const cards = document.querySelectorAll(".risk-profile-card");
    expect(cards).toHaveLength(3);
    expect(cards[2].textContent).toContain("Özel");
    expect(cards[2].textContent).toContain("Yatırım dağılımınızı kendiniz oluşturun.");
  });

  it("gerçek bir <button>'dır — Tab/Enter/Space ile doğal klavye erişimi sağlar; toggle olmadığı için aria-pressed KULLANMAZ", () => {
    renderPage();
    const card = customCard();
    expect(card.tagName).toBe("BUTTON");
    expect(card).toHaveAttribute("type", "button");
    expect(card).not.toHaveAttribute("tabindex", "-1");
    expect(card).not.toHaveAttribute("aria-pressed");
  });

  it("tıklanınca AYNI SAYFADA inline bir düzenleyici AÇMAZ, bunun yerine ayrı #/hesaplama/ozel rotasına yönlendirir", () => {
    renderPage();
    fireEvent.click(customCard());

    // Ayrı rotaya gidildi: ana sayfanın hiçbir parçası (kartlar, satır içi
    // düzenleyici) artık DOM'da değil, hedef sayfanın içeriği görünüyor.
    expect(screen.getByText("ÖZEL DAĞILIM SAYFASI")).toBeInTheDocument();
    expect(screen.queryByTestId("custom-allocation-editor")).not.toBeInTheDocument();
    expect(document.querySelector(".custom-allocation-row")).not.toBeInTheDocument();
  });
});

describe("CalculatorPage — daha önce tamamlanmış bir özel dağılımla ana sayfaya dönüş", () => {
  function seedCompleteCustomSession() {
    sessionStorage.setItem(
      "fonPortfoy.calculatorSelection.v1",
      JSON.stringify({
        totalAmountInput: "1000000",
        selectedProfileId: "custom",
        overrides: {},
        customAllocations: { DEPOSIT: 40, MONEY_MARKET: 10, BIST_EQUITY: 20, GOLD: 20, FX: 10 },
      }),
    );
  }

  it("Özel kartı 'seçili' görünür (görsel — aria-pressed değil) ve inline düzenleyici YİNE DE açılmaz", () => {
    seedCompleteCustomSession();
    renderPage();
    expect(customCard()).toHaveClass("selected");
    expect(screen.queryByTestId("custom-allocation-editor")).not.toBeInTheDocument();
  });

  it("Portföyü Hesapla doğrudan aktiftir ve tıklanınca /hesaplama/sonuc'a gider (Özel sayfasına tekrar gitmeye gerek yok)", () => {
    seedCompleteCustomSession();
    renderPage();
    const button = screen.getByRole("button", { name: "Portföyü Hesapla" });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(screen.getByText("SONUÇ SAYFASI")).toBeInTheDocument();
  });

  it("özel dağılım toplamı %100 değilse buton yine devre dışıdır ve doğru doğrulama mesajını gösterir", () => {
    sessionStorage.setItem(
      "fonPortfoy.calculatorSelection.v1",
      JSON.stringify({
        totalAmountInput: "1000000",
        selectedProfileId: "custom",
        overrides: {},
        customAllocations: { DEPOSIT: 40, MONEY_MARKET: 10, BIST_EQUITY: 20, GOLD: 20, FX: 9 }, // toplam 99
      }),
    );
    renderPage();
    expect(screen.getByRole("button", { name: "Portföyü Hesapla" })).toBeDisabled();
    expect(screen.getByText(/Devam etmek için özel dağılım toplamını %100 yapın/)).toBeInTheDocument();
  });
});
