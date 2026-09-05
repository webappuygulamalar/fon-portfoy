import { useEffect, useMemo, useState } from "react";
import { calculatePortfolio } from "../../domain/calculation/engine";
import { buildCalculationInput, resolveFundSelections } from "../../domain/calculation/buildInput";
import type { FundAssetClass, PortfolioCalculationResult } from "../../domain/calculation/types";
import { usePublishedModel } from "../../hooks/usePublishedModel";
import { useFxRates } from "../../hooks/useFxRates";
import { Disclaimer } from "../../components/ui/Disclaimer";
import { Banner } from "../../components/ui/Banner";
import { AllocationEditor } from "../../components/portfolio/AllocationEditor";
import { CalculationSummary } from "../../components/portfolio/CalculationSummary";

export function CalculatorPage() {
  const { loading, error, data } = usePublishedModel();
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [totalAmountInput, setTotalAmountInput] = useState("");
  const [overrides, setOverrides] = useState<Partial<Record<FundAssetClass, string>>>({});
  const [result, setResult] = useState<PortfolioCalculationResult | null>(null);

  useEffect(() => {
    if (data && !selectedProfileId && data.profiles.length > 0) {
      setSelectedProfileId(data.profiles[0].profileId);
    }
  }, [data, selectedProfileId]);

  const selectedProfile = data?.profiles.find((p) => p.profileId === selectedProfileId) ?? null;

  const selections = useMemo(() => {
    if (!selectedProfile || !data) return [];
    return resolveFundSelections(selectedProfile, data.fundsById, data.latestPriceByFundId, overrides);
  }, [selectedProfile, data, overrides]);

  const currenciesNeeded = selections.map((s) => s.price?.currency).filter((c): c is string => Boolean(c));
  const fxRatesByCurrency = useFxRates(currenciesNeeded);

  const allFunds = useMemo(() => (data ? Object.values(data.fundsById) : []), [data]);

  const parsedTotal = Number(totalAmountInput.replace(/\./g, "").replace(",", "."));
  const isTotalValid = totalAmountInput.trim() !== "" && Number.isFinite(parsedTotal) && parsedTotal > 0;

  function handleProfileChange(profileId: string) {
    setSelectedProfileId(profileId);
    setOverrides({});
    setResult(null);
  }

  function handleOverrideChange(assetClass: FundAssetClass, fundId: string | null) {
    setOverrides((prev) => {
      const next = { ...prev };
      if (fundId) next[assetClass] = fundId;
      else delete next[assetClass];
      return next;
    });
    setResult(null);
  }

  function handleCalculate() {
    if (!selectedProfile || !data || !isTotalValid) return;
    const input = buildCalculationInput(
      parsedTotal,
      selectedProfile,
      data.fundsById,
      data.latestPriceByFundId,
      overrides,
      fxRatesByCurrency,
    );
    setResult(calculatePortfolio(input));
  }

  if (loading) {
    return <p className="page-subtitle">Yükleniyor…</p>;
  }

  if (error) {
    return <Banner variant="danger">Veriler yüklenemedi: {error}</Banner>;
  }

  if (!data) {
    return <Banner variant="warning">Henüz yayınlanmış bir model portföy bulunmuyor.</Banner>;
  }

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Portföy Hesaplama</h1>
        <p className="page-subtitle">
          Toplam tutarınızı girin, bir risk profili seçin ve model dağılımına göre pay hesaplama
          özetini görün.
        </p>
      </div>

      <Disclaimer />

      <div className="card stack">
        <div className="field">
          <label className="field-label" htmlFor="total-amount">
            Toplam Portföy Tutarı (TL)
          </label>
          <input
            id="total-amount"
            className="input tabular-nums"
            inputMode="decimal"
            placeholder="Örn. 100.000"
            value={totalAmountInput}
            onChange={(e) => {
              setTotalAmountInput(e.target.value);
              setResult(null);
            }}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="risk-profile">
            Risk Profili
          </label>
          <select
            id="risk-profile"
            className="select"
            value={selectedProfileId}
            onChange={(e) => handleProfileChange(e.target.value)}
          >
            {data.profiles.map((p) => (
              <option key={p.profileId} value={p.profileId}>
                {p.name}
              </option>
            ))}
          </select>
          {selectedProfile && <p className="page-subtitle">{selectedProfile.description}</p>}
        </div>
      </div>

      {selectedProfile && (
        <div className="card">
          <p className="section-title">Model Dağılımı</p>
          <div style={{ marginTop: 12 }}>
            <AllocationEditor
              profile={selectedProfile}
              fundsById={data.fundsById}
              latestPriceByFundId={data.latestPriceByFundId}
              allFunds={allFunds}
              overrides={overrides}
              onOverrideChange={handleOverrideChange}
              onResetOverrides={() => {
                setOverrides({});
                setResult(null);
              }}
            />
          </div>
        </div>
      )}

      <div className="desktop-only">
        <button className="btn btn-primary" disabled={!isTotalValid} onClick={handleCalculate}>
          Portföyü Hesapla
        </button>
      </div>

      <div className="sticky-action-bar">
        <button className="btn btn-primary btn-block" disabled={!isTotalValid} onClick={handleCalculate}>
          Portföyü Hesapla
        </button>
      </div>

      {result && (
        <div>
          <p className="section-title" style={{ marginBottom: 12 }}>
            Pay Hesaplama Özeti
          </p>
          <CalculationSummary result={result} />
        </div>
      )}
    </div>
  );
}
