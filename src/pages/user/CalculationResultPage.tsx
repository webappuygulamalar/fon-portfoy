import { useMemo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { calculatePortfolio } from "../../domain/calculation/engine";
import { buildCalculationInput, resolveFundSelections } from "../../domain/calculation/buildInput";
import {
  buildCustomProfileModel,
  CUSTOM_PROFILE_ID,
  isCustomAllocationComplete,
} from "../../domain/calculation/customAllocation";
import { usePublishedModel } from "../../hooks/usePublishedModel";
import { useFxRates } from "../../hooks/useFxRates";
import { useCalculatorSelection } from "../../context/CalculatorSelectionContext";
import { parseAmountValue } from "../../lib/amountInput";
import { formatTRY } from "../../lib/format";
import { Disclaimer } from "../../components/ui/Disclaimer";
import { Banner } from "../../components/ui/Banner";
import { AllocationEditor } from "../../components/portfolio/AllocationEditor";
import { CalculationSummary } from "../../components/portfolio/CalculationSummary";

/**
 * Ayrı sonuç sayfası: girdi (tutar, risk profili, fon override'ları)
 * `CalculatorSelectionContext`ten (sessionStorage destekli) okunur, sonuç
 * her render'da SAF `calculatePortfolio` ile burada yeniden hesaplanır —
 * ayrıca saklanan bir "result" state'i yoktur. Bu sayede:
 *  - Sayfa yenilendiğinde (URL: #/hesaplama/sonuc) sessionStorage'daki
 *    girdilerle hesaplama sorunsuz tekrarlanır.
 *  - Fon override'ı değiştirip geri dönüldüğünde sonuç otomatik güncellenir.
 * Geçersiz/eksik girdiyle (tutar yok/negatif, profil seçilmemiş veya
 * güncel yayınlanmış modelde artık bulunmuyor) hesaplama sayfasına
 * yönlendirilir — hata fırlatılmaz.
 */
export function CalculationResultPage() {
  const navigate = useNavigate();
  const { totalAmountInput, selectedProfileId, overrides, resetOverrides, customAllocations } =
    useCalculatorSelection();
  const { loading, error, data } = usePublishedModel();

  const isCustomSelected = selectedProfileId === CUSTOM_PROFILE_ID;
  const isCustomComplete = isCustomAllocationComplete(customAllocations);
  // Özel dağılım, yayınlanmış modelin bir parçası değildir — gerçek
  // profillerde yapıldığı gibi `data.profiles` içinde ARANMAZ. Aynı
  // `ProfileModel` şekline (bkz. buildCustomProfileModel) dönüştürülerek
  // aşağıdaki tüm akış (fon çözümü, hesaplama, gösterim) değişmeden
  // yeniden kullanılır.
  const selectedProfile = !data
    ? null
    : isCustomSelected
      ? buildCustomProfileModel(customAllocations, data.defaultPreferredFundIdByAssetClass)
      : (data.profiles.find((p) => p.profileId === selectedProfileId) ?? null);

  // resolveFundSelections, AllocationEditor içinde ayrıca çağrılır; burada
  // yalnızca hangi döviz kurlarına ihtiyaç olduğunu belirlemek için kullanılır.
  const selections = useMemo(() => {
    if (!selectedProfile || !data) return [];
    return resolveFundSelections(selectedProfile, data.fundsById, data.latestPriceByFundId, overrides);
  }, [selectedProfile, data, overrides]);

  const currenciesNeeded = selections.map((s) => s.price?.currency).filter((c): c is string => Boolean(c));
  const fxRatesByCurrency = useFxRates(currenciesNeeded);

  const parsedTotal = parseAmountValue(totalAmountInput);
  const isTotalValid = Number.isFinite(parsedTotal) && parsedTotal > 0;

  // Tüm hook'lar yukarıda, koşulsuz çağrıldı — artık güvenle erken dönebiliriz.
  // Özel seçiliyken toplam tam %100 değilse (ör. sayfa doğrudan URL ile
  // açıldıysa) CalculatorPage'deki "yalnızca %100'de hesapla" kısıtı burada
  // da uygulanır — eksik/taşan bir dağılımla asla sonuç üretilmez.
  if (!isTotalValid || !selectedProfileId || (isCustomSelected && !isCustomComplete)) {
    return <Navigate to="/" replace />;
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
  if (!selectedProfile) {
    return <Navigate to="/" replace />;
  }

  const input = buildCalculationInput(
    parsedTotal,
    selectedProfile,
    data.fundsById,
    data.latestPriceByFundId,
    overrides,
    fxRatesByCurrency,
  );
  const result = calculatePortfolio(input);

  return (
    <div className="stack">
      <button className="btn btn-secondary" onClick={() => navigate("/")}>
        ← Geri dön
      </button>

      <div>
        <h1 className="page-title">Hesaplama Sonucu</h1>
        <p className="page-subtitle">
          {isCustomSelected
            ? "Özel dağılımınıza göre pay hesaplama özetiniz."
            : "Model dağılımına göre pay hesaplama özetiniz."}
        </p>
      </div>

      <Disclaimer />

      <div className="card row-between">
        <div>
          <p className="section-title">Toplam Portföy Tutarı</p>
          <p style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }} className="tabular-nums">
            {formatTRY(parsedTotal)}
          </p>
        </div>
        <div>
          <p className="section-title">Risk Profili</p>
          <p style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{selectedProfile.name}</p>
        </div>
      </div>

      <div className="card">
        <p className="section-title">Model Dağılımı</p>
        <div style={{ marginTop: 12 }}>
          <AllocationEditor
            profile={selectedProfile}
            fundsById={data.fundsById}
            latestPriceByFundId={data.latestPriceByFundId}
            returnsByFundId={data.returnsByFundId}
            overrides={overrides}
            onResetOverrides={resetOverrides}
          />
        </div>
      </div>

      <div>
        <p className="section-title" style={{ marginBottom: 12 }}>
          Pay Hesaplama Özeti
        </p>
        <CalculationSummary result={result} />
      </div>
    </div>
  );
}
