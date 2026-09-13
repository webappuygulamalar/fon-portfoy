import { Link } from "react-router-dom";
import { ASSET_CLASS_LABELS, type AssetClass } from "../../lib/constants";
import { resolveFundSelections } from "../../domain/calculation/buildInput";
import { CUSTOM_PROFILE_ID, isHiddenZeroPercentCategory } from "../../domain/calculation/customAllocation";
import type { FundAssetClass } from "../../domain/calculation/types";
import type { ProfileModel } from "../../domain/model/publishedModel";
import type { FundPriceRow, FundReturnsRow, FundRow } from "../../services/types";
import { formatCurrencyCode, formatDateTR, formatNumber, formatPercent, formatSignedPercent } from "../../lib/format";
import { isPriceStale } from "../../lib/priceFreshness";
import { Badge } from "../ui/Badge";
import { orderFundSelectionsForDisplay } from "./fundLineOrder";

const MONEY_MARKET: FundAssetClass = "MONEY_MARKET";

function formatReturn1m(row: FundReturnsRow | undefined): string {
  const value = row?.return_1m_pct ? Number(row.return_1m_pct) : null;
  return value === null ? "—" : formatSignedPercent(Math.round(value * 100) / 100);
}

interface AllocationEditorProps {
  profile: ProfileModel;
  fundsById: Record<string, FundRow>;
  latestPriceByFundId: Record<string, FundPriceRow>;
  returnsByFundId: Record<string, FundReturnsRow>;
  overrides: Partial<Record<FundAssetClass, string>>;
  onResetOverrides: () => void;
}

export function AllocationEditor({
  profile,
  fundsById,
  latestPriceByFundId,
  returnsByFundId,
  overrides,
  onResetOverrides,
}: AllocationEditorProps) {
  const isCustom = profile.profileId === CUSTOM_PROFILE_ID;
  // Özel dağılımda kullanıcının tam %0 verdiği bir kategori Model
  // Dağılımı'nda da HİÇ render edilmez (fon kartı, fiyatı, "Fonu değiştir"
  // dahil) — bkz. isHiddenZeroPercentCategory. Hazır profillerde bu her
  // zaman false'tur, görünüm/davranış değişmez.
  const visibleSelections = orderFundSelectionsForDisplay(
    resolveFundSelections(profile, fundsById, latestPriceByFundId, overrides),
    profile,
  ).filter((sel) => !isHiddenZeroPercentCategory(isCustom, profile.allocations[sel.assetClass as AssetClass] ?? 0));
  const hasOverrides = visibleSelections.some((s) => s.isOverride);
  const depositPct = profile.allocations.DEPOSIT ?? 0;
  const showDeposit = !isHiddenZeroPercentCategory(isCustom, depositPct);

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

      {showDeposit && (
        <div className="record-card">
          <div className="row-between">
            <strong>{ASSET_CLASS_LABELS.DEPOSIT}</strong>
            <Badge>{formatPercent(depositPct)}</Badge>
          </div>
        </div>
      )}

      {visibleSelections.map((sel) => {
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

                <span className="disclaimer">1 aylık getiri: {formatReturn1m(returnsByFundId[sel.fund.id])}</span>

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
