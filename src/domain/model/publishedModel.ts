import type { AssetClass } from "../../lib/constants";
import type { FundAssetClass } from "../calculation/types";
import type {
  ModelDepositBucketRow,
  ModelPreferredFundRow,
  ModelProfileAllocationRow,
  RiskProfileRow,
} from "../../services/types";

export interface ProfileDepositBucket {
  id: string;
  label: string;
  weightPercent: number;
  sortOrder: number;
}

export interface ProfileModel {
  profileId: string;
  key: string;
  name: string;
  description: string;
  sortOrder: number;
  allocations: Partial<Record<AssetClass, number>>;
  preferredFundIdByAssetClass: Partial<Record<FundAssetClass, string>>;
  depositBuckets: ProfileDepositBucket[];
}

/**
 * Ham DB satırlarını, her profil için tam çözümlenmiş bir modele
 * birleştiren saf fonksiyon. Tercih edilen fon çözümü: profile'a özel
 * override (profile_id dolu) varsa o kullanılır, yoksa varsayılan
 * (profile_id null) kullanılır.
 */
export function buildProfileModels(
  profiles: RiskProfileRow[],
  allocations: ModelProfileAllocationRow[],
  preferredFunds: ModelPreferredFundRow[],
  depositBuckets: ModelDepositBucketRow[],
): ProfileModel[] {
  return [...profiles]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((profile) => {
      const allocationMap: Partial<Record<AssetClass, number>> = {};
      for (const a of allocations) {
        if (a.profile_id === profile.id) allocationMap[a.asset_class] = a.percentage;
      }

      const relevantPreferred = preferredFunds.filter(
        (p) => p.profile_id === profile.id || p.profile_id === null,
      );
      // Override'lar (profile_id dolu) varsayılanlardan (null) önce gelecek
      // şekilde sırala, sonra varlık sınıfı başına ilk görüleni al.
      const sortedPreferred = [...relevantPreferred].sort((a, b) => {
        const rank = (p: ModelPreferredFundRow) => (p.profile_id === null ? 1 : 0);
        return rank(a) - rank(b);
      });
      const preferredByClass = new Map<AssetClass, string>();
      for (const p of sortedPreferred) {
        if (!preferredByClass.has(p.asset_class)) {
          preferredByClass.set(p.asset_class, p.fund_id);
        }
      }

      const buckets = depositBuckets
        .filter((b) => b.profile_id === profile.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((b) => ({
          id: b.id,
          label: b.label,
          weightPercent: Number(b.weight_percent),
          sortOrder: b.sort_order,
        }));

      return {
        profileId: profile.id,
        key: profile.key,
        name: profile.name,
        description: profile.description,
        sortOrder: profile.sort_order,
        allocations: allocationMap,
        preferredFundIdByAssetClass: Object.fromEntries(preferredByClass) as Partial<
          Record<FundAssetClass, string>
        >,
        depositBuckets: buckets,
      };
    });
}
