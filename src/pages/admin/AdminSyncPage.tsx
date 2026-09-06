import { useEffect, useState } from "react";
import { listActiveFunds, insertManualPrice } from "../../services/fundsRepository";
import { listSyncRuns, triggerManualTefasSync } from "../../services/syncRepository";
import type { FundRow, SyncRunRow } from "../../services/types";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  async function reload() {
    const [r, f] = await Promise.all([listSyncRuns(30), listActiveFunds()]);
    setRuns(r);
    setFunds(f);
  }

  useEffect(() => {
    reload()
      .catch((err) => setError(err instanceof Error ? err.message : "Yüklenemedi"))
      .finally(() => setLoading(false));
  }, []);

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
