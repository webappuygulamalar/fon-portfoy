// Resmi portföy yönetim şirketi (PYŞ) sayfalarından, TEFAS'ın kendi ham
// fiyatının yanlış pay grubuna ait olduğu doğrulanmış fonlar için (bkz.
// fund_share_class_overrides tablosu, 20260911130000_fund_share_class_
// price_overrides.sql) native fiyat çeker.
//
// KRİTİK İLKE: sayfa yapısı beklenenle eşleşmezse (etiket/değer bulunamazsa)
// HİÇBİR SAYI UYDURULMAZ — null döner; ağ/HTTP düzeyinde bir sorun olursa
// (zaman aşımı, HTTP hatası, bilinmeyen kaynak) hata fırlatılır. Her iki
// durumda da çağıran taraf (index.ts) o fon için fiyatı o çalıştırmada
// ATLAR (son bilinen değeri korur) ve sync_runs.error_summary'ye insan
// tarafından okunabilir bir not düşer — ASLA eski/yanlış bir fiyata
// sessizce geri dönülmez.
//
// Desteklenen kaynaklar:
//   - isportfoy_resmi_sayfa: server-side render edilmiş düz HTML.
//   - yapikredi_resmi_api: Yapı Kredi Portföy'ün kendi fon detay sayfasının
//     kullandığı, aynı origin'deki JSON endpoint'i.
// Yeni bir PYŞ kaynağı eklenirken kaynak biçimine uygun, dar kapsamlı ve
// fon kodunu da doğrulayan bir ayrıştırıcı eklenmelidir; index.ts veya tablo
// şeması değişmez.
import { parseTefasDate } from "./tefasAdapter.ts";
import type { ShareClassOverride } from "./types.ts";

export interface FetchedNativePrice {
  price: number;
  priceDate: string;
}

interface FetchOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const DEFAULT_HEADERS = {
  Accept: "text/html",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
};

/**
 * İş Portföy'ün fon detay sayfasındaki "Fon Birim Fiyatı (<PARA BİRİMİ>)"
 * bloğundan (etiket + tarih + değer) native fiyatı ayrıştırır. SAF
 * fonksiyon — ağ bağımlılığı yok, testlerden doğrudan çağrılabilir. Canlı
 * sayfa yapısı (2026-09-11 doğrulandı):
 *   <span>Fon Birim Fiyatı (USD)</span>
 *   <span class="date m-0">11.09.2026</span>
 *   ...
 *   <span class="content">1,277608</span>
 */
export function parseIsPortfoyNativePrice(html: string, currency: string): FetchedNativePrice | null {
  const re = new RegExp(
    `Fon Birim Fiyat[ıi]\\s*\\(\\s*${currency}\\s*\\)` +
      `[\\s\\S]{0,400}?class="date[^"]*"[^>]*>\\s*(\\d{2}\\.\\d{2}\\.\\d{4})\\s*<` +
      `[\\s\\S]{0,400}?class="content"[^>]*>\\s*([\\d.,]+)\\s*<`,
  );
  const m = re.exec(html);
  if (!m) return null;

  let priceDate: string;
  try {
    priceDate = parseTefasDate(m[1]);
  } catch {
    return null;
  }

  const price = Number(m[2].replace(",", "."));
  if (!Number.isFinite(price) || price <= 0) return null;

  return { price, priceDate };
}

const SOURCE_PARSERS: Record<string, (html: string, currency: string) => FetchedNativePrice | null> = {
  isportfoy_resmi_sayfa: parseIsPortfoyNativePrice,
};

interface YapiKrediFundDetailRow {
  code?: unknown;
  lastUpdateDate?: unknown;
  unitAmount?: unknown;
}

/**
 * Yapı Kredi Portföy'ün resmî fon detay JSON'ından native pay grubu
 * fiyatını ayrıştırır. Endpoint hem TL hem döviz pay gruplarını aynı
 * `unitAmount` nesnesinde döndürür; istenen para birimi açıkça seçilir ve
 * endpoint'in yanlış fon düğümüne yönelmesi ihtimaline karşı fon kodu da
 * doğrulanır.
 */
export function parseYapiKrediNativePrice(
  payload: unknown,
  currency: string,
  expectedFundCode: string,
): FetchedNativePrice | null {
  if (typeof payload !== "object" || payload === null) return null;

  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length === 0) return null;

  const row = data[0] as YapiKrediFundDetailRow;
  if (typeof row.code !== "string" || row.code.toUpperCase() !== expectedFundCode.toUpperCase()) return null;
  if (typeof row.lastUpdateDate !== "string") return null;
  if (typeof row.unitAmount !== "object" || row.unitAmount === null) return null;

  const rawAmount = (row.unitAmount as Record<string, unknown>)[currency];
  if (typeof rawAmount !== "string") return null;

  // Canlı biçim örneği: "1,043073 USD". Para birimi son ekini zorunlu
  // tutmak, yanlışlıkla TL alanının USD diye kabul edilmesini engeller.
  const amountMatch = new RegExp(`^\\s*([\\d.]+(?:,\\d+)?)\\s+${currency}\\s*$`, "i").exec(rawAmount);
  if (!amountMatch) return null;

  let priceDate: string;
  try {
    priceDate = parseTefasDate(row.lastUpdateDate);
  } catch {
    return null;
  }

  const price = Number(amountMatch[1].replaceAll(".", "").replace(",", "."));
  if (!Number.isFinite(price) || price <= 0) return null;

  return { price, priceDate };
}

/**
 * Bir fund_share_class_overrides satırı için, o fonun resmi PYŞ sayfasından
 * bugünün native fiyatını çeker.
 *
 * - price_fetch_source/price_fetch_url NULL ise (henüz otomatik bir kaynak
 *   tanımlanmamışsa) sessizce null döner — bu BEKLENEN bir durumdur, hata
 *   sayılmaz (çağıran taraf bu fonun fiyatını admin manuel girene kadar
 *   atlamaya devam eder).
 * - price_fetch_source bilinmeyen bir değerse veya ağ/HTTP hatası olursa
 *   hata fırlatılır (çağıran taraf bunu error_summary'ye yazar).
 * - Sayfa erişilebilir ama beklenen fiyat bloğu ayrıştırılamazsa null
 *   döner (uydurma yok).
 */
export async function fetchManagementCompanyPrice(
  override: ShareClassOverride,
  options: FetchOptions = {},
): Promise<FetchedNativePrice | null> {
  if (!override.priceFetchSource || !override.priceFetchUrl) return null;

  const htmlParser = SOURCE_PARSERS[override.priceFetchSource];
  const isYapiKrediApi = override.priceFetchSource === "yapikredi_resmi_api";
  if (!htmlParser && !isYapiKrediApi) {
    throw new Error(
      `Bilinmeyen fiyat kaynağı: "${override.priceFetchSource}" (fon: ${override.fundCode})`,
    );
  }

  const { timeoutMs = 10000, fetchImpl = fetch } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetchImpl(override.priceFetchUrl, {
      method: isYapiKrediApi ? "POST" : "GET",
      headers: isYapiKrediApi
        ? { ...DEFAULT_HEADERS, Accept: "application/json", "Content-Type": "application/json" }
        : DEFAULT_HEADERS,
      body: isYapiKrediApi ? "{}" : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    throw new Error(
      `${override.priceFetchSource} HTTP ${res.status} (fon: ${override.fundCode})`,
    );
  }

  const responseBody = await res.text();
  if (isYapiKrediApi) {
    try {
      return parseYapiKrediNativePrice(
        JSON.parse(responseBody) as unknown,
        override.nativeCurrency,
        override.fundCode,
      );
    } catch {
      return null;
    }
  }

  return htmlParser!(responseBody, override.nativeCurrency);
}
