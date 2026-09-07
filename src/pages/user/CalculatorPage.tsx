import { useNavigate } from "react-router-dom";
import { usePublishedModel } from "../../hooks/usePublishedModel";
import { useCalculatorSelection } from "../../context/CalculatorSelectionContext";
import { parseAmountValue } from "../../lib/amountInput";
import { AmountInput } from "../../components/ui/AmountInput";
import { Disclaimer } from "../../components/ui/Disclaimer";
import { Banner } from "../../components/ui/Banner";
import { RiskProfileSelector } from "../../components/portfolio/RiskProfileSelector";

export function CalculatorPage() {
  const navigate = useNavigate();
  const { loading, error, data } = usePublishedModel();
  const { totalAmountInput, setTotalAmountInput, selectedProfileId, setSelectedProfileId } =
    useCalculatorSelection();

  const parsedTotal = parseAmountValue(totalAmountInput);
  const isTotalValid = Number.isFinite(parsedTotal) && parsedTotal > 0;
  const hasProfileSelection = Boolean(selectedProfileId);

  function handleCalculate() {
    if (!isTotalValid || !hasProfileSelection) return;
    navigate("/hesaplama/sonuc");
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
          Toplam tutarınızı girin, bir risk profili seçin ve devam edin.
        </p>
      </div>

      <Disclaimer />

      <div className="card">
        <div className="field">
          <label className="field-label" htmlFor="total-amount">
            Toplam Portföy Tutarı (TL)
          </label>
          <AmountInput
            id="total-amount"
            className="input tabular-nums"
            placeholder="Örn. 100.000"
            value={totalAmountInput}
            onChange={setTotalAmountInput}
          />
        </div>
      </div>

      <div>
        <p className="section-title" style={{ marginBottom: 12 }}>
          Risk Profili
        </p>
        <RiskProfileSelector
          profiles={data.profiles}
          selectedProfileId={selectedProfileId}
          onSelect={setSelectedProfileId}
        />
      </div>

      {(!isTotalValid || !hasProfileSelection) && (
        <p className="disclaimer" style={{ color: "var(--color-warning)" }}>
          {!isTotalValid
            ? "Devam etmek için toplam portföy tutarını girin."
            : "Devam etmek için bir risk profili seçin."}
        </p>
      )}

      <button
        className="btn btn-primary btn-block"
        disabled={!isTotalValid || !hasProfileSelection}
        onClick={handleCalculate}
      >
        Portföyü Hesapla
      </button>
    </div>
  );
}
