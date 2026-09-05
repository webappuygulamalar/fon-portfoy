import { useMemo, useState } from "react";
import { useFundsExplorer, type FundExplorerRow } from "../../hooks/useFundsExplorer";
import { ASSET_CLASS_LABELS, type AssetClass } from "../../lib/constants";
import { formatDateTR, formatNumber, formatPercent } from "../../lib/format";
import { Banner } from "../../components/ui/Banner";
import { Badge } from "../../components/ui/Badge";
import { Disclaimer } from "../../components/ui/Disclaimer";

type SortKey = "code" | "fundSize" | "return1m" | "return3m" | "returnYtd" | "return1y";
type AssetClassFilter = AssetClass | "ALL" | "NONE";

const SORT_LABELS: Record<SortKey, string> = {
  code: "Koda göre (A-Z)",
  fundSize: "Büyüklüğe göre (çoktan aza)",
  return1m: "1 ay getiriye göre",
  return3m: "3 ay getiriye göre",
  returnYtd: "Yılbaşından beri getiriye göre",
  return1y: "1 yıl getiriye göre",
};

function cell(value: number | null, suffix = ""): string {
  return value === null ? "—" : `${formatNumber(value)}${suffix}`;
}

function returnCell(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${formatPercent(Math.round(value * 100) / 100)}`;
}

function assetClassLabel(assetClass: AssetClass | null): string {
  return assetClass ? ASSET_CLASS_LABELS[assetClass] : "Model dışı";
}

export function FundsPage() {
  const { loading, error, rows } = useFundsExplorer();
  const [search, setSearch] = useState("");
  const [assetClassFilter, setAssetClassFilter] = useState<AssetClassFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [companyFilter, setCompanyFilter] = useState<string>("ALL");
  const [fundTypeFilter, setFundTypeFilter] = useState<string>("ALL");
  const [currencyFilter, setCurrencyFilter] = useState<string>("ALL");
  const [riskFilter, setRiskFilter] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("code");

  const currencies = useMemo(() => [...new Set(rows.map((r) => r.currency))].sort(), [rows]);
  const categories = useMemo(
    () => [...new Set(rows.map((r) => r.catalogCategory).filter((c): c is string => Boolean(c)))].sort(
      (a, b) => a.localeCompare(b, "tr-TR"),
    ),
    [rows],
  );
  const companies = useMemo(
    () =>
      [...new Set(rows.map((r) => r.managementCompany).filter((c): c is string => Boolean(c)))].sort(
        (a, b) => a.localeCompare(b, "tr-TR"),
      ),
    [rows],
  );
  const fundTypes = useMemo(
    () => [...new Set(rows.map((r) => r.fundType).filter((t): t is string => Boolean(t)))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr-TR");
    let result = rows.filter((r) => {
      const matchesTerm =
        term === "" ||
        r.code.toLocaleLowerCase("tr-TR").includes(term) ||
        r.name.toLocaleLowerCase("tr-TR").includes(term) ||
        (r.managementCompany?.toLocaleLowerCase("tr-TR").includes(term) ?? false);
      const matchesAssetClass =
        assetClassFilter === "ALL" ||
        (assetClassFilter === "NONE" ? r.assetClass === null : r.assetClass === assetClassFilter);
      const matchesCategory = categoryFilter === "ALL" || r.catalogCategory === categoryFilter;
      const matchesCompany = companyFilter === "ALL" || r.managementCompany === companyFilter;
      const matchesFundType = fundTypeFilter === "ALL" || r.fundType === fundTypeFilter;
      const matchesCurrency = currencyFilter === "ALL" || r.currency === currencyFilter;
      const matchesRisk = riskFilter === "ALL" || String(r.riskValue ?? "") === riskFilter;
      return (
        matchesTerm &&
        matchesAssetClass &&
        matchesCategory &&
        matchesCompany &&
        matchesFundType &&
        matchesCurrency &&
        matchesRisk
      );
    });

    result = [...result].sort((a, b) => {
      if (sortKey === "code") return a.code.localeCompare(b.code, "tr-TR");
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return bv - av;
    });

    return result;
  }, [rows, search, assetClassFilter, categoryFilter, companyFilter, fundTypeFilter, currencyFilter, riskFilter, sortKey]);

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Fonlar</h1>
        <p className="page-subtitle">Katılım fonu kataloğunu inceleyin, arayın ve filtreleyin.</p>
      </div>

      <Disclaimer />

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
            style={{ width: "auto", flex: "1 1 180px" }}
            value={assetClassFilter}
            onChange={(e) => setAssetClassFilter(e.target.value as AssetClassFilter)}
          >
            <option value="ALL">Tüm varlık sınıfları</option>
            {Object.entries(ASSET_CLASS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            <option value="NONE">Model dışı</option>
          </select>
          <select
            className="select"
            style={{ width: "auto", flex: "1 1 200px" }}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="ALL">Tüm kategoriler</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
        </div>
        <div className="row">
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
          <select
            className="select"
            style={{ width: "auto", flex: "1 1 140px" }}
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
          >
            <option value="ALL">Tüm para birimleri</option>
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className="select"
            style={{ width: "auto", flex: "1 1 120px" }}
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
          >
            <option value="ALL">Tüm risk değerleri</option>
            {[1, 2, 3, 4, 5, 6, 7].map((r) => (
              <option key={r} value={r}>
                Risk {r}
              </option>
            ))}
          </select>
          <select
            className="select"
            style={{ width: "auto", flex: "1 1 200px" }}
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p className="page-subtitle">Yükleniyor…</p>}
      {error && <Banner variant="danger">Fonlar yüklenemedi: {error}</Banner>}

      {!loading && !error && (
        <p className="disclaimer">{filtered.length} fon gösteriliyor.</p>
      )}

      {!loading && !error && filtered.length === 0 && (
        <Banner variant="info">Aramanızla eşleşen fon bulunamadı.</Banner>
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          <div className="table-scroll desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Tam Ad</th>
                  <th>Portföy Şirketi</th>
                  <th>Model Sınıfı</th>
                  <th>Kategori</th>
                  <th>Tür</th>
                  <th>Para Birimi</th>
                  <th>Risk</th>
                  <th>Son Fiyat</th>
                  <th>Fiyat Tarihi</th>
                  <th>Büyüklük</th>
                  <th>Yatırımcı</th>
                  <th>1 Ay</th>
                  <th>3 Ay</th>
                  <th>YBB</th>
                  <th>1 Yıl</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr key={f.id}>
                    <td>
                      {f.code} {f.verificationNeeded && <Badge variant="gold">doğrulama gerekli</Badge>}
                    </td>
                    <td>{f.name}</td>
                    <td>{f.managementCompany ?? "—"}</td>
                    <td>{assetClassLabel(f.assetClass)}</td>
                    <td>{f.catalogCategory ?? "—"}</td>
                    <td>{f.fundType ?? "—"}</td>
                    <td>{f.currency}</td>
                    <td className="tabular-nums">{f.riskValue ?? "—"}</td>
                    <td className="tabular-nums">{cell(f.price)}</td>
                    <td>{f.priceDate ? formatDateTR(f.priceDate) : "—"}</td>
                    <td className="tabular-nums">{cell(f.fundSize)}</td>
                    <td className="tabular-nums">{cell(f.investorCount)}</td>
                    <td className="tabular-nums">{returnCell(f.return1m)}</td>
                    <td className="tabular-nums">{returnCell(f.return3m)}</td>
                    <td className="tabular-nums">{returnCell(f.returnYtd)}</td>
                    <td className="tabular-nums">{returnCell(f.return1y)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mobile-only stack-sm">
            {filtered.map((f) => (
              <FundCard key={f.id} fund={f} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FundCard({ fund }: { fund: FundExplorerRow }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="record-card">
      <button
        className="row-between"
        style={{ background: "none", border: "none", width: "100%", cursor: "pointer", padding: 0 }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div style={{ textAlign: "left" }}>
          <strong>{fund.code}</strong>
          <p className="disclaimer">{fund.name}</p>
        </div>
        <Badge>{assetClassLabel(fund.assetClass)}</Badge>
      </button>

      {expanded && (
        <div className="stack-sm" style={{ marginTop: 10 }}>
          <div className="kv-row">
            <span className="k">Portföy Şirketi</span>
            <span>{fund.managementCompany ?? "—"}</span>
          </div>
          <div className="kv-row">
            <span className="k">Kategori</span>
            <span>{fund.catalogCategory ?? "—"}</span>
          </div>
          <div className="kv-row">
            <span className="k">Tür</span>
            <span>{fund.fundType ?? "—"}</span>
          </div>
          <div className="kv-row">
            <span className="k">Para Birimi</span>
            <span>{fund.currency}</span>
          </div>
          <div className="kv-row">
            <span className="k">Risk Değeri</span>
            <span className="tabular-nums">{fund.riskValue ?? "—"}</span>
          </div>
          <div className="kv-row">
            <span className="k">Son Fiyat</span>
            <span className="tabular-nums">
              {cell(fund.price)} {fund.priceDate ? `(${formatDateTR(fund.priceDate)})` : ""}
            </span>
          </div>
          <div className="kv-row">
            <span className="k">Fon Büyüklüğü</span>
            <span className="tabular-nums">{cell(fund.fundSize)}</span>
          </div>
          <div className="kv-row">
            <span className="k">Yatırımcı Sayısı</span>
            <span className="tabular-nums">{cell(fund.investorCount)}</span>
          </div>
          <div className="kv-row">
            <span className="k">1 Ay / 3 Ay Getiri</span>
            <span className="tabular-nums">
              {returnCell(fund.return1m)} / {returnCell(fund.return3m)}
            </span>
          </div>
          <div className="kv-row">
            <span className="k">YBB / 1 Yıl Getiri</span>
            <span className="tabular-nums">
              {returnCell(fund.returnYtd)} / {returnCell(fund.return1y)}
            </span>
          </div>
          {fund.verificationNeeded && <Badge variant="gold">Doğrulama gerekli</Badge>}
        </div>
      )}
    </div>
  );
}
