import { useMemo, useState } from "react";
import { useFundsExplorer, type FundExplorerRow } from "../../hooks/useFundsExplorer";
import { ASSET_CLASS_LABELS, type AssetClass } from "../../lib/constants";
import { formatDateTR, formatNumber, formatPercent } from "../../lib/format";
import { Banner } from "../../components/ui/Banner";
import { Badge } from "../../components/ui/Badge";
import { Disclaimer } from "../../components/ui/Disclaimer";

type SortKey = "code" | "fundSize" | "return1y" | "returnYtd";

function cell(value: number | null, suffix = ""): string {
  return value === null ? "—" : `${formatNumber(value)}${suffix}`;
}

function returnCell(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${formatPercent(Math.round(value * 100) / 100)}`;
}

export function FundsPage() {
  const { loading, error, rows } = useFundsExplorer();
  const [search, setSearch] = useState("");
  const [assetClassFilter, setAssetClassFilter] = useState<AssetClass | "ALL">("ALL");
  const [currencyFilter, setCurrencyFilter] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("code");

  const currencies = useMemo(() => [...new Set(rows.map((r) => r.currency))].sort(), [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr-TR");
    let result = rows.filter((r) => {
      const matchesTerm =
        term === "" ||
        r.code.toLocaleLowerCase("tr-TR").includes(term) ||
        r.name.toLocaleLowerCase("tr-TR").includes(term) ||
        r.managementCompany.toLocaleLowerCase("tr-TR").includes(term);
      const matchesAssetClass = assetClassFilter === "ALL" || r.assetClass === assetClassFilter;
      const matchesCurrency = currencyFilter === "ALL" || r.currency === currencyFilter;
      return matchesTerm && matchesAssetClass && matchesCurrency;
    });

    result = [...result].sort((a, b) => {
      if (sortKey === "code") return a.code.localeCompare(b.code, "tr-TR");
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return bv - av;
    });

    return result;
  }, [rows, search, assetClassFilter, currencyFilter, sortKey]);

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
            style={{ width: "auto", flex: "1 1 160px" }}
            value={assetClassFilter}
            onChange={(e) => setAssetClassFilter(e.target.value as AssetClass | "ALL")}
          >
            <option value="ALL">Tüm varlık sınıfları</option>
            {Object.entries(ASSET_CLASS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="select"
            style={{ width: "auto", flex: "1 1 120px" }}
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
            style={{ width: "auto", flex: "1 1 160px" }}
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="code">Koda göre (A-Z)</option>
            <option value="fundSize">Büyüklüğe göre (çoktan aza)</option>
            <option value="return1y">1 yıl getiriye göre</option>
            <option value="returnYtd">Yılbaşından beri getiriye göre</option>
          </select>
        </div>
      </div>

      {loading && <p className="page-subtitle">Yükleniyor…</p>}
      {error && <Banner variant="danger">Fonlar yüklenemedi: {error}</Banner>}

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
                  <th>Sınıf</th>
                  <th>Tür</th>
                  <th>Para Birimi</th>
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
                    <td>{f.managementCompany}</td>
                    <td>{ASSET_CLASS_LABELS[f.assetClass]}</td>
                    <td>{f.fundType ?? "—"}</td>
                    <td>{f.currency}</td>
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
        <Badge>{ASSET_CLASS_LABELS[fund.assetClass]}</Badge>
      </button>

      {expanded && (
        <div className="stack-sm" style={{ marginTop: 10 }}>
          <div className="kv-row">
            <span className="k">Portföy Şirketi</span>
            <span>{fund.managementCompany}</span>
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
