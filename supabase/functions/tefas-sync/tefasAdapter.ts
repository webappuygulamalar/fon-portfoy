// TEFAS ile konuşan TEK dosya. TEFAS kendi API yapısını değiştirirse
// düzeltilmesi gereken yer yalnızca burasıdır — geri kalan sistem
// ParsedFundPrice sözleşmesine bağlıdır ve TEFAS'ın iç detaylarını bilmez.
//
// Endpoint ve alan adları, TEFAS'ın 2026-04'te yaptığı platform geçişinden
// sonra hâlâ çalıştığı doğrulanmış açık kaynak scraper'lardan (pytefas,
// tefas-crawler) alınmıştır. Resmi bir TEFAS API dokümantasyonu yoktur;
// bu isimler ilk canlı senkronizasyonda teyit edilmelidir (bkz. README).
import type { FetchTefasOptions, ParsedFundPrice, TefasRawRow } from "./types.ts";

const TEFAS_URL = "https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir";

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  Accept: "*/*",
  Origin: "https://www.tefas.gov.tr",
  Referer: "https://www.tefas.gov.tr/tr/fon-verileri",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/**
 * TEFAS'ın kullandığı birkaç olası tarih biçimini YYYY-MM-DD'ye çevirir.
 * Tanınmayan bir biçimle karşılaşırsa SESSİZCE yanlış bir tarih üretmez;
 * hata fırlatır (çağıran taraf bunu sync_runs.error_summary'ye yazar).
 */
export function parseTefasDate(raw: string | number): string {
  if (typeof raw === "number") {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      throw new Error(`Ayrıştırılamayan TEFAS tarihi (epoch): ${raw}`);
    }
    return d.toISOString().slice(0, 10);
  }

  const s = String(raw).trim();

  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  m = /^\/Date\((\d+)\)\/$/.exec(s);
  if (m) return new Date(Number(m[1])).toISOString().slice(0, 10);

  throw new Error(`Ayrıştırılamayan TEFAS tarih biçimi: "${s}"`);
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Bir fon koduna ait satırlar arasından en güncel tarihli olanı seçer.
 * Saf fonksiyondur — ağ çağrısı yapmaz, bu yüzden ağ olmadan test edilebilir.
 */
export function parseLatestPriceFromRows(
  rows: TefasRawRow[],
  fundCode: string,
): ParsedFundPrice {
  const matching = rows.filter(
    (r) => (r.fonKodu ?? "").toString().toUpperCase() === fundCode.toUpperCase(),
  );
  if (matching.length === 0) {
    throw new Error(`TEFAS yanıtında "${fundCode}" için satır bulunamadı`);
  }

  const withDates = matching.map((r) => ({
    row: r,
    priceDate: parseTefasDate(r.tarih ?? ""),
  }));
  withDates.sort((a, b) => b.priceDate.localeCompare(a.priceDate));
  const latest = withDates[0];

  const price = toNumber(latest.row.fiyat);
  if (price === null || price <= 0) {
    throw new Error(`"${fundCode}" için geçersiz fiyat: ${String(latest.row.fiyat)}`);
  }

  return {
    fundCode,
    priceDate: latest.priceDate,
    price,
    fundSize: toNumber(latest.row.portfoyBuyukluk),
    investorCount: toNumber(latest.row.kisiSayisi),
  };
}

/**
 * Tek bir fonun en güncel fiyatını TEFAS'tan çeker. Düşük hacimli:
 * zaman aşımı + sınırlı retry/backoff içerir, agresif paralel istek atmaz.
 * Hafta sonu/tatil ihtimaline karşı 10 günlük bir pencere sorgular ve en
 * güncel tarihli satırı seçer.
 */
export async function fetchLatestFundPrice(
  fundCode: string,
  options: FetchTefasOptions = {},
): Promise<ParsedFundPrice> {
  const { timeoutMs = 8000, retries = 2, fetchImpl = fetch, now = new Date() } = options;
  const start = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  const body = {
    fonTipi: "YAT",
    fonKodu: fundCode,
    aramaMetni: null,
    fonTurKod: null,
    fonGrubu: null,
    sfonTurKod: null,
    fonTurAciklama: null,
    kurucuKod: null,
    basTarih: formatYmd(start),
    bitTarih: formatYmd(now),
    basSira: 1,
    bitSira: 100,
    dil: "TR",
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(TEFAS_URL, {
        method: "POST",
        headers: DEFAULT_HEADERS,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (res.status === 429) {
        const retryAfterHeader = Number(res.headers.get("retry-after"));
        const waitSeconds = Number.isFinite(retryAfterHeader) ? retryAfterHeader : (attempt + 1) * 5;
        await sleep(waitSeconds * 1000);
        continue;
      }
      if (!res.ok) {
        throw new Error(`TEFAS HTTP ${res.status}`);
      }

      const json = (await res.json()) as { resultList?: TefasRawRow[] };
      const rows = Array.isArray(json.resultList) ? json.resultList : [];
      return parseLatestPriceFromRows(rows, fundCode);
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(500 * (attempt + 1));
        continue;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
