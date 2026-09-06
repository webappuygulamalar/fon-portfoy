import { ASSET_CLASS_LABELS } from "../../lib/constants";
import type { PortfolioCalculationResult, FundLineResult } from "../../domain/calculation/types";
import { formatDateTR, formatNumber, formatPercent, formatTRY } from "../../lib/format";
import { Badge } from "../ui/Badge";
import { Banner } from "../ui/Banner";

interface CalculationSummaryProps {
  result: PortfolioCalculationResult;
}

const BLOCK_REASON_LABEL: Record<string, string> = {
  MISSING_PRICE: "fiyat verisi eksik",
  MISSING_FX_RATE: "döviz kuru eksik",
};

export function CalculationSummary({ result }: CalculationSummaryProps) {
  if (result.status === "BLOCKED") {
    return (
      <Banner variant="danger">
        <strong>Hesaplama yapılamıyor.</strong>
        <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
          {result.blockReasons.map((r, i) => (
            <li key={i}>
              {ASSET_CLASS_LABELS[r.assetClass]}: {BLOCK_REASON_LABEL[r.type] ?? r.type}
              {r.type === "MISSING_FX_RATE" ? ` (${r.currency})` : ""}
            </li>
          ))}
        </ul>
      </Banner>
    );
  }

  const allLines = [...result.fundLines, result.moneyMarketLine].filter(
    (l): l is FundLineResult => l !== null,
  );
  const depositPlannedPct =
    result.distribution.find((d) => d.assetClass === "DEPOSIT")?.plannedPercentage ?? 0;

  return (
    <div className="stack">
      {!result.isCashBalanceValid && (
        <Banner variant="warning">
          Cari hesap bakiyesi beklenen aralıkta değil; lütfen fiyatları kontrol edin.
        </Banner>
      )}

      <div className="table-scroll desktop-only">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fon</th>
              <th>Model %</th>
              <th>Hedef Tutar</th>
              <th>Birim Fiyat</th>
              <th>Pay Adedi</th>
              <th>Hesaplanan Tutar</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{ASSET_CLASS_LABELS.DEPOSIT}</td>
              <td className="tabular-nums">{formatPercent(depositPlannedPct)}</td>
              <td className="tabular-nums">{formatTRY(result.depositAmount)}</td>
              <td>—</td>
              <td>—</td>
              <td className="tabular-nums">{formatTRY(result.depositAmount)}</td>
            </tr>
            {allLines.map((line) => (
              <FundRowDesktop key={line.assetClass} line={line} />
            ))}
            <tr>
              <td>Cari Hesap</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td className="tabular-nums">{formatTRY(result.cashBalance)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mobile-only stack-sm">
        <div className="record-card">
          <div className="row-between">
            <strong>{ASSET_CLASS_LABELS.DEPOSIT}</strong>
            <span className="tabular-nums">{formatTRY(result.depositAmount)}</span>
          </div>
        </div>
        {allLines.map((line) => (
          <FundCardMobile key={line.assetClass} line={line} />
        ))}
        <div className="record-card">
          <div className="row-between">
            <strong>Cari Hesap</strong>
            <span className="tabular-nums">{formatTRY(result.cashBalance)}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <p className="section-title">Toplamlar</p>
        <div className="stack-sm" style={{ marginTop: 10 }}>
          <div className="kv-row">
            <span className="k">Mevduat</span>
            <span className="tabular-nums">{formatTRY(result.totals.depositAmount)}</span>
          </div>
          <div className="kv-row">
            <span className="k">Fonlara ayrılan toplam tutar</span>
            <span className="tabular-nums">{formatTRY(result.totals.investedInFunds)}</span>
          </div>
          <div className="kv-row">
            <span className="k">Cari hesapta kalacak tutar</span>
            <span className="tabular-nums">{formatTRY(result.totals.cashBalance)}</span>
          </div>
          <hr className="divider" />
          <div className="kv-row">
            <span className="k">Toplam Portföy</span>
            <span className="tabular-nums">{formatTRY(result.totals.grandTotalCheck)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PriceCell({ line }: { line: FundLineResult }) {
  return (
    <div className="stack-sm">
      <span className="tabular-nums">{formatNumber(line.unitPriceTRY)} TL</span>
      <span className="disclaimer">{formatDateTR(line.priceDate)}</span>
      {line.isStalePrice && <Badge variant="warning">Eski fiyat</Badge>}
      {line.fxRateUsed && (
        <span className="disclaimer">
          1 {line.originalCurrency} = {formatNumber(line.fxRateUsed.rate)} TL ({line.fxRateUsed.source},{" "}
          {formatDateTR(line.fxRateUsed.rateDate)})
        </span>
      )}
    </div>
  );
}

function FundRowDesktop({ line }: { line: FundLineResult }) {
  return (
    <tr>
      <td>
        {line.fundName ?? ASSET_CLASS_LABELS[line.assetClass]}
        <div className="disclaimer">{line.fundCode}</div>
      </td>
      <td className="tabular-nums">{formatPercent(line.percentage)}</td>
      <td className="tabular-nums">{formatTRY(line.targetAmount)}</td>
      <td>
        <PriceCell line={line} />
      </td>
      <td className="tabular-nums">{formatNumber(line.shareCount)}</td>
      <td className="tabular-nums">{formatTRY(line.actualAmount)}</td>
    </tr>
  );
}

function FundCardMobile({ line }: { line: FundLineResult }) {
  return (
    <div className="record-card">
      <div className="row-between">
        <strong>{line.fundName ?? ASSET_CLASS_LABELS[line.assetClass]}</strong>
        <Badge>{formatPercent(line.percentage)}</Badge>
      </div>
      <p className="disclaimer" style={{ marginTop: 4 }}>
        {line.fundCode}
      </p>
      <div className="stack-sm" style={{ marginTop: 8 }}>
        <div className="kv-row">
          <span className="k">Hedef tutar</span>
          <span className="tabular-nums">{formatTRY(line.targetAmount)}</span>
        </div>
        <div className="kv-row">
          <span className="k">Birim fiyat</span>
          <span className="tabular-nums">
            {formatNumber(line.unitPriceTRY)} TL · {formatDateTR(line.priceDate)}
          </span>
        </div>
        <div className="kv-row">
          <span className="k">Pay adedi</span>
          <span className="tabular-nums">{formatNumber(line.shareCount)}</span>
        </div>
        <div className="kv-row">
          <span className="k">Hesaplanan tutar</span>
          <span className="tabular-nums">{formatTRY(line.actualAmount)}</span>
        </div>
        {line.isStalePrice && <Badge variant="warning">Eski fiyat</Badge>}
        {line.fxRateUsed && (
          <span className="disclaimer">
            1 {line.originalCurrency} = {formatNumber(line.fxRateUsed.rate)} TL ({line.fxRateUsed.source},{" "}
            {formatDateTR(line.fxRateUsed.rateDate)})
          </span>
        )}
      </div>
    </div>
  );
}
