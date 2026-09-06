// Supabase Edge Function: KAP (Kamuyu Aydınlatma Platformu) risk verisi
// zenginleştirme.
//
// tefas-sync (günlük fiyat/katalog senkronizasyonu) ve history-backfill
// (tarihsel fiyat geri yükleme) ile AYNI yetkilendirme yollarını kullanır
// ama TAMAMEN AYRI, düşük yoğunluklu bir işi vardır: `funds.risk_value`
// için KAP'ın resmi, herkese açık (güvenlik önlemi OLMAYAN) arama API'si
// ve fon detay sayfaları üzerinden ek veri arar.
//
// TASARIM GEREKÇESİ (bkz. 20260906160000_kap_risk_metadata.sql):
//  - Bu işi GÜNLÜK fiyat senkronizasyonuna KARIŞTIRMAZ, otomatik cron'a
//    BAĞLAMAZ — yalnızca admin panelinden manuel tetiklenir.
//  - Her çağrıda yalnızca küçük bir PARTİ (BATCH_SIZE) fon işlenir; hangi
//    fonların işlendiği `funds.kap_checked_at` ile checkpoint'lenir, bu
//    yüzden tamamlanana kadar tekrar tekrar çağrılması gerekir (aynı
//    history-backfill'in pencere bazlı çalışması gibi).
//  - KAP'a aynı anda en fazla CONCURRENCY (3) istek gider ve her fon
//    arasında ek bir bekleme uygulanır — "düşük istek hızı" gereksinimi.
//  - Fon kodu eşleşse bile KURUCU UNVANI da uyuşmazsa (founderMatches)
//    OTOMATİK EŞLEŞTİRME YAPILMAZ — yanlış fon eşleştirmesi riskine karşı.
//  - Belirsiz/çelişkili risk verisi ASLA tahmin edilip yazılmaz; ilgili
//    fon `risk_verification_needed=true` ile işaretlenir.
//  - Mevcut bir risk_value (ör. referans katalogdan), KAP'ta bulunamama/
//    belirsizlik durumunda ASLA null'a düşürülmez (bkz. decideFundUpdate.ts).
import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/jsonResponse.ts";
import { authenticateSyncRequest } from "../_shared/authenticateSyncRequest.ts";
import { fetchKapFundDetailHtml, mapWithConcurrency, searchKapFundByCode } from "./kapClient.ts";
import {
  decodeNextRscChunks,
  extractFounderTitle,
  extractFundDetailArray,
  extractRiskFromFundDetail,
  founderMatches,
} from "./kapRiskParser.ts";
import { buildFundUpdate, type FundForKapSync, type KapLookupOutcome } from "./decideFundUpdate.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

// Bir Edge Function çağrısında işlenecek fon sayısı — hem Edge Function
// süre sınırını aşmamak hem de KAP'a tek çalışmada aşırı istek göndermemek
// için küçük tutulur.
const BATCH_SIZE = 20;
// KAP'a aynı anda gidecek en fazla istek sayısı.
const CONCURRENCY = 3;
// Her fon işlemi arasında ek, kasıtlı gecikme (ms) — "düşük istek hızı".
const PER_FUND_PACING_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface FundQueryRow extends FundForKapSync {
  currency: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const authResult = await authenticateSyncRequest(req, admin, CRON_SECRET);
  if (authResult instanceof Response) return authResult;
  const { triggerType, triggeredByAdminId } = authResult;

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const revalidateAll = body?.revalidateAll === true;

  if (revalidateAll) {
    const { error } = await admin
      .from("funds")
      .update({ kap_checked_at: null })
      .eq("is_participation_fund", true);
    if (error) {
      return jsonResponse({ error: "Yeniden doğrulama sıfırlanamadı", detail: error.message }, 500);
    }
    return jsonResponse({
      status: "success",
      fundsReset: true,
      message: "Tüm katılım fonları için KAP kontrol durumu sıfırlandı; bir sonraki partiler tüm fonları yeniden işleyecek.",
    });
  }

  // Öncelik sırası: henüz risk_value'su olmayan fonlar (nulls first), sonra
  // koda göre. Bu, kullanıcının istediği "önce eksik 110, sonra tümü 286"
  // aşamalı doğrulamayı, ayrı bir mod gerektirmeden DOĞAL olarak sağlar —
  // eksik fonlar bitince aynı buton risk_value'su zaten olan fonları da
  // (yeniden doğrulama amacıyla) işlemeye devam eder.
  const { data: fundsData, error: fetchErr } = await admin
    .from("funds")
    .select("id, code, management_company, currency")
    .eq("is_participation_fund", true)
    .or("kap_checked_at.is.null,kap_lookup_status.eq.error")
    .order("risk_value", { ascending: true, nullsFirst: true })
    .order("code", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchErr) {
    return jsonResponse({ error: "Fon listesi okunamadı", detail: fetchErr.message }, 500);
  }

  const funds = (fundsData ?? []) as FundQueryRow[];

  const { data: runRow, error: runInsertErr } = await admin
    .from("risk_sync_runs")
    .insert({ status: "running", trigger_type: triggerType, triggered_by_admin_id: triggeredByAdminId })
    .select()
    .single();

  if (runInsertErr || !runRow) {
    return jsonResponse(
      { error: "risk_sync_runs kaydı oluşturulamadı", detail: runInsertErr?.message },
      500,
    );
  }

  if (funds.length === 0) {
    const finishedAt = new Date().toISOString();
    await admin
      .from("risk_sync_runs")
      .update({ finished_at: finishedAt, status: "success", funds_checked: 0 })
      .eq("id", runRow.id);
    return jsonResponse({
      status: "success",
      fundsChecked: 0,
      isComplete: true,
      message: "İşlenecek fon kalmadı (tüm katılım fonları en az bir kez kontrol edilmiş).",
    });
  }

  const nowIso = new Date().toISOString();

  const processed = await mapWithConcurrency(funds, CONCURRENCY, async (fund) => {
    let outcome: KapLookupOutcome;
    let errorMessage: string | null = null;
    try {
      const searchResults = await searchKapFundByCode(fund.code);
      if (searchResults.length === 0) {
        outcome = { kind: "not_found" };
      } else if (searchResults.length > 1) {
        outcome = { kind: "ambiguous_search_match" };
      } else {
        const [match] = searchResults;
        const html = await fetchKapFundDetailHtml(match.memberOrFundOid);
        const decoded = decodeNextRscChunks(html);
        const items = extractFundDetailArray(decoded);
        if (!items) {
          outcome = { kind: "error" };
          errorMessage = "KAP sayfasından fundDetail verisi ayrıştırılamadı";
        } else {
          const founderTitle = extractFounderTitle(items);
          if (!founderMatches(fund.management_company, founderTitle)) {
            outcome = { kind: "founder_mismatch", kapFounderTitle: founderTitle };
          } else {
            const risk = extractRiskFromFundDetail(items, fund.currency);
            outcome = { kind: "matched", kapFundId: match.memberOrFundOid, risk };
          }
        }
      }
    } catch (err) {
      outcome = { kind: "error" };
      errorMessage = err instanceof Error ? err.message : String(err);
    }
    await sleep(PER_FUND_PACING_MS);
    return { fund, outcome, errorMessage };
  });

  let matched = 0;
  let riskObtained = 0;
  let ambiguous = 0;
  let notFound = 0;
  let errored = 0;
  const failedFundCodes: string[] = [];
  const errorLines: string[] = [];

  for (const { fund, outcome, errorMessage } of processed) {
    const payload = buildFundUpdate(fund, outcome, nowIso);
    const { id, ...changes } = payload;
    const { error: updateErr } = await admin.from("funds").update(changes).eq("id", id);

    if (updateErr) {
      errored++;
      failedFundCodes.push(fund.code);
      errorLines.push(`${fund.code}: DB güncelleme hatası — ${updateErr.message}`);
      continue;
    }

    switch (outcome.kind) {
      case "matched":
        matched++;
        if (outcome.risk.status === "found") riskObtained++;
        if (outcome.risk.status === "ambiguous") ambiguous++;
        break;
      case "ambiguous_search_match":
      case "founder_mismatch":
        ambiguous++;
        break;
      case "not_found":
        notFound++;
        break;
      case "error":
        errored++;
        failedFundCodes.push(fund.code);
        if (errorMessage) errorLines.push(`${fund.code}: ${errorMessage}`);
        break;
    }
  }

  const status: "success" | "partial" | "failed" =
    errored === 0 ? "success" : errored === funds.length ? "failed" : "partial";
  const finishedAt = new Date().toISOString();

  await admin
    .from("risk_sync_runs")
    .update({
      finished_at: finishedAt,
      status,
      funds_checked: funds.length,
      funds_matched: matched,
      funds_risk_obtained: riskObtained,
      funds_ambiguous: ambiguous,
      funds_not_found: notFound,
      funds_error: errored,
      failed_fund_codes: failedFundCodes,
      error_summary: errorLines.length > 0 ? errorLines.join("\n").slice(0, 4000) : null,
    })
    .eq("id", runRow.id);

  return jsonResponse({
    status,
    fundsChecked: funds.length,
    fundsMatched: matched,
    fundsRiskObtained: riskObtained,
    fundsAmbiguous: ambiguous,
    fundsNotFound: notFound,
    fundsError: errored,
    failedFundCodes,
  });
});
