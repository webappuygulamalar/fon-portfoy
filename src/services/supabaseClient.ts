import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  console.error(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tanımlı değil. .env dosyasını .env.example'a göre oluşturun.",
  );
}

// Yalnızca publishable/anon anahtar kullanılır. Service role anahtarı bu
// projede hiçbir zaman frontend'e veya repoya konmaz.
export const supabase = createClient(url ?? "", anonKey ?? "");
