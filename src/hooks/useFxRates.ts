import { useEffect, useState } from "react";
import { getLatestFxRate } from "../services/fxRepository";
import type { FxRateRow } from "../services/types";

export interface UseFxRatesResult {
  rates: Record<string, FxRateRow>;
  /**
   * Gerçekten bir kur isteği sürüyorken true. `currencies` TRY dışında
   * hiçbir para birimi içermiyorsa (TL portföyü) hiçbir istek atılmaz ve bu
   * hep false'tur — TL portföyü hiçbir zaman gereksiz yere beklemez.
   */
  loading: boolean;
  /**
   * Yalnızca kur İSTEĞİNİN KENDİSİ (ağ/istisna) başarısız olduğunda dolu
   * olur. Kur isteği BAŞARIYLA tamamlanıp istenen para birimi sonuçta
   * bulunamazsa bu `null` kalır — o durum "gerçekten eksik veri"dir ve
   * motorun `MISSING_FX_RATE` blockReason'ı üzerinden ayrıca ele alınır
   * (bkz. CalculationResultPage, CalculationSummary). Bu ayrım olmadan
   * "yükleniyor", "gerçekten eksik" ve "istek başarısız oldu" durumları
   * birbirine karışır.
   */
  error: string | null;
}

/**
 * Verilen para birimleri için en güncel kurları getirir (TRY hariç).
 * Üç durumu KESİN olarak ayırır: `loading` (istek sürüyor), `error` (istek
 * ağ/istisna nedeniyle başarısız oldu) ve normal dönüş değeri `rates`
 * (istek başarıyla tamamlandı — aranan para birimi haritada yoksa bu,
 * "gerçekten kur bulunamadı" anlamına gelir, `error` ile KARIŞTIRILMAZ).
 */
export function useFxRates(currencies: string[]): UseFxRatesResult {
  const needed = [...new Set(currencies.filter((c) => c && c !== "TRY"))].sort();
  const key = needed.join(",");
  const [rates, setRates] = useState<Record<string, FxRateRow>>({});
  const [loading, setLoading] = useState(needed.length > 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (needed.length === 0) {
      setRates({});
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all(needed.map((c) => getLatestFxRate(c)))
      .then((results) => {
        if (!active) return;
        const map: Record<string, FxRateRow> = {};
        results.forEach((r, i) => {
          if (r) map[needed[i]] = r;
        });
        setRates(map);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setRates({});
        setLoading(false);
        setError(err instanceof Error ? err.message : "Döviz kuru bilgisi alınamadı");
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { rates, loading, error };
}
