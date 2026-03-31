// src/agents/research.ts
// Tavily search per company → structured ResearchOutput.
// Never throws — returns AgentResult<ResearchOutput>.

import Anthropic from '@anthropic-ai/sdk';
import { tavilySearch } from '../tools/tavily';
import { researchSystemPrompt, researchUserPrompt } from '../prompts/research';
import { parseJSON } from '../lib/parseJSON';
import { AgentContext, AgentResult, ResearchOutput } from '../types';

const anthropic = new Anthropic();

function formatSearchResults(results: { url: string; title: string; content: string }[]): string {
  return results
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`)
    .join('\n\n---\n\n');
}

export async function runResearchAgent(
  company: string,
  context: AgentContext
): Promise<AgentResult<ResearchOutput>> {
  const start = Date.now();
  const agentName = `research:${company}`;

  try {
    const depth = context.request.depth ?? 'standard';
    const focusSuffix = context.request.focus ? ` ${context.request.focus}` : '';

    const [generalResults, productResults] = await Promise.allSettled([
      tavilySearch(`${company} company overview positioning product${focusSuffix}`, depth),
      tavilySearch(`${company} pricing features customers competitors${focusSuffix}`, depth),
    ]);

    const allResults = [
      ...(generalResults.status === 'fulfilled' ? generalResults.value.results : []),
      ...(productResults.status === 'fulfilled' ? productResults.value.results : []),
    ];

    if (allResults.length === 0) {
      return {
        status: 'rejected',
        agent: agentName,
        error: 'Tavily returned no results for this company',
        durationMs: Date.now() - start,
      };
    }

    const searchText = formatSearchResults(allResults);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: researchSystemPrompt(context),
      messages: [{ role: 'user', content: researchUserPrompt(company, searchText) }],
    });

    console.log(`[research:${company}] tokens:`, message.usage);
    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    const parsed = parseJSON<Omit<ResearchOutput, 'sources'>>(raw);

    const output: ResearchOutput = {
      ...parsed,
      sources: allResults.map((r) => ({
        url: r.url,
        title: r.title,
        summary: r.content.slice(0, 300),
      })),
    };

    return {
      status: 'fulfilled',
      agent: agentName,
      data: output,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      status: 'rejected',
      agent: agentName,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}
