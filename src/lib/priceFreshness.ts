import { STALE_PRICE_THRESHOLD_DAYS } from "./constants";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * priceDate (YYYY-MM-DD) ile now arasındaki takvim günü farkı eşiği
 * aşıyorsa fiyat "eski" kabul edilir. Hafta sonu/tatil nedeniyle aynı
 * değerleme tarihinin tekrarlanması burada hata değildir; sadece gün
 * farkına bakılır.
 */
export function isPriceStale(
  priceDate: string,
  now: Date = new Date(),
  thresholdDays: number = STALE_PRICE_THRESHOLD_DAYS,
): boolean {
  const priceDateUtc = Date.parse(
    priceDate.length === 10 ? `${priceDate}T00:00:00Z` : priceDate,
  );
  if (Number.isNaN(priceDateUtc)) return false;
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffDays = (nowUtc - priceDateUtc) / MS_PER_DAY;
  return diffDays > thresholdDays;
}
