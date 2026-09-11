import { ASSET_CLASSES, ASSET_CLASS_LABELS, type AssetClass } from "../../lib/constants";
import { customAllocationTotal, isCustomAllocationComplete } from "../../domain/calculation/customAllocation";
import { formatPercent } from "../../lib/format";
import { DonutChart, type DonutChartSegment } from "../ui/DonutChart";
import { Banner } from "../ui/Banner";

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
 * "Özel" kartı seçildiğinde açılan, kullanıcının 5 varlık sınıfı için
 * doğrudan yüzde yazabildiği düzenleyici. Canlı donut grafik için mevcut
 * bağımlılıksız `DonutChart` bileşeni yeniden kullanılır — yeni bir grafik
 * kütüphanesi eklenmez.
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

  function handleTextChange(assetClass: AssetClass, raw: string) {
    if (raw.trim() === "") {
      onChange(assetClass, 0);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    onChange(assetClass, parsed);
  }

  function step(assetClass: AssetClass, delta: number) {
    onChange(assetClass, (allocations[assetClass] ?? 0) + delta);
  }

  return (
    <div className="card custom-allocation-editor stack" data-testid="custom-allocation-editor">
      <p className="disclaimer">Bu dağılım kullanıcı tarafından oluşturulur ve hazır bir risk profili değildir.</p>

      <div className="stack-sm">
        {ASSET_CLASSES.map((ac) => (
          <div className="custom-allocation-row" key={ac}>
            <label className="field-label custom-allocation-label" htmlFor={`custom-pct-${ac}`}>
              {ASSET_CLASS_LABELS[ac]}
            </label>
            <div className="custom-allocation-input-group">
              <button
                type="button"
                className="btn btn-secondary custom-allocation-step"
                aria-label={`${ASSET_CLASS_LABELS[ac]} yüzdesini bir azalt`}
                onClick={() => step(ac, -1)}
              >
                −
              </button>
              <input
                id={`custom-pct-${ac}`}
                className="input tabular-nums custom-allocation-input"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                value={allocations[ac] ?? 0}
                onChange={(e) => handleTextChange(ac, e.target.value)}
              />
              <span className="custom-allocation-suffix" aria-hidden="true">
                %
              </span>
              <button
                type="button"
                className="btn btn-secondary custom-allocation-step"
                aria-label={`${ASSET_CLASS_LABELS[ac]} yüzdesini bir artır`}
                onClick={() => step(ac, 1)}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="custom-allocation-chart-row">
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

      <div className="stack-sm">
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
  );
}
