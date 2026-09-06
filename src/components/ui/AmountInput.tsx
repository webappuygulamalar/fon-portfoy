import { useRef, type ChangeEvent } from "react";
import {
  countDigits,
  formatAmountInputDisplay,
  positionAfterDigitCount,
  sanitizeAmountInput,
} from "../../lib/amountInput";

interface AmountInputProps {
  id?: string;
  className?: string;
  placeholder?: string;
  /** Ham (nokta ondalık ayırıcılı, gruplamasız) değer — hesaplamaya giden kaynak string. */
  value: string;
  onChange: (raw: string) => void;
}

/**
 * "Yazarken biçimlenen" Türkçe tutar girişi: kullanıcı `6000000` yazınca
 * ekranda `6.000.000` gösterir, dışarıya her zaman ham (biçimlenmemiş)
 * sayısal string verir. `type="number"` KULLANMAZ — tarayıcı locale'ine
 * göre değişen davranışlar yerine, tam kontrolümüzde metin girişi + güvenli
 * ayrıştırma kullanılır. `inputMode="numeric"` mobilde rakam klavyesi açar.
 */
export function AmountInput({ id, className, placeholder, value, onChange }: AmountInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const el = e.target;
    const cursor = el.selectionStart ?? el.value.length;
    const digitsBeforeCursor = countDigits(el.value, cursor);
    const sanitized = sanitizeAmountInput(el.value);
    onChange(sanitized);

    // React, `value` prop'unu güncelleyince imleci sona atlatabilir; bir
    // sonraki frame'de aynı rakam sayısına göre imleci yeniden konumlandırıyoruz.
    requestAnimationFrame(() => {
      const node = inputRef.current;
      if (!node) return;
      const newDisplay = formatAmountInputDisplay(sanitized);
      const pos = positionAfterDigitCount(newDisplay, digitsBeforeCursor);
      node.setSelectionRange(pos, pos);
    });
  }

  return (
    <input
      ref={inputRef}
      id={id}
      className={className}
      inputMode="numeric"
      placeholder={placeholder}
      value={formatAmountInputDisplay(value)}
      onChange={handleChange}
    />
  );
}
