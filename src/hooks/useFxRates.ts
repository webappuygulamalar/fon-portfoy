import { useEffect, useState } from "react";
import { getLatestFxRate } from "../services/fxRepository";
import type { FxRateRow } from "../services/types";

/** Verilen para birimleri için en güncel kurları getirir (TRY hariç). */
export function useFxRates(currencies: string[]): Record<string, FxRateRow> {
  const needed = [...new Set(currencies.filter((c) => c && c !== "TRY"))].sort();
  const key = needed.join(",");
  const [rates, setRates] = useState<Record<string, FxRateRow>>({});

  useEffect(() => {
    let active = true;
    if (needed.length === 0) {
      setRates({});
      return;
    }
    Promise.all(needed.map((c) => getLatestFxRate(c)))
      .then((results) => {
        if (!active) return;
        const map: Record<string, FxRateRow> = {};
        results.forEach((r, i) => {
          if (r) map[needed[i]] = r;
        });
        setRates(map);
      })
      .catch(() => {
        if (active) setRates({});
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return rates;
}
