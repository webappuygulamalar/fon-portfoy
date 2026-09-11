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
import { classifyFund, shouldSkipReferenceCatalogRisk, type FundClassification } from "./classifyFund.ts";
import { fetchAllParticipationFunds } from "./tefasAdapter.ts";
import { fetchTcmbRates } from "./fxRateAdapter.ts";
import { fetchManagementCompanyPrice } from "./managementCompanyPriceAdapter.ts";
import { resolveFundCurrency, shouldTrustTefasPrice } from "./shareClassOverride.ts";
import type { ShareClassOverride } from "./types.ts";
import { CORS_HEADERS, jsonResponse } from "../_shared/jsonResponse.ts";
import { authenticateSyncRequest } from "../_shared/authenticateSyncRequest.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

// Supabase upsert isteklerini makul boyutta tutmak için toplu işlem boyutu.
const UPSERT_BATCH_SIZE = 300;

interface FundUpsertRowBase {
  code: string;
  name: string;
  management_company: string | null;
  asset_class: "MONEY_MARKET" | "BIST_EQUITY" | "GOLD" | "FX" | null;
  fund_type: string;
  currency: "TRY" | "USD" | "EUR";
  currency_source: string;
  tefas_fetch_code: string;
  is_active: true;
  verification_needed: boolean;
  verification_note: string | null;
  is_participation_fund: true;
  catalog_category: string;
  is_substitution_eligible: boolean;
}

// risk_value/risk_source/risk_updated_at BİLEREK bu temel satırın dışında
// tutulur ve yalnızca gerçek bir değer olduğunda ayrı bir upsert'e eklenir
// (bkz. aşağıdaki "risk alanlı"/"risk alansız" ayrımı). Amaç: risk verisi
// olmayan bir fon için bu sütunları upsert payload'ına HİÇ dahil etmemek —
// böylece Postgres'in ON CONFLICT DO UPDATE'i bu sütunlara dokunmaz ve
// gelecekte başka bir yolla (ör. admin) girilmiş olabilecek bir risk
// değerini asla null'a ezmez.
interface RiskFields {
  risk_value: number;
  risk_source: string;
  risk_updated_at: string;
}

Deno.serve(async (req: Request) => {
  // Tarayıcı CORS preflight'ı — auth kontrolünden ÖNCE, koşulsuz yanıtlanır.
  // Bkz. _shared/jsonResponse.ts üstündeki not: bu olmadan admin panelinden
  // yapılan HER manuel tetikleme, sunucuda hiçbir kod çalışmadan
  // "Failed to send a request" ile başarısız olur.
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

    // Sınıflandırma her fon için BİR KEZ hesaplanır; hem funds hem
    // fund_prices upsert'i (native fiyatın hangi para biriminde olduğunu
    // bilmek için) aynı sonucu kullanır — iki yerde tutarsız bir para
    // birimi asla oluşamaz.
    const classificationByCode = new Map<string, FundClassification>();
    for (const f of catalog) {
      classificationByCode.set(f.code, classifyFund(f.code, f.rawTitle));
    }

    // Kaynak önceliği: KAP (kap-risk-sync, bkz. 20260906160000_kap_risk_metadata.sql)
    // referans katalogdan DAHA GÜVENİLİRDİR (fon koduna ÖZGÜ, KAP'ın resmi
    // sayfasından, kurucu unvanı çapraz kontrolüyle doğrulanmıştır). Bu
    // günlük/iki-günlük senkronizasyon, statik referans kataloğu (2026-09-04
    // anlık görüntüsü) her çalıştığında yeniden uyguluyordu — bu, code'u HEM
    // referans katalogda HEM KAP'ta bulunan bir fonun risk_source'unu her
    // senkronizasyonda sessizce 'reference_catalog_2026-09-04'e GERİ
    // DÜŞÜRÜYORDU (canlıda doğrulanan gerçek bir regresyon: KAP'ın para
    // birimine duyarlı, daha doğru değeri siliniyordu). bkz.
    // shouldSkipReferenceCatalogRisk (classifyFund.ts) — önceden zaten
    // KAP'tan gelmiş bir risk_source varsa, bu fon için risk sütunları
    // upsert payload'ına HİÇ dahil edilmez (mevcut "risk alanlı"/"risk
    // alansız" ayrımıyla aynı, kanıtlanmış desen — sütun payload'da yoksa
    // ON CONFLICT DO UPDATE ona dokunmaz).
    const kapSourcedCodes = new Set<string>();
    const allCodes = [...classificationByCode.keys()];
    for (let i = 0; i < allCodes.length; i += UPSERT_BATCH_SIZE) {
      const batch = allCodes.slice(i, i + UPSERT_BATCH_SIZE);
      const { data, error } = await admin.from("funds").select("code, risk_source").in("code", batch);
      if (error) {
        errors.push(`mevcut risk_source okunamadı (${i}-${i + batch.length}): ${error.message}`);
        continue;
      }
      for (const row of data ?? []) {
        if (shouldSkipReferenceCatalogRisk(row.risk_source as string | null)) {
          kapSourcedCodes.add(row.code as string);
        }
      }
    }

    // Pay grubu geçersiz kılmaları (bkz. fund_share_class_overrides,
    // 20260911130000_fund_share_class_price_overrides.sql): birden fazla
    // pay grubuna sahip fonlar için doğrulanmış native para birimi/fiyat
    // kaynağı. Aktif bir satırı olan fon kodu için currency/currency_source
    // HER ÇALIŞTIRMADA bu tablodan zorla uygulanır (referans katalog/başlık
    // sezgisinden DEĞİL) — böylece günlük senkronizasyon bu değeri asla
    // eski/yanlış bir değere geri düşürmez. tefas_price_is_native=false
    // olan fonlar için TEFAS'ın ham fiyatı hiç kullanılmaz (bkz. aşağıdaki
    // fiyat çekimi bloğu).
    const overrideByCode = new Map<string, ShareClassOverride>();
    {
      const { data, error } = await admin
        .from("fund_share_class_overrides")
        .select(
          "fund_code, share_class_label, native_currency, tefas_price_is_native, price_fetch_source, price_fetch_url",
        )
        .eq("is_active", true);
      if (error) {
        errors.push(`fund_share_class_overrides okunamadı: ${error.message}`);
      } else {
        for (const row of data ?? []) {
          overrideByCode.set(row.fund_code as string, {
            fundCode: row.fund_code as string,
            shareClassLabel: row.share_class_label as string,
            nativeCurrency: row.native_currency as "TRY" | "USD" | "EUR",
            tefasPriceIsNative: row.tefas_price_is_native as boolean,
            priceFetchSource: row.price_fetch_source as string | null,
            priceFetchUrl: row.price_fetch_url as string | null,
          });
        }
      }
    }

    const nowIso = new Date().toISOString();
    const fundRowsWithRisk: (FundUpsertRowBase & RiskFields)[] = [];
    const fundRowsWithoutRisk: FundUpsertRowBase[] = [];

    for (const f of catalog) {
      const classification = classificationByCode.get(f.code)!;
      const override = overrideByCode.get(f.code);
      const resolvedCurrency = resolveFundCurrency(
        { currency: classification.currency, currencySource: classification.currencySource },
        override,
      );
      const base: FundUpsertRowBase = {
        code: f.code,
        name: f.displayName,
        management_company: f.managementCompany,
        asset_class: classification.modelAssetClass,
        fund_type: f.fonTipi === "YAT" ? "Yatırım Fonu" : "Borsa Yatırım Fonu",
        currency: resolvedCurrency.currency,
        currency_source: resolvedCurrency.currencySource,
        tefas_fetch_code: f.code,
        is_active: true,
        verification_needed: classification.needsVerification,
        verification_note: classification.verificationNote,
        is_participation_fund: true,
        catalog_category: classification.catalogCategory,
        is_substitution_eligible: classification.modelAssetClass !== null && !classification.needsVerification,
      };
      if (classification.riskValue !== null && classification.riskSource !== null && !kapSourcedCodes.has(f.code)) {
        fundRowsWithRisk.push({
          ...base,
          risk_value: classification.riskValue,
          risk_source: classification.riskSource,
          risk_updated_at: nowIso,
        });
      } else {
        fundRowsWithoutRisk.push(base);
      }
    }

    // 1) Fon kataloğu upsert'i (code üzerinden idempotent — mevcut fonların
    // id'si korunur). İki ayrı batch grubu: risk_value bilinen fonlar için
    // risk sütunları da upsert edilir; bilinmeyenler için bu sütunlar
    // payload'a HİÇ dahil edilmez (yukarıdaki RiskFields notuna bakın) —
    // böylece günlük senkronizasyon var olan bir risk değerini asla silmez.
    const fundIdByCode = new Map<string, string>();
    for (const [label, rows] of [
      ["risk alanlı", fundRowsWithRisk] as const,
      ["risk alansız", fundRowsWithoutRisk] as const,
    ]) {
      for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
        const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
        if (batch.length === 0) continue;
        const { data, error } = await admin
          .from("funds")
          .upsert(batch, { onConflict: "code" })
          .select("id, code");
        if (error) {
          fundsFailed += batch.length;
          batch.forEach((b) => failedCodes.push(b.code));
          errors.push(`funds upsert (${label}, ${i}-${i + batch.length}): ${error.message}`);
          continue;
        }
        for (const row of data ?? []) fundIdByCode.set(row.code as string, row.id as string);
      }
    }

    // 2) Fiyat upsert'i — yalnızca geçerli (>0) fiyatlı fonlar için. TEFAS'ta
    // geçici olarak 0/askıda görünen bir fon için o günün fiyatı uydurulmaz;
    // fon kataloğa yine de eklenir/güncellenir, sadece bugünün fiyat satırı
    // atlanır. `currency` fonun native para birimidir (ör. BKY için USD) —
    // fiyat DEĞERİ zaten TEFAS'ın döndürdüğü native sayıdır, TL'ye
    // ÇEVRİLMEZ; TL karşılığı hesaplama anında (fx_rates ile) türetilir.
    //
    // İSTİSNA: tefas_price_is_native=false olan bir override'a sahip fonlar
    // için (bkz. overrideByCode yukarıda) TEFAS'ın ham fiyatı BAŞKA bir pay
    // grubuna ait olduğu doğrulandığından hiç kullanılmaz — bunun yerine
    // resmi PYŞ kaynağından (bkz. managementCompanyPriceAdapter.ts) o günün
    // native fiyatı çekilir. Çekim başarısız olursa (ağ hatası veya sayfa
    // yapısı beklenmedikse) o fon için o günün fiyatı UYDURULMAZ — bu
    // çalıştırmada atlanır, son bilinen değer korunur, hata error_summary'ye
    // yazılır.
    const overrideFetchFunds = catalog.filter((f) => !shouldTrustTefasPrice(overrideByCode.get(f.code)));
    const managementCompanyPriceByCode = new Map<string, { price: number; priceDate: string }>();
    const overrideFetchResults = await Promise.allSettled(
      overrideFetchFunds.map((f) => fetchManagementCompanyPrice(overrideByCode.get(f.code)!)),
    );
    overrideFetchResults.forEach((result, i) => {
      const code = overrideFetchFunds[i].code;
      if (result.status === "rejected") {
        const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
        errors.push(`Resmi PYŞ fiyatı alınamadı (${code}): ${message}`);
        return;
      }
      if (result.value === null) {
        errors.push(
          `Resmi PYŞ sayfasında beklenen fiyat alanı bulunamadı (${code}) — bu fon için fiyat bu çalıştırmada güncellenmedi.`,
        );
        return;
      }
      managementCompanyPriceByCode.set(code, result.value);
    });

    interface PriceUpsertRow {
      fund_id: string;
      price_date: string;
      currency: "TRY" | "USD" | "EUR";
      price: number;
      fund_size: number | null;
      investor_count: number | null;
      source: "TEFAS" | "MANAGEMENT_COMPANY";
      fetched_at: string;
      note: string | null;
    }

    const priceRows = catalog
      .filter((f) => fundIdByCode.has(f.code))
      .flatMap((f): PriceUpsertRow[] => {
        const override = overrideByCode.get(f.code);
        const currency = override ? override.nativeCurrency : classificationByCode.get(f.code)!.currency;

        if (override && !shouldTrustTefasPrice(override)) {
          const fetched = managementCompanyPriceByCode.get(f.code);
          if (!fetched) return [];
          return [
            {
              fund_id: fundIdByCode.get(f.code)!,
              price_date: fetched.priceDate,
              currency,
              price: fetched.price,
              fund_size: f.fundSize,
              investor_count: f.investorCount,
              source: "MANAGEMENT_COMPANY",
              fetched_at: nowIso,
              note: `Kaynak: ${override.priceFetchSource} (fund_share_class_overrides, ${override.shareClassLabel})`,
            },
          ];
        }

        if (f.price <= 0) return [];
        return [
          {
            fund_id: fundIdByCode.get(f.code)!,
            price_date: f.priceDate,
            currency,
            price: f.price,
            fund_size: f.fundSize,
            investor_count: f.investorCount,
            source: "TEFAS",
            fetched_at: nowIso,
            note: null,
          },
        ];
      });

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

    // 3) TCMB döviz kuru senkronizasyonu — TEFAS'tan tamamen bağımsız,
    // ayrı bir kaynak. Başarısız olursa fon/fiyat senkronizasyonunu
    // düşürmez (o zaten kaydedildi); yalnızca hata listesine eklenir ve
    // döviz fonlarının hesaplaması bir sonraki başarılı kur senkronizasyonuna
    // kadar "kur eksik" olarak güvenli biçimde engellenir (uydurma kur yok).
    try {
      const fxRates = await fetchTcmbRates(["USD", "EUR"], { timeoutMs: 8000 });
      if (fxRates.length > 0) {
        const { error: fxError } = await admin.from("fx_rates").upsert(
          fxRates.map((r) => ({
            currency: r.currency,
            rate_to_try: r.rateToTry,
            rate_date: r.rateDate,
            source: "TCMB",
            fetched_at: nowIso,
          })),
          { onConflict: "currency,rate_date,source" },
        );
        if (fxError) errors.push(`fx_rates upsert: ${fxError.message}`);
      } else {
        errors.push("TCMB yanıtından hiçbir kur ayrıştırılamadı");
      }
    } catch (err) {
      errors.push(`TCMB kur senkronizasyonu başarısız: ${err instanceof Error ? err.message : String(err)}`);
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
