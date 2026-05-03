import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const db = getSupabase();
  if (!db) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const since = searchParams.get('since');
  const userId = searchParams.get('userId');

  let query = db
    .from('api_usage')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(500);

  if (since) query = query.gte('timestamp', since);
  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ entries: data ?? [] });
}
