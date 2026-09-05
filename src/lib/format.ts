import { Decimal, toDecimal } from "./decimal";

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
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

export function formatTRY(value: Decimal.Value): string {
  return currencyFormatter.format(toDecimal(value).toNumber());
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
