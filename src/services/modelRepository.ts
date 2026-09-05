import { supabase } from "./supabaseClient";
import type {
  ModelDepositBucketRow,
  ModelPreferredFundRow,
  ModelProfileAllocationRow,
  ModelVersionRow,
  RiskProfileRow,
} from "./types";

export async function getCurrentPublishedModelVersion(): Promise<ModelVersionRow | null> {
  const { data, error } = await supabase
    .from("current_model_version")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listActiveRiskProfiles(): Promise<RiskProfileRow[]> {
  const { data, error } = await supabase
    .from("risk_profiles")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return data;
}

export async function listAllRiskProfiles(): Promise<RiskProfileRow[]> {
  const { data, error } = await supabase
    .from("risk_profiles")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return data;
}

export interface UpsertRiskProfileInput {
  id?: string;
  key: string;
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

export async function upsertRiskProfile(input: UpsertRiskProfileInput): Promise<RiskProfileRow> {
  const { data, error } = await supabase.from("risk_profiles").upsert(input).select().single();
  if (error) throw error;
  return data;
}

export async function swapRiskProfileOrder(a: RiskProfileRow, b: RiskProfileRow): Promise<void> {
  const { error: e1 } = await supabase
    .from("risk_profiles")
    .update({ sort_order: b.sort_order })
    .eq("id", a.id);
  if (e1) throw e1;
  const { error: e2 } = await supabase
    .from("risk_profiles")
    .update({ sort_order: a.sort_order })
    .eq("id", b.id);
  if (e2) throw e2;
}

export async function getAllocationsForVersion(
  modelVersionId: string,
): Promise<ModelProfileAllocationRow[]> {
  const { data, error } = await supabase
    .from("model_profile_allocations")
    .select("*")
    .eq("model_version_id", modelVersionId);
  if (error) throw error;
  return data;
}

export async function getPreferredFundsForVersion(
  modelVersionId: string,
): Promise<ModelPreferredFundRow[]> {
  const { data, error } = await supabase
    .from("model_preferred_funds")
    .select("*")
    .eq("model_version_id", modelVersionId);
  if (error) throw error;
  return data;
}

export async function getDepositBucketsForVersion(
  modelVersionId: string,
): Promise<ModelDepositBucketRow[]> {
  const { data, error } = await supabase
    .from("model_deposit_buckets")
    .select("*")
    .eq("model_version_id", modelVersionId)
    .order("sort_order");
  if (error) throw error;
  return data;
}

export interface PublishedModelBundle {
  version: ModelVersionRow;
  profiles: RiskProfileRow[];
  allocations: ModelProfileAllocationRow[];
  preferredFunds: ModelPreferredFundRow[];
  depositBuckets: ModelDepositBucketRow[];
}

/** Kullanıcı ekranı için gereken her şeyi tek seferde toplar. */
export async function loadPublishedModelBundle(): Promise<PublishedModelBundle | null> {
  const version = await getCurrentPublishedModelVersion();
  if (!version) return null;

  const [profiles, allocations, preferredFunds, depositBuckets] = await Promise.all([
    listActiveRiskProfiles(),
    getAllocationsForVersion(version.id),
    getPreferredFundsForVersion(version.id),
    getDepositBucketsForVersion(version.id),
  ]);

  return { version, profiles, allocations, preferredFunds, depositBuckets };
}

// ---- Admin: taslak / yayınlama akışı ----

export async function listModelVersions(): Promise<ModelVersionRow[]> {
  const { data, error } = await supabase
    .from("model_versions")
    .select("*")
    .order("version_number", { ascending: false });
  if (error) throw error;
  return data;
}

/** En son versiyonun (yayınlanmış veya taslak) tam içeriğinden yeni bir taslak oluşturur. */
export async function createDraftFromVersion(sourceVersionId: string): Promise<ModelVersionRow> {
  const [allocations, preferredFunds, depositBuckets] = await Promise.all([
    getAllocationsForVersion(sourceVersionId),
    getPreferredFundsForVersion(sourceVersionId),
    getDepositBucketsForVersion(sourceVersionId),
  ]);

  const { data: draft, error: draftErr } = await supabase
    .from("model_versions")
    .insert({ status: "draft", notes: "Önceki versiyondan kopyalandı" })
    .select()
    .single();
  if (draftErr || !draft) throw draftErr;

  if (allocations.length > 0) {
    const { error } = await supabase.from("model_profile_allocations").insert(
      allocations.map((a) => ({
        model_version_id: draft.id,
        profile_id: a.profile_id,
        asset_class: a.asset_class,
        percentage: a.percentage,
      })),
    );
    if (error) throw error;
  }

  if (preferredFunds.length > 0) {
    const { error } = await supabase.from("model_preferred_funds").insert(
      preferredFunds.map((p) => ({
        model_version_id: draft.id,
        profile_id: p.profile_id,
        asset_class: p.asset_class,
        fund_id: p.fund_id,
      })),
    );
    if (error) throw error;
  }

  if (depositBuckets.length > 0) {
    const { error } = await supabase.from("model_deposit_buckets").insert(
      depositBuckets.map((b) => ({
        model_version_id: draft.id,
        profile_id: b.profile_id,
        label: b.label,
        weight_percent: b.weight_percent,
        sort_order: b.sort_order,
      })),
    );
    if (error) throw error;
  }

  return draft;
}

export async function upsertAllocation(input: {
  model_version_id: string;
  profile_id: string;
  asset_class: ModelProfileAllocationRow["asset_class"];
  percentage: number;
}): Promise<void> {
  const { error } = await supabase
    .from("model_profile_allocations")
    .upsert(input, { onConflict: "model_version_id,profile_id,asset_class" });
  if (error) throw error;
}

/**
 * Bir varlık sınıfı için tercih edilen fonu ayarlar. profile_id null ise
 * tüm profiller için varsayılan; doluysa yalnızca o profil için override.
 * Var olan satırı silip yeniden eklemek, "upsert" için ayrı unique index
 * (null/not-null) yönetmekten daha basittir.
 */
export async function setPreferredFund(input: {
  model_version_id: string;
  profile_id: string | null;
  asset_class: ModelPreferredFundRow["asset_class"];
  fund_id: string;
}): Promise<void> {
  let deleteQuery = supabase
    .from("model_preferred_funds")
    .delete()
    .eq("model_version_id", input.model_version_id)
    .eq("asset_class", input.asset_class);
  deleteQuery =
    input.profile_id === null
      ? deleteQuery.is("profile_id", null)
      : deleteQuery.eq("profile_id", input.profile_id);
  const { error: deleteErr } = await deleteQuery;
  if (deleteErr) throw deleteErr;

  const { error } = await supabase.from("model_preferred_funds").insert(input);
  if (error) throw error;
}

export async function replaceDepositBuckets(
  modelVersionId: string,
  profileId: string,
  buckets: Array<{ label: string; weight_percent: number; sort_order: number }>,
): Promise<void> {
  const { error: deleteErr } = await supabase
    .from("model_deposit_buckets")
    .delete()
    .eq("model_version_id", modelVersionId)
    .eq("profile_id", profileId);
  if (deleteErr) throw deleteErr;

  if (buckets.length === 0) return;

  const { error } = await supabase.from("model_deposit_buckets").insert(
    buckets.map((b) => ({
      model_version_id: modelVersionId,
      profile_id: profileId,
      label: b.label,
      weight_percent: b.weight_percent,
      sort_order: b.sort_order,
    })),
  );
  if (error) throw error;
}

export async function publishModelVersion(
  modelVersionId: string,
  effectiveDate: string,
): Promise<void> {
  const { error } = await supabase
    .from("model_versions")
    .update({
      status: "published",
      effective_date: effectiveDate,
      published_at: new Date().toISOString(),
    })
    .eq("id", modelVersionId);
  if (error) throw error;
}
