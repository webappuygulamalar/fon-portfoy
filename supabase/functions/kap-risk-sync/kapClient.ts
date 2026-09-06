// KAP (kap.org.tr) ile ağ iletişimi: resmi, herkese açık, güvenlik önlemi
// OLMAYAN arama API'si ve fon detay sayfaları. Düşük istek hızı ve
// yeniden-deneme/backoff burada merkezileştirilmiştir — kap-risk-sync
// Edge Function'ı bunu düşük eşzamanlılıkla (bkz. mapWithConcurrency)
// kullanır, TÜM 286 fonu tek çalışmada işlemeye ÇALIŞMAZ.

const USER_AGENT = "Mozilla/5.0 (compatible; fon-portfoy-risk-sync/1.0; +https://webappuygulamalar.github.io/fon-portfoy/)";

export interface KapSearchMatch {
  memberOrFundOid: string;
  cmpOrFundCode: string;
  searchValue: string;
}

export interface KapClientOptions {
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  baseDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Basit üstel geri çekilmeli yeniden deneme. Son denemede de başarısız olursa hatayı fırlatır. */
export async function withRetry<T>(fn: () => Promise<T>, maxRetries: number, baseDelayMs: number): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        await sleep(baseDelayMs * 2 ** attempt);
      }
    }
  }
  throw lastErr;
}

interface RawSearchResult {
  category?: string;
  results?: Array<{
    searchType?: string;
    cmpOrFundCode?: string | null;
    memberOrFundOid?: string | null;
    searchValue?: string;
  }>;
}

/**
 * KAP'ın resmi halka açık arama API'sinde fon kodunu arar. Yalnızca
 * `searchType === "F"` VE `cmpOrFundCode`'u aranan kodla (büyük/küçük harf
 * duyarsız) TAM eşleşen sonuçları döner — isim benzerliğine göre EŞLEŞTİRME
 * YAPMAZ (yanlış fon eşleştirmesini önlemek için).
 */
export async function searchKapFundByCode(code: string, opts: KapClientOptions = {}): Promise<KapSearchMatch[]> {
  const f = opts.fetchImpl ?? fetch;
  const maxRetries = opts.maxRetries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 800;
  return withRetry(async () => {
    const res = await f("https://www.kap.org.tr/tr/api/search/combined", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify({ keyword: code, discClass: "ALL", lang: "tr", channel: "WEB" }),
    });
    if (!res.ok) throw new Error(`KAP arama isteği başarısız: HTTP ${res.status}`);
    const json = (await res.json()) as RawSearchResult[];
    const combined = Array.isArray(json) ? json.find((c) => c.category === "companyOrFunds") : undefined;
    const results = combined?.results ?? [];
    const matches: KapSearchMatch[] = [];
    for (const r of results) {
      if (
        r.searchType === "F" &&
        typeof r.cmpOrFundCode === "string" &&
        r.cmpOrFundCode.toLowerCase() === code.toLowerCase() &&
        typeof r.memberOrFundOid === "string"
      ) {
        matches.push({
          memberOrFundOid: r.memberOrFundOid,
          cmpOrFundCode: r.cmpOrFundCode,
          searchValue: r.searchValue ?? "",
        });
      }
    }
    return matches;
  }, maxRetries, baseDelayMs);
}

/** KAP fon detay sayfasının ham HTML'ini çeker. */
export async function fetchKapFundDetailHtml(oid: string, opts: KapClientOptions = {}): Promise<string> {
  const f = opts.fetchImpl ?? fetch;
  const maxRetries = opts.maxRetries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 800;
  return withRetry(async () => {
    const res = await f(`https://www.kap.org.tr/tr/fon-bilgileri/genel/${oid}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) throw new Error(`KAP fon detay sayfası başarısız: HTTP ${res.status}`);
    return res.text();
  }, maxRetries, baseDelayMs);
}

/**
 * Verilen öğeleri en fazla `concurrency` eşzamanlı çağrıyla işler — KAP'a
 * tek seferde 2-3'ten fazla eşzamanlı istek gitmemesini garanti eder.
 * Sonuçlar giriş sırasıyla döner (tamamlanma sırasıyla değil).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
