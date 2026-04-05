// src/agents/competitor.ts
// Tavily search across all companies → CompetitorOutput.
// Covers feature gaps, recent moves, weaknesses.
// Never throws — returns AgentResult<CompetitorOutput>.

import Anthropic from '@anthropic-ai/sdk';
import { tavilySearch } from '../tools/tavily';
import { competitorSystemPrompt, competitorUserPrompt } from '../prompts/competitor';
import { parseJSON } from '../lib/parseJSON';
import { addLLMUsage } from '../lib/cost';
import { AgentContext, AgentResult, CompetitorOutput, ResearchOutput } from '../types';

const anthropic = new Anthropic();

function formatSearchResults(results: { url: string; title: string; content: string }[]): string {
  return results
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`)
    .join('\n\n---\n\n');
}

function researchToSummary(research: ResearchOutput[]): string {
  return research
    .map(
      (r) =>
        `## ${r.company}\n${r.keyFacts.map((f) => `- ${f}`).join('\n')}`
    )
    .join('\n\n');
}

export async function runCompetitorAgent(
  context: AgentContext,
  researchResults: ResearchOutput[]
): Promise<AgentResult<CompetitorOutput>> {
  const start = Date.now();

  try {
    const allCompanies = [
      context.request.yourCompany,
      ...context.request.competitors,
    ];
    const depth = context.request.depth ?? 'standard';
    const focusSuffix = context.request.focus ? ` ${context.request.focus}` : '';
    const companiesQuery = allCompanies.join(' vs ');

    const [movesResults, featureResults] = await Promise.allSettled([
      tavilySearch(`${companiesQuery} product updates launch 2024 2025${focusSuffix}`, depth),
      tavilySearch(`${companiesQuery} features comparison${focusSuffix}`, depth),
    ]);

    const searchText = [
      '## Existing Research\n' + researchToSummary(researchResults),
      movesResults.status === 'fulfilled'
        ? '## Recent Moves\n' + formatSearchResults(movesResults.value.results)
        : '',
      featureResults.status === 'fulfilled'
        ? '## Feature Comparison\n' + formatSearchResults(featureResults.value.results)
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: competitorSystemPrompt(context),
      messages: [{ role: 'user', content: competitorUserPrompt(allCompanies, searchText) }],
    });

    addLLMUsage('competitor', message.usage);
    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    const parsed = parseJSON<CompetitorOutput>(raw);

    return {
      status: 'fulfilled',
      agent: 'competitor',
      data: parsed,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      status: 'rejected',
      agent: 'competitor',
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}
