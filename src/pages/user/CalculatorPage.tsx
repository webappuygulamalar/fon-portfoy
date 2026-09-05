import { useEffect, useMemo, useState } from "react";
import { calculatePortfolio } from "../../domain/calculation/engine";
import { buildCalculationInput, resolveFundSelections } from "../../domain/calculation/buildInput";
import type { PortfolioCalculationResult } from "../../domain/calculation/types";
import { usePublishedModel } from "../../hooks/usePublishedModel";
import { useFxRates } from "../../hooks/useFxRates";
import { useCalculatorSelection } from "../../context/CalculatorSelectionContext";
import { Disclaimer } from "../../components/ui/Disclaimer";
import { Banner } from "../../components/ui/Banner";
import { AllocationEditor } from "../../components/portfolio/AllocationEditor";
import { CalculationSummary } from "../../components/portfolio/CalculationSummary";

export function CalculatorPage() {
  const { loading, error, data } = usePublishedModel();
  const {
    totalAmountInput,
    setTotalAmountInput,
    selectedProfileId,
    setSelectedProfileId,
    overrides,
    resetOverrides,
  } = useCalculatorSelection();
  const [result, setResult] = useState<PortfolioCalculationResult | null>(null);

  useEffect(() => {
    if (data && !selectedProfileId && data.profiles.length > 0) {
      setSelectedProfileId(data.profiles[0].profileId);
    }
  }, [data, selectedProfileId, setSelectedProfileId]);

  const selectedProfile = data?.profiles.find((p) => p.profileId === selectedProfileId) ?? null;

  // resolveFundSelections, AllocationEditor içinde ayrıca çağrılır; burada
  // yalnızca hangi döviz kurlarına ihtiyaç olduğunu belirlemek için kullanılır.
  const selections = useMemo(() => {
    if (!selectedProfile || !data) return [];
    return resolveFundSelections(selectedProfile, data.fundsById, data.latestPriceByFundId, overrides);
  }, [selectedProfile, data, overrides]);

  const currenciesNeeded = selections.map((s) => s.price?.currency).filter((c): c is string => Boolean(c));
  const fxRatesByCurrency = useFxRates(currenciesNeeded);

  const parsedTotal = Number(totalAmountInput.replace(/\./g, "").replace(",", "."));
  const isTotalValid = totalAmountInput.trim() !== "" && Number.isFinite(parsedTotal) && parsedTotal > 0;

  function handleProfileChange(profileId: string) {
    setSelectedProfileId(profileId);
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
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div className="field" style={{ flex: "1 1 240px", minWidth: 220 }}>
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

          <div className="field" style={{ flex: "1 1 240px", minWidth: 220 }}>
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

        <button className="btn btn-primary btn-block" disabled={!isTotalValid} onClick={handleCalculate}>
          Portföyü Hesapla
        </button>
      </div>

      {selectedProfile && (
        <div className="card">
          <p className="section-title">Model Dağılımı</p>
          <div style={{ marginTop: 12 }}>
            <AllocationEditor
              profile={selectedProfile}
              fundsById={data.fundsById}
              latestPriceByFundId={data.latestPriceByFundId}
              overrides={overrides}
              onResetOverrides={() => {
                resetOverrides();
                setResult(null);
              }}
            />
          </div>
        </div>
      )}

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
