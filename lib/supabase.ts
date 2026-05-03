import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
// Server-side: service role key bypasses RLS; falls back to anon key
const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
// Client-side (browser): always use anon key
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';

// Server-only singleton — for API routes
let _server: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (!url || !serverKey) return null;
  if (!_server) _server = createClient(url, serverKey, { auth: { persistSession: false } });
  return _server;
}

// Browser singleton — for auth in client components
let _browser: SupabaseClient | null = null;
export function getBrowserSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;
  if (!url || !anonKey) return null;
  if (!_browser) _browser = createClient(url, anonKey);
  return _browser;
}
