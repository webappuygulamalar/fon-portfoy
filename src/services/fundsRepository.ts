import { supabase } from "./supabaseClient";
import type { FundPriceRow, FundReturnsRow, FundRow } from "./types";

export async function listFunds(): Promise<FundRow[]> {
  const { data, error } = await supabase.from("funds").select("*").order("code");
  if (error) throw error;
  return data;
}

export async function listActiveFunds(): Promise<FundRow[]> {
  const { data, error } = await supabase
    .from("funds")
    .select("*")
    .eq("is_active", true)
    .order("code");
  if (error) throw error;
  return data;
}

export async function getLatestPrices(): Promise<FundPriceRow[]> {
  const { data, error } = await supabase.from("fund_latest_price").select("*");
  if (error) throw error;
  return data;
}

export async function getLatestPriceForFund(fundId: string): Promise<FundPriceRow | null> {
  const { data, error } = await supabase
    .from("fund_latest_price")
    .select("*")
    .eq("fund_id", fundId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getFundReturns(): Promise<FundReturnsRow[]> {
  const { data, error } = await supabase.from("fund_returns").select("*");
  if (error) throw error;
  return data;
}

export interface UpsertFundInput {
  id?: string;
  code: string;
  name: string;
  management_company: string;
  asset_class: FundRow["asset_class"];
  fund_type: string | null;
  currency: string;
  tefas_fetch_code: string;
  is_active: boolean;
  verification_needed: boolean;
  verification_note: string | null;
}

export async function upsertFund(input: UpsertFundInput): Promise<FundRow> {
  const { data, error } = await supabase.from("funds").upsert(input).select().single();
  if (error) throw error;
  return data;
}

export async function insertManualPrice(input: {
  fund_id: string;
  price_date: string;
  currency: string;
  price: number;
  note: string;
}): Promise<void> {
  const { error } = await supabase.from("fund_prices").upsert(
    {
      fund_id: input.fund_id,
      price_date: input.price_date,
      currency: input.currency,
      price: input.price,
      source: "MANUAL",
      note: input.note,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "fund_id,price_date,currency" },
  );
  if (error) throw error;
}
