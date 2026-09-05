import { useEffect, useState } from "react";
import { getFundReturns, getLatestPrices, listActiveFunds } from "../services/fundsRepository";
import type { AssetClass } from "../lib/constants";

export interface FundExplorerRow {
  id: string;
  code: string;
  name: string;
  managementCompany: string | null;
  /** null: model dışı (5 model sınıfından hiçbirine uymuyor). */
  assetClass: AssetClass | null;
  catalogCategory: string | null;
  fundType: string | null;
  currency: string;
  riskValue: number | null;
  isSubstitutionEligible: boolean;
  price: number | null;
  priceDate: string | null;
  fundSize: number | null;
  investorCount: number | null;
  return1m: number | null;
  return3m: number | null;
  returnYtd: number | null;
  return1y: number | null;
  verificationNeeded: boolean;
}

interface UseFundsExplorerResult {
  loading: boolean;
  error: string | null;
  rows: FundExplorerRow[];
}

export function useFundsExplorer(): UseFundsExplorerResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<FundExplorerRow[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [funds, prices, returns] = await Promise.all([
          listActiveFunds(),
          getLatestPrices(),
          getFundReturns(),
        ]);
        if (!active) return;

        const priceByFund = Object.fromEntries(prices.map((p) => [p.fund_id, p]));
        const returnsByFund = Object.fromEntries(returns.map((r) => [r.fund_id, r]));

        setRows(
          funds.map((f) => {
            const price = priceByFund[f.id];
            const ret = returnsByFund[f.id];
            return {
              id: f.id,
              code: f.code,
              name: f.name,
              managementCompany: f.management_company,
              assetClass: f.asset_class,
              catalogCategory: f.catalog_category,
              fundType: f.fund_type,
              currency: f.currency,
              riskValue: f.risk_value,
              isSubstitutionEligible: f.is_substitution_eligible,
              price: price ? Number(price.price) : null,
              priceDate: price ? price.price_date : null,
              fundSize: price?.fund_size ? Number(price.fund_size) : null,
              investorCount: price?.investor_count ?? null,
              return1m: ret?.return_1m_pct ? Number(ret.return_1m_pct) : null,
              return3m: ret?.return_3m_pct ? Number(ret.return_3m_pct) : null,
              returnYtd: ret?.return_ytd_pct ? Number(ret.return_ytd_pct) : null,
              return1y: ret?.return_1y_pct ? Number(ret.return_1y_pct) : null,
              verificationNeeded: f.verification_needed,
            };
          }),
        );
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
  }, []);

  return { loading, error, rows };
}
