// src/agents/content.ts
// Reasons over ResearchOutputs — no Tavily calls.
// Returns ContentOutput per company.
// Never throws — returns AgentResult<ContentOutput[]>.

import Anthropic from '@anthropic-ai/sdk';
import { contentSystemPrompt, contentUserPrompt } from '../prompts/content';
import { parseJSON } from '../lib/parseJSON';
import { addLLMUsage } from '../lib/cost';
import { AgentContext, AgentResult, ContentOutput, ResearchOutput } from '../types';

const anthropic = new Anthropic();

function researchToSummary(research: ResearchOutput): string {
  return [
    `Company: ${research.company}`,
    `Key facts:\n${research.keyFacts.map((f) => `- ${f}`).join('\n')}`,
    research.sources.length > 0
      ? `Source titles:\n${research.sources.map((s) => `- ${s.title}`).join('\n')}`
      : '',
    research.gaps.length > 0 ? `Gaps: ${research.gaps.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function runContentAgent(
  context: AgentContext,
  researchResults: ResearchOutput[]
): Promise<AgentResult<ContentOutput[]>> {
  const start = Date.now();

  try {
    const outputs: ContentOutput[] = [];

    for (const research of researchResults) {
      const summary = researchToSummary(research);

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        system: contentSystemPrompt(context),
        messages: [
          { role: 'user', content: contentUserPrompt(research.company, summary) },
        ],
      });

      addLLMUsage(`content:${research.company}`, message.usage);
      const raw = message.content[0].type === 'text' ? message.content[0].text : '';
      const parsed = parseJSON<ContentOutput>(raw);
      outputs.push(parsed);
    }

    return {
      status: 'fulfilled',
      agent: 'content',
      data: outputs,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      status: 'rejected',
      agent: 'content',
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}
