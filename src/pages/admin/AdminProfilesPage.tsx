import { useEffect, useState } from "react";
import {
  listAllRiskProfiles,
  swapRiskProfileOrder,
  upsertRiskProfile,
} from "../../services/modelRepository";
import type { RiskProfileRow } from "../../services/types";
import { Banner } from "../../components/ui/Banner";

export function AdminProfilesPage() {
  const [profiles, setProfiles] = useState<RiskProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      setProfiles(await listAllRiskProfiles());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= profiles.length) return;
    try {
      await swapRiskProfileOrder(profiles[index], profiles[target]);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sıralama güncellenemedi");
    }
  }

  async function handleAddNew() {
    const nextOrder = profiles.length > 0 ? Math.max(...profiles.map((p) => p.sort_order)) + 1 : 1;
    try {
      await upsertRiskProfile({
        key: `profil_${Date.now()}`,
        name: "Yeni Profil",
        description: "",
        sort_order: nextOrder,
        is_active: false,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profil eklenemedi");
    }
  }

  return (
    <div className="stack">
      <div className="row-between">
        <div>
          <h1 className="page-title">Risk Profilleri</h1>
          <p className="page-subtitle">
            Profil adını, açıklamasını, sıralamasını ve aktiflik durumunu yönetin. Yüzde
            dağılımları için "Model Portföy" sayfasını kullanın.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleAddNew}>
          + Yeni Profil
        </button>
      </div>

      {error && <Banner variant="danger">{error}</Banner>}
      {loading && <p className="page-subtitle">Yükleniyor…</p>}

      {!loading && (
        <div className="stack-sm">
          {profiles.map((profile, index) => (
            <ProfileRow
              key={profile.id}
              profile={profile}
              isFirst={index === 0}
              isLast={index === profiles.length - 1}
              onMove={(dir) => handleMove(index, dir)}
              onSaved={reload}
              onError={setError}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileRow({
  profile,
  isFirst,
  isLast,
  onMove,
  onSaved,
  onError,
}: {
  profile: RiskProfileRow;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [description, setDescription] = useState(profile.description);
  const [isActive, setIsActive] = useState(profile.is_active);
  const [saving, setSaving] = useState(false);
  const dirty = name !== profile.name || description !== profile.description || isActive !== profile.is_active;

  async function handleSave() {
    setSaving(true);
    try {
      await upsertRiskProfile({
        id: profile.id,
        key: profile.key,
        name,
        description,
        sort_order: profile.sort_order,
        is_active: isActive,
      });
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="row-between">
        <span className="disclaimer">Sıra: {profile.sort_order}</span>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-secondary btn-sm" disabled={isFirst} onClick={() => onMove(-1)}>
            ↑
          </button>
          <button className="btn btn-secondary btn-sm" disabled={isLast} onClick={() => onMove(1)}>
            ↓
          </button>
        </div>
      </div>

      <div className="stack-sm" style={{ marginTop: 10 }}>
        <div className="field">
          <label className="field-label">Ad</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Açıklama</label>
          <textarea
            className="input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Aktif (kullanıcı uygulamasında görünür)
        </label>
        <button className="btn btn-primary btn-sm" disabled={!dirty || saving} onClick={handleSave}>
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>
    </div>
  );
}
