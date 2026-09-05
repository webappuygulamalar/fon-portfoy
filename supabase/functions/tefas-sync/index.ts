// Supabase Edge Function: TEFAS katılım fonu kataloğu + fiyat senkronizasyonu.
//
// İki çağrı yolu:
//   1. Cron (pg_cron -> pg_net), `x-cron-secret` header'ı ile.
//   2. Admin paneli, kullanıcının Supabase Auth JWT'si ile (Authorization: Bearer ...).
// Her iki durumda da yetkilendirme burada, fonksiyon içinde yapılır;
// bu yüzden config.toml'da bu fonksiyon için verify_jwt=false ayarlıdır.
//
// service role anahtarı yalnızca bu sunucu tarafı ortamda kullanılır,
// tarayıcıya asla gönderilmez.
//
// Akış: TEFAS'ın toplu liste endpoint'inden (YAT+BYF, "katılım" aramasıyla)
// TÜM katılım fonu evreni TEK seferde keşfedilir, her fon sınıflandırılır
// (classifyFund.ts) ve `funds` + `fund_prices` tablolarına idempotent
// upsert edilir (code / (fund_id,price_date,currency) üzerinden — tekrar
// çalıştırma yeni satır oluşturmaz). Listeden geçici olarak kaybolan bir
// fonun geçmiş fiyat kaydı asla silinmez; sadece o gün için güncellenmez.
import { createClient } from "npm:@supabase/supabase-js@2";
import { classifyFund } from "./classifyFund.ts";
import { fetchAllParticipationFunds } from "./tefasAdapter.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

// Supabase upsert isteklerini makul boyutta tutmak için toplu işlem boyutu.
const UPSERT_BATCH_SIZE = 300;

interface FundUpsertRow {
  code: string;
  name: string;
  management_company: string | null;
  asset_class: "MONEY_MARKET" | "BIST_EQUITY" | "GOLD" | "FX" | null;
  fund_type: string;
  currency: "TRY";
  tefas_fetch_code: string;
  is_active: true;
  verification_needed: boolean;
  verification_note: string | null;
  is_participation_fund: true;
  catalog_category: string;
  is_substitution_eligible: boolean;
}

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

  // Bu noktadan sonra HER ŞEY tek bir try/catch içindedir: beklenmedik bir
  // istisna (ör. bir upsert çağrısının kendisinin fırlatması) bile sync_runs
  // kaydını sonsuza dek "running" bırakmaz — her zaman "failed" olarak
  // kapatılır ve hata mesajı kaydedilir. Ağ/işlem hataları asla iz
  // bırakmadan kaybolmaz.
  try {
    // TEFAS'a iki fon tipi (YAT+BYF) PARALEL istenir; biri zaman aşımına
    // uğrarsa diğerinin sonuçları yine de kullanılır (bkz. tefasAdapter.ts).
    // Kısa timeout + paralel çağrı, Edge Function'ın çalışma süresi
    // sınırını aşma riskini azaltır (önceki sürümde sıralı + uzun timeout,
    // canlıda "Failed to send a request" ile sonuçlanan bir zaman aşımına
    // yol açmıştı).
    const { funds: catalog, errors: catalogErrors } = await fetchAllParticipationFunds({ timeoutMs: 12000 });

    if (catalog.length === 0) {
      const message =
        catalogErrors.length > 0
          ? catalogErrors.join("; ")
          : "TEFAS toplu listesi boş sonuç döndürdü.";
      await admin
        .from("sync_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: "failed",
          error_summary: `TEFAS'tan hiçbir katılım fonu alınamadı: ${message}`.slice(0, 4000),
        })
        .eq("id", runRow.id);
      return jsonResponse({ error: "TEFAS toplu liste alınamadı", detail: message }, 502);
    }

    const fundsChecked = catalog.length;
    let fundsFailed = 0;
    let fundsUpdated = 0;
    const failedCodes: string[] = [];
    const errors: string[] = [...catalogErrors];

    const fundRows: FundUpsertRow[] = catalog.map((f) => {
      const classification = classifyFund(f.code, f.rawTitle);
      return {
        code: f.code,
        name: f.displayName,
        management_company: f.managementCompany,
        asset_class: classification.modelAssetClass,
        fund_type: f.fonTipi === "YAT" ? "Yatırım Fonu" : "Borsa Yatırım Fonu",
        currency: "TRY",
        tefas_fetch_code: f.code,
        is_active: true,
        verification_needed: classification.needsVerification,
        verification_note: classification.verificationNote,
        is_participation_fund: true,
        catalog_category: classification.catalogCategory,
        is_substitution_eligible: classification.modelAssetClass !== null && !classification.needsVerification,
      };
    });

    // 1) Fon kataloğu upsert'i (code üzerinden idempotent — mevcut fonların id'si korunur).
    const fundIdByCode = new Map<string, string>();
    for (let i = 0; i < fundRows.length; i += UPSERT_BATCH_SIZE) {
      const batch = fundRows.slice(i, i + UPSERT_BATCH_SIZE);
      const { data, error } = await admin
        .from("funds")
        .upsert(batch, { onConflict: "code" })
        .select("id, code");
      if (error) {
        fundsFailed += batch.length;
        batch.forEach((b) => failedCodes.push(b.code));
        errors.push(`funds upsert (${i}-${i + batch.length}): ${error.message}`);
        continue;
      }
      for (const row of data ?? []) fundIdByCode.set(row.code as string, row.id as string);
    }

    // 2) Fiyat upsert'i — yalnızca geçerli (>0) fiyatlı fonlar için. TEFAS'ta
    // geçici olarak 0/askıda görünen bir fon için o günün fiyatı uydurulmaz;
    // fon kataloğa yine de eklenir/güncellenir, sadece bugünün fiyat satırı atlanır.
    const priceRows = catalog
      .filter((f) => fundIdByCode.has(f.code) && f.price > 0)
      .map((f) => ({
        fund_id: fundIdByCode.get(f.code)!,
        price_date: f.priceDate,
        currency: "TRY",
        price: f.price,
        fund_size: f.fundSize,
        investor_count: f.investorCount,
        source: "TEFAS",
        fetched_at: new Date().toISOString(),
        note: null,
      }));

    for (let i = 0; i < priceRows.length; i += UPSERT_BATCH_SIZE) {
      const batch = priceRows.slice(i, i + UPSERT_BATCH_SIZE);
      const { error } = await admin
        .from("fund_prices")
        .upsert(batch, { onConflict: "fund_id,price_date,currency" });
      if (error) {
        errors.push(`fund_prices upsert (${i}-${i + batch.length}): ${error.message}`);
        continue;
      }
      fundsUpdated += batch.length;
    }

    const status: "success" | "partial" | "failed" =
      fundsFailed === 0 && catalogErrors.length === 0 ? "success" : fundsUpdated > 0 ? "partial" : "failed";

    await admin
      .from("sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        status,
        funds_checked: fundsChecked,
        funds_updated: fundsUpdated,
        funds_failed: fundsFailed,
        failed_fund_codes: failedCodes,
        catalog_synced: true,
        error_summary: errors.length > 0 ? errors.join("\n").slice(0, 4000) : null,
      })
      .eq("id", runRow.id);

    return jsonResponse({
      status,
      fundsChecked,
      fundsUpdated,
      fundsFailed,
      failedFundCodes: failedCodes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        error_summary: `Beklenmeyen hata: ${message}`.slice(0, 4000),
      })
      .eq("id", runRow.id);
    return jsonResponse({ error: "Senkronizasyon sırasında beklenmeyen hata oluştu", detail: message }, 500);
  }
});
