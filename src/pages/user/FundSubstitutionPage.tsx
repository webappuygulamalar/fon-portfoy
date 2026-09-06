import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { usePublishedModel } from "../../hooks/usePublishedModel";
import { useFundsExplorer, type FundExplorerRow } from "../../hooks/useFundsExplorer";
import { useCalculatorSelection } from "../../context/CalculatorSelectionContext";
import { ASSET_CLASS_LABELS } from "../../lib/constants";
import type { FundAssetClass } from "../../domain/calculation/types";
import { formatCurrencyCode, formatDateTR, formatNumber, formatSignedPercent } from "../../lib/format";
import { isPriceStale } from "../../lib/priceFreshness";
import { Badge } from "../../components/ui/Badge";
import { Banner } from "../../components/ui/Banner";
import { Disclaimer } from "../../components/ui/Disclaimer";

const VALID_ASSET_CLASSES: readonly FundAssetClass[] = ["MONEY_MARKET", "BIST_EQUITY", "GOLD", "FX"];

function isFundAssetClass(value: string | undefined): value is FundAssetClass {
  return !!value && (VALID_ASSET_CLASSES as readonly string[]).includes(value);
}

function cell(value: number | null, suffix = ""): string {
  return value === null ? "—" : `${formatNumber(value)}${suffix}`;
}

function returnCell(value: number | null): string {
  return value === null ? "—" : formatSignedPercent(Math.round(value * 100) / 100);
}

export function FundSubstitutionPage() {
  const { assetClass: assetClassParam } = useParams<{ assetClass: string }>();
  const navigate = useNavigate();
  const { data, loading: modelLoading, error: modelError } = usePublishedModel();
  const { rows, loading: rowsLoading, error: rowsError } = useFundsExplorer();
  const { selectedProfileId, overrides, setOverride } = useCalculatorSelection();

  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [fundTypeFilter, setFundTypeFilter] = useState("ALL");

  const candidates = useMemo(
    () =>
      isFundAssetClass(assetClassParam)
        ? rows.filter((r) => r.assetClass === assetClassParam && r.isSubstitutionEligible)
        : [],
    [rows, assetClassParam],
  );

  const companies = useMemo(
    () =>
      [...new Set(candidates.map((c) => c.managementCompany).filter((c): c is string => Boolean(c)))].sort(
        (a, b) => a.localeCompare(b, "tr-TR"),
      ),
    [candidates],
  );
  const fundTypes = useMemo(
    () => [...new Set(candidates.map((c) => c.fundType).filter((t): t is string => Boolean(t)))].sort(),
    [candidates],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr-TR");
    return candidates.filter((c) => {
      const matchesTerm =
        term === "" ||
        c.code.toLocaleLowerCase("tr-TR").includes(term) ||
        c.name.toLocaleLowerCase("tr-TR").includes(term) ||
        (c.managementCompany?.toLocaleLowerCase("tr-TR").includes(term) ?? false);
      const matchesCompany = companyFilter === "ALL" || c.managementCompany === companyFilter;
      const matchesType = fundTypeFilter === "ALL" || c.fundType === fundTypeFilter;
      return matchesTerm && matchesCompany && matchesType;
    });
  }, [candidates, search, companyFilter, fundTypeFilter]);

  if (!isFundAssetClass(assetClassParam)) {
    return <Navigate to="/" replace />;
  }

  if (modelLoading || rowsLoading) {
    return <p className="page-subtitle">Yükleniyor…</p>;
  }
  if (modelError) return <Banner variant="danger">Veriler yüklenemedi: {modelError}</Banner>;
  if (rowsError) return <Banner variant="danger">Fon kataloğu yüklenemedi: {rowsError}</Banner>;
  if (!data) return <Banner variant="warning">Henüz yayınlanmış bir model portföy bulunmuyor.</Banner>;

  const selectedProfile = data.profiles.find((p) => p.profileId === selectedProfileId) ?? data.profiles[0] ?? null;
  if (!selectedProfile) {
    return <Banner variant="warning">Önce hesaplama sayfasından bir risk profili seçin.</Banner>;
  }

  const standardFundId = selectedProfile.preferredFundIdByAssetClass[assetClassParam] ?? null;
  const currentFundId = overrides[assetClassParam] ?? standardFundId;
  const hasOverride = Boolean(overrides[assetClassParam]);

  function handleSelect(fundId: string) {
    const isStandard = fundId === standardFundId;
    setOverride(assetClassParam as FundAssetClass, isStandard ? null : fundId);
    navigate("/");
  }

  function handleResetToStandard() {
    setOverride(assetClassParam as FundAssetClass, null);
    navigate("/");
  }

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">{ASSET_CLASS_LABELS[assetClassParam]} Seç</h1>
        <p className="page-subtitle">
          {selectedProfile.name} profili için bu varlık sınıfına uygun katılım fonları arasından seçim
          yapın. Seçiminiz yalnızca bu tarayıcı oturumunda geçerli olur; yayınlanan model değişmez.
        </p>
      </div>

      <Disclaimer />

      <div className="row-between">
        {hasOverride ? (
          <button className="btn btn-secondary btn-sm" onClick={handleResetToStandard}>
            Standart fona dön
          </button>
        ) : (
          <span />
        )}
        <button className="btn btn-secondary btn-sm" onClick={() => navigate("/")}>
          Vazgeç ve geri dön
        </button>
      </div>

      <div className="card stack-sm">
        <input
          className="input"
          placeholder="Kod, ad veya portföy şirketine göre ara"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="row">
          <select
            className="select"
            style={{ width: "auto", flex: "1 1 200px" }}
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
          >
            <option value="ALL">Tüm portföy şirketleri</option>
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className="select"
            style={{ width: "auto", flex: "1 1 160px" }}
            value={fundTypeFilter}
            onChange={(e) => setFundTypeFilter(e.target.value)}
          >
            <option value="ALL">Tüm fon türleri</option>
            {fundTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 && (
        <Banner variant="info">Bu varlık sınıfı için aramanızla eşleşen uygun fon bulunamadı.</Banner>
      )}

      {filtered.length > 0 && (
        <>
          <div className="table-scroll desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fon</th>
                  <th>Portföy Şirketi</th>
                  <th>Tür</th>
                  <th>Risk</th>
                  <th>Son Fiyat</th>
                  <th>Büyüklük</th>
                  <th>Yatırımcı</th>
                  <th>1 Ay</th>
                  <th>1 Yıl</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <FundRowDesktop
                    key={f.id}
                    fund={f}
                    isStandard={f.id === standardFundId}
                    isSelected={f.id === currentFundId}
                    onSelect={() => handleSelect(f.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mobile-only stack-sm">
            {filtered.map((f) => (
              <FundCardMobile
                key={f.id}
                fund={f}
                isStandard={f.id === standardFundId}
                isSelected={f.id === currentFundId}
                onSelect={() => handleSelect(f.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadges({ fund, isStandard, isSelected }: { fund: FundExplorerRow; isStandard: boolean; isSelected: boolean }) {
  const stale = fund.priceDate ? isPriceStale(fund.priceDate) : false;
  return (
    <div className="row" style={{ gap: 6 }}>
      {isStandard && <Badge variant="mint">Standart fon</Badge>}
      {isSelected && <Badge variant="gold">Seçildi</Badge>}
      {fund.price === null && <Badge variant="danger">Fiyat yok</Badge>}
      {fund.price !== null && stale && <Badge variant="warning">Eski fiyat</Badge>}
      {fund.verificationNeeded && <Badge variant="gold">Doğrulama gerekli</Badge>}
    </div>
  );
}

function SelectButton({ fund, onSelect }: { fund: FundExplorerRow; onSelect: () => void }) {
  const disabled = fund.price === null;
  return (
    <div>
      <button className="btn btn-primary btn-sm" disabled={disabled} onClick={onSelect}>
        Bu fonu seç
      </button>
      {disabled && <p className="disclaimer" style={{ marginTop: 4 }}>Bu fon için güncel fiyat verisi yok.</p>}
    </div>
  );
}

function FundRowDesktop({
  fund,
  isStandard,
  isSelected,
  onSelect,
}: {
  fund: FundExplorerRow;
  isStandard: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <tr>
      <td>
        <strong>{fund.code}</strong>
        <div className="disclaimer">{fund.name}</div>
      </td>
      <td>{fund.managementCompany ?? "—"}</td>
      <td>{fund.fundType ?? "—"}</td>
      <td className="tabular-nums">{fund.riskValue ?? "—"}</td>
      <td className="tabular-nums">
        {cell(fund.price)} {fund.price !== null ? formatCurrencyCode(fund.currency) : ""}
        <div className="disclaimer">{fund.priceDate ? formatDateTR(fund.priceDate) : "—"}</div>
      </td>
      <td className="tabular-nums">{cell(fund.fundSize)}</td>
      <td className="tabular-nums">{cell(fund.investorCount)}</td>
      <td className="tabular-nums">{returnCell(fund.return1m)}</td>
      <td className="tabular-nums">{returnCell(fund.return1y)}</td>
      <td>
        <StatusBadges fund={fund} isStandard={isStandard} isSelected={isSelected} />
      </td>
      <td>
        <SelectButton fund={fund} onSelect={onSelect} />
      </td>
    </tr>
  );
}

function FundCardMobile({
  fund,
  isStandard,
  isSelected,
  onSelect,
}: {
  fund: FundExplorerRow;
  isStandard: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="record-card">
      <div className="row-between">
        <div>
          <strong>{fund.code}</strong>
          <p className="disclaimer">{fund.name}</p>
        </div>
      </div>
      <div className="stack-sm" style={{ marginTop: 8 }}>
        <StatusBadges fund={fund} isStandard={isStandard} isSelected={isSelected} />
        <div className="kv-row">
          <span className="k">Portföy Şirketi</span>
          <span>{fund.managementCompany ?? "—"}</span>
        </div>
        <div className="kv-row">
          <span className="k">Son Fiyat</span>
          <span className="tabular-nums">
            {cell(fund.price)} {fund.price !== null ? formatCurrencyCode(fund.currency) : ""}{" "}
            {fund.priceDate ? `(${formatDateTR(fund.priceDate)})` : ""}
          </span>
        </div>
        <div className="kv-row">
          <span className="k">Risk / Büyüklük</span>
          <span className="tabular-nums">
            {fund.riskValue ?? "—"} / {cell(fund.fundSize)}
          </span>
        </div>
        <div className="kv-row">
          <span className="k">1 Ay / 1 Yıl Getiri</span>
          <span className="tabular-nums">
            {returnCell(fund.return1m)} / {returnCell(fund.return1y)}
          </span>
        </div>
        <SelectButton fund={fund} onSelect={onSelect} />
      </div>
    </div>
  );
}
