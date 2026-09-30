import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only. Uses the Supabase service role key, which bypasses Row Level
// Security. NEVER import this file from a "use client" component or expose
// SUPABASE_SERVICE_ROLE_KEY with a NEXT_PUBLIC_ prefix — only import it from
// route handlers under app/api/**.
let cachedClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase admin env vars: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-only, never NEXT_PUBLIC_) in your environment."
    );
  }

  cachedClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedClient;
}
