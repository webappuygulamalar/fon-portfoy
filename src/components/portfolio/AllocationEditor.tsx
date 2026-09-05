import { ASSET_CLASS_LABELS, type AssetClass } from "../../lib/constants";
import { resolveFundSelections } from "../../domain/calculation/buildInput";
import type { FundAssetClass } from "../../domain/calculation/types";
import type { ProfileModel } from "../../domain/model/publishedModel";
import type { FundPriceRow, FundRow } from "../../services/types";
import { formatDateTR, formatPercent } from "../../lib/format";
import { isPriceStale } from "../../lib/priceFreshness";
import { Badge } from "../ui/Badge";

const MONEY_MARKET: FundAssetClass = "MONEY_MARKET";

interface AllocationEditorProps {
  profile: ProfileModel;
  fundsById: Record<string, FundRow>;
  latestPriceByFundId: Record<string, FundPriceRow>;
  allFunds: FundRow[];
  overrides: Partial<Record<FundAssetClass, string>>;
  onOverrideChange: (assetClass: FundAssetClass, fundId: string | null) => void;
  onResetOverrides: () => void;
}

export function AllocationEditor({
  profile,
  fundsById,
  latestPriceByFundId,
  allFunds,
  overrides,
  onOverrideChange,
  onResetOverrides,
}: AllocationEditorProps) {
  const selections = resolveFundSelections(profile, fundsById, latestPriceByFundId, overrides);
  const hasOverrides = selections.some((s) => s.isOverride);
  const depositPct = profile.allocations.DEPOSIT ?? 0;

  return (
    <div className="stack">
      {hasOverrides && (
        <div className="banner banner-warning row-between">
          <span>Standart model değiştirildi.</span>
          <button className="btn btn-secondary btn-sm" onClick={onResetOverrides}>
            Standart seçime dön
          </button>
        </div>
      )}

      <div className="record-card">
        <div className="row-between">
          <strong>{ASSET_CLASS_LABELS.DEPOSIT}</strong>
          <Badge>{formatPercent(depositPct)}</Badge>
        </div>
        {profile.depositBuckets.length > 0 && (
          <p className="disclaimer" style={{ marginTop: 8 }}>
            Vade dilimleri:{" "}
            {profile.depositBuckets
              .map((b) => `${b.label} (${formatPercent(Math.round(b.weightPercent * 10) / 10)})`)
              .join(", ")}
          </p>
        )}
      </div>

      {selections.map((sel) => {
        const assetClass = sel.assetClass as AssetClass;
        const percentage = profile.allocations[assetClass] ?? 0;
        const alternatives = allFunds.filter(
          (f) => f.asset_class === sel.assetClass && f.is_active,
        );
        const stale = sel.price ? isPriceStale(sel.price.price_date) : false;

        return (
          <div className="record-card" key={sel.assetClass}>
            <div className="row-between">
              <strong>{ASSET_CLASS_LABELS[assetClass]}</strong>
              <Badge>{formatPercent(percentage)}</Badge>
            </div>

            {sel.fund ? (
              <div className="stack-sm" style={{ marginTop: 10 }}>
                <div className="row-between">
                  <span>
                    {sel.fund.code} — {sel.fund.name}
                  </span>
                  {sel.assetClass === MONEY_MARKET && (
                    <span className="disclaimer">(diğer fonların kalanı buraya eklenir)</span>
                  )}
                </div>

                <div className="row" style={{ gap: 8 }}>
                  {sel.price ? (
                    <span className="disclaimer">
                      Son fiyat: {sel.price.price} TL · {formatDateTR(sel.price.price_date)}
                    </span>
                  ) : (
                    <Badge variant="danger">Fiyat verisi yok</Badge>
                  )}
                  {stale && <Badge variant="warning">Eski fiyat</Badge>}
                  {sel.fund.verification_needed && <Badge variant="gold">Doğrulama gerekli</Badge>}
                </div>

                {alternatives.length > 1 && (
                  <select
                    className="select"
                    value={sel.fundId ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      const isDefault =
                        !overrides[sel.assetClass] &&
                        value === profile.preferredFundIdByAssetClass[sel.assetClass];
                      onOverrideChange(sel.assetClass, isDefault ? null : value);
                    }}
                  >
                    {alternatives.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.code} — {f.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <Badge variant="danger">Bu varlık sınıfı için standart fon tanımlı değil</Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}
