import { useEffect, useMemo, useState } from "react";
import { listActiveFunds, insertManualPrice } from "../../services/fundsRepository";
import {
  getPriceBackfillCheckpoint,
  listPriceBackfillRuns,
  listRiskSyncRuns,
  listSyncRuns,
  triggerKapRiskFullRevalidation,
  triggerKapRiskSyncStep,
  triggerManualTefasSync,
  triggerPriceBackfillStep,
} from "../../services/syncRepository";
import type {
  FundRow,
  PriceBackfillCheckpointRow,
  PriceBackfillRunRow,
  RiskSyncRunRow,
  SyncRunRow,
} from "../../services/types";
import { formatCurrencyCode, formatDateTR } from "../../lib/format";
import { ASSET_CLASS_LABELS } from "../../lib/constants";
import { Banner } from "../../components/ui/Banner";
import { Badge } from "../../components/ui/Badge";

const STATUS_VARIANT: Record<SyncRunRow["status"], "mint" | "warning" | "danger" | "default"> = {
  success: "mint",
  partial: "warning",
  failed: "danger",
  running: "default",
};

export function AdminSyncPage() {
  const [runs, setRuns] = useState<SyncRunRow[]>([]);
  const [funds, setFunds] = useState<FundRow[]>([]);
  const [checkpoint, setCheckpoint] = useState<PriceBackfillCheckpointRow | null>(null);
  const [backfillRuns, setBackfillRuns] = useState<PriceBackfillRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [riskSyncRuns, setRiskSyncRuns] = useState<RiskSyncRunRow[]>([]);
  const [riskSyncing, setRiskSyncing] = useState(false);
  const [riskSyncResult, setRiskSyncResult] = useState<string | null>(null);

  async function reload() {
    const [r, f, cp, br, rsr] = await Promise.all([
      listSyncRuns(30),
      listActiveFunds(),
      getPriceBackfillCheckpoint(),
      listPriceBackfillRuns(10),
      listRiskSyncRuns(10),
    ]);
    setRuns(r);
    setFunds(f);
    setCheckpoint(cp);
    setBackfillRuns(br);
    setRiskSyncRuns(rsr);
  }

  async function handleBackfillStep() {
    setBackfilling(true);
    setBackfillResult(null);
    setError(null);
    try {
      const result = await triggerPriceBackfillStep();
      setBackfillResult(
        result.isComplete
          ? "Geri yükleme tamamlandı."
          : `Pencere ${result.windowStart} → ${result.windowEnd}: ${result.rowsUpserted} satır, ${result.fundsTouched} fon (${result.status}).`,
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Geri yükleme adımı tetiklenemedi");
      await reload().catch(() => {});
    } finally {
      setBackfilling(false);
    }
  }

  useEffect(() => {
    reload()
      .catch((err) => setError(err instanceof Error ? err.message : "Yüklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  async function handleRiskSyncStep() {
    setRiskSyncing(true);
    setRiskSyncResult(null);
    setError(null);
    try {
      const result = await triggerKapRiskSyncStep();
      setRiskSyncResult(
        result.message ??
          `${result.fundsChecked} fon kontrol edildi · ${result.fundsRiskObtained} risk değeri elde edildi · ${result.fundsAmbiguous} belirsiz · ${result.fundsNotFound} bulunamadı · ${result.fundsError} hata (${result.status}).`,
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "KAP risk partisi tetiklenemedi");
      await reload().catch(() => {});
    } finally {
      setRiskSyncing(false);
    }
  }

  async function handleRiskFullRevalidation() {
    if (!window.confirm("Tüm katılım fonlarının KAP kontrol durumu sıfırlanacak; bir sonraki partiler hepsini yeniden işleyecek. Devam edilsin mi?")) {
      return;
    }
    setRiskSyncing(true);
    setRiskSyncResult(null);
    setError(null);
    try {
      const result = await triggerKapRiskFullRevalidation();
      setRiskSyncResult(result.message ?? "Yeniden doğrulama sıfırlandı.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yeniden doğrulama sıfırlanamadı");
    } finally {
      setRiskSyncing(false);
    }
  }

  async function handleManualSync() {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const result = await triggerManualTefasSync();
      setSyncResult(
        `Durum: ${result.status} · Kontrol edilen: ${result.fundsChecked} · Güncellenen: ${result.fundsUpdated} · Başarısız: ${result.fundsFailed}` +
          (result.failedFundCodes.length > 0 ? ` (${result.failedFundCodes.join(", ")})` : ""),
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Senkronizasyon tetiklenemedi");
      // İstek tarayıcıda başarısız görünse bile sunucu tarafında bir
      // sync_runs kaydı zaten oluşmuş olabilir (ör. yanıt dönerken bağlantı
      // kesildi). Çalışma geçmişini yine de tazeleyerek yanlış/eksik bir
      // izlenim bırakmayı önlüyoruz.
      await reload().catch(() => {});
    } finally {
      setSyncing(false);
    }
  }

  const lastRun = runs[0];

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">TEFAS Senkronizasyonu</h1>
        <p className="page-subtitle">
          Fiyatlar her sabah 07:30 (TR) otomatik güncellenir. Gerekirse manuel tetikleyebilir veya
          fiyatı elle girebilirsiniz.
        </p>
      </div>

      {error && <Banner variant="danger">{error}</Banner>}
      {syncResult && <Banner variant="info">{syncResult}</Banner>}

      <div className="card row-between">
        <div>
          {lastRun ? (
            <>
              <p>
                Son çalışma: <Badge variant={STATUS_VARIANT[lastRun.status]}>{lastRun.status}</Badge>{" "}
                <span className="disclaimer">{new Date(lastRun.started_at).toLocaleString("tr-TR")}</span>
              </p>
              <p className="disclaimer">
                Başarılı: {lastRun.funds_updated} · Başarısız: {lastRun.funds_failed}
                {lastRun.failed_fund_codes.length > 0 && ` (${lastRun.failed_fund_codes.join(", ")})`}
              </p>
            </>
          ) : (
            <p className="page-subtitle">Henüz senkronizasyon çalıştırılmadı.</p>
          )}
        </div>
        <button className="btn btn-primary" onClick={handleManualSync} disabled={syncing}>
          {syncing ? "Çalışıyor…" : "TEFAS fiyatlarını güncelle"}
        </button>
      </div>

      <DataCoverageCard funds={funds} />

      <PriceBackfillCard
        checkpoint={checkpoint}
        runs={backfillRuns}
        backfilling={backfilling}
        result={backfillResult}
        onRun={handleBackfillStep}
      />

      <KapRiskSyncCard
        funds={funds}
        runs={riskSyncRuns}
        syncing={riskSyncing}
        result={riskSyncResult}
        onRunBatch={handleRiskSyncStep}
        onRevalidateAll={handleRiskFullRevalidation}
      />

      <div className="card">
        <p className="section-title">Çalışma Geçmişi</p>
        {loading ? (
          <p className="page-subtitle">Yükleniyor…</p>
        ) : (
          <div className="table-scroll" style={{ marginTop: 12 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Başlangıç</th>
                  <th>Tetikleyici</th>
                  <th>Durum</th>
                  <th>Kontrol</th>
                  <th>Güncellenen</th>
                  <th>Başarısız</th>
                  <th>Hata</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>{new Date(run.started_at).toLocaleString("tr-TR")}</td>
                    <td>{run.trigger_type === "cron" ? "Otomatik" : "Manuel"}</td>
                    <td>
                      <Badge variant={STATUS_VARIANT[run.status]}>{run.status}</Badge>
                    </td>
                    <td className="tabular-nums">{run.funds_checked}</td>
                    <td className="tabular-nums">{run.funds_updated}</td>
                    <td className="tabular-nums">
                      {run.funds_failed}
                      {run.failed_fund_codes.length > 0 && ` (${run.failed_fund_codes.join(", ")})`}
                    </td>
                    <td style={{ maxWidth: 280, whiteSpace: "pre-wrap" }}>{run.error_summary ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ManualPriceForm funds={funds} onSaved={reload} />
    </div>
  );
}

function DataCoverageCard({ funds }: { funds: FundRow[] }) {
  const [showMissingRisk, setShowMissingRisk] = useState(false);
  const stats = useMemo(() => {
    const total = funds.length;
    const withRisk = funds.filter((f) => f.risk_value !== null);
    const missingRisk = funds.filter((f) => f.risk_value === null);
    const byCurrency = new Map<string, number>();
    for (const f of funds) {
      byCurrency.set(f.currency, (byCurrency.get(f.currency) ?? 0) + 1);
    }
    const bySource = new Map<string, number>();
    for (const f of withRisk) {
      const key = f.risk_source ?? "bilinmeyen";
      bySource.set(key, (bySource.get(key) ?? 0) + 1);
    }
    const needsVerification = funds.filter((f) => f.verification_needed).length;
    const eligibleByClass = new Map<string, number>();
    for (const f of funds) {
      if (f.is_substitution_eligible && f.asset_class) {
        eligibleByClass.set(f.asset_class, (eligibleByClass.get(f.asset_class) ?? 0) + 1);
      }
    }
    const lastRiskUpdate = withRisk
      .map((f) => f.risk_updated_at)
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1);
    return { total, withRisk, missingRisk, byCurrency, bySource, needsVerification, eligibleByClass, lastRiskUpdate };
  }, [funds]);

  return (
    <div className="card">
      <p className="section-title">Veri Kapsamı</p>
      <div className="stack-sm" style={{ marginTop: 10 }}>
        <div className="kv-row">
          <span className="k">Toplam aktif katılım fonu</span>
          <span className="tabular-nums">{stats.total}</span>
        </div>
        <div className="kv-row">
          <span className="k">Risk değeri bilinen fon</span>
          <span className="tabular-nums">
            {stats.withRisk.length} / {stats.total}
          </span>
        </div>
        {[...stats.bySource.entries()].map(([source, count]) => (
          <div className="kv-row" key={source}>
            <span className="k">— kaynak: {source}</span>
            <span className="tabular-nums">{count}</span>
          </div>
        ))}
        <div className="kv-row">
          <span className="k">Risk değeri eksik fon</span>
          <span className="tabular-nums">{stats.missingRisk.length}</span>
        </div>
        <div className="kv-row">
          <span className="k">Son risk metadata güncellemesi</span>
          <span className="tabular-nums">{stats.lastRiskUpdate ? formatDateTR(stats.lastRiskUpdate) : "—"}</span>
        </div>
        {stats.missingRisk.length > 0 && (
          <div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowMissingRisk((v) => !v)}
              type="button"
            >
              {showMissingRisk ? "Eksik risk kodlarını gizle" : "Eksik risk kodlarını göster"}
            </button>
            {showMissingRisk && (
              <p className="disclaimer" style={{ marginTop: 8, wordBreak: "break-word" }}>
                {stats.missingRisk.map((f) => f.code).join(", ")}
              </p>
            )}
          </div>
        )}
        <div className="kv-row">
          <span className="k">Doğrulama gereken fon</span>
          <span className="tabular-nums">{stats.needsVerification}</span>
        </div>
        {[...stats.byCurrency.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([currency, count]) => (
            <div className="kv-row" key={currency}>
              <span className="k">{formatCurrencyCode(currency)} fon sayısı</span>
              <span className="tabular-nums">{count}</span>
            </div>
          ))}
        <hr className="divider" />
        {[...stats.eligibleByClass.entries()].map(([assetClass, count]) => (
          <div className="kv-row" key={assetClass}>
            <span className="k">{ASSET_CLASS_LABELS[assetClass as keyof typeof ASSET_CLASS_LABELS]} — seçilebilir</span>
            <span className="tabular-nums">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const BACKFILL_STATUS_VARIANT: Record<PriceBackfillRunRow["status"], "mint" | "warning" | "danger" | "default"> = {
  success: "mint",
  partial: "warning",
  failed: "danger",
  running: "default",
};

function PriceBackfillCard({
  checkpoint,
  runs,
  backfilling,
  result,
  onRun,
}: {
  checkpoint: PriceBackfillCheckpointRow | null;
  runs: PriceBackfillRunRow[];
  backfilling: boolean;
  result: string | null;
  onRun: () => void;
}) {
  const progressPct = useMemo(() => {
    if (!checkpoint) return null;
    const today = new Date();
    const target = new Date(checkpoint.target_start_date);
    const oldest = new Date(checkpoint.oldest_fetched_date);
    const totalDays = (today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000);
    const doneDays = (today.getTime() - oldest.getTime()) / (24 * 60 * 60 * 1000);
    if (totalDays <= 0) return 100;
    return Math.max(0, Math.min(100, Math.round((doneDays / totalDays) * 100)));
  }, [checkpoint]);

  return (
    <div className="card stack">
      <div className="row-between">
        <p className="section-title">Tarihsel Fiyat Geri Yükleme (Getiri Hesabı İçin)</p>
        <button className="btn btn-secondary btn-sm" onClick={onRun} disabled={backfilling || checkpoint?.is_complete}>
          {backfilling ? "Çalışıyor…" : "Bir sonraki pencereyi çalıştır"}
        </button>
      </div>
      {result && <Banner variant="info">{result}</Banner>}
      {checkpoint ? (
        <div className="stack-sm">
          <div className="kv-row">
            <span className="k">Durum</span>
            <span>
              <Badge variant={checkpoint.is_complete ? "mint" : "warning"}>
                {checkpoint.is_complete ? "Tamamlandı" : "Devam ediyor"}
              </Badge>
            </span>
          </div>
          <div className="kv-row">
            <span className="k">Şu ana kadar kapsanan en eski tarih</span>
            <span className="tabular-nums">{formatDateTR(checkpoint.oldest_fetched_date)}</span>
          </div>
          <div className="kv-row">
            <span className="k">Hedef başlangıç</span>
            <span className="tabular-nums">{formatDateTR(checkpoint.target_start_date)}</span>
          </div>
          {progressPct !== null && (
            <div className="kv-row">
              <span className="k">İlerleme</span>
              <span className="tabular-nums">%{progressPct}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="page-subtitle">Yükleniyor…</p>
      )}
      {runs.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Başlangıç</th>
                <th>Pencere</th>
                <th>Durum</th>
                <th>Satır</th>
                <th>Fon</th>
                <th>Hata</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{new Date(run.started_at).toLocaleString("tr-TR")}</td>
                  <td>
                    {formatDateTR(run.window_start)} → {formatDateTR(run.window_end)}
                  </td>
                  <td>
                    <Badge variant={BACKFILL_STATUS_VARIANT[run.status]}>{run.status}</Badge>
                  </td>
                  <td className="tabular-nums">{run.rows_upserted}</td>
                  <td className="tabular-nums">{run.funds_touched}</td>
                  <td style={{ maxWidth: 240, whiteSpace: "pre-wrap" }}>{run.error_summary ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const RISK_SYNC_STATUS_VARIANT: Record<RiskSyncRunRow["status"], "mint" | "warning" | "danger" | "default"> = {
  success: "mint",
  partial: "warning",
  failed: "danger",
  running: "default",
};

function KapRiskSyncCard({
  funds,
  runs,
  syncing,
  result,
  onRunBatch,
  onRevalidateAll,
}: {
  funds: FundRow[];
  runs: RiskSyncRunRow[];
  syncing: boolean;
  result: string | null;
  onRunBatch: () => void;
  onRevalidateAll: () => void;
}) {
  const [showFailed, setShowFailed] = useState(false);

  const stats = useMemo(() => {
    const total = funds.length;
    const kapMatched = funds.filter((f) => f.kap_lookup_status === "matched").length;
    const kapRiskObtained = funds.filter((f) => (f.risk_source ?? "").startsWith("kap")).length;
    const referenceCatalogRemaining = funds.filter(
      (f) => f.risk_value !== null && !(f.risk_source ?? "").startsWith("kap"),
    ).length;
    const stillMissing = funds.filter((f) => f.risk_value === null).length;
    const ambiguous = funds.filter((f) => f.risk_verification_needed);
    const notChecked = funds.filter((f) => f.kap_checked_at === null).length;
    const lastChecked = funds
      .map((f) => f.kap_checked_at)
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1);
    return { total, kapMatched, kapRiskObtained, referenceCatalogRemaining, stillMissing, ambiguous, notChecked, lastChecked };
  }, [funds]);

  const lastRun = runs[0];

  return (
    <div className="card stack">
      <div className="row-between">
        <p className="section-title">KAP Risk Değeri Zenginleştirme</p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={onRevalidateAll} disabled={syncing}>
            286 fonun tümünü yeniden doğrula
          </button>
          <button className="btn btn-primary btn-sm" onClick={onRunBatch} disabled={syncing || stats.notChecked === 0}>
            {syncing ? "Çalışıyor…" : "Sıradaki KAP partisini işle"}
          </button>
        </div>
      </div>
      <p className="page-subtitle">
        KAP'ın (Kamuyu Aydınlatma Platformu) resmi, herkese açık fon sayfalarından risk değeri arar. Günlük TEFAS
        senkronizasyonundan AYRIDIR; her tıklama küçük bir parti işler, KAP'a düşük istek hızıyla erişir.
      </p>
      {result && <Banner variant="info">{result}</Banner>}
      <div className="stack-sm">
        <div className="kv-row">
          <span className="k">Toplam katılım fonu</span>
          <span className="tabular-nums">{stats.total}</span>
        </div>
        <div className="kv-row">
          <span className="k">KAP'ta doğrulanmış fon (kod + kurucu eşleşti)</span>
          <span className="tabular-nums">{stats.kapMatched}</span>
        </div>
        <div className="kv-row">
          <span className="k">KAP'tan risk değeri elde edilen</span>
          <span className="tabular-nums">{stats.kapRiskObtained}</span>
        </div>
        <div className="kv-row">
          <span className="k">Referans katalogdan risk değeri (KAP'tan değil)</span>
          <span className="tabular-nums">{stats.referenceCatalogRemaining}</span>
        </div>
        <div className="kv-row">
          <span className="k">Hâlâ risk değeri eksik</span>
          <span className="tabular-nums">{stats.stillMissing}</span>
        </div>
        <div className="kv-row">
          <span className="k">Belirsiz / çelişkili (admin incelemesi gerekir)</span>
          <span className="tabular-nums">{stats.ambiguous.length}</span>
        </div>
        <div className="kv-row">
          <span className="k">Henüz KAP'ta hiç kontrol edilmemiş</span>
          <span className="tabular-nums">{stats.notChecked}</span>
        </div>
        <div className="kv-row">
          <span className="k">Son KAP kontrolü</span>
          <span className="tabular-nums">{stats.lastChecked ? new Date(stats.lastChecked).toLocaleString("tr-TR") : "—"}</span>
        </div>
        {stats.ambiguous.length > 0 && (
          <div>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowFailed((v) => !v)} type="button">
              {showFailed ? "Belirsiz fonları gizle" : "Belirsiz fonları göster"}
            </button>
            {showFailed && (
              <div className="stack-sm" style={{ marginTop: 8 }}>
                {stats.ambiguous.map((f) => (
                  <p key={f.id} className="disclaimer" style={{ wordBreak: "break-word" }}>
                    <strong>{f.code}</strong> — {f.risk_verification_note ?? "neden belirtilmemiş"}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {lastRun && lastRun.failed_fund_codes.length > 0 && (
        <p className="disclaimer" style={{ wordBreak: "break-word" }}>
          Son çalışmada başarısız olan kodlar (bir sonraki partide otomatik tekrar denenir):{" "}
          {lastRun.failed_fund_codes.join(", ")}
        </p>
      )}
      {runs.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Başlangıç</th>
                <th>Durum</th>
                <th>Kontrol</th>
                <th>Eşleşen</th>
                <th>Risk elde edilen</th>
                <th>Belirsiz</th>
                <th>Bulunamadı</th>
                <th>Hata</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{new Date(run.started_at).toLocaleString("tr-TR")}</td>
                  <td>
                    <Badge variant={RISK_SYNC_STATUS_VARIANT[run.status]}>{run.status}</Badge>
                  </td>
                  <td className="tabular-nums">{run.funds_checked}</td>
                  <td className="tabular-nums">{run.funds_matched}</td>
                  <td className="tabular-nums">{run.funds_risk_obtained}</td>
                  <td className="tabular-nums">{run.funds_ambiguous}</td>
                  <td className="tabular-nums">{run.funds_not_found}</td>
                  <td className="tabular-nums">{run.funds_error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ManualPriceForm({ funds, onSaved }: { funds: FundRow[]; onSaved: () => void }) {
  const [fundId, setFundId] = useState("");
  const [priceDate, setPriceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedFund = funds.find((f) => f.id === fundId);

  async function handleSubmit() {
    if (!selectedFund || !price || !note.trim()) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await insertManualPrice({
        fund_id: selectedFund.id,
        price_date: priceDate,
        currency: selectedFund.currency,
        price: Number(price),
        note: note.trim(),
      });
      setMessage("Fiyat kaydedildi.");
      setPrice("");
      setNote("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card stack">
      <p className="section-title">Manuel Fiyat Girişi (TEFAS erişilemezse)</p>
      {error && <Banner variant="danger">{error}</Banner>}
      {message && <Banner variant="info">{message}</Banner>}

      <div className="field">
        <label className="field-label">Fon</label>
        <select className="select" value={fundId} onChange={(e) => setFundId(e.target.value)}>
          <option value="">— Seçiniz —</option>
          {funds.map((f) => (
            <option key={f.id} value={f.id}>
              {f.code} — {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="row">
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">Fiyat Tarihi</label>
          <input
            type="date"
            className="input"
            value={priceDate}
            onChange={(e) => setPriceDate(e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">Fiyat ({selectedFund?.currency ?? "TRY"})</label>
          <input
            type="number"
            step="0.000001"
            className="input"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label className="field-label">Kaynak / Not (zorunlu)</label>
        <input
          className="input"
          placeholder="Örn. TEFAS web sitesinden manuel, 05.09.2026 14:00"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <button
        className="btn btn-primary"
        disabled={saving || !fundId || !price || !note.trim()}
        onClick={handleSubmit}
      >
        Fiyatı Kaydet
      </button>
    </div>
  );
}
