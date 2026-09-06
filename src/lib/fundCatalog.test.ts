import { describe, expect, it } from "vitest";
import {
  DEFAULT_FUND_SORT_KEY,
  PRIORITY_CATALOG_CATEGORY,
  sortCatalogCategoriesForFilter,
  sortFundRows,
  type FundSortableRow,
} from "./fundCatalog";

function row(overrides: Partial<FundSortableRow> & Pick<FundSortableRow, "code">): FundSortableRow {
  return {
    name: overrides.code,
    fundSize: null,
    return1m: null,
    return3m: null,
    returnYtd: null,
    return1y: null,
    ...overrides,
  };
}

describe("sortCatalogCategoriesForFilter — kategori seçenek sırası", () => {
  it("para piyasası kategorisini varsa en başa alır, geri kalanı alfabetik sıralar", () => {
    const result = sortCatalogCategoriesForFilter([
      "Hisse Senedi",
      "Kira Sertifikası (Sukuk)",
      PRIORITY_CATALOG_CATEGORY,
      "Altın & Kıymetli Maden",
    ]);
    expect(result).toEqual([
      PRIORITY_CATALOG_CATEGORY,
      "Altın & Kıymetli Maden",
      "Hisse Senedi",
      "Kira Sertifikası (Sukuk)",
    ]);
  });

  it("para piyasası kategorisi yoksa yalnızca alfabetik sıralar", () => {
    const result = sortCatalogCategoriesForFilter(["Hisse Senedi", "Altın & Kıymetli Maden"]);
    expect(result).toEqual(["Altın & Kıymetli Maden", "Hisse Senedi"]);
  });

  it("yinelenen kategorileri tekilleştirir", () => {
    const result = sortCatalogCategoriesForFilter([PRIORITY_CATALOG_CATEGORY, PRIORITY_CATALOG_CATEGORY, "Hisse Senedi"]);
    expect(result).toEqual([PRIORITY_CATALOG_CATEGORY, "Hisse Senedi"]);
  });

  it("boş listede boş dizi döner", () => {
    expect(sortCatalogCategoriesForFilter([])).toEqual([]);
  });
});

describe("sortFundRows — varsayılan sıralama (3 ay getirisi)", () => {
  it("varsayılan sıralama anahtarı 3 aylık getiridir", () => {
    expect(DEFAULT_FUND_SORT_KEY).toBe("return3m");
  });

  it("3 aylık getiriyi yüksekten düşüğe sıralar", () => {
    const rows = [
      row({ code: "AAA", return3m: 1.5 }),
      row({ code: "BBB", return3m: 5.2 }),
      row({ code: "CCC", return3m: -2.1 }),
    ];
    const result = sortFundRows(rows, "return3m");
    expect(result.map((r) => r.code)).toEqual(["BBB", "AAA", "CCC"]);
  });

  it("3 aylık getirisi olmayan fonları listenin sonuna koyar", () => {
    const rows = [
      row({ code: "AAA", return3m: null }),
      row({ code: "BBB", return3m: 5.2 }),
      row({ code: "CCC", return3m: -2.1 }),
      row({ code: "DDD", return3m: null }),
    ];
    const result = sortFundRows(rows, "return3m");
    expect(result.map((r) => r.code)).toEqual(["BBB", "CCC", "AAA", "DDD"]);
  });

  it("eşit 3 aylık getiride fon koduna göre A-Z sıralar (kararlı)", () => {
    const rows = [
      row({ code: "ZKP", return3m: 3.0 }),
      row({ code: "ABC", return3m: 3.0 }),
      row({ code: "MID", return3m: 3.0 }),
    ];
    const result = sortFundRows(rows, "return3m");
    expect(result.map((r) => r.code)).toEqual(["ABC", "MID", "ZKP"]);
  });

  it("3 aylık getirisi olmayan fonlar kendi aralarında koda göre A-Z sıralanır", () => {
    const rows = [row({ code: "ZKP", return3m: null }), row({ code: "ABC", return3m: null })];
    const result = sortFundRows(rows, "return3m");
    expect(result.map((r) => r.code)).toEqual(["ABC", "ZKP"]);
  });
});

describe("sortFundRows — diğer sıralama seçenekleri", () => {
  it("ada göre A-Z sıralar", () => {
    const rows = [row({ code: "A1", name: "Ziraat Fonu" }), row({ code: "A2", name: "Ak Fonu" })];
    expect(sortFundRows(rows, "name").map((r) => r.code)).toEqual(["A2", "A1"]);
  });

  it("koda göre A-Z sıralar", () => {
    const rows = [row({ code: "ZZZ" }), row({ code: "AAA" })];
    expect(sortFundRows(rows, "code").map((r) => r.code)).toEqual(["AAA", "ZZZ"]);
  });

  it("büyüklüğe göre çoktan aza sıralar, veri yoksa sonda kalır", () => {
    const rows = [
      row({ code: "A", fundSize: 100 }),
      row({ code: "B", fundSize: null }),
      row({ code: "C", fundSize: 500 }),
    ];
    expect(sortFundRows(rows, "fundSize").map((r) => r.code)).toEqual(["C", "A", "B"]);
  });

  it("1 aylık getiriye göre çoktan aza sıralar", () => {
    const rows = [row({ code: "A", return1m: -1 }), row({ code: "B", return1m: 2 })];
    expect(sortFundRows(rows, "return1m").map((r) => r.code)).toEqual(["B", "A"]);
  });

  it("orijinal diziyi değiştirmez", () => {
    const rows = [row({ code: "B", return3m: 1 }), row({ code: "A", return3m: 2 })];
    const original = [...rows];
    sortFundRows(rows, "return3m");
    expect(rows).toEqual(original);
  });
});
