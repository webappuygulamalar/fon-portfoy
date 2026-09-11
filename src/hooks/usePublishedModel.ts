import { useCallback, useEffect, useState } from "react";
import { getFundReturns, getLatestPrices, listActiveFunds } from "../services/fundsRepository";
import { loadPublishedModelBundle } from "../services/modelRepository";
import {
  buildDefaultPreferredFundIdByAssetClass,
  buildProfileModels,
  type ProfileModel,
} from "../domain/model/publishedModel";
import type { FundAssetClass } from "../domain/calculation/types";
import type { FundPriceRow, FundReturnsRow, FundRow, ModelVersionRow } from "../services/types";

export interface PublishedModelData {
  version: ModelVersionRow;
  profiles: ProfileModel[];
  fundsById: Record<string, FundRow>;
  latestPriceByFundId: Record<string, FundPriceRow>;
  /** 1/3 aylık vb. getiriler — tek toplu sorgu (bkz. getFundReturns), N+1 yok. */
  returnsByFundId: Record<string, FundReturnsRow>;
  /**
   * Herhangi bir profile özel olmayan, "varsayılan, tüm profiller" fon
   * tercihleri. Özel (kullanıcı tanımlı) dağılım için standart fon kaynağı
   * budur — bkz. `buildCustomProfileModel`.
   */
  defaultPreferredFundIdByAssetClass: Partial<Record<FundAssetClass, string>>;
}

interface UsePublishedModelResult {
  loading: boolean;
  error: string | null;
  data: PublishedModelData | null;
  reload: () => void;
}

export function usePublishedModel(): UsePublishedModelResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PublishedModelData | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const [bundle, funds, prices, returns] = await Promise.all([
          loadPublishedModelBundle(),
          listActiveFunds(),
          getLatestPrices(),
          getFundReturns(),
        ]);
        if (!active) return;

        if (!bundle) {
          setData(null);
          return;
        }

        const profiles = buildProfileModels(bundle.profiles, bundle.allocations, bundle.preferredFunds);
        const defaultPreferredFundIdByAssetClass = buildDefaultPreferredFundIdByAssetClass(
          bundle.preferredFunds,
        );

        setData({
          version: bundle.version,
          profiles,
          fundsById: Object.fromEntries(funds.map((f) => [f.id, f])),
          latestPriceByFundId: Object.fromEntries(prices.map((p) => [p.fund_id, p])),
          returnsByFundId: Object.fromEntries(returns.map((r) => [r.fund_id, r])),
          defaultPreferredFundIdByAssetClass,
        });
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Bilinmeyen hata oluştu");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [reloadTick]);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  return { loading, error, data, reload };
}
