import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
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
  if (error) throw new Error(describeSyncError(error));
  return data;
}

/**
 * `functions.invoke` üç farklı hata sınıfı fırlatabilir (ağ hatası, relay
 * hatası, fonksiyonun kendi hata yanıtı). Kullanıcıya ham İngilizce SDK
 * mesajı yerine anlaşılır, yeniden deneme öneren bir Türkçe mesaj gösterilir.
 */
function describeSyncError(error: unknown): string {
  if (error instanceof FunctionsFetchError) {
    return "TEFAS senkronizasyon fonksiyonuna ulaşılamadı (ağ zaman aşımı olabilir). Lütfen birkaç saniye sonra tekrar deneyin.";
  }
  if (error instanceof FunctionsRelayError) {
    return "Senkronizasyon sırasında geçici bir sunucu hatası oluştu. Lütfen tekrar deneyin.";
  }
  if (error instanceof FunctionsHttpError) {
    return "Senkronizasyon başarısız oldu; çalışma geçmişindeki hata özetine bakın veya tekrar deneyin.";
  }
  return error instanceof Error ? error.message : "Senkronizasyon tetiklenemedi. Lütfen tekrar deneyin.";
}
