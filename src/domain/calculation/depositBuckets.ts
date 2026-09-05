import { Decimal, toDecimal } from "../../lib/decimal";

export interface DepositBucketInput {
  id: string;
  label: string;
  /** Mevduat tahsisinin yüzdesi (0-100), kesirli olabilir. */
  weightPercent: Decimal.Value;
  sortOrder: number;
}

export interface DepositBucketResult {
  id: string;
  label: string;
  weightPercent: Decimal;
  amount: Decimal;
  sortOrder: number;
}

export interface DepositBucketValidationResult {
  valid: boolean;
  totalPercent: Decimal;
  errors: string[];
}

/**
 * Vade dilimi ağırlıklarının toplamının %100 olduğunu doğrular.
 * Hiç dilim tanımlanmamışsa (boş liste) geçerli sayılır; bu durumda
 * mevduat tek kalem olarak gösterilir.
 */
export function validateDepositBucketWeights(
  buckets: DepositBucketInput[],
): DepositBucketValidationResult {
  if (buckets.length === 0) {
    return { valid: true, totalPercent: new Decimal(0), errors: [] };
  }
  const total = buckets.reduce(
    (sum, b) => sum.plus(toDecimal(b.weightPercent)),
    new Decimal(0),
  );
  const errors: string[] = [];
  if (!total.eq(100)) {
    errors.push(`Vade dilimleri toplamı %100 olmalı (şu an %${total.toString()})`);
  }
  return { valid: errors.length === 0, totalPercent: total, errors };
}

/**
 * Ana mevduat tutarını, admin tarafından tanımlanan vade dilimlerine
 * böler. Bu, yalnızca özet/gösterim amaçlıdır — pay hesaplama
 * mantığına hiç girmez; mevduat doğrudan tutar olarak ayrılır.
 */
export function splitDepositIntoBuckets(
  depositAmount: Decimal.Value,
  buckets: DepositBucketInput[],
): DepositBucketResult[] {
  const amount = toDecimal(depositAmount);
  return [...buckets]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((b) => ({
      id: b.id,
      label: b.label,
      weightPercent: toDecimal(b.weightPercent),
      amount: amount.mul(toDecimal(b.weightPercent)).div(100),
      sortOrder: b.sortOrder,
    }));
}
