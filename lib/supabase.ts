import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase env vars: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) in .env.local"
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export type EscrowStatus =
  | "PENDING_PAYMENT"
  | "HELD_IN_ESCROW"
  | "DISPATCHED"
  | "FUNDS_RELEASED"
  | "DISPUTED";

export type EscrowOrder = {
  id: string;
  item_title: string;
  amount: number;
  delivery_fee: number;
  seller_name: string;
  seller_phone: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  status: EscrowStatus;
  created_at: string;
};
