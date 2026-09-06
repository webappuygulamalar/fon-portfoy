// Supabase Edge Function: tarihsel fiyat geri yükleme (backfill).
//
// tefas-sync (günlük fiyat/katalog senkronizasyonu) ile AYNI yetkilendirme
// yollarını kullanır (cron secret veya admin JWT — bkz. _shared/
// authenticateSyncRequest.ts) ama TAMAMEN AYRI bir işi vardır: 1/3/6/12
// aylık getiri hesaplayabilmek için `fund_prices`'a geçmişe dönük fiyat
// yükler.
//
// TEFAS'ın toplu liste endpoint'i tek istekte ~1 aydan uzun tarih aralığı
// KABUL ETMİYOR (canlıda doğrulandı: "Geçersiz veri: Tarih aralığı 1 ayı
// aşamaz"). Bu yüzden bu fonksiyon HER ÇAĞRIDA yalnızca bir sonraki
// ~27 günlük pencereyi işler ve `price_backfill_checkpoint` singleton
// satırında nereye kadar geldiğini kaydeder — checkpoint `is_complete`
// olana kadar tekrar tekrar (admin panelinden veya cron ile) çağrılması
// gerekir. Bu, günlük tefas-sync akışını YAVAŞLATMAZ/ETKİLEMEZ — tamamen
// ayrı tablolara (price_backfill_*) ve ayrı bir Edge Function'a yazar.
import { createClient } from "npm:@supabase/supabase-js@2";
import { fetchParticipationFundPriceHistory } from "../tefas-sync/tefasAdapter.ts";
import { CORS_HEADERS, jsonResponse } from "../_shared/jsonResponse.ts";
import { authenticateSyncRequest } from "../_shared/authenticateSyncRequest.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

// TEFAS'ın "1 ay" sınırının altında güvenli bir marj.
const WINDOW_DAYS = 27;
const UPSERT_BATCH_SIZE = 500;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDate(d);
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

  const { data: checkpoint, error: checkpointErr } = await admin
    .from("price_backfill_checkpoint")
    .select("*")
    .eq("id", true)
    .single();

  if (checkpointErr || !checkpoint) {
    return jsonResponse(
      { error: "price_backfill_checkpoint okunamadı", detail: checkpointErr?.message },
      500,
    );
  }

  if (checkpoint.is_complete) {
    return jsonResponse({
      status: "success",
      windowStart: null,
      windowEnd: null,
      rowsUpserted: 0,
      fundsTouched: 0,
      isComplete: true,
      message: "Geri yükleme zaten tamamlandı.",
    });
  }

  // Bir sonraki pencere: en eski çekilen tarihin hemen öncesinden geriye
  // doğru WINDOW_DAYS gün, ama hedef başlangıcın gerisine geçmez.
  const windowEnd = addDays(checkpoint.oldest_fetched_date, -1);
  let windowStart = addDays(windowEnd, -(WINDOW_DAYS - 1));
  if (windowStart < checkpoint.target_start_date) {
    windowStart = checkpoint.target_start_date;
  }

  const { data: runRow, error: runInsertErr } = await admin
    .from("price_backfill_runs")
    .insert({
      status: "running",
      trigger_type: triggerType,
      triggered_by_admin_id: triggeredByAdminId,
      window_start: windowStart,
      window_end: windowEnd,
    })
    .select()
    .single();

  if (runInsertErr || !runRow) {
    return jsonResponse(
      { error: "price_backfill_runs kaydı oluşturulamadı", detail: runInsertErr?.message },
      500,
    );
  }

  try {
    const { rows, errors } = await fetchParticipationFundPriceHistory(windowStart, windowEnd, {
      timeoutMs: 20000,
    });

    // Yalnızca ZATEN kataloğumuzda olan (günlük tefas-sync tarafından
    // keşfedilmiş, aktif) fonlar için geçmiş yüklenir — geri yükleme
    // pencereleri geçmişe gittikçe artık listede olmayan/kapanmış fonlara
    // rastlanabilir; bunlar bilinçli olarak atlanır (kapsam dışı, uydurma
    // fon oluşturulmaz).
    const codes = [...new Set(rows.map((r) => r.code))];
    const fundIdAndCurrencyByCode = new Map<string, { id: string; currency: string }>();
    for (let i = 0; i < codes.length; i += UPSERT_BATCH_SIZE) {
      const batch = codes.slice(i, i + UPSERT_BATCH_SIZE);
      const { data: fundsData, error: fundsErr } = await admin
        .from("funds")
        .select("id, code, currency")
        .in("code", batch);
      if (fundsErr) throw new Error(`funds okunamadı: ${fundsErr.message}`);
      for (const f of fundsData ?? []) {
        fundIdAndCurrencyByCode.set(f.code as string, { id: f.id as string, currency: f.currency as string });
      }
    }

    const nowIso = new Date().toISOString();
    const priceRows = rows
      .filter((r) => fundIdAndCurrencyByCode.has(r.code))
      .map((r) => {
        const fund = fundIdAndCurrencyByCode.get(r.code)!;
        return {
          fund_id: fund.id,
          price_date: r.priceDate,
          currency: fund.currency,
          price: r.price,
          fund_size: r.fundSize,
          investor_count: r.investorCount,
          source: "TEFAS",
          fetched_at: nowIso,
          note: null,
        };
      });

    let rowsUpserted = 0;
    const upsertErrors: string[] = [...errors];
    for (let i = 0; i < priceRows.length; i += UPSERT_BATCH_SIZE) {
      const batch = priceRows.slice(i, i + UPSERT_BATCH_SIZE);
      const { error } = await admin
        .from("fund_prices")
        .upsert(batch, { onConflict: "fund_id,price_date,currency" });
      if (error) {
        upsertErrors.push(`fund_prices upsert (${i}-${i + batch.length}): ${error.message}`);
        continue;
      }
      rowsUpserted += batch.length;
    }

    const fundsTouched = new Set(priceRows.map((r) => r.fund_id)).size;
    const isComplete = windowStart <= checkpoint.target_start_date;

    await admin
      .from("price_backfill_checkpoint")
      .update({
        oldest_fetched_date: windowStart,
        is_complete: isComplete,
        updated_at: nowIso,
      })
      .eq("id", true);

    const status: "success" | "partial" | "failed" =
      upsertErrors.length === 0 ? "success" : rowsUpserted > 0 ? "partial" : "failed";

    await admin
      .from("price_backfill_runs")
      .update({
        finished_at: nowIso,
        status,
        rows_upserted: rowsUpserted,
        funds_touched: fundsTouched,
        error_summary: upsertErrors.length > 0 ? upsertErrors.join("\n").slice(0, 4000) : null,
      })
      .eq("id", runRow.id);

    return jsonResponse({
      status,
      windowStart,
      windowEnd,
      rowsUpserted,
      fundsTouched,
      isComplete,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("price_backfill_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        error_summary: `Beklenmeyen hata: ${message}`.slice(0, 4000),
      })
      .eq("id", runRow.id);
    return jsonResponse({ error: "Geri yükleme sırasında beklenmeyen hata oluştu", detail: message }, 500);
  }
});
