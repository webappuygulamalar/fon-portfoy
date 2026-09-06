import { Link } from "react-router-dom";
import { ASSET_CLASS_LABELS, type AssetClass } from "../../lib/constants";
import { resolveFundSelections } from "../../domain/calculation/buildInput";
import type { FundAssetClass } from "../../domain/calculation/types";
import type { ProfileModel } from "../../domain/model/publishedModel";
import type { FundPriceRow, FundRow } from "../../services/types";
import { formatCurrencyCode, formatDateTR, formatNumber, formatPercent } from "../../lib/format";
import { isPriceStale } from "../../lib/priceFreshness";
import { Badge } from "../ui/Badge";

const MONEY_MARKET: FundAssetClass = "MONEY_MARKET";

interface AllocationEditorProps {
  profile: ProfileModel;
  fundsById: Record<string, FundRow>;
  latestPriceByFundId: Record<string, FundPriceRow>;
  overrides: Partial<Record<FundAssetClass, string>>;
  onResetOverrides: () => void;
}

export function AllocationEditor({
  profile,
  fundsById,
  latestPriceByFundId,
  overrides,
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
            Standart fona dön
          </button>
        </div>
      )}

      <div className="record-card">
        <div className="row-between">
          <strong>{ASSET_CLASS_LABELS.DEPOSIT}</strong>
          <Badge>{formatPercent(depositPct)}</Badge>
        </div>
      </div>

      {selections.map((sel) => {
        const assetClass = sel.assetClass as AssetClass;
        const percentage = profile.allocations[assetClass] ?? 0;
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
                      Son fiyat: {formatNumber(sel.price.price)} {formatCurrencyCode(sel.price.currency)} ·{" "}
                      {formatDateTR(sel.price.price_date)}
                    </span>
                  ) : (
                    <Badge variant="danger">Fiyat verisi yok</Badge>
                  )}
                  {stale && <Badge variant="warning">Eski fiyat</Badge>}
                  {sel.fund.verification_needed && <Badge variant="gold">Doğrulama gerekli</Badge>}
                </div>

                <div>
                  <Link className="btn btn-secondary btn-sm" to={`/fon-degistir/${sel.assetClass}`}>
                    Fonu değiştir
                  </Link>
                </div>
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
