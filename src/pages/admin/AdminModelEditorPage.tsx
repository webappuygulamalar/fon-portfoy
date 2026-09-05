import { useEffect, useMemo, useState } from "react";
import { ASSET_CLASSES, ASSET_CLASS_LABELS, SHARE_BASED_ASSET_CLASSES, type AssetClass } from "../../lib/constants";
import { validateAllocations } from "../../domain/calculation/validateAllocations";
import { validateDepositBucketWeights } from "../../domain/calculation/depositBuckets";
import type { FundAssetClass } from "../../domain/calculation/types";
import { listActiveFunds } from "../../services/fundsRepository";
import {
  createDraftFromVersion,
  getAllocationsForVersion,
  getDepositBucketsForVersion,
  getPreferredFundsForVersion,
  listAllRiskProfiles,
  listModelVersions,
  publishModelVersion,
  replaceDepositBuckets,
  setPreferredFund,
  upsertAllocation,
} from "../../services/modelRepository";
import type { FundRow, ModelVersionRow, RiskProfileRow } from "../../services/types";
import { Banner } from "../../components/ui/Banner";
import { Badge } from "../../components/ui/Badge";
import { formatDateTR } from "../../lib/format";

type AllocationForm = Record<string, Partial<Record<AssetClass, number>>>; // profileId -> class -> pct
type PreferredForm = Partial<Record<FundAssetClass, string>>; // assetClass -> fundId (varsayılan, tüm profiller)
type BucketRow = { key: string; label: string; weightPercent: number; sortOrder: number };
type BucketsForm = Record<string, BucketRow[]>; // profileId -> buckets

export function AdminModelEditorPage() {
  const [versions, setVersions] = useState<ModelVersionRow[]>([]);
  const [profiles, setProfiles] = useState<RiskProfileRow[]>([]);
  const [funds, setFunds] = useState<FundRow[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [allocationForm, setAllocationForm] = useState<AllocationForm>({});
  const [preferredForm, setPreferredForm] = useState<PreferredForm>({});
  const [bucketsForm, setBucketsForm] = useState<BucketsForm>({});
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));

  const drafts = versions.filter((v) => v.status === "draft");
  const published = versions.filter((v) => v.status === "published");

  async function reloadVersions() {
    setVersions(await listModelVersions());
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [v, p, f] = await Promise.all([listModelVersions(), listAllRiskProfiles(), listActiveFunds()]);
        setVersions(v);
        setProfiles(p);
        setFunds(f);
        const firstDraft = v.find((x) => x.status === "draft");
        if (firstDraft) setSelectedDraftId(firstDraft.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Yüklenemedi");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!selectedDraftId) return;
    async function loadDraft() {
      setError(null);
      try {
        const [allocations, preferredFunds, buckets] = await Promise.all([
          getAllocationsForVersion(selectedDraftId),
          getPreferredFundsForVersion(selectedDraftId),
          getDepositBucketsForVersion(selectedDraftId),
        ]);

        const allocForm: AllocationForm = {};
        for (const a of allocations) {
          allocForm[a.profile_id] = { ...allocForm[a.profile_id], [a.asset_class]: a.percentage };
        }
        setAllocationForm(allocForm);

        const prefForm: PreferredForm = {};
        for (const p of preferredFunds) {
          if (p.profile_id === null) prefForm[p.asset_class as FundAssetClass] = p.fund_id;
        }
        setPreferredForm(prefForm);

        const bucketForm: BucketsForm = {};
        for (const b of buckets) {
          const list = bucketForm[b.profile_id] ?? [];
          list.push({
            key: b.id,
            label: b.label,
            weightPercent: Number(b.weight_percent),
            sortOrder: b.sort_order,
          });
          bucketForm[b.profile_id] = list;
        }
        for (const key of Object.keys(bucketForm)) {
          bucketForm[key].sort((a, b) => a.sortOrder - b.sortOrder);
        }
        setBucketsForm(bucketForm);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Taslak yüklenemedi");
      }
    }
    loadDraft();
  }, [selectedDraftId]);

  const validation = useMemo(() => {
    const perProfile = profiles.map((profile) => {
      const allocations = ASSET_CLASSES.map((ac) => ({
        assetClass: ac,
        percentage: allocationForm[profile.id]?.[ac] ?? 0,
      }));
      const allocCheck = validateAllocations(allocations);
      const bucketCheck = validateDepositBucketWeights(
        (bucketsForm[profile.id] ?? []).map((b) => ({
          id: b.key,
          label: b.label,
          weightPercent: b.weightPercent,
          sortOrder: b.sortOrder,
        })),
      );
      return { profile, allocCheck, bucketCheck };
    });
    const missingPreferredFunds = (SHARE_BASED_ASSET_CLASSES as FundAssetClass[]).filter(
      (ac) => !preferredForm[ac],
    );
    const allValid =
      perProfile.every((p) => p.allocCheck.valid && p.bucketCheck.valid) &&
      missingPreferredFunds.length === 0;
    return { perProfile, missingPreferredFunds, allValid };
  }, [profiles, allocationForm, bucketsForm, preferredForm]);

  async function handleCreateDraft() {
    const source = versions[0]; // en yüksek version_number (listModelVersions desc sıralı)
    setSaving(true);
    setError(null);
    try {
      const draft = source
        ? await createDraftFromVersion(source.id)
        : await createDraftFromVersion("");
      await reloadVersions();
      setSelectedDraftId(draft.id);
      setNotice("Yeni taslak oluşturuldu.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Taslak oluşturulamadı");
    } finally {
      setSaving(false);
    }
  }

  async function persistDraft(): Promise<boolean> {
    if (!selectedDraftId) return false;
    setSaving(true);
    setError(null);
    try {
      for (const profile of profiles) {
        for (const ac of ASSET_CLASSES) {
          const pct = allocationForm[profile.id]?.[ac];
          if (pct === undefined) continue;
          await upsertAllocation({
            model_version_id: selectedDraftId,
            profile_id: profile.id,
            asset_class: ac,
            percentage: pct,
          });
        }
      }

      for (const ac of SHARE_BASED_ASSET_CLASSES as FundAssetClass[]) {
        const fundId = preferredForm[ac];
        if (!fundId) continue;
        await setPreferredFund({
          model_version_id: selectedDraftId,
          profile_id: null,
          asset_class: ac,
          fund_id: fundId,
        });
      }

      for (const profile of profiles) {
        const buckets = bucketsForm[profile.id] ?? [];
        await replaceDepositBuckets(
          selectedDraftId,
          profile.id,
          buckets.map((b, i) => ({ label: b.label, weight_percent: b.weightPercent, sort_order: i })),
        );
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kaydedilemedi");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDraft() {
    setNotice(null);
    const ok = await persistDraft();
    if (ok) setNotice("Taslak kaydedildi.");
  }

  async function handlePublish() {
    if (!validation.allValid || !selectedDraftId) return;
    setNotice(null);
    const ok = await persistDraft();
    if (!ok) return;
    setSaving(true);
    try {
      await publishModelVersion(selectedDraftId, effectiveDate);
      await reloadVersions();
      setNotice(`Versiyon yayınlandı (geçerlilik tarihi: ${formatDateTR(effectiveDate)}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yayınlanamadı");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="page-subtitle">Yükleniyor…</p>;

  const selectedDraft = versions.find((v) => v.id === selectedDraftId) ?? null;

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Model Portföy</h1>
        <p className="page-subtitle">
          Taslak oluşturun, dağılımı ve tercih edilen fonları düzenleyin, önizleyin ve geçerlilik
          tarihiyle yayınlayın. Yayınlanan versiyonlar asla düzenlenmez; her değişiklik yeni bir
          versiyon olarak eklenir.
        </p>
      </div>

      {error && <Banner variant="danger">{error}</Banner>}
      {notice && <Banner variant="info">{notice}</Banner>}

      <div className="card row-between">
        <div className="field" style={{ minWidth: 260 }}>
          <label className="field-label">Düzenlenen taslak</label>
          <select className="select" value={selectedDraftId} onChange={(e) => setSelectedDraftId(e.target.value)}>
            {drafts.length === 0 && <option value="">Taslak yok</option>}
            {drafts.map((d) => (
              <option key={d.id} value={d.id}>
                Taslak v{d.version_number} ({new Date(d.created_at).toLocaleDateString("tr-TR")})
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-secondary" onClick={handleCreateDraft} disabled={saving}>
          + Son versiyondan yeni taslak
        </button>
      </div>

      {selectedDraft && (
        <>
          <div className="card">
            <p className="section-title">Model Dağılımı (Taslak v{selectedDraft.version_number})</p>
            <div className="table-scroll" style={{ marginTop: 12 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Profil</th>
                    {ASSET_CLASSES.map((ac) => (
                      <th key={ac}>{ASSET_CLASS_LABELS[ac]}</th>
                    ))}
                    <th>Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {validation.perProfile.map(({ profile, allocCheck }) => (
                    <tr key={profile.id}>
                      <td>{profile.name}</td>
                      {ASSET_CLASSES.map((ac) => (
                        <td key={ac}>
                          <input
                            type="number"
                            className="input"
                            style={{ width: 84 }}
                            min={0}
                            max={100}
                            step={1}
                            value={allocationForm[profile.id]?.[ac] ?? 0}
                            onChange={(e) => {
                              const value = Math.round(Number(e.target.value));
                              setAllocationForm((prev) => ({
                                ...prev,
                                [profile.id]: { ...prev[profile.id], [ac]: value },
                              }));
                            }}
                          />
                        </td>
                      ))}
                      <td>
                        <Badge variant={allocCheck.valid ? "mint" : "danger"}>%{allocCheck.sum}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <p className="section-title">Standart (Tercih Edilen) Fonlar</p>
            <p className="disclaimer">Tüm profillerde kullanılan varsayılan fonlar.</p>
            <div className="stack-sm" style={{ marginTop: 12 }}>
              {(SHARE_BASED_ASSET_CLASSES as FundAssetClass[]).map((ac) => {
                const options = funds.filter((f) => f.asset_class === ac);
                return (
                  <div className="field" key={ac}>
                    <label className="field-label">{ASSET_CLASS_LABELS[ac]}</label>
                    <select
                      className="select"
                      value={preferredForm[ac] ?? ""}
                      onChange={(e) =>
                        setPreferredForm((prev) => ({ ...prev, [ac]: e.target.value || undefined }))
                      }
                    >
                      <option value="">— Seçiniz —</option>
                      {options.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.code} — {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <p className="section-title">Mevduat Vade Dilimleri</p>
            <p className="disclaimer">Yalnızca gösterim amaçlıdır; tanımlanırsa toplamı %100 olmalıdır.</p>
            <div className="stack" style={{ marginTop: 12 }}>
              {profiles.map((profile) => (
                <DepositBucketEditor
                  key={profile.id}
                  profile={profile}
                  buckets={bucketsForm[profile.id] ?? []}
                  onChange={(buckets) =>
                    setBucketsForm((prev) => ({ ...prev, [profile.id]: buckets }))
                  }
                />
              ))}
            </div>
          </div>

          <div className="card stack">
            <p className="section-title">Yayınla</p>
            {validation.missingPreferredFunds.length > 0 && (
              <Banner variant="warning">
                Eksik standart fon:{" "}
                {validation.missingPreferredFunds.map((ac) => ASSET_CLASS_LABELS[ac]).join(", ")}
              </Banner>
            )}
            <div className="field" style={{ maxWidth: 220 }}>
              <label className="field-label">Geçerlilik Tarihi</label>
              <input
                type="date"
                className="input"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
            <div className="row">
              <button className="btn btn-secondary" onClick={handleSaveDraft} disabled={saving}>
                Taslağı Kaydet
              </button>
              <button
                className="btn btn-primary"
                onClick={handlePublish}
                disabled={saving || !validation.allValid}
              >
                Yayınla
              </button>
            </div>
            {!validation.allValid && (
              <p className="disclaimer">
                Yayınlamak için tüm profillerin toplamı %100 olmalı ve tüm standart fonlar seçilmiş
                olmalıdır.
              </p>
            )}
          </div>
        </>
      )}

      <div className="card">
        <p className="section-title">Versiyon Geçmişi</p>
        <div className="table-scroll" style={{ marginTop: 12 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Versiyon</th>
                <th>Durum</th>
                <th>Geçerlilik Tarihi</th>
                <th>Yayın Tarihi</th>
              </tr>
            </thead>
            <tbody>
              {[...published, ...versions.filter((v) => v.status === "archived")].map((v) => (
                <tr key={v.id}>
                  <td>v{v.version_number}</td>
                  <td>
                    <Badge variant={v.status === "published" ? "mint" : "default"}>{v.status}</Badge>
                  </td>
                  <td>{v.effective_date ? formatDateTR(v.effective_date) : "—"}</td>
                  <td>{v.published_at ? formatDateTR(v.published_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DepositBucketEditor({
  profile,
  buckets,
  onChange,
}: {
  profile: RiskProfileRow;
  buckets: BucketRow[];
  onChange: (buckets: BucketRow[]) => void;
}) {
  const total = buckets.reduce((sum, b) => sum + b.weightPercent, 0);
  const valid = buckets.length === 0 || Math.abs(total - 100) < 0.01;

  function update(index: number, patch: Partial<BucketRow>) {
    onChange(buckets.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  function remove(index: number) {
    onChange(buckets.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([
      ...buckets,
      { key: `new-${Date.now()}-${buckets.length}`, label: "", weightPercent: 0, sortOrder: buckets.length },
    ]);
  }

  return (
    <div className="record-card">
      <div className="row-between">
        <strong>{profile.name}</strong>
        {buckets.length > 0 && (
          <Badge variant={valid ? "mint" : "danger"}>Toplam %{total.toFixed(2)}</Badge>
        )}
      </div>
      <div className="stack-sm" style={{ marginTop: 10 }}>
        {buckets.map((b, i) => (
          <div className="row" key={b.key}>
            <input
              className="input"
              style={{ flex: 2 }}
              placeholder="Örn. 101 gün"
              value={b.label}
              onChange={(e) => update(i, { label: e.target.value })}
            />
            <input
              type="number"
              className="input"
              style={{ flex: 1 }}
              placeholder="%"
              value={b.weightPercent}
              onChange={(e) => update(i, { weightPercent: Number(e.target.value) })}
            />
            <button className="btn btn-secondary btn-sm" onClick={() => remove(i)}>
              Sil
            </button>
          </div>
        ))}
        <button className="btn btn-secondary btn-sm" onClick={addRow}>
          + Vade dilimi ekle
        </button>
      </div>
    </div>
  );
}
