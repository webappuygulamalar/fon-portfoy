import { describe, expect, it } from "vitest";
import { isPriceStale } from "./priceFreshness";

describe("isPriceStale", () => {
  const now = new Date("2026-09-10T12:00:00Z");

  it("tam eşik gününde (4 gün) eski sayılmaz", () => {
    expect(isPriceStale("2026-09-06", now, 4)).toBe(false);
  });

  it("eşiği aşan tarihte (5 gün) eski sayılır", () => {
    expect(isPriceStale("2026-09-05", now, 4)).toBe(true);
  });

  it("bugünün tarihi eski değildir", () => {
    expect(isPriceStale("2026-09-10", now, 4)).toBe(false);
  });

  it("eşik parametresi kolayca değiştirilebilir", () => {
    expect(isPriceStale("2026-09-08", now, 1)).toBe(true);
    expect(isPriceStale("2026-09-08", now, 10)).toBe(false);
  });
});
