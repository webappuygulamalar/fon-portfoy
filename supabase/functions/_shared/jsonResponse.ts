// Tarayıcıdan (GitHub Pages origin'i) supabase-js `functions.invoke()` ile
// yapılan her çağrı, `Authorization`/`apikey`/`x-client-info` gibi özel
// header'lar taşıdığından önce bir CORS preflight (OPTIONS) isteği gönderir.
// Bu header'lar olmadan tarayıcı asıl isteği hiç göndermez ve bunu
// `FunctionsFetchError` ("Failed to send a request") olarak raporlar —
// sunucu tarafında hiçbir hata oluşmasa bile. Bu yüzden HEM preflight
// yanıtı HEM DE (401/403/500 dahil) her gerçek yanıt bu header'ları taşımalı.
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
