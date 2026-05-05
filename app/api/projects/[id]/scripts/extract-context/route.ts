import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcAnthropicCost } from '@/lib/usage';

export const maxDuration = 60;

const MAX_CHARS_PER_URL = 20000;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function wikipediaTitle(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith('wikipedia.org')) return null;
    const m = u.pathname.match(/^\/wiki\/(.+)/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}

async function fetchWikipedia(title: string): Promise<string> {
  const headers = {
    'User-Agent': 'YTAnalyzer/1.0 (https://github.com/ytanalyzer; context-extraction-bot)',
    'Api-User-Agent': 'YTAnalyzer/1.0 (context-extraction-bot)',
    'Accept': 'application/json',
  };

  // Try REST v1 page summary + sections (designed for third-party app use, more lenient limits)
  const summaryRes = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    { headers, signal: AbortSignal.timeout(10000) }
  );
  if (!summaryRes.ok) throw new Error(`Wikipedia error ${summaryRes.status}`);
  const summary = await summaryRes.json() as { extract?: string; title?: string };
  const summaryText = summary.extract ?? '';

  // Also fetch full mobile sections for more detail
  const sectionsRes = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/mobile-sections/${encodeURIComponent(title)}`,
    { headers, signal: AbortSignal.timeout(10000) }
  );
  let sectionsText = '';
  if (sectionsRes.ok) {
    const sections = await sectionsRes.json() as { lead?: { sections?: { text?: string }[] }; remaining?: { sections?: { text?: string; line?: string }[] } };
    const parts: string[] = [];
    for (const s of sections.lead?.sections ?? []) {
      if (s.text) parts.push(stripHtml(s.text));
    }
    for (const s of (sections.remaining?.sections ?? []).slice(0, 6)) {
      if (s.text) parts.push((s.line ? `${s.line}: ` : '') + stripHtml(s.text));
    }
    sectionsText = parts.join('\n\n');
  }

  const combined = [summaryText, sectionsText].filter(Boolean).join('\n\n');
  if (!combined) throw new Error('Wikipedia article not found or has no content');
  return combined.slice(0, MAX_CHARS_PER_URL);
}

async function fetchPageText(url: string): Promise<string> {
  const wikiTitle = wikipediaTitle(url);
  if (wikiTitle) return fetchWikipedia(wikiTitle);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const html = await res.text();
  return stripHtml(html).slice(0, MAX_CHARS_PER_URL);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = (await request.json()) as {
    urls: string[];
    topic?: string;
    anthropicApiKey?: string;
  };

  const anthropicApiKey = resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    return NextResponse.json({ error: 'Anthropic API key required.' }, { status: 400 });
  }
  if (!body.urls?.length) {
    return NextResponse.json({ error: 'At least one URL is required.' }, { status: 400 });
  }

  // Fetch all pages in parallel
  const pageResults = await Promise.allSettled(body.urls.map(fetchPageText));
  const pages = pageResults.map((r, i) => ({
    url: body.urls[i],
    text: r.status === 'fulfilled' ? r.value : null,
    error: r.status === 'rejected' ? (r as PromiseRejectedResult).reason?.message : null,
  }));

  const failed = pages.filter(p => p.error);
  const succeeded = pages.filter(p => p.text);

  if (succeeded.length === 0) {
    const errors = failed.map(p => `• ${p.url}: ${p.error}`).join('\n');
    return NextResponse.json({ error: `Could not fetch any of the provided URLs:\n${errors}` }, { status: 400 });
  }

  const pagesBlock = succeeded
    .map((p, i) => `--- SOURCE ${i + 1}: ${p.url} ---\n${p.text}`)
    .join('\n\n');

  const ai = new Anthropic({ apiKey: anthropicApiKey });
  const response = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are helping prepare context for a YouTube scriptwriter.
${body.topic ? `The video topic is: "${body.topic}"\n` : ''}
Extract all factually useful details from the sources below that a scriptwriter would need: names, dates, locations, sequence of events, quotes, outcomes, statistics, and any other specific details. Be thorough and specific — don't generalise. Write as a dense factual summary in plain prose (no bullet points, no headers). Aim for 150–400 words.

${pagesBlock}

Return ONLY the extracted context, nothing else.`,
    }],
  });

  const model = 'claude-haiku-4-5-20251001';
  void trackUsage({
    operation: 'extract-context',
    api: 'anthropic',
    project_id: params.id,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    estimated_cost_usd: calcAnthropicCost(response.usage.input_tokens, response.usage.output_tokens, model),
  });

  const context = (response.content[0] as { type: string; text: string }).text.trim();
  const warnings = failed.length
    ? failed.map(p => `${p.url}: ${p.error}`)
    : undefined;
  return NextResponse.json({ context, warnings });
}
