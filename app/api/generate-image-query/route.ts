import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { resolveKey } from '@/lib/beta';

export async function POST(request: NextRequest) {
  const { selection, storyTopic, segmentContext, anthropicApiKey } = (await request.json()) as {
    selection: string;
    storyTopic?: string;
    segmentContext?: string;
    anthropicApiKey?: string;
  };

  if (!selection?.trim()) {
    return NextResponse.json({ error: 'selection is required' }, { status: 400 });
  }

  const apiKey = resolveKey(anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY');
  if (!apiKey) {
    // Fall back gracefully — caller should use the raw selection
    return NextResponse.json({ query: selection });
  }

  const contextParts: string[] = [];
  if (storyTopic) contextParts.push(`Story topic: ${storyTopic}`);
  if (segmentContext) contextParts.push(`Narration context: "${segmentContext}"`);

  const ai = new Anthropic({ apiKey });
  const response = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 32,
    messages: [{
      role: 'user',
      content: `Generate a precise 3-6 word image search query for the word/phrase "${selection}" specifically within the context of this story.
${contextParts.join('\n')}

The query must find images relevant to THIS specific story, not generic images of the word/phrase alone.
Return ONLY the search query — no explanation, no punctuation, no quotes.`,
    }],
  });

  const query = (response.content[0] as { text: string }).text.trim().replace(/^["']|["']$/g, '');
  return NextResponse.json({ query });
}
