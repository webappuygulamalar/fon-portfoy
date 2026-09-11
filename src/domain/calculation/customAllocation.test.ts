import { describe, expect, it } from "vitest";
import {
  buildCustomProfileModel,
  clampPercentage,
  CUSTOM_PROFILE_DESCRIPTION,
  CUSTOM_PROFILE_ID,
  CUSTOM_PROFILE_NAME,
  customAllocationTotal,
  EMPTY_CUSTOM_ALLOCATIONS,
  isCustomAllocationComplete,
  sanitizeCustomAllocations,
} from "./customAllocation";

describe("customAllocationTotal / isCustomAllocationComplete", () => {
  it("beş sınıfın yüzdelerini toplar", () => {
    const total = customAllocationTotal({ DEPOSIT: 50, MONEY_MARKET: 10, BIST_EQUITY: 20, GOLD: 10, FX: 10 });
    expect(total).toBe(100);
  });

  it("%99 tamamlanmamış, %100 tamamlanmış, %101 fazladır", () => {
    const base = { DEPOSIT: 0, MONEY_MARKET: 0, BIST_EQUITY: 0, GOLD: 0, FX: 0 };
    expect(isCustomAllocationComplete({ ...base, DEPOSIT: 99 })).toBe(false);
    expect(isCustomAllocationComplete({ ...base, DEPOSIT: 100 })).toBe(true);
    expect(isCustomAllocationComplete({ ...base, DEPOSIT: 100, MONEY_MARKET: 1 })).toBe(false);
  });

  it("tüm tutar tek kategoriye %100 verilebilir", () => {
    expect(
      isCustomAllocationComplete({ DEPOSIT: 0, MONEY_MARKET: 0, BIST_EQUITY: 0, GOLD: 0, FX: 100 }),
    ).toBe(true);
  });

  it("bazı kategoriler %0 bırakılabilir, toplamı etkilemez", () => {
    const total = customAllocationTotal({ DEPOSIT: 100, MONEY_MARKET: 0, BIST_EQUITY: 0, GOLD: 0, FX: 0 });
    expect(total).toBe(100);
  });
});

describe("clampPercentage", () => {
  it("0-100 aralığına kırpar", () => {
    expect(clampPercentage(-5, 0)).toBe(0);
    expect(clampPercentage(150, 0)).toBe(100);
    expect(clampPercentage(42, 0)).toBe(42);
  });

  it("en yakın tam sayıya yuvarlar", () => {
    expect(clampPercentage(42.6, 0)).toBe(43);
  });

  it("sonlu olmayan değerde fallback'i korur", () => {
    expect(clampPercentage(NaN, 7)).toBe(7);
    expect(clampPercentage(Infinity, 7)).toBe(7);
  });
});

describe("sanitizeCustomAllocations — bozuk sessionStorage verisine karşı güvenlik", () => {
  it("geçerli bir nesneyi olduğu gibi kabul eder", () => {
    const result = sanitizeCustomAllocations({
      DEPOSIT: 10,
      MONEY_MARKET: 20,
      BIST_EQUITY: 30,
      GOLD: 20,
      FX: 20,
    });
    expect(result).toEqual({ DEPOSIT: 10, MONEY_MARKET: 20, BIST_EQUITY: 30, GOLD: 20, FX: 20 });
  });

  it("eksik alanları 0 kabul eder", () => {
    const result = sanitizeCustomAllocations({ DEPOSIT: 50 });
    expect(result).toEqual({ ...EMPTY_CUSTOM_ALLOCATIONS, DEPOSIT: 50 });
  });

  it("null/undefined/nesne olmayan girdide güvenli varsayılana döner", () => {
    expect(sanitizeCustomAllocations(null)).toEqual(EMPTY_CUSTOM_ALLOCATIONS);
    expect(sanitizeCustomAllocations(undefined)).toEqual(EMPTY_CUSTOM_ALLOCATIONS);
    expect(sanitizeCustomAllocations("bozuk")).toEqual(EMPTY_CUSTOM_ALLOCATIONS);
    expect(sanitizeCustomAllocations(42)).toEqual(EMPTY_CUSTOM_ALLOCATIONS);
  });

  it("negatif veya 100'den büyük bir değer tüm nesneyi reddeder (kısmi onarım yapmaz)", () => {
    expect(sanitizeCustomAllocations({ DEPOSIT: -5, GOLD: 10 })).toEqual(EMPTY_CUSTOM_ALLOCATIONS);
    expect(sanitizeCustomAllocations({ DEPOSIT: 101 })).toEqual(EMPTY_CUSTOM_ALLOCATIONS);
  });

  it("ondalık veya yanlış tipte bir değer tüm nesneyi reddeder", () => {
    expect(sanitizeCustomAllocations({ DEPOSIT: 10.5 })).toEqual(EMPTY_CUSTOM_ALLOCATIONS);
    expect(sanitizeCustomAllocations({ DEPOSIT: "50" })).toEqual(EMPTY_CUSTOM_ALLOCATIONS);
  });
});

describe("buildCustomProfileModel", () => {
  it("ProfileModel şeklinde, veritabanına ait olmayan sabit bir kimlikle döner", () => {
    const allocations = { DEPOSIT: 10, MONEY_MARKET: 20, BIST_EQUITY: 30, GOLD: 20, FX: 20 };
    const defaults = { MONEY_MARKET: "fund-mm", BIST_EQUITY: "fund-bist", GOLD: "fund-gold", FX: "fund-fx" };
    const model = buildCustomProfileModel(allocations, defaults);

    expect(model.profileId).toBe(CUSTOM_PROFILE_ID);
    expect(model.name).toBe(CUSTOM_PROFILE_NAME);
    expect(model.description).toBe(CUSTOM_PROFILE_DESCRIPTION);
    expect(model.allocations).toEqual(allocations);
    expect(model.preferredFundIdByAssetClass).toEqual(defaults);
  });
});
