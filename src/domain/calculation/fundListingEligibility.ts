/** TEFAS'ın `fonTipi=YAT` dışındaki tüm fonlara verdiği tür adı (bkz. tefas-sync/index.ts). */
const EXCHANGE_TRADED_FUND_TYPE = "Borsa Yatırım Fonu";

/** Büyük fon istisnası eşiği (TL). Kullanıcı kararı: 1 milyar TL. */
export const LARGE_FUND_SIZE_THRESHOLD_TRY = 1_000_000_000;

export interface FundListingCandidate {
  /** TEFAS/referans katalog/KAP risk değeri (1-7). Bilinmiyorsa null. */
  riskValue: number | null;
  /** Son fiyat kaydındaki yatırımcı sayısı. Bilinmiyorsa (TEFAS vermemişse) null. */
  investorCount: number | null;
  /** "Yatırım Fonu" | "Borsa Yatırım Fonu" | null. */
  fundType: string | null;
  /** Son fiyat kaydındaki fon büyüklüğü (TL). Bilinmiyorsa null. */
  fundSize: number | null;
}

/**
 * Kullanıcıya gösterilen fon listelerinde (Fonlar kataloğu, fon değiştirme
 * seçim listesi) ORTAK asgari uygunluk kuralı — bu iki sayfanın tek
 * doğruluk kaynağıdır (bkz. useFundsExplorer).
 *
 * Kurallar:
 *  1. Risk değeri bilinmeyen (null) fon ASLA gösterilmez — fon ne kadar
 *     büyük olursa olsun (100 milyar TL dahi) bu şart muaf tutmaz;
 *     kullanıcıya risksiz görünüp yanıltmaması için.
 *  2. Şart (1) sağlandıktan sonra, aşağıdakilerden EN AZ BİRİ yeterlidir:
 *     a) Yatırımcı sayısı bilinmiyor (null) — "muhtemelen 50'nin altındadır"
 *        diye TAHMİN EDİLMEZ, olduğu gibi gösterilmeye devam edilir.
 *     b) Yatırımcı sayısı en az 50 (sınır dahil).
 *     c) Son fon büyüklüğü en az LARGE_FUND_SIZE_THRESHOLD_TRY (sınır
 *        dahil) — büyük bir fon, yatırımcı sayısı düşük görünse bile
 *        (ör. kurumsal ağırlıklı fonlar) gösterilir. fund_size null ise
 *        bu istisna UYGULANMAZ (büyüklüğü bilinmeyen bir fon "büyük"
 *        varsayılıp muaf tutulmaz).
 *     d) Fon türü Borsa Yatırım Fonu (BYF/ETF) — TEFAS'ın "yatırımcı
 *        sayısı" alanı doğrudan katılma payı sahibi sayısını sayar, BYF
 *        paylarıysa borsada hisse gibi el değiştirdiğinden bu alan onlar
 *        için hiç anlamlı doldurulmuyor (canlı veride 12 BYF'nin TAMAMI
 *        0/null gösteriyor — ZKP/ZGD gibi büyük, likit, model portföyde
 *        fiilen kullanılan fonlar dahil).
 *
 * Bu, yalnızca GÖSTERİM/SEÇİM katmanında bir filtredir: fon veritabanından
 * silinmez, TEFAS/KAP senkronizasyonundan çıkarılmaz, ve zaten yayınlanmış
 * bir modelin hesaplama motoru (bkz. usePublishedModel) bu filtreden
 * TAMAMEN bağımsızdır — model bu kurala uymayan bir fonu tercih ediyorsa
 * hesaplama yine de doğru çalışır (bkz. AdminModelEditorPage'deki uyarı).
 */
export function isFundEligibleForListing(candidate: FundListingCandidate): boolean {
  if (candidate.riskValue === null) return false;

  if (candidate.investorCount === null) return true;
  if (candidate.investorCount >= 50) return true;
  if (candidate.fundSize !== null && candidate.fundSize >= LARGE_FUND_SIZE_THRESHOLD_TRY) return true;
  if (candidate.fundType === EXCHANGE_TRADED_FUND_TYPE) return true;

  return false;
}
