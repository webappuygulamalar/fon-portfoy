import Decimal from "decimal.js";

// Tüm parasal hesaplamalar bu ayarlarla çalışan Decimal örneğini kullanır.
// JavaScript'in floating-point sayılarına asla güvenilmez.
Decimal.set({ precision: 34, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export function toDecimal(value: Decimal.Value): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export const ZERO = new Decimal(0);
