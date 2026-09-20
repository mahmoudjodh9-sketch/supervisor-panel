import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the SECRET key.
 * This file must never be imported from a "use client" component —
 * it is only ever called from Server Components / Route Handlers,
 * so the secret key never reaches the browser.
 */
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secretKey = process.env.SUPABASE_SECRET_KEY!;

  return createSupabaseClient(url, secretKey, {
    auth: { persistSession: false },
  });
}
