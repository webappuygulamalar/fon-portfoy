import { describe, expect, it } from "vitest";
import { buildProfileModels } from "./publishedModel";
import type {
  ModelDepositBucketRow,
  ModelPreferredFundRow,
  ModelProfileAllocationRow,
  RiskProfileRow,
} from "../../services/types";

const profiles: RiskProfileRow[] = [
  { id: "p1", key: "dusuk_1", name: "Düşük 1", description: "", sort_order: 1, is_active: true },
  { id: "p2", key: "orta", name: "Orta", description: "", sort_order: 2, is_active: true },
];

const allocations: ModelProfileAllocationRow[] = [
  { id: "a1", model_version_id: "v1", profile_id: "p1", asset_class: "DEPOSIT", percentage: 85 },
  { id: "a2", model_version_id: "v1", profile_id: "p2", asset_class: "DEPOSIT", percentage: 50 },
];

describe("buildProfileModels", () => {
  it("profile'a özel override, varsayılan fondan önceliklidir", () => {
    const preferredFunds: ModelPreferredFundRow[] = [
      { id: "pf1", model_version_id: "v1", profile_id: null, asset_class: "GOLD", fund_id: "fund-default" },
      { id: "pf2", model_version_id: "v1", profile_id: "p2", asset_class: "GOLD", fund_id: "fund-override" },
    ];
    const result = buildProfileModels(profiles, allocations, preferredFunds, []);

    const p1 = result.find((p) => p.profileId === "p1")!;
    const p2 = result.find((p) => p.profileId === "p2")!;

    expect(p1.preferredFundIdByAssetClass.GOLD).toBe("fund-default");
    expect(p2.preferredFundIdByAssetClass.GOLD).toBe("fund-override");
  });

  it("sortOrder'a göre profilleri sıralar", () => {
    const result = buildProfileModels(
      [...profiles].reverse(),
      allocations,
      [],
      [],
    );
    expect(result.map((p) => p.key)).toEqual(["dusuk_1", "orta"]);
  });

  it("her profilin yalnızca kendi vade dilimlerini alır", () => {
    const buckets: ModelDepositBucketRow[] = [
      { id: "b1", model_version_id: "v1", profile_id: "p1", label: "101 gün", weight_percent: "47.059", sort_order: 1 },
      { id: "b2", model_version_id: "v1", profile_id: "p1", label: "32 gün", weight_percent: "52.941", sort_order: 2 },
    ];
    const result = buildProfileModels(profiles, allocations, [], buckets);
    const p1 = result.find((p) => p.profileId === "p1")!;
    const p2 = result.find((p) => p.profileId === "p2")!;
    expect(p1.depositBuckets).toHaveLength(2);
    expect(p1.depositBuckets[0].label).toBe("101 gün");
    expect(p2.depositBuckets).toHaveLength(0);
  });
});
