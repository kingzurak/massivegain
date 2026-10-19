/**
 * Supabase client using the SERVICE-ROLE key. It bypasses Row Level Security.
 *
 * SERVER ONLY. Import this only from Route Handlers / Server Code — never
 * from a file with "use client" or any component the browser receives.
 * The key comes from the SUPABASE_SERVICE_ROLE_KEY environment variable
 * (no NEXT_PUBLIC_ prefix, so Next.js never ships it to the browser).
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase service-role environment variables are not configured.");
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
