import { describe, expect, it } from "vitest";
import { splitDepositIntoBuckets, validateDepositBucketWeights } from "./depositBuckets";

describe("deposit buckets", () => {
  it("örnekteki gibi 8.500.000 TL'yi 4.000.000 / 4.500.000 olarak böler", () => {
    const buckets = [
      { id: "b1", label: "101 gün", weightPercent: "47.058823529411764706", sortOrder: 1 },
      { id: "b2", label: "32 gün", weightPercent: "52.941176470588235294", sortOrder: 2 },
    ];
    expect(validateDepositBucketWeights(buckets).valid).toBe(true);

    const split = splitDepositIntoBuckets("8500000", buckets);
    expect(split[0].amount.toDecimalPlaces(2).toNumber()).toBeCloseTo(4_000_000, 2);
    expect(split[1].amount.toDecimalPlaces(2).toNumber()).toBeCloseTo(4_500_000, 2);
  });

  it("toplamı %100 olmayan dilimleri geçersiz sayar", () => {
    const result = validateDepositBucketWeights([
      { id: "b1", label: "101 gün", weightPercent: 40, sortOrder: 1 },
      { id: "b2", label: "32 gün", weightPercent: 50, sortOrder: 2 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/%100/);
  });

  it("hiç dilim tanımlanmamışsa geçerli sayılır (tek kalem gösterim)", () => {
    expect(validateDepositBucketWeights([]).valid).toBe(true);
  });

  it("sortOrder'a göre sıralar", () => {
    const buckets = [
      { id: "b2", label: "İkinci", weightPercent: 50, sortOrder: 2 },
      { id: "b1", label: "Birinci", weightPercent: 50, sortOrder: 1 },
    ];
    const split = splitDepositIntoBuckets(1000, buckets);
    expect(split.map((b) => b.id)).toEqual(["b1", "b2"]);
  });
});
