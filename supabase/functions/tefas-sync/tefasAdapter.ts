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
import type {
  FetchTefasOptions,
  ParsedCatalogFund,
  ParsedFundPrice,
  TefasBulkRow,
  TefasRawRow,
} from "./types.ts";

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

// ---------------------------------------------------------------------
// Toplu katılım fonu keşfi — günlük katalog senkronizasyonu.
//
// Aynı `fonGnlBlgSiraliGetir` endpoint'i, `fonKodu: null` ve
// `aramaMetni: "KATILIM"` ile çağrıldığında TEK bir fon yerine, başlığında
// "katılım" geçen TÜM fonları (sayfalanmış olarak) döner — bu, canlı
// sandbox'ta doğrudan doğrulanmıştır (2026-09-05). Bu sayede yüzlerce ayrı
// istek yerine, her fon tipi (YAT: menkul kıymet yatırım fonu, BYF: borsa
// yatırım fonu) için birkaç sayfalı istekle TÜM katılım fonu evreni ve
// güncel fiyatları TEK seferde alınır.
const BULK_FON_TIPI_CANDIDATES = ["YAT", "BYF"] as const;
const BULK_PAGE_SIZE = 1000;
// Hafta sonu/uzun tatil güvenliği için, tek günlük fiyat yerine son 10
// günlük pencere istenir; her fon kodu için en güncel tarihli satır seçilir
// (parseLatestPriceFromRows'daki mantığın tüm kodlar için genelleştirilmişi).
const BULK_LOOKBACK_DAYS = 10;
// TEFAS beklenmedik şekilde davranırsa (ör. toplamSayi hep artıyor gibi
// görünürse) sonsuz döngüye girmemek için sert bir üst sınır.
const MAX_BULK_PAGES_PER_TYPE = 20;

const KNOWN_ACRONYMS = ["BIST", "TL", "USD", "EUR", "GBP", "TEFAS", "KYD", "VİOP"];

/**
 * TEFAS'ın TÜMÜ BÜYÜK HARF döndürdüğü fon unvanını, Türkçe kurallara göre
 * (İ/I ayrımı dahil) okunabilir bir başlığa çevirir. Bilinen kısaltmalar
 * (BIST, TL, USD...) büyük harfte kalır. Yalnızca gösterim amaçlıdır.
 */
export function toTitleCaseTR(raw: string): string {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  const lower = collapsed.toLocaleLowerCase("tr-TR");
  const titled = lower.replace(
    /(^|[\s(/-])(\p{L})/gu,
    (_match, sep: string, ch: string) => sep + ch.toLocaleUpperCase("tr-TR"),
  );
  return titled.replace(/\p{L}+/gu, (word) => {
    const upper = word.toLocaleUpperCase("tr-TR");
    return KNOWN_ACRONYMS.includes(upper) ? upper : word;
  });
}

/**
 * Türkiye'deki fon unvanları neredeyse istisnasız "<Şirket Adı> Portföy
 * ..." biçimindedir — kurucu/portföy yönetim şirketi adı, unvanda ilk
 * geçen "PORTFÖY" kelimesine kadarki (dahil) kısımdır. Bu desene uymayan
 * (ör. doğrudan bir ihraççı tarafından çıkarılan varlık finansmanı fonu)
 * unvanlarda çıkarılamaz ve null döner — arayüzde "—" gösterilir. Bu bir
 * TAHMİN değil, TEFAS'ın kendi unvan alanından yapılan yapısal bir
 * çıkarımdır; uydurma veri eklenmez.
 */
export function extractManagementCompany(rawTitle: string): string | null {
  const marker = " PORTFÖY";
  const idx = rawTitle.toLocaleUpperCase("tr-TR").indexOf(marker);
  if (idx === -1) return null;
  return toTitleCaseTR(rawTitle.slice(0, idx + marker.length));
}

async function fetchBulkPage(
  fonTipi: string,
  basSira: number,
  bitSira: number,
  basTarihStr: string,
  bitTarihStr: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<{ rows: TefasBulkRow[]; toplamSayi: number }> {
  const body = {
    fonTipi,
    fonKodu: null,
    aramaMetni: "KATILIM",
    fonTurKod: null,
    fonGrubu: null,
    sfonTurKod: null,
    fonTurAciklama: null,
    kurucuKod: null,
    basTarih: basTarihStr,
    bitTarih: bitTarihStr,
    basSira,
    bitSira,
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

    if (!res.ok) {
      throw new RetryableTefasError(`TEFAS toplu liste HTTP ${res.status} — fonTipi=${fonTipi}`);
    }

    const json = (await res.json()) as {
      resultList?: TefasBulkRow[] | null;
      errorMessage?: string | null;
      toplamSayi?: number;
    };

    if (json.errorMessage) {
      throw new Error(`TEFAS toplu liste hatası (fonTipi=${fonTipi}): ${json.errorMessage}`);
    }

    return {
      rows: Array.isArray(json.resultList) ? json.resultList : [],
      toplamSayi: typeof json.toplamSayi === "number" ? json.toplamSayi : 0,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

type LatestRowByCode = Map<string, { row: TefasBulkRow; fonTipi: "YAT" | "BYF"; priceDate: string }>;

/**
 * Tek bir fon tipi (YAT veya BYF) için tüm sayfaları çeker. Bu fonksiyon
 * BİLEREK diğer fon tipinden bağımsız çalışır (fetchAllParticipationFunds
 * içinde Promise.allSettled ile izole edilir) — biri ağ sorunu yaşarsa
 * diğerinin sonuçları yine de kullanılır, tüm senkronizasyon iptal olmaz.
 */
async function fetchOneFonTipi(
  fonTipi: "YAT" | "BYF",
  timeoutMs: number,
  fetchImpl: typeof fetch,
  now: Date,
): Promise<LatestRowByCode> {
  const start = new Date(now.getTime() - BULK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const basTarihStr = formatYmd(start);
  const bitTarihStr = formatYmd(now);

  const latestByCode: LatestRowByCode = new Map();
  let basSira = 1;
  let toplamSayi = Number.POSITIVE_INFINITY;
  let pages = 0;

  while (basSira <= toplamSayi && pages < MAX_BULK_PAGES_PER_TYPE) {
    let page: { rows: TefasBulkRow[]; toplamSayi: number } | undefined;
    let lastErr: unknown;
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        page = await fetchBulkPage(
          fonTipi,
          basSira,
          basSira + BULK_PAGE_SIZE - 1,
          basTarihStr,
          bitTarihStr,
          timeoutMs,
          fetchImpl,
        );
        break;
      } catch (err) {
        lastErr = err;
        if (err instanceof RetryableTefasError && attempt === 0) {
          await sleep(500);
          continue;
        }
        throw err instanceof Error ? err : new Error(String(lastErr));
      }
    }
    if (!page) throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));

    toplamSayi = page.toplamSayi;
    for (const row of page.rows) {
      const code = (row.fonKodu ?? "").toString().trim().toUpperCase();
      if (!code) continue;
      let priceDate: string;
      try {
        priceDate = parseTefasDate(row.tarih ?? "");
      } catch {
        continue; // Ayrıştırılamayan tarihli satır sessizce atlanır; uydurulmaz.
      }
      const existing = latestByCode.get(code);
      if (!existing || priceDate > existing.priceDate) {
        latestByCode.set(code, { row, fonTipi, priceDate });
      }
    }

    basSira += BULK_PAGE_SIZE;
    pages++;
  }

  return latestByCode;
}

export interface BulkFetchOutcome {
  funds: ParsedCatalogFund[];
  /**
   * Bir fon tipinin ("YAT"/"BYF") toplu çekimi tamamen başarısız olursa
   * (ör. TEFAS'a ağ zaman aşımı) burada insan-okunur bir mesaj olarak yer
   * alır; diğer fon tipinden gelen sonuçlar yine de kullanılır — tek bir
   * kategorideki geçici bir sorun tüm senkronizasyonu iptal etmez.
   */
  errors: string[];
}

/**
 * TEFAS'taki (YAT + BYF fon tiplerinde) başlığında "katılım" geçen TÜM
 * fonları döner. İki fon tipi PARALEL ve BİRBİRİNDEN BAĞIMSIZ çekilir —
 * hem toplam süreyi kısaltmak (Edge Function'ın çalışma süresi sınırına
 * karşı güvenlik payı) hem de birinin geçici ağ sorunundan etkilenmeden
 * diğerinin sonuçlarının kullanılabilmesini sağlamak için. Ayrıştırılamayan
 * tarihli tekil satırlar sessizce atlanır (uydurulmaz); ancak bir fon
 * tipinin tamamı başarısız olursa bu `errors` listesinde raporlanır.
 */
export async function fetchAllParticipationFunds(
  options: FetchTefasOptions = {},
): Promise<BulkFetchOutcome> {
  const { timeoutMs = 12000, fetchImpl = fetch, now = new Date() } = options;

  const settled = await Promise.allSettled(
    BULK_FON_TIPI_CANDIDATES.map((fonTipi) => fetchOneFonTipi(fonTipi, timeoutMs, fetchImpl, now)),
  );

  const latestByCode: LatestRowByCode = new Map();
  const errors: string[] = [];

  settled.forEach((outcome, i) => {
    const fonTipi = BULK_FON_TIPI_CANDIDATES[i];
    if (outcome.status === "rejected") {
      const message = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
      errors.push(`TEFAS toplu liste (fonTipi=${fonTipi}) alınamadı: ${message}`);
      return;
    }
    for (const [code, entry] of outcome.value) {
      const existing = latestByCode.get(code);
      if (!existing || entry.priceDate > existing.priceDate) {
        latestByCode.set(code, entry);
      }
    }
  });

  const funds: ParsedCatalogFund[] = [];
  for (const [code, { row, fonTipi, priceDate }] of latestByCode) {
    const rawTitle = (row.fonUnvan ?? "").toString().trim();
    funds.push({
      code,
      rawTitle,
      displayName: toTitleCaseTR(rawTitle),
      managementCompany: extractManagementCompany(rawTitle),
      fonTipi,
      priceDate,
      price: toNumber(row.fiyat) ?? 0,
      fundSize: toNumber(row.portfoyBuyukluk),
      investorCount: toNumber(row.kisiSayisi),
    });
  }
  return { funds, errors };
}

// ---------------------------------------------------------------------
// Tarihsel fiyat geri yükleme (backfill) — günlük senkronizasyondan AYRI.
//
// TEFAS'ın toplu liste endpoint'i tek istekte en fazla ~1 aylık tarih
// aralığı kabul ediyor: canlı olarak doğrulandı — daha geniş bir aralık
// istendiğinde `{"errorMessage":"Geçersiz veri: Tarih aralığı 1 ayı
// aşamaz", ...}` döner. Bu yüzden 1 yıllık geçmiş, checkpoint'li ve
// tekrar tekrar çağrılabilir küçük pencerelerle (bkz. history-backfill
// Edge Function) toplanır. Bu fonksiyon TEK bir pencere için, o pencere
// içindeki HER (fon, tarih) satırını döner — günlük senkronizasyondaki
// gibi yalnızca "en güncel"e indirgemez, çünkü geçmiş getiri hesabı için
// TÜM günlere ihtiyaç vardır.
const MAX_HISTORY_PAGES_PER_TYPE = 10;

export interface HistoricalPriceRow {
  code: string;
  priceDate: string;
  price: number;
  fundSize: number | null;
  investorCount: number | null;
}

export interface HistoryFetchOutcome {
  rows: HistoricalPriceRow[];
  errors: string[];
}

async function fetchOneFonTipiHistory(
  fonTipi: "YAT" | "BYF",
  basTarihStr: string,
  bitTarihStr: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<HistoricalPriceRow[]> {
  const rows: HistoricalPriceRow[] = [];
  let basSira = 1;
  let toplamSayi = Number.POSITIVE_INFINITY;
  let pages = 0;

  while (basSira <= toplamSayi && pages < MAX_HISTORY_PAGES_PER_TYPE) {
    let page: { rows: TefasBulkRow[]; toplamSayi: number } | undefined;
    let lastErr: unknown;
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        page = await fetchBulkPage(
          fonTipi,
          basSira,
          basSira + BULK_PAGE_SIZE - 1,
          basTarihStr,
          bitTarihStr,
          timeoutMs,
          fetchImpl,
        );
        break;
      } catch (err) {
        lastErr = err;
        if (err instanceof RetryableTefasError && attempt === 0) {
          await sleep(500);
          continue;
        }
        throw err instanceof Error ? err : new Error(String(lastErr));
      }
    }
    if (!page) throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));

    toplamSayi = page.toplamSayi;
    for (const row of page.rows) {
      const code = (row.fonKodu ?? "").toString().trim().toUpperCase();
      if (!code) continue;
      let priceDate: string;
      try {
        priceDate = parseTefasDate(row.tarih ?? "");
      } catch {
        continue; // Ayrıştırılamayan tarihli satır sessizce atlanır; uydurulmaz.
      }
      const price = toNumber(row.fiyat);
      if (price === null || price <= 0) continue; // Geçersiz/askıda fiyat uydurulmaz, atlanır.
      rows.push({
        code,
        priceDate,
        price,
        fundSize: toNumber(row.portfoyBuyukluk),
        investorCount: toNumber(row.kisiSayisi),
      });
    }

    basSira += BULK_PAGE_SIZE;
    pages++;
  }

  return rows;
}

/**
 * Verilen [windowStart, windowEnd] penceresi (YYYY-MM-DD, TEFAS kısıtı
 * gereği ~1 aydan kısa olmalı) için TÜM katılım fonlarının o pencaredeki
 * HER GÜNLÜK fiyatını döner (yalnızca en güncel değil). İki fon tipi
 * paralel ve birbirinden izole çekilir (bkz. fetchAllParticipationFunds
 * ile aynı desen).
 */
export async function fetchParticipationFundPriceHistory(
  windowStart: string,
  windowEnd: string,
  options: FetchTefasOptions = {},
): Promise<HistoryFetchOutcome> {
  const { timeoutMs = 15000, fetchImpl = fetch } = options;
  const basTarihStr = windowStart.replaceAll("-", "");
  const bitTarihStr = windowEnd.replaceAll("-", "");

  const settled = await Promise.allSettled(
    BULK_FON_TIPI_CANDIDATES.map((fonTipi) =>
      fetchOneFonTipiHistory(fonTipi, basTarihStr, bitTarihStr, timeoutMs, fetchImpl),
    ),
  );

  const rows: HistoricalPriceRow[] = [];
  const errors: string[] = [];
  settled.forEach((outcome, i) => {
    const fonTipi = BULK_FON_TIPI_CANDIDATES[i];
    if (outcome.status === "rejected") {
      const message = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
      errors.push(`TEFAS geçmiş fiyat (fonTipi=${fonTipi}) alınamadı: ${message}`);
      return;
    }
    rows.push(...outcome.value);
  });

  return { rows, errors };
}
