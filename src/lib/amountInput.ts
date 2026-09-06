// Türkçe biçimli, "yazarken biçimlenen" tutar girişi için saf yardımcı
// fonksiyonlar. Yalnızca GÖSTERİM/GİRİŞ katmanına aittir — hesaplama
// motoruna (domain/calculation) hiçbir bağımlılığı yoktur ve ondalık
// hassasiyet kaybına yol açmaz: `parseAmountValue`, kullanıcının yazdığı
// rakamları birebir sayıya çevirir, yuvarlama yapmaz.

const CURRENCY_SIGNS = /[₺]|TL/gi;

/**
 * Kullanıcının yazdığı veya yapıştırdığı serbest metni, hesaplamaya
 * gönderilebilecek "ham" bir sayısal string'e çevirir: nokta ondalık
 * ayırıcı, gruplama karakteri yok. Türkçe kurala göre `.` binlik ayırıcı,
 * `,` ondalık ayırıcı kabul edilir — hem "6000000" hem "6.000.000" hem de
 * "100.000,50" güvenle ayrıştırılır. TL/₺ işareti ve boşluklar yok sayılır.
 * Girdi boşsa (veya hiç rakam içermiyorsa) "" döner.
 */
export function sanitizeAmountInput(raw: string): string {
  const cleaned = raw.replace(CURRENCY_SIGNS, "").replace(/\s/g, "");
  const numericOnly = cleaned.replace(/[^\d.,]/g, "");
  if (numericOnly === "") return "";

  const lastComma = numericOnly.lastIndexOf(",");
  if (lastComma === -1) {
    // Ondalık ayırıcı yok: tüm nokta/virgüller binlik gruplamasıdır, atılır.
    return numericOnly.replace(/[.,]/g, "");
  }

  const intDigits = numericOnly.slice(0, lastComma).replace(/[.,]/g, "");
  const decDigits = numericOnly.slice(lastComma + 1).replace(/[.,]/g, "");
  return `${intDigits}.${decDigits}`;
}

function groupThousands(digits: string): string {
  if (digits === "") return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * `sanitizeAmountInput` çıktısı gibi ham (nokta ondalık ayırıcılı) bir
 * string'i, kullanıcıya gösterilecek Türkçe biçime çevirir (binlik nokta,
 * ondalık virgül). Kullanıcı henüz yazmakta olabileceğinden ondalık kısım
 * (varsa) tamamlanmamış haliyle korunur — ör. "100000," girilmişse
 * "100.000," gösterilir, sona sıfır eklenmez.
 */
export function formatAmountInputDisplay(raw: string): string {
  if (raw === "") return "";
  const dotIndex = raw.indexOf(".");
  const intPart = dotIndex === -1 ? raw : raw.slice(0, dotIndex);
  const decPart = dotIndex === -1 ? undefined : raw.slice(dotIndex + 1);
  const trimmedInt = intPart.replace(/^0+(?=\d)/, "");
  const grouped = groupThousands(trimmedInt);
  return decPart === undefined ? grouped : `${grouped},${decPart}`;
}

/** Ham string'i hesaplamada kullanılacak sayıya çevirir; geçersiz/boşsa NaN. */
export function parseAmountValue(raw: string): number {
  if (raw === "" || raw === ".") return NaN;
  return Number(raw);
}

/** `text` içinde, `uptoIndex`'ten (hariç) önceki rakam sayısını döner. */
export function countDigits(text: string, uptoIndex: number): number {
  let count = 0;
  const end = Math.min(uptoIndex, text.length);
  for (let i = 0; i < end; i++) {
    if (text[i] >= "0" && text[i] <= "9") count++;
  }
  return count;
}

/**
 * `text` içinde, baştan itibaren `digitCount` kadar rakamdan hemen
 * sonraki konumu döner (imleci yeniden konumlandırmak için). Yeterli
 * rakam yoksa metnin sonunu döner.
 */
export function positionAfterDigitCount(text: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] >= "0" && text[i] <= "9") {
      seen++;
      if (seen === digitCount) return i + 1;
    }
  }
  return text.length;
}
