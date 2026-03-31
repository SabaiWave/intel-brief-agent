// src/agents/positioning.ts
// Reasons over ResearchOutputs — no Tavily calls.
// Returns PositioningOutput per company (your company + each competitor).
// Never throws — returns AgentResult<PositioningOutput[]>.

import Anthropic from '@anthropic-ai/sdk';
import { positioningSystemPrompt, positioningUserPrompt } from '../prompts/positioning';
import { parseJSON } from '../lib/parseJSON';
import { AgentContext, AgentResult, PositioningOutput, ResearchOutput } from '../types';

const anthropic = new Anthropic();

function researchToSummary(research: ResearchOutput): string {
  return [
    `Company: ${research.company}`,
    `Key facts:\n${research.keyFacts.map((f) => `- ${f}`).join('\n')}`,
    research.gaps.length > 0 ? `Gaps: ${research.gaps.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function runPositioningAgent(
  context: AgentContext,
  researchResults: ResearchOutput[]
): Promise<AgentResult<PositioningOutput[]>> {
  const start = Date.now();

  try {
    const outputs: PositioningOutput[] = [];

    for (const research of researchResults) {
      const summary = researchToSummary(research);

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: positioningSystemPrompt(context),
        messages: [
          { role: 'user', content: positioningUserPrompt(research.company, summary) },
        ],
      });

      console.log(`[positioning:${research.company}] tokens:`, message.usage);
      const raw = message.content[0].type === 'text' ? message.content[0].text : '';
      const parsed = parseJSON<PositioningOutput>(raw);
      outputs.push(parsed);
    }

    return {
      status: 'fulfilled',
      agent: 'positioning',
      data: outputs,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      status: 'rejected',
      agent: 'positioning',
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}
