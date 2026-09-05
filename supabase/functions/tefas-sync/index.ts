// Supabase Edge Function: TEFAS fiyat senkronizasyonu.
//
// İki çağrı yolu:
//   1. Cron (pg_cron -> pg_net), `x-cron-secret` header'ı ile.
//   2. Admin paneli, kullanıcının Supabase Auth JWT'si ile (Authorization: Bearer ...).
// Her iki durumda da yetkilendirme burada, fonksiyon içinde yapılır;
// bu yüzden config.toml'da bu fonksiyon için verify_jwt=false ayarlıdır.
//
// service role anahtarı yalnızca bu sunucu tarafı ortamda kullanılır,
// tarayıcıya asla gönderilmez.
import { createClient } from "npm:@supabase/supabase-js@2";
import { fetchLatestFundPrice } from "./tefasAdapter.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

// Fonlar arasında bekleme: TEFAS'a düşük hacimli, nazik istek göndermek için.
const DELAY_BETWEEN_FUNDS_MS = 2000;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const cronSecretHeader = req.headers.get("x-cron-secret");
  let triggerType: "cron" | "manual";
  let triggeredByAdminId: string | null = null;

  if (CRON_SECRET && cronSecretHeader && cronSecretHeader === CRON_SECRET) {
    triggerType = "cron";
  } else {
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
    triggerType = "manual";
    triggeredByAdminId = adminRow.id as string;
  }

  const { data: runRow, error: runInsertErr } = await admin
    .from("sync_runs")
    .insert({
      status: "running",
      trigger_type: triggerType,
      triggered_by_admin_id: triggeredByAdminId,
    })
    .select()
    .single();

  if (runInsertErr || !runRow) {
    return jsonResponse(
      { error: "sync_runs kaydı oluşturulamadı", detail: runInsertErr?.message },
      500,
    );
  }

  const { data: funds, error: fundsErr } = await admin
    .from("funds")
    .select("id, code, tefas_fetch_code, currency")
    .eq("is_active", true);

  if (fundsErr || !funds) {
    await admin
      .from("sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        error_summary: `funds tablosu okunamadı: ${fundsErr?.message ?? "bilinmeyen hata"}`,
      })
      .eq("id", runRow.id);
    return jsonResponse({ error: "funds tablosu okunamadı" }, 500);
  }

  let updated = 0;
  let failed = 0;
  const failedCodes: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < funds.length; i++) {
    const fund = funds[i];
    try {
      const result = await fetchLatestFundPrice(fund.tefas_fetch_code, {
        timeoutMs: 8000,
        retries: 2,
      });

      // Idempotent upsert: aynı (fund_id, price_date, currency) için tekrar
      // çalıştırma yeni satır oluşturmaz, mevcut satırı günceller.
      const { error: upsertErr } = await admin.from("fund_prices").upsert(
        {
          fund_id: fund.id,
          price_date: result.priceDate,
          currency: fund.currency,
          price: result.price,
          fund_size: result.fundSize,
          investor_count: result.investorCount,
          source: "TEFAS",
          fetched_at: new Date().toISOString(),
          note: null,
        },
        { onConflict: "fund_id,price_date,currency" },
      );
      if (upsertErr) throw new Error(upsertErr.message);
      updated++;
    } catch (err) {
      failed++;
      failedCodes.push(fund.code);
      errors.push(`${fund.code}: ${err instanceof Error ? err.message : String(err)}`);
      // Son başarılı fiyatı ASLA silmeyiz/üzerine boş yazmayız — bu fon
      // için sadece bu turda güncelleme yapılmaz, önceki satır kalır.
    }

    if (i < funds.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_FUNDS_MS));
    }
  }

  const status: "success" | "partial" | "failed" =
    failed === 0 ? "success" : updated > 0 ? "partial" : "failed";

  await admin
    .from("sync_runs")
    .update({
      finished_at: new Date().toISOString(),
      status,
      funds_checked: funds.length,
      funds_updated: updated,
      funds_failed: failed,
      failed_fund_codes: failedCodes,
      error_summary: errors.length > 0 ? errors.join("\n").slice(0, 4000) : null,
    })
    .eq("id", runRow.id);

  return jsonResponse({
    status,
    fundsChecked: funds.length,
    fundsUpdated: updated,
    fundsFailed: failed,
    failedFundCodes: failedCodes,
  });
});
