// TCMB (T.C. Merkez Bankası) günlük döviz kurları — resmi, ücretsiz, kimlik
// doğrulama gerektirmeyen tek bir kaynak. Katılım fonu hesaplamasında döviz
// cinsi fonların (ör. BKY, native fiyatı USD) TL karşılığını hesaplamak için
// kullanılır. "ForexBuying" (TCMB döviz alış kuru) kullanılır — Türkiye'de
// döviz cinsi varlıkların TL karşılığını tahmin etmek için yaygın kullanılan
// resmi referans kurdur. Bu, TEFAS'la ilgisi olmayan AYRI bir kaynaktır;
// tefasAdapter.ts'e karıştırılmaz.
const TCMB_URL = "https://www.tcmb.gov.tr/kurlar/today.xml";

export type FxCurrencyCode = "USD" | "EUR";

export interface FetchedFxRate {
  currency: FxCurrencyCode;
  rateToTry: number;
  /** YYYY-MM-DD — TCMB bülten tarihi (her zaman en son iş günü). */
  rateDate: string;
}

/**
 * TCMB'nin günlük kur XML'ini ayrıştırır. Saf fonksiyondur, ağ çağrısı
 * yapmaz. Beklenmeyen bir biçimle karşılaşırsa (tarih veya kur bulunamazsa)
 * o para birimini sessizce atlar — asla uydurma bir kur üretmez.
 */
export function parseTcmbRates(xml: string, currencies: readonly FxCurrencyCode[]): FetchedFxRate[] {
  const dateMatch = /Tarih="(\d{2})\.(\d{2})\.(\d{4})"/.exec(xml);
  if (!dateMatch) {
    throw new Error("TCMB yanıtında bülten tarihi bulunamadı");
  }
  const [, dd, mm, yyyy] = dateMatch;
  const rateDate = `${yyyy}-${mm}-${dd}`;

  const results: FetchedFxRate[] = [];
  for (const currency of currencies) {
    const blockMatch = new RegExp(`<Currency[^>]*Kod="${currency}"[^>]*>([\\s\\S]*?)</Currency>`).exec(xml);
    if (!blockMatch) continue;
    const rateMatch = /<ForexBuying>([\d.]+)<\/ForexBuying>/.exec(blockMatch[1]);
    if (!rateMatch) continue;
    const rateToTry = Number(rateMatch[1]);
    if (!Number.isFinite(rateToTry) || rateToTry <= 0) continue;
    results.push({ currency, rateToTry, rateDate });
  }
  return results;
}

export async function fetchTcmbRates(
  currencies: readonly FxCurrencyCode[],
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<FetchedFxRate[]> {
  const { timeoutMs = 8000, fetchImpl = fetch } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(TCMB_URL, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`TCMB HTTP ${res.status}`);
    }
    const xml = await res.text();
    return parseTcmbRates(xml, currencies);
  } finally {
    clearTimeout(timeoutId);
  }
}
