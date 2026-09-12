import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCalculatorSelection } from "../../context/CalculatorSelectionContext";
import { CUSTOM_PROFILE_ID, isCustomAllocationComplete } from "../../domain/calculation/customAllocation";
import { parseAmountValue } from "../../lib/amountInput";
import { AmountInput } from "../../components/ui/AmountInput";
import { Disclaimer } from "../../components/ui/Disclaimer";
import { CustomAllocationEditor } from "../../components/portfolio/CustomAllocationEditor";

/**
 * Ayrı, odaklanmış Özel dağılım adımı (`#/hesaplama/ozel`). Daha önce "Özel"
 * kartının altında AYNI SAYFADA açılan dev bir satır içi düzenleyicinin
 * yerine geçer — mobilde kart açıldığında yüzde alanlarının ekranın çok
 * altında kalıp kullanıcının kaydırması gerektiğini fark etmemesi sorununu
 * çözer. Mobil içerik sırası bilinçli: başlık/açıklama -> tutar -> yüzde
 * alanları -> toplam/kalan -> donut -> hesapla butonu (bkz.
 * CustomAllocationEditor) — yüzde alanları ilk ekranda, büyük bir kart/
 * grafik geçilmeden görünür.
 *
 * Bu sayfa ziyaret edilmesi, kullanıcının Özel'i seçtiği anlamına gelir;
 * `selectedProfileId` burada (tarayıcı geçmişi/sessionStorage tutarsız bir
 * değer taşısa bile) her zaman `CUSTOM_PROFILE_ID`'ye sabitlenir — sayfa
 * kendi kendine yeterlidir, "geçersiz durum" yönlendirmesine gerek yoktur
 * (customAllocations zaten güvenli, sanitize edilmiş bir varsayılana sahip).
 */
export function CustomAllocationPage() {
  const navigate = useNavigate();
  const {
    totalAmountInput,
    setTotalAmountInput,
    customAllocations,
    setCustomAllocationPercentage,
    selectedProfileId,
    setSelectedProfileId,
  } = useCalculatorSelection();

  useEffect(() => {
    if (selectedProfileId !== CUSTOM_PROFILE_ID) {
      setSelectedProfileId(CUSTOM_PROFILE_ID);
    }
  }, [selectedProfileId, setSelectedProfileId]);

  const parsedTotal = parseAmountValue(totalAmountInput);
  const isTotalValid = Number.isFinite(parsedTotal) && parsedTotal > 0;
  const isComplete = isCustomAllocationComplete(customAllocations);
  const canCalculate = isTotalValid && isComplete;

  function handleCalculate() {
    if (!canCalculate) return;
    navigate("/hesaplama/sonuc");
  }

  let validationMessage: string | null = null;
  if (!isTotalValid) {
    validationMessage = "Devam etmek için toplam portföy tutarını girin.";
  } else if (!isComplete) {
    validationMessage = "Devam etmek için özel dağılım toplamını %100 yapın.";
  }

  return (
    <div className="stack">
      {/* Toplam tutar ve girilmiş yüzdeler CalculatorSelectionContext'te
          (sessionStorage) tutulduğu için "/" adresine dönmek hiçbirini
          silmez — ayrıca bir "kaydet" adımına gerek yoktur. */}
      <button className="btn btn-secondary" onClick={() => navigate("/")}>
        ← Geri dön
      </button>

      <div>
        <h1 className="page-title">Kendi Dağılımını Oluştur</h1>
        <p className="page-subtitle">5 varlık sınıfı için kendi yüzdelerinizi belirleyin.</p>
      </div>

      <Disclaimer />

      <div className="field">
        <label className="field-label" htmlFor="custom-total-amount">
          Toplam Portföy Tutarı (TL)
        </label>
        <AmountInput
          id="custom-total-amount"
          className="input tabular-nums"
          placeholder="Örn. 100.000"
          value={totalAmountInput}
          onChange={setTotalAmountInput}
        />
      </div>

      <CustomAllocationEditor allocations={customAllocations} onChange={setCustomAllocationPercentage} />

      {validationMessage && (
        <p className="disclaimer" style={{ color: "var(--color-warning)" }}>
          {validationMessage}
        </p>
      )}

      <button className="btn btn-primary btn-block" disabled={!canCalculate} onClick={handleCalculate}>
        Portföyü Hesapla
      </button>
    </div>
  );
}
