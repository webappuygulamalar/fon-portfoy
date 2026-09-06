// KAP (kap.org.tr) fon detay sayfasından risk verisi çıkarımı — SAF
// fonksiyonlar, ağ/Deno bağımlılığı yok (hem Deno hem Vitest'ten test
// edilebilir, bkz. kapRiskParser.test.ts).
//
// KAP fon detay sayfaları Next.js RSC akışına `self.__next_f.push([1,
// "..."])` çağrıları içinde escaped JSON olarak gömülü bir `fundDetail`
// dizisi taşır: `{ itemName, itemKey, value, ... }[]`.
//
// Gerçek verilerde GÖZLEMLENEN iki farklı şema:
//  1. Emeklilik fonları (EYF tipi, kapsamımız DIŞINDA): üst düzey
//     "Fonun Risk Değeri" (tek sayı) ve "Fonun Risk Aralığı" alanları var.
//  2. Katılım (yatırım) fonları: üst düzey risk alanı YOK; risk verisi
//     (varsa) "Fonun Yatırım Amacı veya Stratejisi" alanının değer
//     dizisindeki her elemanın `riskDegeri` alt-alanında, çoğunlukla pay
//     grubu bazlı serbest metin olarak geliyor (ör. "TL:6 USD:3",
//     "A grubu paylar için 5", "Fonun risk değeri 6 olarak belirlenmiştir").
//     Bazı fonlarda bu alan tamamen yok (risk verisi hiç yayınlanmamış).
//
// Kritik ilke: BELİRSİZ/ÇELİŞKİLİ durumda TAHMİN ETME — risk_value yazma,
// `ambiguous` sonucu dön ki admin incelemesine düşsün.

export interface KapFundDetailItem {
  itemName?: string | null;
  itemKey?: string | null;
  value?: unknown;
  disclosureIndex?: number | null;
  creationDate?: string | null;
  codeKey?: string | null;
}

export interface RiskCandidate {
  /** "TL" | "USD" | "EUR" | null (etikette para birimi yoksa) */
  currency: "TL" | "USD" | "EUR" | null;
  /** "A" | "B" | null (etikette pay grubu harfi yoksa) */
  letterGroup: "A" | "B" | null;
  value: number;
  raw: string;
}

export type RiskExtractionStatus = "found" | "no_risk_field" | "ambiguous";

export interface RiskExtractionResult {
  status: RiskExtractionStatus;
  /** status === "found" ise 1-7 arası tam sayı. */
  riskValue: number | null;
  /** status === "found" ise kaynağın nasıl belirlendiğini açıklayan kısa etiket. */
  sourceDetail: string | null;
  /** status === "ambiguous" ise insan tarafından okunabilir açıklama (ham metinle). */
  note: string | null;
}

/** `self.__next_f.push([1, "..."])` parçalarından tam decoded RSC metnini birleştirir. */
export function decodeNextRscChunks(html: string): string {
  const chunkRe = /self\.__next_f\.push\(\[1,\s*("(?:[^"\\]|\\.)*")\]\)/gs;
  let full = "";
  let m: RegExpExecArray | null;
  while ((m = chunkRe.exec(html))) {
    try {
      full += JSON.parse(m[1]) as string;
    } catch {
      // Ayrıştırılamayan parça sessizce atlanır — geri kalan parçalardan
      // fundDetail'i bulmaya çalışırız.
    }
  }
  return full;
}

/** Decoded RSC metni içinden `"fundDetail":[...]` dizisini bulup ayrıştırır. */
export function extractFundDetailArray(decodedRsc: string): KapFundDetailItem[] | null {
  const idx = decodedRsc.indexOf('"fundDetail":[');
  if (idx === -1) return null;
  const start = idx + '"fundDetail":'.length;
  let depth = 0;
  let end = -1;
  for (let i = start; i < decodedRsc.length; i++) {
    const ch = decodedRsc[i];
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) return null;
  try {
    return JSON.parse(decodedRsc.slice(start, end)) as KapFundDetailItem[];
  } catch {
    return null;
  }
}

function findItem(items: KapFundDetailItem[], name: string): KapFundDetailItem | undefined {
  return items.find((it) => (it.itemName ?? "").trim() === name);
}

/** KAP'ın fon detay sayfasından "Kurucunun Ünvanı" (founder) metnini döner. */
export function extractFounderTitle(items: KapFundDetailItem[]): string | null {
  const item = findItem(items, "Kurucunun Ünvanı");
  const v = item?.value;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

const GENERIC_COMPANY_WORDS = new Set([
  "PORTFÖY",
  "PORTFOY",
  "YÖNETİMİ",
  "YONETIMI",
  "YATIRIM",
  "BANKASI",
  "EMEKLİLİK",
  "EMEKLILIK",
  "VE",
  "A.Ş.",
  "A.S.",
  "AŞ",
  "AS",
  "A.Ş",
  // '.'/',' boşluğa çevrildikten sonra "A.Ş." tek harflik kalıntılara
  // ("A", "Ş"/"S") bölünür — bunlar jenerik sayılmazsa HEMEN HEMEN HER
  // şirket "A.Ş." olduğundan yanlışlıkla eşleşme riski oluşur.
  "A",
  "Ş",
  "S",
]);

function normalizeCompanyTokens(name: string): string[] {
  return name
    .toLocaleUpperCase("tr-TR")
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !GENERIC_COMPANY_WORDS.has(t));
}

/**
 * Fon eşleştirmesinde kurucu unvanı çapraz kontrolü. Bizim `management_company`
 * alanımız (TEFAS başlığından türetilmiş, ör. "Yapı Kredi Portföy") ile
 * KAP'ın tam resmi kurucu unvanı (ör. "YAPI KREDİ PORTFÖY YÖNETİMİ A.Ş.")
 * arasında EN AZ BİR anlamlı (jenerik olmayan) kelime örtüşmesi arar.
 * Örtüşme yoksa false döner — yalnızca isim benzerliğine güvenip YANLIŞ
 * fon eşleştirmesi yapmamak için bu kontrol zorunludur.
 */
export function founderMatches(ourManagementCompany: string | null, kapFounderTitle: string | null): boolean {
  if (!ourManagementCompany || !kapFounderTitle) return false;
  const ours = new Set(normalizeCompanyTokens(ourManagementCompany));
  const theirs = normalizeCompanyTokens(kapFounderTitle);
  return theirs.some((t) => ours.has(t));
}

const CURRENCY_ALIASES: Record<string, "TL" | "USD" | "EUR"> = {
  TL: "TL",
  TRY: "TL",
  USD: "USD",
  DOLAR: "USD",
  EUR: "EUR",
  AVRO: "EUR",
  EURO: "EUR",
};

/**
 * Bir `riskDegeri` serbest metninden etiketli (para birimi ve/veya A/B pay
 * grubu) sayı adaylarını çıkarır. YALNIZCA `riskDegeri` alt-alanına
 * uygulanır — `fonunYatirimAmaci` gibi uzun serbest metin açıklamalarına
 * ASLA uygulanmaz (orada geçen alakasız sayılar risk değeri sanılabilir).
 *
 * Güvenlik: `\b` sınırları sayının başka bir sayının parçası olmasını
 * (ör. "%25" içindeki "2" veya "5") engeller; yalnızca 1-7 aralığındaki
 * tek haneli sayılar aday sayılır (risk değeri şeması zaten 1-7'dir).
 */
export function extractLabeledCandidates(text: string): RiskCandidate[] {
  const candidates: RiskCandidate[] = [];
  const numRe = /\b([1-7])\b/g;
  let m: RegExpExecArray | null;
  while ((m = numRe.exec(text))) {
    const idx = m.index;
    // Sayıdan hemen önceki/sonraki karakter '.' veya ',' ise (ondalık/aralık
    // gösterimi olabilir, ör. "1.500") aday sayılmaz.
    const before = text[idx - 1];
    const after = text[idx + 1];
    if (before === "." || before === "," || after === "." || after === ",") continue;

    const value = Number(m[1]);
    const windowStart = Math.max(0, idx - 40);
    const context = text.slice(windowStart, idx);

    const letterMatch = /(?:^|[^A-Za-zÇĞİÖŞÜçğıöşü])([AB])\s*(?:[.\s]|grubu|grup|tip)/i.exec(context);
    const currencyMatch = [...context.matchAll(/TL|TRY|USD|EUR|AVRO|EURO|DOLAR/gi)].pop();

    candidates.push({
      currency: currencyMatch ? CURRENCY_ALIASES[currencyMatch[0].toUpperCase()] : null,
      letterGroup: letterMatch ? (letterMatch[1].toUpperCase() as "A" | "B") : null,
      value,
      raw: text.slice(windowStart, Math.min(text.length, idx + 20)).trim(),
    });
  }
  return candidates;
}

function dedupeCandidates(candidates: RiskCandidate[]): RiskCandidate[] {
  const seen = new Set<string>();
  const out: RiskCandidate[] = [];
  for (const c of candidates) {
    const key = `${c.currency ?? ""}|${c.letterGroup ?? ""}|${c.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

const RISK_RANGE_RE = /\((\d)\s*-\s*(\d)\)/;

function parseTopLevelRisk(items: KapFundDetailItem[]): RiskExtractionResult | null {
  const valueItem = findItem(items, "Fonun Risk Değeri");
  if (!valueItem) return null;
  const raw = typeof valueItem.value === "string" ? valueItem.value.trim() : String(valueItem.value ?? "");
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 7) {
    return {
      status: "ambiguous",
      riskValue: null,
      sourceDetail: null,
      note: `Üst düzey "Fonun Risk Değeri" alanı 1-7 aralığında bir tam sayı değil: "${raw}"`,
    };
  }

  const rangeItem = findItem(items, "Fonun Risk Aralığı");
  if (rangeItem && typeof rangeItem.value === "string") {
    const rangeMatch = RISK_RANGE_RE.exec(rangeItem.value);
    if (rangeMatch) {
      const lo = Number(rangeMatch[1]);
      const hi = Number(rangeMatch[2]);
      if (n < lo || n > hi) {
        return {
          status: "ambiguous",
          riskValue: null,
          sourceDetail: null,
          note: `Çelişkili KAP verisi: "Fonun Risk Değeri"=${n} ama "Fonun Risk Aralığı"="${rangeItem.value.trim()}" ile uyuşmuyor — ne biri ne diğeri körü körüne kullanılmadı.`,
        };
      }
    }
  }

  return { status: "found", riskValue: n, sourceDetail: "kap_top_level_risk_value", note: null };
}

/**
 * Bir katılım fonunun para birimine göre para birimi etiketli adaylar
 * arasından seçim yapar. Yalnızca TEK bir aday fonun para birimiyle
 * eşleşirse güvenle seçer; 0 veya birden fazla eşleşme varsa (ya da hiç
 * para birimi etiketi yoksa) ambiguous döner — TAHMİN ETMEZ.
 */
function resolveByCurrency(
  candidates: RiskCandidate[],
  fundCurrencyCode: string,
): RiskExtractionResult {
  const targetLabel: "TL" | "USD" | "EUR" | null =
    fundCurrencyCode === "TRY" ? "TL" : fundCurrencyCode === "USD" ? "USD" : fundCurrencyCode === "EUR" ? "EUR" : null;

  // Tam olarak 2 aday VE biri tamamen etiketsiz (ne para birimi ne harf) VE
  // diğeri açık bir yabancı para birimi taşıyorsa: etiketsiz olan örtük
  // "TL/varsayılan" grubu sayılır (gözlemlenen gerçek KAP verilerinde bu
  // ikili dağılım hep bu şekilde: ör. "6", "B Grubu Paylar (USD) Risk
  // Değeri: 3" -> ilk değer örtük TL, ikincisi açık USD).
  let effective = candidates;
  if (candidates.length === 2) {
    const unlabeled = candidates.find((c) => c.currency === null && c.letterGroup === null);
    const labeled = candidates.find((c) => c !== unlabeled && c.currency !== null);
    if (unlabeled && labeled) {
      effective = candidates.map((c) => (c === unlabeled ? { ...c, currency: "TL" as const } : c));
    }
  }

  const withCurrency = effective.filter((c) => c.currency !== null);
  if (withCurrency.length === 0 || targetLabel === null) {
    return {
      status: "ambiguous",
      riskValue: null,
      sourceDetail: null,
      note: `Birden fazla pay grubu değeri var ama hiçbiri para birimi etiketi taşımıyor, fon para birimiyle eşleştirilemedi: ${JSON.stringify(candidates.map((c) => c.raw))}`,
    };
  }

  const matches = withCurrency.filter((c) => c.currency === targetLabel);
  if (matches.length !== 1) {
    return {
      status: "ambiguous",
      riskValue: null,
      sourceDetail: null,
      note: `Fon para birimi (${fundCurrencyCode}) ile eşleşen tam olarak bir pay grubu bulunamadı (${matches.length} eşleşme): ${JSON.stringify(candidates.map((c) => c.raw))}`,
    };
  }

  return {
    status: "found",
    riskValue: matches[0].value,
    sourceDetail: `kap_currency_group_${targetLabel.toLowerCase()}`,
    note: null,
  };
}

function parseStrategyFieldRisk(items: KapFundDetailItem[], fundCurrencyCode: string): RiskExtractionResult {
  const item = findItem(items, "Fonun Yatırım Amacı veya Stratejisi");
  const value = item?.value;
  if (!Array.isArray(value)) {
    return { status: "no_risk_field", riskValue: null, sourceDetail: null, note: null };
  }

  const riskTexts = value
    .map((v) => (v && typeof v === "object" ? (v as Record<string, unknown>).riskDegeri : null))
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);

  if (riskTexts.length === 0) {
    return { status: "no_risk_field", riskValue: null, sourceDetail: null, note: null };
  }

  const allCandidates = dedupeCandidates(riskTexts.flatMap((t) => extractLabeledCandidates(t)));

  if (allCandidates.length === 0) {
    return {
      status: "ambiguous",
      riskValue: null,
      sourceDetail: null,
      note: `"Fonun Yatırım Amacı veya Stratejisi" alanında risk metni var ama sayısal bir değere ayrıştırılamadı: ${JSON.stringify(riskTexts)}`,
    };
  }

  if (allCandidates.length === 1) {
    return { status: "found", riskValue: allCandidates[0].value, sourceDetail: "kap_single_value", note: null };
  }

  return resolveByCurrency(allCandidates, fundCurrencyCode);
}

/**
 * Bir fonun tam `fundDetail` dizisinden risk değerini çıkarır.
 * Önce üst düzey "Fonun Risk Değeri" şemasını (emeklilik fonu tipi
 * sayfalarda görülür), yoksa katılım fonu şemasındaki gömülü
 * pay-grubu-bazlı metni dener.
 */
export function extractRiskFromFundDetail(
  items: KapFundDetailItem[],
  fundCurrencyCode: string,
): RiskExtractionResult {
  const topLevel = parseTopLevelRisk(items);
  if (topLevel) return topLevel;
  return parseStrategyFieldRisk(items, fundCurrencyCode);
}
