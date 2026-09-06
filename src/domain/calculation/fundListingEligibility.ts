/** TEFAS'ın `fonTipi=YAT` dışındaki tüm fonlara verdiği tür adı (bkz. tefas-sync/index.ts). */
const EXCHANGE_TRADED_FUND_TYPE = "Borsa Yatırım Fonu";

export interface FundListingCandidate {
  /** TEFAS/referans katalog/KAP risk değeri (1-7). Bilinmiyorsa null. */
  riskValue: number | null;
  /** Son fiyat kaydındaki yatırımcı sayısı. Bilinmiyorsa (TEFAS vermemişse) null. */
  investorCount: number | null;
  /** "Yatırım Fonu" | "Borsa Yatırım Fonu" | null. */
  fundType: string | null;
}

/**
 * Kullanıcıya gösterilen fon listelerinde (Fonlar kataloğu, fon değiştirme
 * seçim listesi) ORTAK asgari uygunluk kuralı — bu iki sayfanın tek
 * doğruluk kaynağıdır (bkz. useFundsExplorer).
 *
 * Kurallar:
 *  1. Risk değeri bilinmeyen (null) fon gösterilmez — kullanıcıya risksiz
 *     görünüp yanıltmaması için.
 *  2. Yatırımcı sayısı BİLİNEN VE 50'nin altında olan fon gösterilmez (çok
 *     küçük/yeni fonlar) — ANCAK bu kural Borsa Yatırım Fonu (BYF/ETF) tipi
 *     fonlara uygulanmaz: TEFAS'ın "yatırımcı sayısı" alanı doğrudan
 *     katılma payı sahibi sayısını sayar, BYF paylarıysa borsada hisse gibi
 *     el değiştirdiğinden bu alan onlar için hiç anlamlı doldurulmuyor
 *     (canlı veride 12 BYF'nin TAMAMI 0/null gösteriyor — ZKP/ZGD gibi
 *     büyük, likit, model portföyde fiilen kullanılan fonlar dahil). Bu
 *     yüzden BYF'lerde investorCount, null ile aynı muameleyi görür.
 *  3. Yatırımcı sayısı BİLİNMEYEN (null) fon bu kuralla ASLA elenmez —
 *     "muhtemelen 50'nin altındadır" diye TAHMİN EDİLMEZ, olduğu gibi
 *     gösterilmeye devam eder.
 *
 * Bu, yalnızca GÖSTERİM/SEÇİM katmanında bir filtredir: fon veritabanından
 * silinmez, TEFAS/KAP senkronizasyonundan çıkarılmaz, ve zaten yayınlanmış
 * bir modelin hesaplama motoru (bkz. usePublishedModel) bu filtreden
 * TAMAMEN bağımsızdır — model bu kurala uymayan bir fonu tercih ediyorsa
 * hesaplama yine de doğru çalışır (bkz. AdminModelEditorPage'deki uyarı).
 */
export function isFundEligibleForListing(candidate: FundListingCandidate): boolean {
  if (candidate.riskValue === null) return false;
  const investorCountApplies = candidate.fundType !== EXCHANGE_TRADED_FUND_TYPE;
  if (investorCountApplies && candidate.investorCount !== null && candidate.investorCount < 50) return false;
  return true;
}
