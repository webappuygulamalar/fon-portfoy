import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { PercentageField } from "./PercentageField";

const LABEL = "Test Kategori";

/** Gerçek context'teki `setCustomAllocationPercentage` gibi 0-100'e kırpan, tam sayıya yuvarlayan bir test harness'i. */
function ClampedHarness({ initial = 0, onChangeSpy }: { initial?: number; onChangeSpy?: (v: number) => void }) {
  const [value, setValue] = useState(initial);
  function handleChange(v: number) {
    onChangeSpy?.(v);
    if (!Number.isFinite(v)) return;
    setValue(Math.min(100, Math.max(0, Math.round(v))));
  }
  return (
    <PercentageField
      id="pct-test"
      label={LABEL}
      value={value}
      onChange={handleChange}
      decreaseAriaLabel="Test Kategori yüzdesini bir azalt"
      increaseAriaLabel="Test Kategori yüzdesini bir artır"
    />
  );
}

function input(): HTMLInputElement {
  return screen.getByLabelText(LABEL) as HTMLInputElement;
}

describe("PercentageField — sıfır değerde odak davranışı", () => {
  it("7. değer tam 0 iken odaklanınca görünen '0' geçici olarak temizlenir", () => {
    render(<ClampedHarness initial={0} />);
    expect(input().value).toBe("0");
    fireEvent.focus(input());
    expect(input().value).toBe("");
  });

  it("8. boş alana '5' yazıldığında değer 5 olur (uncontrolled '05' oluşmaz)", () => {
    render(<ClampedHarness initial={0} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "5" } });
    expect(input().value).toBe("5");
  });

  it("boş alana '20' yazıldığında değer 20 olur", () => {
    render(<ClampedHarness initial={0} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "20" } });
    expect(input().value).toBe("20");
  });

  it("9. hiçbir rakam yazmadan blur olunca tekrar '0' gösterilir", () => {
    render(<ClampedHarness initial={0} />);
    fireEvent.focus(input());
    expect(input().value).toBe("");
    fireEvent.blur(input());
    expect(input().value).toBe("0");
  });

  it("değeri 0 OLMAYAN bir alana odaklanınca içerik temizlenmez", () => {
    render(<ClampedHarness initial={35} />);
    fireEvent.focus(input());
    expect(input().value).toBe("35");
  });
});

describe("PercentageField — mevcut değeri elle silme", () => {
  it("10. değer elle tamamen silinip blur edilince 0'a döner", () => {
    render(<ClampedHarness initial={35} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "" } });
    expect(input().value).toBe(""); // düzenleme sırasında hâlâ boş gösterilir
    fireEvent.blur(input());
    expect(input().value).toBe("0");
  });

  it("11. geçici boşluk sırasında dahili state NaN olmaz; onChange her zaman geçerli bir sayı ile çağrılır", () => {
    const calls: number[] = [];
    render(<ClampedHarness initial={35} onChangeSpy={(v) => calls.push(v)} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "" } });
    expect(calls).toEqual([0]);
    expect(calls.every((v) => Number.isFinite(v))).toBe(true);
  });
});

describe("PercentageField — artı/eksi düğmeleri", () => {
  it("12a. alan geçici olarak boşken '+' sıfırdan artırır", () => {
    render(<ClampedHarness initial={0} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "" } });
    expect(input().value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Test Kategori yüzdesini bir artır" }));
    expect(input().value).toBe("1");
  });

  it("12b. '−' hiçbir zaman negatif değer üretmez (0'da durur)", () => {
    render(<ClampedHarness initial={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Test Kategori yüzdesini bir azalt" }));
    expect(input().value).toBe("0");
  });

  it("'+' düğmesi taslağı temizler, gösterim gerçek değere döner", () => {
    render(<ClampedHarness initial={5} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "57" } });
    fireEvent.click(screen.getByRole("button", { name: "Test Kategori yüzdesini bir artır" }));
    // 57 + 1 = 58 (taslak değil, gerçek state üzerinden).
    expect(input().value).toBe("58");
  });
});

describe("PercentageField — Enter ile çıkış", () => {
  it("13. Enter alanı blur eder (Tab/Bitti ile aynı 'commit ve çık' davranışı)", () => {
    render(<ClampedHarness initial={0} />);
    // `fireEvent.focus` sentetik bir olay gönderir ama `document.activeElement`ı
    // değiştirmez; gerçek kullanıcı odaklanmasını (ve dolayısıyla Enter'ın
    // gerçekten blur ETTİĞİNİ) doğrulamak için native `.focus()` kullanılır.
    input().focus();
    expect(document.activeElement).toBe(input());
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(document.activeElement).not.toBe(input());
    expect(input().value).toBe("0");
  });
});

describe("PercentageField — 0-100 sınırları (14)", () => {
  it.each([
    ["0", 0],
    ["1", 1],
    ["99", 99],
    ["100", 100],
    ["101", 100],
  ])("'%s' yazılıp blur edildiğinde değer %i olur", (raw, expected) => {
    render(<ClampedHarness initial={0} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: raw } });
    fireEvent.blur(input());
    expect(input().value).toBe(String(expected));
  });
});

describe("PercentageField — erişilebilirlik", () => {
  it("görünür bir label'ı ve doğru inputMode'u korur", () => {
    render(<ClampedHarness initial={0} />);
    const el = input();
    expect(document.querySelector(`label[for="${el.id}"]`)?.textContent).toBe(LABEL);
    expect(el).toHaveAttribute("inputMode", "numeric");
  });

  it("React controlled/uncontrolled input uyarısı vermez (value her zaman tanımlı bir string)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ClampedHarness initial={0} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "" } });
    fireEvent.blur(input());
    const uncontrolledWarning = errorSpy.mock.calls.some((args) =>
      String(args[0]).includes("changing an uncontrolled input"),
    );
    expect(uncontrolledWarning).toBe(false);
    errorSpy.mockRestore();
  });
});
