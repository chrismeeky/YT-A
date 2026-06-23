import { NextRequest, NextResponse } from 'next/server';
import { makeLLMConfig, llmComplete } from '@/lib/llm';
import { resolveKey } from '@/lib/beta';

export async function POST(request: NextRequest) {
  const { selection, storyTopic, segmentContext, anthropicApiKey, xaiApiKey, llmProvider } = (await request.json()) as {
    selection: string;
    storyTopic?: string;
    segmentContext?: string;
    anthropicApiKey?: string;
    xaiApiKey?: string;
    llmProvider?: 'claude' | 'grok';
  };

  if (!selection?.trim()) {
    return NextResponse.json({ error: 'selection is required' }, { status: 400 });
  }

  const llm = makeLLMConfig(
    llmProvider,
    resolveKey(anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY'),
    resolveKey(xaiApiKey, 'NEXT_PUBLIC_XAI_API_KEY'),
  );
  if (!llm) {
    // Fall back gracefully — caller should use the raw selection
    return NextResponse.json({ query: selection });
  }

  const contextParts: string[] = [];
  if (storyTopic) contextParts.push(`Story topic: ${storyTopic}`);
  if (segmentContext) contextParts.push(`Narration context: "${segmentContext}"`);

  const result = await llmComplete(llm, {
    claudeModel: 'claude-haiku-4-5-20251001',
    maxTokens: 32,
    messages: [{
      role: 'user',
      content: `Generate a precise 3-6 word image search query for the word/phrase "${selection}" specifically within the context of this story.
${contextParts.join('\n')}

The query must find images relevant to THIS specific story, not generic images of the word/phrase alone.
Return ONLY the search query — no explanation, no punctuation, no quotes.`,
    }],
  });

  const query = result.text.trim().replace(/^["']|["']$/g, '');
  return NextResponse.json({ query });
}
