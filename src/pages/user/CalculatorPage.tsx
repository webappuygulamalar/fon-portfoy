import { useNavigate } from "react-router-dom";
import { usePublishedModel } from "../../hooks/usePublishedModel";
import { useCalculatorSelection } from "../../context/CalculatorSelectionContext";
import { parseAmountValue } from "../../lib/amountInput";
import { AmountInput } from "../../components/ui/AmountInput";
import { Disclaimer } from "../../components/ui/Disclaimer";
import { Banner } from "../../components/ui/Banner";
import { RiskProfileSelector } from "../../components/portfolio/RiskProfileSelector";
import { CustomProfileCard } from "../../components/portfolio/CustomProfileCard";
import { CustomAllocationEditor } from "../../components/portfolio/CustomAllocationEditor";
import { CUSTOM_PROFILE_ID, isCustomAllocationComplete } from "../../domain/calculation/customAllocation";

export function CalculatorPage() {
  const navigate = useNavigate();
  const { loading, error, data } = usePublishedModel();
  const {
    totalAmountInput,
    setTotalAmountInput,
    selectedProfileId,
    setSelectedProfileId,
    customAllocations,
    setCustomAllocationPercentage,
  } = useCalculatorSelection();

  const parsedTotal = parseAmountValue(totalAmountInput);
  const isTotalValid = Number.isFinite(parsedTotal) && parsedTotal > 0;
  const hasProfileSelection = Boolean(selectedProfileId);
  const isCustomSelected = selectedProfileId === CUSTOM_PROFILE_ID;
  const isCustomComplete = isCustomAllocationComplete(customAllocations);
  // Özel seçiliyken, toplam tam %100 olmadan hesaplamaya asla izin verilmez
  // (klavye/tıklama/form gönderimi fark etmeksizin — buton `disabled` olur
  // ve `handleCalculate` de aynı koşulu ayrıca doğrular).
  const canCalculate = isTotalValid && hasProfileSelection && (!isCustomSelected || isCustomComplete);

  function handleCalculate() {
    if (!canCalculate) return;
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
        >
          <CustomProfileCard
            selected={isCustomSelected}
            onSelect={() => setSelectedProfileId(CUSTOM_PROFILE_ID)}
          />
        </RiskProfileSelector>
      </div>

      {isCustomSelected && (
        <CustomAllocationEditor allocations={customAllocations} onChange={setCustomAllocationPercentage} />
      )}

      {(!isTotalValid || !hasProfileSelection || (isCustomSelected && !isCustomComplete)) && (
        <p className="disclaimer" style={{ color: "var(--color-warning)" }}>
          {!isTotalValid
            ? "Devam etmek için toplam portföy tutarını girin."
            : !hasProfileSelection
              ? "Devam etmek için bir risk profili seçin."
              : "Devam etmek için özel dağılım toplamını %100 yapın."}
        </p>
      )}

      <button className="btn btn-primary btn-block" disabled={!canCalculate} onClick={handleCalculate}>
        Portföyü Hesapla
      </button>
    </div>
  );
}
