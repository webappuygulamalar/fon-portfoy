import type { FundLineResult } from "../../domain/calculation/types";

/**
 * Pay Hesaplama Özeti'nde fon satırlarının GÖSTERİM sırasını belirler:
 * Para Piyasası Katılım Fonu (varsa) en önde, ardından kalan fonlar model
 * yüzdesine göre büyükten küçüğe. Mevduat ve Cari Hesap bu listenin
 * dışında, çağıran tarafından ayrıca (sırasıyla en başta ve en sonda)
 * render edilir.
 *
 * Bu SADECE bir gösterim sıralamasıdır — `calculatePortfolio` motorunun
 * PPF'yi diğer fonların kalanını topladıktan sonra en son hesaplama sırası
 * değişmez (bkz. engine.ts). `Array.prototype.sort` ES2019'dan beri
 * kararlıdır, bu yüzden eşit yüzdeli fonlar `fundLines`'taki (yani
 * SHARE_BASED_ASSET_CLASSES'teki) orijinal model sırasını korur ve sonuç
 * her çağrıda aynıdır.
 */
export function orderFundLinesForDisplay(
  fundLines: FundLineResult[],
  moneyMarketLine: FundLineResult | null,
): FundLineResult[] {
  const sortedFundLines = [...fundLines].sort((a, b) => b.percentage - a.percentage);
  return [moneyMarketLine, ...sortedFundLines].filter((l): l is FundLineResult => l !== null);
}
