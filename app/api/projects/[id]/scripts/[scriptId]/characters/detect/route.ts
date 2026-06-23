import { NextRequest, NextResponse } from 'next/server';
import { makeLLMConfig, llmErrorMessage, llmComplete } from '@/lib/llm';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcLLMCost } from '@/lib/usage';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; scriptId: string } }
) {
  const body = (await request.json()) as {
    scenes: Array<{ narration: string; title: string }>;
    anthropicApiKey?: string;
    xaiApiKey?: string;
    llmProvider?: 'claude' | 'grok';
  };

  const llm = makeLLMConfig(
    body.llmProvider,
    resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY'),
    resolveKey(body.xaiApiKey, 'NEXT_PUBLIC_XAI_API_KEY'),
  );
  if (!llm) return NextResponse.json({ error: llmErrorMessage(body.llmProvider ?? 'claude') }, { status: 400 });

  if (!body.scenes?.length) {
    return NextResponse.json({ characters: [] });
  }

  const fullText = body.scenes.map(s => s.narration).join('\n\n');

  const response = await llmComplete(llm, {
    claudeModel: 'claude-haiku-4-5-20251001',
    maxTokens: 512,
    system: 'You are a script analyst. Respond ONLY with valid JSON, no markdown.',
    messages: [
      {
        role: 'user',
        content: `Extract all significant fictional characters (people only) from this script — both named characters AND unnamed characters who play a meaningful role.

For unnamed characters, use the most descriptive reference used in the script (e.g. "Emeka's mother", "the old fisherman", "the mysterious stranger"). Do NOT invent a name — use exactly how they are referred to.

Include a character if they:
- Are referred to by name, OR
- Appear repeatedly or have a significant role in the story, OR
- Have any physical description or emotional significance, OR
- Drive or are affected by key story events

Exclude: places, objects, animals (unless central to the story), real historical figures, and background crowd references.

SCRIPT:
${fullText}

Return JSON: { "characters": [{ "name": "Character Name 1", "count": 7 }, { "name": "Emeka's mother", "count": 3 }, ...] }
"count" is the number of distinct scenes or narrative moments in which this character appears or is mentioned.
Return an empty array if no characters are found.`,
      },
    ],
  });

  const { cost: detectCost, api: detectApi } = calcLLMCost(llm.provider, response.inputTokens, response.outputTokens);
  void trackUsage({
    operation: 'detect-characters',
    api: detectApi,
    project_id: params.id,
    input_tokens: response.inputTokens,
    output_tokens: response.outputTokens,
    estimated_cost_usd: detectCost,
  });

  const raw = response.text || '{}';
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');

  try {
    const parsed = JSON.parse(cleaned) as { characters?: Array<{ name: string; count: number } | string> };
    const characters = (parsed.characters ?? []).map(c =>
      typeof c === 'string' ? { name: c, count: 1 } : { name: c.name, count: c.count ?? 1 }
    );
    return NextResponse.json({ characters });
  } catch {
    return NextResponse.json({ characters: [] });
  }
}
