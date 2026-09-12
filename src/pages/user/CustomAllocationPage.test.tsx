import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CustomAllocationPage } from "./CustomAllocationPage";
import { CalculatorSelectionProvider } from "../../context/CalculatorSelectionContext";

const STORAGE_KEY = "fonPortfoy.calculatorSelection.v1";

function renderPage(initialPath = "/hesaplama/ozel") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <CalculatorSelectionProvider>
        <Routes>
          <Route path="/" element={<div>ANA SAYFA</div>} />
          <Route path="/hesaplama/ozel" element={<CustomAllocationPage />} />
          <Route path="/hesaplama/sonuc" element={<div>SONUÇ SAYFASI</div>} />
        </Routes>
      </CalculatorSelectionProvider>
    </MemoryRouter>,
  );
}

function pctInput(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

function seedSession(overrides: Record<string, unknown> = {}) {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ totalAmountInput: "", selectedProfileId: "", overrides: {}, ...overrides }),
  );
}

beforeEach(() => {
  sessionStorage.clear();
});

describe("CustomAllocationPage — ayrı ve odaklanmış adım", () => {
  it("3. yüzde giriş alanları sayfa açılır açılmaz (hiçbir tıklama olmadan) görünür", () => {
    renderPage();
    expect(pctInput("Mevduat")).toBeInTheDocument();
    expect(pctInput("Para Piyasası Katılım Fonu")).toBeInTheDocument();
    expect(pctInput("BIST Katılım Hisse Fonu")).toBeInTheDocument();
    expect(pctInput("Altın Katılım Fonu")).toBeInTheDocument();
    expect(pctInput("Döviz Katılım/Borçlanma Fonu")).toBeInTheDocument();
  });

  it("başlık 'Kendi Dağılımını Oluştur'dur ve üstte belirgin bir 'Geri dön' düğmesi vardır", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Kendi Dağılımını Oluştur" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Geri dön/ })).toBeInTheDocument();
  });

  it("'Geri dön' ana sayfaya döner", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Geri dön/ }));
    expect(screen.getByText("ANA SAYFA")).toBeInTheDocument();
  });

  it("sayfa ziyaret edilince selectedProfileId otomatik olarak 'custom' olur (sessionStorage'da doğrulanır)", () => {
    seedSession({ selectedProfileId: "p1" }); // önceden gerçek bir profil seçilmiş olabilir
    renderPage();
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored.selectedProfileId).toBe("custom");
  });

  it("doğrudan/bozuk state ile açılsa bile güvenli varsayılanlarla (yüzdeler %0) çalışır, ana sayfaya yönlendirmez", () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        totalAmountInput: "",
        selectedProfileId: "silinmis-profil-id",
        overrides: {},
        customAllocations: { DEPOSIT: "bozuk", GOLD: 999 },
      }),
    );
    renderPage();
    expect(screen.getByRole("heading", { name: "Kendi Dağılımını Oluştur" })).toBeInTheDocument();
    expect(pctInput("Mevduat").value).toBe("0");
    expect(pctInput("Altın Katılım Fonu").value).toBe("0");
  });
});

describe("CustomAllocationPage — toplam tutar korunumu", () => {
  it("4. Geri dön sonrası (yeniden ziyarette) girilen toplam tutar korunur", () => {
    const { unmount } = renderPage();
    fireEvent.change(screen.getByLabelText("Toplam Portföy Tutarı (TL)"), { target: { value: "2500000" } });
    unmount();

    renderPage();
    expect(screen.getByLabelText("Toplam Portföy Tutarı (TL)")).toHaveValue("2.500.000");
  });
});

describe("CustomAllocationPage — toplam kontrolü", () => {
  it("9a. %99 toplamda tamamlanmamış uyarısı gösterir ve hesapla butonunu devre dışı bırakır", () => {
    renderPage();
    fireEvent.change(pctInput("Mevduat"), { target: { value: "99" } });
    fireEvent.change(screen.getByLabelText("Toplam Portföy Tutarı (TL)"), { target: { value: "1000000" } });

    expect(screen.getByText(/Toplamın %100 olması için %1 daha dağıtmalısınız/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Portföyü Hesapla" })).toBeDisabled();
    expect(screen.getByText(/Devam etmek için özel dağılım toplamını %100 yapın/)).toBeInTheDocument();
  });

  it("9b. %100 toplamda olumlu (yeşil) durum gösterir ve hesapla aktif olur, tıklanınca /hesaplama/sonuc'a gider", () => {
    renderPage();
    fireEvent.change(pctInput("Mevduat"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Toplam Portföy Tutarı (TL)"), { target: { value: "1000000" } });

    expect(screen.getByText("Toplam %100 — hesaplamaya hazır.")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Portföyü Hesapla" });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(screen.getByText("SONUÇ SAYFASI")).toBeInTheDocument();
  });

  it("9c. %101 toplamda aşım uyarısı gösterir ve hesapla butonunu devre dışı bırakır", () => {
    renderPage();
    fireEvent.change(pctInput("Mevduat"), { target: { value: "100" } });
    fireEvent.change(pctInput("Altın Katılım Fonu"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Toplam Portföy Tutarı (TL)"), { target: { value: "1000000" } });

    expect(screen.getByText(/Toplam %100'ü %1 aşıyor/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Portföyü Hesapla" })).toBeDisabled();
  });

  it("negatif değer 0'a, 100'den büyük değer 100'e kırpılır (mevcut artı/eksi davranışı korunur)", () => {
    renderPage();
    const input = pctInput("Mevduat");
    fireEvent.change(input, { target: { value: "-5" } });
    expect(input.value).toBe("0");
    fireEvent.change(input, { target: { value: "250" } });
    expect(input.value).toBe("100");
  });

  it("+/- düğmeleri yüzdeyi birer birer değiştirir", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Mevduat yüzdesini bir artır" }));
    expect(pctInput("Mevduat").value).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Mevduat yüzdesini bir azalt" }));
    expect(pctInput("Mevduat").value).toBe("0");
  });

  it("tüm tutar tek bir kategoriye %100 verilebilir", () => {
    renderPage();
    fireEvent.change(pctInput("Döviz Katılım/Borçlanma Fonu"), { target: { value: "100" } });
    expect(screen.getByText("Toplam %100 — hesaplamaya hazır.")).toBeInTheDocument();
  });

  it("bazı kategoriler %0 bırakılabilir (toplamı 100 olduğu sürece)", () => {
    renderPage();
    fireEvent.change(pctInput("Mevduat"), { target: { value: "60" } });
    fireEvent.change(pctInput("Para Piyasası Katılım Fonu"), { target: { value: "40" } });
    expect(screen.getByText("Toplam %100 — hesaplamaya hazır.")).toBeInTheDocument();
    expect(pctInput("BIST Katılım Hisse Fonu").value).toBe("0");
  });
});

describe("CustomAllocationPage — oturum boyunca korunma", () => {
  it("6. sayfa yeniden render edildiğinde (sessionStorage) girilen yüzdeler korunur", () => {
    const { unmount } = renderPage();
    fireEvent.change(pctInput("Altın Katılım Fonu"), { target: { value: "35" } });
    unmount();

    renderPage();
    expect(pctInput("Altın Katılım Fonu").value).toBe("35");
  });

  it("8. fon değiştirme akışını simüle eden bir override sessionStorage'da olsa bile yüzdeler etkilenmez", () => {
    seedSession({
      selectedProfileId: "custom",
      overrides: { BIST_EQUITY: "fund-alt" },
      customAllocations: { DEPOSIT: 40, MONEY_MARKET: 10, BIST_EQUITY: 20, GOLD: 20, FX: 10 },
    });
    renderPage();
    expect(pctInput("Mevduat").value).toBe("40");
    expect(pctInput("BIST Katılım Hisse Fonu").value).toBe("20");
  });
});

describe("CustomAllocationPage — klavye erişilebilirliği", () => {
  it("yüzde giriş alanlarının görünür label'ı ve erişilebilir adı vardır", () => {
    renderPage();
    const input = pctInput("Mevduat");
    expect(input.id).toBeTruthy();
    expect(document.querySelector(`label[for="${input.id}"]`)?.textContent).toBe("Mevduat");
  });

  it("+/- düğmeleri gerçek <button>'dır (Tab/Enter/Space ile doğal erişim)", () => {
    renderPage();
    const btn = screen.getByRole("button", { name: "Mevduat yüzdesini bir artır" });
    expect(btn.tagName).toBe("BUTTON");
    expect(btn).toHaveAttribute("type", "button");
  });
});
