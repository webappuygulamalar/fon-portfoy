import { useEffect, useMemo, useState } from "react";
import { ASSET_CLASSES, ASSET_CLASS_LABELS, SHARE_BASED_ASSET_CLASSES, type AssetClass } from "../../lib/constants";
import { validateAllocations } from "../../domain/calculation/validateAllocations";
import { isFundEligibleForListing } from "../../domain/calculation/fundListingEligibility";
import type { FundAssetClass } from "../../domain/calculation/types";
import { getLatestPrices, listActiveFunds } from "../../services/fundsRepository";
import {
  createDraftFromVersion,
  getAllocationsForVersion,
  getPreferredFundsForVersion,
  listAllRiskProfiles,
  listModelVersions,
  publishModelVersion,
  setPreferredFund,
  upsertAllocation,
} from "../../services/modelRepository";
import type { FundPriceRow, FundRow, ModelVersionRow, RiskProfileRow } from "../../services/types";
import { Banner } from "../../components/ui/Banner";
import { Badge } from "../../components/ui/Badge";
import { formatDateTR } from "../../lib/format";

type AllocationForm = Record<string, Partial<Record<AssetClass, number>>>; // profileId -> class -> pct
type PreferredForm = Partial<Record<FundAssetClass, string>>; // assetClass -> fundId (varsayılan, tüm profiller)

export function AdminModelEditorPage() {
  const [versions, setVersions] = useState<ModelVersionRow[]>([]);
  const [profiles, setProfiles] = useState<RiskProfileRow[]>([]);
  const [funds, setFunds] = useState<FundRow[]>([]);
  const [latestPrices, setLatestPrices] = useState<FundPriceRow[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [allocationForm, setAllocationForm] = useState<AllocationForm>({});
  const [preferredForm, setPreferredForm] = useState<PreferredForm>({});
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
        const [v, p, f, prices] = await Promise.all([
          listModelVersions(),
          listAllRiskProfiles(),
          listActiveFunds(),
          getLatestPrices(),
        ]);
        setVersions(v);
        setProfiles(p);
        setFunds(f);
        setLatestPrices(prices);
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
        const [allocations, preferredFunds] = await Promise.all([
          getAllocationsForVersion(selectedDraftId),
          getPreferredFundsForVersion(selectedDraftId),
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Taslak yüklenemedi");
      }
    }
    loadDraft();
  }, [selectedDraftId]);

  // Kullanıcıya gösterilen fon listeleriyle (bkz. useFundsExplorer /
  // isFundEligibleForListing) AYNI kuralı uygular — model bu kurala uymayan
  // bir fonu tercih ediyorsa hesaplama motoru yine de doğru çalışır (bu
  // sayfa yalnızca admin'i bilgilendirmek için kullanır, veri silmez).
  const ineligiblePreferredFunds = useMemo(() => {
    const latestPriceByFundId = new Map(latestPrices.map((p) => [p.fund_id, p]));
    const result: Partial<Record<FundAssetClass, FundRow>> = {};
    for (const ac of SHARE_BASED_ASSET_CLASSES as FundAssetClass[]) {
      const fundId = preferredForm[ac];
      if (!fundId) continue;
      const fund = funds.find((f) => f.id === fundId);
      if (!fund) continue;
      const eligible = isFundEligibleForListing({
        riskValue: fund.risk_value,
        investorCount: latestPriceByFundId.get(fundId)?.investor_count ?? null,
        fundType: fund.fund_type,
      });
      if (!eligible) result[ac] = fund;
    }
    return result;
  }, [funds, latestPrices, preferredForm]);

  const validation = useMemo(() => {
    const perProfile = profiles.map((profile) => {
      const allocations = ASSET_CLASSES.map((ac) => ({
        assetClass: ac,
        percentage: allocationForm[profile.id]?.[ac] ?? 0,
      }));
      const allocCheck = validateAllocations(allocations);
      return { profile, allocCheck };
    });
    const missingPreferredFunds = (SHARE_BASED_ASSET_CLASSES as FundAssetClass[]).filter(
      (ac) => !preferredForm[ac],
    );
    const allValid =
      perProfile.every((p) => p.allocCheck.valid) && missingPreferredFunds.length === 0;
    return { perProfile, missingPreferredFunds, allValid };
  }, [profiles, allocationForm, preferredForm]);

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
            {Object.entries(ineligiblePreferredFunds).length > 0 && (
              <Banner variant="warning">
                Şu standart fonlar risk değeri eksik veya yatırımcı sayısı 50'nin altında olduğu için
                artık kullanıcı fon listelerinde görünmüyor (hesaplama etkilenmez, yalnızca fon
                değiştirme seçim listesinde seçilemezler):{" "}
                {Object.entries(ineligiblePreferredFunds)
                  .map(([ac, fund]) => `${ASSET_CLASS_LABELS[ac as FundAssetClass]}: ${fund.code}`)
                  .join(", ")}
              </Banner>
            )}
            <div className="stack-sm" style={{ marginTop: 12 }}>
              {(SHARE_BASED_ASSET_CLASSES as FundAssetClass[]).map((ac) => {
                const options = funds.filter((f) => f.asset_class === ac && f.is_substitution_eligible);
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
