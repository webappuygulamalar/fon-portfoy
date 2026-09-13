import { useState, type ChangeEvent, type KeyboardEvent } from "react";

interface PercentageFieldProps {
  id: string;
  label: string;
  /** Her zaman 0-100 aralığında, tam sayı — üst bileşen (context) zaten kırpıyor. */
  value: number;
  onChange: (value: number) => void;
  decreaseAriaLabel: string;
  increaseAriaLabel: string;
}

/**
 * Tam sayı yüzde girişi (0-100), +/- düğmeleriyle. Değer tam 0 iken alana
 * odaklanıldığında görünen "0" GEÇİCİ OLARAK temizlenir — aksi halde
 * kullanıcı yeni rakamı "0"ın sağına yazmak zorunda kalır ve "05"/"010"
 * gibi anlamsız ara değerler oluşur. Bunu, `value` (gerçek sayısal state —
 * asla boş string/NaN almaz) ile ekranda gösterilen metni ayıran yerel bir
 * `draft` string state'i sağlar:
 *  - `draft === null`: gösterim doğrudan `value`den türetilir (normal durum).
 *  - `draft !== null`: kullanıcı o an düzenliyor; ekranda ham yazdığı metin
 *    gösterilir (boş dahil). Alan boşken bile `onChange` HER ZAMAN 0
 *    (asla NaN/boş) ile çağrılır, böylece toplam/kalan ve donut gibi diğer
 *    hesaplamalar düzenleme sırasında da doğru kalır.
 * Blur olunca draft temizlenir; alan hâlâ boşsa gösterim otomatik olarak
 * `value` (zaten 0'a çekilmiş) üzerinden "0"a döner. Bu sayede React'e
 * controlled input her zaman tanımlı bir string `value` ile verilir —
 * "uncontrolled input" uyarısı oluşmaz.
 */
export function PercentageField({
  id,
  label,
  value,
  onChange,
  decreaseAriaLabel,
  increaseAriaLabel,
}: PercentageFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayValue = draft ?? String(value);

  function handleFocus() {
    if (value === 0) setDraft("");
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setDraft(raw);
    if (raw.trim() === "") {
      onChange(0);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    onChange(parsed);
  }

  function handleBlur() {
    setDraft(null);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Enter'da da Tab/Bitti ile aynı şekilde "commit ve çık" davranışı —
    // form olmadığından Enter'ın kendiliğinden hiçbir etkisi yok, blur
    // tetiklemek dışında.
    if (e.key === "Enter") e.currentTarget.blur();
  }

  function step(delta: number) {
    setDraft(null);
    onChange(value + delta);
  }

  return (
    <div className="custom-allocation-row">
      <label className="field-label custom-allocation-label" htmlFor={id}>
        {label}
      </label>
      <div className="custom-allocation-input-group">
        <button
          type="button"
          className="btn btn-secondary custom-allocation-step"
          aria-label={decreaseAriaLabel}
          onClick={() => step(-1)}
        >
          −
        </button>
        <input
          id={id}
          className="input tabular-nums custom-allocation-input"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          value={displayValue}
          onFocus={handleFocus}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
        <span className="custom-allocation-suffix" aria-hidden="true">
          %
        </span>
        <button
          type="button"
          className="btn btn-secondary custom-allocation-step"
          aria-label={increaseAriaLabel}
          onClick={() => step(1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
