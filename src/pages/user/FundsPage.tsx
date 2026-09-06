import { useMemo, useState } from "react";
import { useFundsExplorer, type FundExplorerRow } from "../../hooks/useFundsExplorer";
import {
  DEFAULT_FUND_SORT_KEY,
  FUND_SORT_LABELS,
  sortCatalogCategoriesForFilter,
  sortFundRows,
  type FundSortKey,
} from "../../lib/fundCatalog";
import {
  formatCurrencyCode,
  formatDateTR,
  formatFundSizeShort,
  formatNumber,
  formatSignedPercent,
} from "../../lib/format";
import { Banner } from "../../components/ui/Banner";
import { Badge } from "../../components/ui/Badge";
import { Disclaimer } from "../../components/ui/Disclaimer";

function cell(value: number | null, suffix = ""): string {
  return value === null ? "—" : `${formatNumber(value)}${suffix}`;
}

function returnCell(value: number | null): string {
  return value === null ? "—" : formatSignedPercent(Math.round(value * 100) / 100);
}

export function FundsPage() {
  const { loading, error, rows } = useFundsExplorer();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [companyFilter, setCompanyFilter] = useState<string>("ALL");
  const [fundTypeFilter, setFundTypeFilter] = useState<string>("ALL");
  const [currencyFilter, setCurrencyFilter] = useState<string>("ALL");
  const [riskFilter, setRiskFilter] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<FundSortKey>(DEFAULT_FUND_SORT_KEY);

  const currencies = useMemo(() => [...new Set(rows.map((r) => r.currency))].sort(), [rows]);
  const categories = useMemo(
    () => sortCatalogCategoriesForFilter(rows.map((r) => r.catalogCategory).filter((c): c is string => Boolean(c))),
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
    const result = rows.filter((r) => {
      const matchesTerm =
        term === "" ||
        r.code.toLocaleLowerCase("tr-TR").includes(term) ||
        r.name.toLocaleLowerCase("tr-TR").includes(term) ||
        (r.managementCompany?.toLocaleLowerCase("tr-TR").includes(term) ?? false);
      const matchesCategory = categoryFilter === "ALL" || r.catalogCategory === categoryFilter;
      const matchesCompany = companyFilter === "ALL" || r.managementCompany === companyFilter;
      const matchesFundType = fundTypeFilter === "ALL" || r.fundType === fundTypeFilter;
      const matchesCurrency = currencyFilter === "ALL" || r.currency === currencyFilter;
      const matchesRisk = riskFilter === "ALL" || String(r.riskValue ?? "") === riskFilter;
      return matchesTerm && matchesCategory && matchesCompany && matchesFundType && matchesCurrency && matchesRisk;
    });

    return sortFundRows(result, sortKey);
  }, [rows, search, categoryFilter, companyFilter, fundTypeFilter, currencyFilter, riskFilter, sortKey]);

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
                {formatCurrencyCode(c)}
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
            style={{ width: "auto", flex: "1 1 220px" }}
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as FundSortKey)}
          >
            {Object.entries(FUND_SORT_LABELS).map(([value, label]) => (
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
                  <th>Kategori</th>
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
                    <td>{f.catalogCategory ?? "—"}</td>
                    <td>{formatCurrencyCode(f.currency)}</td>
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

          <div className="mobile-only fund-compact" role="table" aria-label="Fonlar">
            <div className="fund-compact-head" role="row">
              <span role="columnheader">Fon</span>
              <span role="columnheader">1 Ay</span>
              <span role="columnheader">3 Ay</span>
              <span role="columnheader">Büyüklük</span>
            </div>
            <div className="fund-compact-body">
              {filtered.map((f) => (
                <FundCompactRow key={f.id} fund={f} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FundCompactRow({ fund }: { fund: FundExplorerRow }) {
  return (
    <div className="fund-compact-row" role="row">
      <div className="fund-compact-name" role="cell">
        <div className="fund-compact-code-row">
          <span className="fund-compact-code">{fund.code}</span>
          {fund.verificationNeeded && <Badge variant="gold">doğrulama gerekli</Badge>}
        </div>
        <div className="fund-compact-title">{fund.name}</div>
        <div className="fund-compact-category">{fund.catalogCategory ?? "Model dışı"}</div>
      </div>
      <div className="fund-compact-num" role="cell">
        {returnCell(fund.return1m)}
      </div>
      <div className="fund-compact-num" role="cell">
        {returnCell(fund.return3m)}
      </div>
      <div className="fund-compact-num fund-compact-size" role="cell">
        {formatFundSizeShort(fund.fundSize)}
      </div>
    </div>
  );
}
