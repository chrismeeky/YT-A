import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

const DEFAULT_LIMIT = 20;

export async function GET(request: NextRequest) {
  const db = getSupabase();
  if (!db) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const since  = searchParams.get('since');
  const userId = searchParams.get('userId');
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit  = Math.min(100, Math.max(5, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)));
  const from   = (page - 1) * limit;
  const to     = from + limit - 1;

  // Paginated full entries for the log
  let entryQ = db
    .from('api_usage')
    .select('*', { count: 'exact' })
    .order('timestamp', { ascending: false })
    .range(from, to);
  if (since)  entryQ = entryQ.gte('timestamp', since);
  if (userId) entryQ = entryQ.eq('user_id', userId);
  const { data: entries, error: entryErr, count } = await entryQ;
  if (entryErr) return NextResponse.json({ error: entryErr.message }, { status: 500 });

  // Lightweight aggregate rows for summary cards (all rows, fewer columns)
  let aggQ = db
    .from('api_usage')
    .select('api, operation, estimated_cost_usd, input_tokens, output_tokens, characters, quota_units, requests, key_fingerprint');
  if (since)  aggQ = aggQ.gte('timestamp', since);
  if (userId) aggQ = aggQ.eq('user_id', userId);
  const { data: allRows, error: aggErr } = await aggQ;
  if (aggErr) return NextResponse.json({ error: aggErr.message }, { status: 500 });

  return NextResponse.json({ entries: entries ?? [], total: count ?? 0, allRows: allRows ?? [] });
}
