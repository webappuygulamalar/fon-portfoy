import { ASSET_CLASS_LABELS, type AssetClass } from "../../lib/constants";

export interface RiskProfileChartCategory {
  key: string;
  label: string;
  /** Tam sayı, 0-100 aralığında. */
  percentage: number;
  /** CSS renk değeri (değişken referansı veya sabit hex). */
  color: string;
}

const DEPOSIT_MM_KEY = "DEPOSIT_MONEY_MARKET";
const DEPOSIT_MM_LABEL = "Mevduat/Para Piyasası Fonu";

/** Grafik/legend için, ASSET_CLASS_LABELS'tan daha kısa, gösterime özel adlar. */
const CHART_CATEGORY_LABEL: Partial<Record<AssetClass, string>> = {
  BIST_EQUITY: "Hisse",
  GOLD: "Altın",
  FX: "USD/Döviz",
};

const CHART_CATEGORY_COLOR: Record<string, string> = {
  [DEPOSIT_MM_KEY]: "var(--color-mint)",
  BIST_EQUITY: "var(--color-chart-blue)",
  GOLD: "var(--color-gold)",
  FX: "var(--color-chart-violet)",
};

/** Bilinmeyen/gelecekte eklenebilecek bir varlık sınıfı için nötr yedek renk. */
const FALLBACK_COLOR = "var(--color-text-faint)";

// Mevduat/PPF birleşiminden sonraki kanonik gösterim sırası — hesaplama
// motorunun SHARE_BASED_ASSET_CLASSES sırasıyla aynı (bkz. lib/constants.ts).
const CANONICAL_ORDER: readonly AssetClass[] = ["BIST_EQUITY", "GOLD", "FX"];

/**
 * Bir risk profilinin model dağılımını, risk kartındaki pasta/donut grafik
 * ve legend için gösterim kategorilerine dönüştürür:
 *  - Mevduat + Para Piyasası Fonu TEK kategoride birleştirilir
 *    ("Mevduat/Para Piyasası Fonu") — YALNIZCA burada, gösterim amaçlı.
 *  - Diğer sınıflar kısa, kullanıcı dostu adlarla (Hisse, Altın, USD/Döviz)
 *    ayrı ayrı gösterilir.
 *  - `ASSET_CLASSES` bugün 5 sabit değerle sınırlı olsa da, ileride model
 *    şemasına eklenebilecek herhangi bir sınıf burada KAYBOLMAZ — bilinen
 *    5 sınıfın dışında kalan (yüzdesi > 0 olan) her anahtar, alfabetik
 *    sırayla, ASSET_CLASS_LABELS'tan gelen adla listenin sonuna eklenir.
 *  - Yüzdesi 0 (veya tanımsız) olan kategoriler listelenmez.
 *
 * Bu fonksiyon SAF ve YALNIZCA GÖSTERİM amaçlıdır: hesaplama motorunun
 * kullandığı gerçek `AllocationInput[]` dizisini üretmez/değiştirmez —
 * `distribution`/`fundLines` içindeki Mevduat ve PPF ayrı kalmaya devam
 * eder (bkz. CalculationSummary, fundLineOrder.ts).
 */
export function buildRiskProfileChartCategories(
  allocations: Partial<Record<AssetClass, number>>,
): RiskProfileChartCategory[] {
  const categories: RiskProfileChartCategory[] = [];

  const depositPct = allocations.DEPOSIT ?? 0;
  const moneyMarketPct = allocations.MONEY_MARKET ?? 0;
  const mergedPct = depositPct + moneyMarketPct;
  if (mergedPct > 0) {
    categories.push({
      key: DEPOSIT_MM_KEY,
      label: DEPOSIT_MM_LABEL,
      percentage: mergedPct,
      color: CHART_CATEGORY_COLOR[DEPOSIT_MM_KEY],
    });
  }

  for (const assetClass of CANONICAL_ORDER) {
    const pct = allocations[assetClass] ?? 0;
    if (pct <= 0) continue;
    categories.push({
      key: assetClass,
      label: CHART_CATEGORY_LABEL[assetClass] ?? ASSET_CLASS_LABELS[assetClass],
      percentage: pct,
      color: CHART_CATEGORY_COLOR[assetClass] ?? FALLBACK_COLOR,
    });
  }

  const knownKeys = new Set<string>(["DEPOSIT", "MONEY_MARKET", ...CANONICAL_ORDER]);
  const extraKeys = (Object.keys(allocations) as AssetClass[])
    .filter((key) => !knownKeys.has(key) && (allocations[key] ?? 0) > 0)
    .sort((a, b) => a.localeCompare(b, "tr-TR"));
  for (const key of extraKeys) {
    categories.push({
      key,
      label: ASSET_CLASS_LABELS[key] ?? key,
      percentage: allocations[key] ?? 0,
      color: FALLBACK_COLOR,
    });
  }

  return categories;
}
