import { ASSET_CLASSES } from "../../lib/constants";
import type { AllocationInput } from "./types";

export interface AllocationValidationResult {
  valid: boolean;
  errors: string[];
  sum: number;
}

/**
 * Model dağılımının kural setini doğrular:
 * - Tam olarak beş varlık sınıfının her biri bir kez bulunmalı
 * - Her yüzde tam sayı ve 0-100 aralığında olmalı
 * - Toplam tam olarak 100 olmalı
 *
 * Yabancı hisse veya başka bir sınıf, AssetClass tipinde tanımlı
 * olmadığından buraya hiç giremez; bu fonksiyon yalnızca beş sabit
 * sınıfın doğru kullanıldığını doğrular.
 */
export function validateAllocations(
  allocations: AllocationInput[],
): AllocationValidationResult {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const a of allocations) {
    if (seen.has(a.assetClass)) {
      errors.push(`${a.assetClass} birden fazla kez tanımlanmış`);
    }
    seen.add(a.assetClass);

    if (!Number.isInteger(a.percentage)) {
      errors.push(`${a.assetClass} yüzdesi tam sayı olmalı`);
    }
    if (a.percentage < 0 || a.percentage > 100) {
      errors.push(`${a.assetClass} yüzdesi 0-100 aralığında olmalı`);
    }
  }

  for (const ac of ASSET_CLASSES) {
    if (!seen.has(ac)) {
      errors.push(`${ac} için dağılım eksik`);
    }
  }

  const sum = allocations.reduce((s, a) => s + a.percentage, 0);
  if (sum !== 100) {
    errors.push(`Toplam yüzde 100 olmalı (şu an ${sum})`);
  }

  return { valid: errors.length === 0, errors, sum };
}
