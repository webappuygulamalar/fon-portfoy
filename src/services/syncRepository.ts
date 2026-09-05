import { supabase } from "./supabaseClient";
import type { SyncRunRow } from "./types";

export async function listSyncRuns(limit = 20): Promise<SyncRunRow[]> {
  const { data, error } = await supabase
    .from("sync_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

/**
 * Admin panelinden "TEFAS fiyatlarını güncelle" butonuyla manuel
 * tetikleme. Edge Function, çağıranın admin_users'ta olduğunu kendi
 * içinde JWT üzerinden doğrular.
 */
export async function triggerManualTefasSync(): Promise<{
  status: string;
  fundsChecked: number;
  fundsUpdated: number;
  fundsFailed: number;
  failedFundCodes: string[];
}> {
  const { data, error } = await supabase.functions.invoke("tefas-sync", {
    method: "POST",
    body: { trigger: "manual" },
  });
  if (error) throw error;
  return data;
}
