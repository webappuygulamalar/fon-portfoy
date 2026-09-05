import { useCallback, useEffect, useState } from "react";
import { getLatestPrices, listActiveFunds } from "../services/fundsRepository";
import { loadPublishedModelBundle } from "../services/modelRepository";
import { buildProfileModels, type ProfileModel } from "../domain/model/publishedModel";
import type { FundPriceRow, FundRow, ModelVersionRow } from "../services/types";

export interface PublishedModelData {
  version: ModelVersionRow;
  profiles: ProfileModel[];
  fundsById: Record<string, FundRow>;
  latestPriceByFundId: Record<string, FundPriceRow>;
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
        const [bundle, funds, prices] = await Promise.all([
          loadPublishedModelBundle(),
          listActiveFunds(),
          getLatestPrices(),
        ]);
        if (!active) return;

        if (!bundle) {
          setData(null);
          return;
        }

        const profiles = buildProfileModels(bundle.profiles, bundle.allocations, bundle.preferredFunds);

        setData({
          version: bundle.version,
          profiles,
          fundsById: Object.fromEntries(funds.map((f) => [f.id, f])),
          latestPriceByFundId: Object.fromEntries(prices.map((p) => [p.fund_id, p])),
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
