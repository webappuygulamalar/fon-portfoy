import type { ReactNode } from "react";
import { buildRiskProfileChartCategories } from "../../domain/model/riskProfileChartCategories";
import type { ProfileModel } from "../../domain/model/publishedModel";
import { formatPercent } from "../../lib/format";
import { DonutChart } from "../ui/DonutChart";

interface RiskProfileSelectorProps {
  profiles: ProfileModel[];
  selectedProfileId: string;
  onSelect: (profileId: string) => void;
  /** Yayınlanmış profil kartlarından SONRA, aynı grid içinde gösterilecek ek kart(lar) — ör. Özel dağılım kartı. */
  children?: ReactNode;
}

/**
 * Risk profillerini seçilebilir kartlar olarak gösterir (eski "Risk
 * Profili" combo box'ının yerine geçer). Her kart, o profilin model
 * dağılımından ÜRETİLEN bir donut grafik ve legend içerir — yüzdeler
 * asla sabit kodlanmaz, admin panelinden dağılım değişince otomatik
 * günceller (bkz. riskProfileChartCategories.ts).
 *
 * Radio-group yerine bilinçli olarak `aria-pressed` düğmeler kullanılır:
 * her kart bağımsız, doğal Tab sırasıyla odaklanabilir bir `<button>`dır
 * — `role="radio"` ile tam roving-tabindex ok tuşu gezinmesi eklemeden
 * de klavye/erişilebilirlik gereksinimini karşılar.
 */
export function RiskProfileSelector({ profiles, selectedProfileId, onSelect, children }: RiskProfileSelectorProps) {
  return (
    <div className="risk-profile-grid" role="group" aria-label="Risk profili seçin">
      {profiles.map((profile) => {
        const categories = buildRiskProfileChartCategories(profile.allocations);
        const isSelected = profile.profileId === selectedProfileId;

        return (
          <button
            key={profile.profileId}
            type="button"
            className={`risk-profile-card${isSelected ? " selected" : ""}`}
            aria-pressed={isSelected}
            onClick={() => onSelect(profile.profileId)}
          >
            <span className="risk-profile-card-name">{profile.name}</span>

            <span className="risk-profile-chart-wrap">
              <DonutChart segments={categories} />
            </span>

            <span className="risk-profile-legend">
              {categories.map((c) => (
                <span className="risk-profile-legend-row" key={c.key}>
                  <span className="risk-profile-legend-dot" style={{ background: c.color }} />
                  <span className="risk-profile-legend-label">{c.label}</span>
                  <span className="risk-profile-legend-pct tabular-nums">{formatPercent(c.percentage)}</span>
                </span>
              ))}
            </span>

            <span className="risk-profile-card-desc">{profile.description}</span>
          </button>
        );
      })}
      {children}
    </div>
  );
}
