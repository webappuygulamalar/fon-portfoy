import { Decimal, toDecimal } from "./decimal";

const currencyFormatterWhole = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const currencyFormatterFraction = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/**
 * TL tutarını Türkçe biçimde gösterir. Küsürat tam olarak sıfırsa (ör.
 * 5.100.000,00) ",00" HİÇ gösterilmez ("₺5.100.000"); gerçek kuruş varsa
 * iki basamak gösterilir ("₺179.846,63"). Yalnızca gösterim amaçlıdır —
 * `toNumber()` çevrimi burada biter, hesaplamalara geri beslenmez.
 */
export function formatTRY(value: Decimal.Value): string {
  const decimal = toDecimal(value);
  const isWhole = decimal.toDecimalPlaces(2).mod(1).isZero();
  const formatter = isWhole ? currencyFormatterWhole : currencyFormatterFraction;
  return formatter.format(decimal.toNumber());
}

export function formatNumber(value: Decimal.Value): string {
  return numberFormatter.format(toDecimal(value).toNumber());
}

export function formatPercent(value: number | Decimal.Value): string {
  const n = value instanceof Decimal ? value : toDecimal(value);
  return `%${numberFormatter.format(n.toNumber())}`;
}

export function formatDateTR(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate.length === 10 ? `${isoDate}T00:00:00Z` : isoDate);
  if (Number.isNaN(d.getTime())) return "—";
  return dateFormatter.format(d);
}
