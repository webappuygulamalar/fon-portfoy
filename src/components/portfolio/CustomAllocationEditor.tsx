import { ASSET_CLASSES, ASSET_CLASS_LABELS, type AssetClass } from "../../lib/constants";
import { customAllocationTotal, isCustomAllocationComplete } from "../../domain/calculation/customAllocation";
import { formatPercent } from "../../lib/format";
import { DonutChart, type DonutChartSegment } from "../ui/DonutChart";
import { Banner } from "../ui/Banner";
import { PercentageField } from "./PercentageField";

/** Uygulamanın yeşil temasına uygun, 5 kategori için ayrı ayrı renkler (mevcut risk kartlarındaki gibi Mevduat+PPF birleştirilMEZ). */
const CUSTOM_CATEGORY_COLOR: Record<AssetClass, string> = {
  DEPOSIT: "var(--color-mint)",
  MONEY_MARKET: "var(--color-mint-strong)",
  BIST_EQUITY: "var(--color-chart-blue)",
  GOLD: "var(--color-gold)",
  FX: "var(--color-chart-violet)",
};

interface CustomAllocationEditorProps {
  allocations: Record<AssetClass, number>;
  onChange: (assetClass: AssetClass, value: number) => void;
}

/**
 * Ayrı `#/hesaplama/ozel` sayfasının (bkz. CustomAllocationPage) içeriği:
 * kullanıcının 5 varlık sınıfı için doğrudan yüzde yazabildiği düzenleyici.
 * Mobilde tek sütun (alanlar üstte, donut altta — kullanıcı büyük bir kart/
 * grafiği geçmeden yüzde alanlarını hemen görür), masaüstünde iki sütun
 * (alanlar solda, donut sağda). Canlı donut grafik için mevcut bağımlılıksız
 * `DonutChart` bileşeni yeniden kullanılır — yeni bir grafik kütüphanesi
 * eklenmez.
 */
export function CustomAllocationEditor({ allocations, onChange }: CustomAllocationEditorProps) {
  const total = customAllocationTotal(allocations);
  const remaining = 100 - total;
  const complete = isCustomAllocationComplete(allocations);

  const segments: DonutChartSegment[] = ASSET_CLASSES.filter((ac) => (allocations[ac] ?? 0) > 0).map((ac) => ({
    key: ac,
    percentage: allocations[ac] ?? 0,
    color: CUSTOM_CATEGORY_COLOR[ac],
  }));

  return (
    <div className="custom-allocation-layout">
      {/* Sıra (mobil, tek sütun): yüzde alanları -> Toplam/Kalan durumu.
          Masaüstünde bu blok SOLDA, donut SAĞDA gösterilir (bkz. CSS). */}
      <div className="card custom-allocation-fields stack" data-testid="custom-allocation-editor">
        <p className="disclaimer">Bu dağılım kullanıcı tarafından oluşturulur ve hazır bir risk profili değildir.</p>

        <div className="stack-sm custom-allocation-rows">
          {ASSET_CLASSES.map((ac) => (
            <PercentageField
              key={ac}
              id={`custom-pct-${ac}`}
              label={ASSET_CLASS_LABELS[ac]}
              value={allocations[ac] ?? 0}
              onChange={(value) => onChange(ac, value)}
              decreaseAriaLabel={`${ASSET_CLASS_LABELS[ac]} yüzdesini bir azalt`}
              increaseAriaLabel={`${ASSET_CLASS_LABELS[ac]} yüzdesini bir artır`}
            />
          ))}
        </div>

        <div className="stack-sm custom-allocation-total-status">
          <div className="kv-row">
            <span className="k">Toplam</span>
            <span className="tabular-nums">{formatPercent(total)}</span>
          </div>
          <div className="kv-row">
            <span className="k">Kalan</span>
            <span className="tabular-nums">
              {remaining >= 0 ? formatPercent(remaining) : `-${formatPercent(Math.abs(remaining))}`}
            </span>
          </div>

          {complete ? (
            <Banner variant="info">Toplam %100 — hesaplamaya hazır.</Banner>
          ) : (
            <Banner variant="warning">
              {remaining > 0
                ? `Toplamın %100 olması için %${remaining} daha dağıtmalısınız.`
                : `Toplam %100'ü %${Math.abs(remaining)} aşıyor; bazı yüzdeleri azaltın.`}
            </Banner>
          )}
        </div>
      </div>

      {/* Donut + legend: mobilde alanların ALTINDA, masaüstünde SAĞ sütunda. */}
      <div className="custom-allocation-chart-col">
        <DonutChart segments={segments} size={140} strokeWidth={20} />
        {segments.length > 0 && (
          <span className="risk-profile-legend custom-allocation-legend">
            {segments.map((s) => (
              <span className="risk-profile-legend-row" key={s.key}>
                <span className="risk-profile-legend-dot" style={{ background: s.color }} />
                <span className="risk-profile-legend-label">{ASSET_CLASS_LABELS[s.key as AssetClass]}</span>
                <span className="risk-profile-legend-pct tabular-nums">{formatPercent(s.percentage)}</span>
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
