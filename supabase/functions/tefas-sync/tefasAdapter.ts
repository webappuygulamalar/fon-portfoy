// TEFAS ile konuşan TEK dosya. TEFAS kendi API yapısını değiştirirse
// düzeltilmesi gereken yer yalnızca burasıdır — geri kalan sistem
// ParsedFundPrice sözleşmesine bağlıdır ve TEFAS'ın iç detaylarını bilmez.
//
// Endpoint ve alan adları, canlı senkronizasyonda (2026-09-05) bu sandbox'tan
// doğrudan doğrulanmıştır. Önemli bulgu: `fonTipi` zorunludur ve fonun
// kategorisine göre değişir (ör. "Serbest" fonlar YAT, borsa yatırım
// fonları/BYF tipi fonlar BYF ister); yanlış değer "bulunamadı" tarzı bir
// hataya yol açar, boş/null değer ise sunucu tarafında 500 (NullPointerException)
// döner. Bu yüzden aşağıda birkaç bilinen fonTipi değeri sırayla denenir.
import type { FetchTefasOptions, ParsedFundPrice, TefasRawRow } from "./types.ts";

const TEFAS_URL = "https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir";

// TEFAS'ın bilinen fonTipi değerleri (araştırma + canlı doğrulama).
// Sırayla denenir; ilk veri dönen kabul edilir.
const FON_TIPI_CANDIDATES = ["YAT", "BYF", "EMK", "GYF", "GSYF"] as const;

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  Accept: "*/*",
  Origin: "https://www.tefas.gov.tr",
  Referer: "https://www.tefas.gov.tr/tr/fon-verileri",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
};

/** Ağ/HTTP düzeyinde geçici bir sorunu işaretler — aynı fonTipi ile bir kez daha denenir. */
class RetryableTefasError extends Error {}

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

async function fetchOnce(
  fundCode: string,
  fonTipi: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
  now: Date,
): Promise<ParsedFundPrice> {
  const start = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const body = {
    fonTipi,
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
      throw new RetryableTefasError(`TEFAS HTTP 429 (rate limit) — fonTipi=${fonTipi}`);
    }
    if (res.status >= 500) {
      throw new RetryableTefasError(`TEFAS HTTP ${res.status} — fonTipi=${fonTipi}`);
    }
    if (!res.ok) {
      throw new Error(`TEFAS HTTP ${res.status} — fonTipi=${fonTipi}`);
    }

    const json = (await res.json()) as {
      resultList?: TefasRawRow[] | null;
      errorMessage?: string | null;
    };

    if (json.errorMessage) {
      // Yanlış fonTipi için TEFAS tarafı genelde bir sunucu istisnası
      // döner (ör. "Hata:java.lang.NullPointerException" ya da "Index 0
      // out of bounds"). Bu, bu fonTipi ile veri olmadığı anlamına gelir;
      // ağ hatası değildir, tekrar denemeye gerek yoktur.
      throw new Error(`TEFAS hatası (fonTipi=${fonTipi}): ${json.errorMessage}`);
    }

    const rows = Array.isArray(json.resultList) ? json.resultList : [];
    return parseLatestPriceFromRows(rows, fundCode);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Tek bir fonun en güncel fiyatını TEFAS'tan çeker. Düşük hacimli: fonun
 * doğru `fonTipi` kategorisini bulana kadar bilinen değerleri sırayla
 * dener (her biri için sadece gerçek ağ sorunlarında bir kez tekrar
 * dener — yanlış fonTipi'yi tekrar denemez, hemen bir sonrakine geçer).
 * Hafta sonu/tatil ihtimaline karşı 10 günlük bir pencere sorgular ve en
 * güncel tarihli satırı seçer.
 */
export async function fetchLatestFundPrice(
  fundCode: string,
  options: FetchTefasOptions = {},
): Promise<ParsedFundPrice> {
  const { timeoutMs = 8000, fetchImpl = fetch, now = new Date() } = options;

  let lastError: unknown;

  for (const fonTipi of FON_TIPI_CANDIDATES) {
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        return await fetchOnce(fundCode, fonTipi, timeoutMs, fetchImpl, now);
      } catch (err) {
        lastError = err;
        if (err instanceof RetryableTefasError && attempt === 0) {
          await sleep(800);
          continue;
        }
        break;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
