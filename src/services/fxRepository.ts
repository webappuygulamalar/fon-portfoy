import { supabase } from "./supabaseClient";
import type { FxRateRow } from "./types";

export async function getLatestFxRate(currency: string): Promise<FxRateRow | null> {
  const { data, error } = await supabase
    .from("fx_rates")
    .select("*")
    .eq("currency", currency)
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
