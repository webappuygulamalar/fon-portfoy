/**
 * Fonlar kataloğu (FundsPage) sıralama ve kategori filtresi için ortak,
 * test edilebilir mantık. Yalnızca GÖSTERİM sıralamasıdır — veritabanı,
 * senkronizasyon ve hesaplama motoru bundan bağımsızdır.
 */

export interface FundSortableRow {
  code: string;
  name: string;
  fundSize: number | null;
  return1m: number | null;
  return3m: number | null;
  returnYtd: number | null;
  return1y: number | null;
}

export type FundSortKey = "return3m" | "name" | "code" | "fundSize" | "return1m" | "returnYtd" | "return1y";

export const DEFAULT_FUND_SORT_KEY: FundSortKey = "return3m";

export const FUND_SORT_LABELS: Record<FundSortKey, string> = {
  return3m: "3 ay getirisi (yüksekten düşüğe)",
  name: "Ada göre (A-Z)",
  code: "Koda göre (A-Z)",
  fundSize: "Büyüklüğe göre (çoktan aza)",
  return1m: "1 ay getiriye göre",
  returnYtd: "Yılbaşından beri getiriye göre",
  return1y: "1 yıl getiriye göre",
};

function compareByCode<T extends Pick<FundSortableRow, "code">>(a: T, b: T): number {
  return a.code.localeCompare(b.code, "tr-TR");
}

/** Sayısal (getiri/büyüklük) alanlarda: büyükten küçüğe, veri yoksa (null) sonda, eşitlikte koda göre A-Z. */
function compareNumericDesc<T extends Pick<FundSortableRow, "code">>(
  av: number | null,
  bv: number | null,
  a: T,
  b: T,
): number {
  if (av === null && bv === null) return compareByCode(a, b);
  if (av === null) return 1;
  if (bv === null) return -1;
  if (av !== bv) return bv - av;
  return compareByCode(a, b);
}

/**
 * Fon satırlarını verilen ölçüte göre sıralar (kararlı — eşitliklerde her
 * zaman koda göre A-Z'ye düşer). Orijinal diziyi değiştirmez.
 */
export function sortFundRows<T extends FundSortableRow>(rows: readonly T[], sortKey: FundSortKey): T[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    switch (sortKey) {
      case "code":
        return compareByCode(a, b);
      case "name":
        return a.name.localeCompare(b.name, "tr-TR") || compareByCode(a, b);
      case "return1m":
        return compareNumericDesc(a.return1m, b.return1m, a, b);
      case "return3m":
        return compareNumericDesc(a.return3m, b.return3m, a, b);
      case "returnYtd":
        return compareNumericDesc(a.returnYtd, b.returnYtd, a, b);
      case "return1y":
        return compareNumericDesc(a.return1y, b.return1y, a, b);
      case "fundSize":
        return compareNumericDesc(a.fundSize, b.fundSize, a, b);
      default:
        return 0;
    }
  });
  return sorted;
}

/** TEFAS başlığından türetilen kategorilerden Fonlar filtresinde önce gösterilen. */
export const PRIORITY_CATALOG_CATEGORY = "Para Piyasası & Kısa Vade";

/**
 * Kategori filtresi seçeneklerini sıralar: önce (varsa) para piyasası
 * kategorisi, ardından geri kalanı alfabetik. "Tüm kategoriler" seçeneği
 * bu listenin dışındadır — çağıran tarafta ayrıca eklenir.
 */
export function sortCatalogCategoriesForFilter(categories: readonly string[]): string[] {
  const unique = [...new Set(categories)];
  const hasPriority = unique.includes(PRIORITY_CATALOG_CATEGORY);
  const rest = unique.filter((c) => c !== PRIORITY_CATALOG_CATEGORY).sort((a, b) => a.localeCompare(b, "tr-TR"));
  return hasPriority ? [PRIORITY_CATALOG_CATEGORY, ...rest] : rest;
}
