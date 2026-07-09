import { NextRequest, NextResponse } from 'next/server';
import { makeLLMConfig, llmErrorMessage, llmComplete } from '@/lib/llm';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcLLMCost } from '@/lib/usage';
import type { Analysis } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = (await request.json()) as {
    analysis: Analysis;
    anthropicApiKey?: string;
    xaiApiKey?: string;
    llmProvider?: 'claude' | 'grok';
    seedTopic?: string;
    claudeModel?: string;
  };

  const llm = makeLLMConfig(
    body.llmProvider,
    resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY'),
    resolveKey(body.xaiApiKey, 'NEXT_PUBLIC_XAI_API_KEY'),
  );
  if (!llm) return NextResponse.json({ error: llmErrorMessage(body.llmProvider ?? 'claude') }, { status: 400 });

  if (!body.analysis?.id) {
    return NextResponse.json({ error: 'Analysis object required.' }, { status: 400 });
  }

  try {
    const analysis = body.analysis;

    const insights = analysis.channelInsights;
    const nature = insights.contentNature?.classification ?? 'non-fictional';

    const noPlaceholders = `Never use placeholder brackets like [Name], [Person], [Location], [Year] or similar in the topic title. Either use a real name you are confident exists, or phrase the title descriptively without a name slot (e.g. "The Victorian Servant Who Vanished" works; "The Case of [Name]" does not).`;

    const contextInstruction = nature === 'fictional'
      ? `For each topic, write a short story context (2–4 sentences) with the creative premise: the world, the central character or conflict, the dramatic question, and the emotional arc. Invent freely — specific names, places, and details are encouraged. ${noPlaceholders}`
      : nature === 'mixed'
      ? `For each topic, indicate whether it is fictional or based on real events. For real-world topics, use real documented names and cases you are confident about; describe the situation and note the writer must verify all facts. For fictional topics, invent freely. ${noPlaceholders}`
      : `For each topic, use a real documented case, person, or event you are confident about — this channel's format is built around real named subjects. Include the real name in the topic title when you know it. In the context field, describe the real situation in broad strokes (what happened, what makes it compelling) and note that the writer must verify all details independently. If you are not confident of a real name for a particular angle, phrase the title descriptively instead of using a placeholder. ${noPlaceholders}

RESEARCH DEPTH REQUIREMENT (strictly enforced): Every suggested topic must have sufficient publicly documented record to support a 20–30 minute deep-dive script. Before finalising each topic, mentally verify: Are there multiple named sources (books, court records, journalism, documentaries, academic papers)? Are the key facts — dates, locations, people, sequence of events, investigation details — well established in the public record? Is there enough documented complexity (motive, investigation, trial, psychological profile, or systemic failure) to sustain extended narrative analysis? If the answer to any of these is "uncertain" or "no", replace the topic with one that clears all three. Do NOT suggest obscure cases where the documented record is thin, disputed without resolution, or relies on a single source.`;

    const pillars = insights.contentPillars ?? [];
    const formulas = insights.titleFormulas ?? [];
    const analyzedTitles = analysis.videoAnalyses.map(v => v.videoTitle).filter(Boolean);
    const analyzedSubjects = analysis.videoAnalyses.map(v => v.channelName ?? '').filter(Boolean);

    // Include full transcripts so the model understands the channel's narrative depth,
    // writing weight, and the complexity of stories it actually covers — not just strategy metadata.
    const transcriptSamples = analysis.videoAnalyses
      .filter(v => v.fullTranscript || v.transcriptHook || v.transcriptExcerpt)
      .slice(0, 3)
      .map((v, i) => {
        const text = v.fullTranscript
          || [v.transcriptHook, v.transcriptExcerpt, v.transcriptClimax, v.transcriptOutro]
               .filter(Boolean).join('\n\n');
        return `--- TRANSCRIPT ${i + 1}: "${v.videoTitle}" ---\n${text}`;
      })
      .join('\n\n');

    const channelContext = `Channel: ${analysis.channelName}
Content nature: ${nature}${insights.contentNature?.reasoning ? ` (${insights.contentNature.reasoning})` : ''}
Content pillars (${pillars.length} total — each topic suggestion must map to one of these):
${pillars.map((p, i) => `  ${i + 1}. ${p}`).join('\n')}
Title formulas (${formulas.length} total — vary which formula you use per topic):
${formulas.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}
Unique value proposition: ${insights.uniqueValueProposition ?? 'N/A'}
Audience: ${insights.audienceProfile?.demographics ?? 'N/A'}
Audience pain points: ${insights.audienceProfile?.painPoints?.join(', ') ?? 'N/A'}
Patterns to replicate: ${insights.thingsToSteal?.slice(0, 3).join(', ') ?? 'N/A'}
${analyzedTitles.length > 0 ? `\nALREADY COVERED — do NOT suggest these or any disguised variation of them:\n${analyzedTitles.map(t => `  - ${t}`).join('\n')}` : ''}
${transcriptSamples ? `\nNARRATIVE DEPTH REFERENCE — these are actual transcript excerpts from this channel's videos. Study them to understand the level of psychological depth, investigative detail, systemic analysis, and narrative weight this channel brings to its subjects. Every suggested topic must have enough documented complexity to sustain this same depth across a full 20–30 minute script:\n\n${transcriptSamples}` : ''}`;

    const prompt = body.seedTopic?.trim()
      ? `You are a YouTube video strategist. The user wants to make a video about: "${body.seedTopic}".

Using this channel's proven title formulas and content style, generate 8 compelling video topic variations of their idea — different angles, framings, or scopes that would perform well on this channel. Each should feel distinct from the others.

${channelContext}

${contextInstruction}

Respond with a raw JSON array only. No markdown, no code fences, no explanation.
[{"topic": "...", "context": "...", "isFactual": ${nature !== 'fictional'}}, ...]`
      : `You are a YouTube video strategist. Based on the following channel analysis, suggest 10 compelling video topic ideas that would perform well on this channel.

${channelContext}

DIVERSITY REQUIREMENT — strictly enforced:
- The "ALREADY COVERED" list above contains the specific cases this channel has analyzed. Do NOT suggest those cases or any topic that is essentially the same case under a different title or angle. Draw entirely from your own knowledge of real documented cases NOT in that list.
- Each topic must be a completely different underlying story with a different subject, crime type, geography, and time period. Not the same archetype reframed.
- Distribute topics across ALL content pillars. If there are 3 pillars, spread the 10 topics roughly evenly across them.
- Use a different title formula for each topic. Do not reuse the same structural pattern more than twice.
- Vary every dimension independently: perpetrator type, victim context, time period (span at least 3 different decades), geography (span at least 3 different countries or regions), investigative angle (caught vs unsolved vs exonerated vs systemic failure).
- Before finalising, scan all 10: if any two share the same perpetrator archetype AND crime type AND setting, replace one. If any topic is a thin variation of a case in the ALREADY COVERED list, replace it.

${contextInstruction}

Respond with a raw JSON array only. No markdown, no code fences, no explanation.
[{"topic": "...", "context": "...", "isFactual": ${nature !== 'fictional'}}, ...]`;

    const response = await llmComplete(llm, {
      claudeModel: body.claudeModel ?? 'claude-opus-4-8',
      maxTokens: 4096,
      system: 'You are a JSON API. Always respond with valid raw JSON only. Never use markdown or code fences.',
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.text.trim();
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const arrayMatch = stripped.match(/\[[\s\S]*\]/);
    const raw = arrayMatch ? arrayMatch[0] : stripped;

    const suggestions = JSON.parse(raw) as { topic: string; context: string; isFactual: boolean }[];

    const { cost: topicsCost, api: topicsApi } = calcLLMCost(llm.provider, response.inputTokens, response.outputTokens);
    void trackUsage({
      operation: 'suggest-topics',
      api: topicsApi,
      project_id: params.id,
      input_tokens: response.inputTokens,
      output_tokens: response.outputTokens,
      estimated_cost_usd: topicsCost,
    });

    return NextResponse.json({ suggestions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[suggest-topics]', message);
    // Surface Anthropic API errors directly (auth, rate limit, etc.)
    if (message.includes('parse') || message.includes('JSON')) {
      return NextResponse.json({ error: 'Model returned unexpected output. Try again.' }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
