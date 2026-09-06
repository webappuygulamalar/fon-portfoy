import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { FundsPage } from "./FundsPage";
import type { FundExplorerRow } from "../../hooks/useFundsExplorer";

function makeRow(overrides: Partial<FundExplorerRow> & Pick<FundExplorerRow, "id" | "code">): FundExplorerRow {
  return {
    name: overrides.code,
    managementCompany: "Test Portföy",
    assetClass: null,
    catalogCategory: null,
    fundType: "Yatırım Fonu",
    currency: "TRY",
    riskValue: 3,
    isSubstitutionEligible: false,
    price: 1,
    priceDate: "2026-01-01",
    fundSize: null,
    investorCount: 200,
    return1m: null,
    return3m: null,
    returnYtd: null,
    return1y: null,
    verificationNeeded: false,
    ...overrides,
  };
}

const rows: FundExplorerRow[] = [
  makeRow({
    id: "1",
    code: "PPK",
    name: "Test Para Piyasası Fonu",
    catalogCategory: "Para Piyasası & Kısa Vade",
    fundSize: 343_400_000,
    return1m: 1.11,
    return3m: 5.55,
  }),
  makeRow({
    id: "2",
    code: "AAA",
    name: "Ana Hisse Fonu",
    catalogCategory: "Hisse Senedi",
    fundSize: 1_200_000,
    return1m: 2,
    return3m: null,
  }),
  makeRow({
    id: "3",
    code: "ZZZ",
    name: "Zirve Hisse Fonu",
    catalogCategory: "Hisse Senedi",
    fundSize: null,
    return1m: -1,
    return3m: 10,
  }),
];

vi.mock("../../hooks/useFundsExplorer", () => ({
  useFundsExplorer: () => ({ loading: false, error: null, rows }),
}));

describe("FundsPage — varlık sınıfı filtresinin kaldırılması", () => {
  it("'Tüm varlık sınıfları' combo box'ı artık gösterilmez", () => {
    const { queryByText, container } = render(<FundsPage />);
    expect(queryByText("Tüm varlık sınıfları")).not.toBeInTheDocument();
    // category, company, fundType, currency, risk, sort — 6 combo box kaldı.
    expect(container.querySelectorAll("select")).toHaveLength(6);
  });
});

describe("FundsPage — kategori filtresi sırası", () => {
  it("Tüm kategoriler, ardından Para Piyasası & Kısa Vade, ardından alfabetik sıra", () => {
    const { getByDisplayValue } = render(<FundsPage />);
    const select = getByDisplayValue("Tüm kategoriler") as HTMLSelectElement;
    const optionTexts = Array.from(select.options).map((o) => o.textContent);
    expect(optionTexts).toEqual(["Tüm kategoriler", "Para Piyasası & Kısa Vade", "Hisse Senedi"]);
  });
});

describe("FundsPage — varsayılan sıralama", () => {
  it("sıralama seçeneğinin başlangıç etiketi '3 ay getirisi (yüksekten düşüğe)' olur", () => {
    const { getByDisplayValue } = render(<FundsPage />);
    expect(getByDisplayValue("3 ay getirisi (yüksekten düşüğe)")).toBeInTheDocument();
  });

  it("fonları 3 aylık getiriye göre yüksekten düşüğe sıralar, eksik olan sonda kalır", () => {
    const { container } = render(<FundsPage />);
    const compact = container.querySelector(".fund-compact") as HTMLElement;
    const codes = Array.from(compact.querySelectorAll(".fund-compact-code")).map((el) => el.textContent);
    expect(codes).toEqual(["ZZZ", "PPK", "AAA"]);
  });
});

describe("FundsPage — mobil kompakt fon listesi", () => {
  it("1 Ay, 3 Ay ve Büyüklük başlıklarını ve değerlerini gösterir", () => {
    const { container } = render(<FundsPage />);
    const compact = container.querySelector(".fund-compact") as HTMLElement;
    const headTexts = Array.from(compact.querySelectorAll(".fund-compact-head span")).map((el) => el.textContent);
    expect(headTexts).toEqual(["Fon", "1 Ay", "3 Ay", "Büyüklük"]);

    const ppkRow = Array.from(compact.querySelectorAll(".fund-compact-row")).find((row) =>
      row.textContent?.includes("PPK"),
    ) as HTMLElement;
    const nums = Array.from(ppkRow.querySelectorAll(".fund-compact-num")).map((el) => el.textContent);
    expect(nums).toEqual(["+%1,11", "+%5,55", "343,4 mio ₺"]);
  });

  it("eksik veride sıfır/tahmini değer üretmez, — gösterir", () => {
    const { container } = render(<FundsPage />);
    const compact = container.querySelector(".fund-compact") as HTMLElement;

    // AAA: 3 aylık getirisi yok (null).
    const aaaRow = Array.from(compact.querySelectorAll(".fund-compact-row")).find((row) =>
      row.textContent?.includes("AAA"),
    ) as HTMLElement;
    expect(Array.from(aaaRow.querySelectorAll(".fund-compact-num")).map((el) => el.textContent)).toEqual([
      "+%2",
      "—",
      "1,2 mio ₺",
    ]);

    // ZZZ: fon büyüklüğü yok (null).
    const zzzRow = Array.from(compact.querySelectorAll(".fund-compact-row")).find((row) =>
      row.textContent?.includes("ZZZ"),
    ) as HTMLElement;
    expect(Array.from(zzzRow.querySelectorAll(".fund-compact-num")).map((el) => el.textContent)).toEqual([
      "-%1",
      "+%10",
      "—",
    ]);
  });
});
