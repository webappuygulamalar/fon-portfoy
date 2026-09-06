// tefas-sync ve history-backfill Edge Function'larının ORTAK yetkilendirme
// mantığı. İki çağrı yolu vardır:
//   1. Cron (pg_cron -> pg_net), `x-cron-secret` header'ı ile.
//   2. Admin paneli, kullanıcının Supabase Auth JWT'si ile (Authorization: Bearer ...).
// Bu dosya, aynı mantığın iki fonksiyonda birbirinden bağımsız (ve
// zamanla tutarsızlaşabilecek) şekilde kopyalanmasını önler.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse } from "./jsonResponse.ts";

export interface SyncAuthResult {
  triggerType: "cron" | "manual";
  triggeredByAdminId: string | null;
}

/**
 * İsteği doğrular. Başarılıysa `SyncAuthResult` döner; başarısızsa
 * doğrudan çağırana geri döndürülebilecek bir `Response` (401/403) döner —
 * çağıran taraf `instanceof Response` ile ayırt eder.
 */
export async function authenticateSyncRequest(
  req: Request,
  admin: SupabaseClient,
  cronSecret: string | undefined,
): Promise<SyncAuthResult | Response> {
  const cronSecretHeader = req.headers.get("x-cron-secret");
  if (cronSecret && cronSecretHeader && cronSecretHeader === cronSecret) {
    return { triggerType: "cron", triggeredByAdminId: null };
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return jsonResponse({ error: "Yetkisiz: cron secret veya admin oturumu gerekli." }, 401);
  }
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) {
    return jsonResponse({ error: "Geçersiz oturum." }, 401);
  }
  const { data: adminRow } = await admin
    .from("admin_users")
    .select("id, is_active")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!adminRow || !adminRow.is_active) {
    return jsonResponse({ error: "Bu işlem için admin yetkisi gerekli." }, 403);
  }
  return { triggerType: "manual", triggeredByAdminId: adminRow.id as string };
}
