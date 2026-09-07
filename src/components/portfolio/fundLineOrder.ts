import type { FundLineResult } from "../../domain/calculation/types";
import type { ResolvedFundSelection } from "../../domain/calculation/buildInput";
import type { ProfileModel } from "../../domain/model/publishedModel";

/**
 * Para Piyasası Katılım Fonu dışındaki fonları model yüzdesine göre
 * büyükten küçüğe, eşit yüzdelerde fon koduna göre A-Z sıralar. Kod
 * bilinmiyorsa (fon seçilmemişse) o satır eşitlik grubunun en sonuna düşer.
 */
function compareByPercentageDescThenCode(
  a: { percentage: number; code: string | null },
  b: { percentage: number; code: string | null },
): number {
  if (a.percentage !== b.percentage) return b.percentage - a.percentage;
  if (a.code === null && b.code === null) return 0;
  if (a.code === null) return 1;
  if (b.code === null) return -1;
  return a.code.localeCompare(b.code, "tr-TR");
}

/**
 * Pay Hesaplama Özeti'nde fon satırlarının GÖSTERİM sırasını belirler:
 * Para Piyasası Katılım Fonu (varsa) en önde, ardından kalan fonlar model
 * yüzdesine göre büyükten küçüğe, eşit yüzdelerde fon koduna göre A-Z.
 * Mevduat ve Cari Hesap bu listenin dışında, çağıran tarafından ayrıca
 * (sırasıyla en başta ve en sonda) render edilir.
 *
 * Bu SADECE bir gösterim sıralamasıdır — `calculatePortfolio` motorunun
 * PPF'yi diğer fonların kalanını topladıktan sonra en son hesaplama sırası
 * değişmez (bkz. engine.ts).
 */
export function orderFundLinesForDisplay(
  fundLines: FundLineResult[],
  moneyMarketLine: FundLineResult | null,
): FundLineResult[] {
  const sortedFundLines = [...fundLines].sort((a, b) =>
    compareByPercentageDescThenCode({ percentage: a.percentage, code: a.fundCode }, { percentage: b.percentage, code: b.fundCode }),
  );
  return [moneyMarketLine, ...sortedFundLines].filter((l): l is FundLineResult => l !== null);
}

/**
 * Model Dağılımı bölümünde (AllocationEditor) fon seçimlerinin GÖSTERİM
 * sırasını belirler: Para Piyasası Katılım Fonu en önde, ardından kalan
 * varlık sınıfları PROFİLDEKİ model yüzdesine göre büyükten küçüğe, eşit
 * yüzdelerde seçili fonun koduna göre A-Z. Mevduat bu listenin dışında,
 * çağıran tarafından ayrıca (en başta) render edilir.
 *
 * `orderFundLinesForDisplay` ile aynı sıralama kuralını, hesaplama
 * SONUCU yerine (henüz hesaplama yapılmamış olabilir) profil + seçim
 * verisi üzerinden uygular.
 */
export function orderFundSelectionsForDisplay(
  selections: ResolvedFundSelection[],
  profile: ProfileModel,
): ResolvedFundSelection[] {
  const moneyMarket = selections.find((s) => s.assetClass === "MONEY_MARKET") ?? null;
  const rest = selections.filter((s) => s.assetClass !== "MONEY_MARKET");
  const sorted = [...rest].sort((a, b) =>
    compareByPercentageDescThenCode(
      { percentage: profile.allocations[a.assetClass] ?? 0, code: a.fund?.code ?? null },
      { percentage: profile.allocations[b.assetClass] ?? 0, code: b.fund?.code ?? null },
    ),
  );
  return moneyMarket ? [moneyMarket, ...sorted] : sorted;
}
