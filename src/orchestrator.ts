// src/orchestrator.ts
// Entry point for the pipeline.
// Parses BriefingRequest, generates per-agent dynamic brief via LLM,
// dispatches all agents in parallel with Promise.allSettled,
// then hands off to synthesis.
// Yields SSEEvent via async generator so the API route can stream.

import Anthropic from '@anthropic-ai/sdk';
import { orchestratorPrompt } from './prompts/orchestrator';
import { parseJSON } from './lib/parseJSON';
import { isDryRun, runDryOrchestrator } from './lib/dryRun';
import { runResearchAgent } from './agents/research';
import { runPositioningAgent } from './agents/positioning';
import { runCompetitorAgent } from './agents/competitor';
import { runContentAgent } from './agents/content';
import { synthesize } from './synthesis/synthesize';
import {
  AgentContext,
  AgentResult,
  BriefingRequest,
  ResearchOutput,
  SSEEvent,
} from './types';

const anthropic = new Anthropic();

interface OrchestratorBriefs {
  research: string;
  positioning: string;
  competitor: string;
  content: string;
  synthesis: string;
}

async function generateAgentBriefs(request: BriefingRequest): Promise<OrchestratorBriefs> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: orchestratorPrompt(request) }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}';
  try {
    return parseJSON<OrchestratorBriefs>(raw);
  } catch {
    // Fallback brief if LLM returns malformed JSON
    const fallback = `Analyze ${request.yourCompany} vs ${request.competitors.join(', ')}.${request.focus ? ` Focus: ${request.focus}.` : ''}`;
    return {
      research: fallback,
      positioning: fallback,
      competitor: fallback,
      content: fallback,
      synthesis: fallback,
    };
  }
}

function makeContext(request: BriefingRequest, brief: string): AgentContext {
  return { request, orchestratorBrief: brief };
}

export async function* runOrchestrator(
  request: BriefingRequest
): AsyncGenerator<SSEEvent> {
  if (isDryRun) {
    yield* runDryOrchestrator(request);
    return;
  }
  // ── Step 1: Generate per-agent briefs ─────────────────────────────────────
  const briefs = await generateAgentBriefs(request);

  const allCompanies = [request.yourCompany, ...request.competitors];

  // ── Step 2: Announce all agents as running ─────────────────────────────────
  for (const company of allCompanies) {
    yield { type: 'status', agent: `research:${company}`, status: 'running' };
  }
  yield { type: 'status', agent: 'competitor', status: 'running' };

  // ── Step 3: Parallel research (one per company) ────────────────────────────
  const researchContext = makeContext(request, briefs.research);
  const researchPromises = allCompanies.map((company) =>
    runResearchAgent(company, researchContext)
  );

  // Competitor uses its own brief but also needs research results — run in parallel
  // but we'll collect research first since positioning/content depend on it.
  const researchSettled = await Promise.allSettled(researchPromises);

  const researchResults: ResearchOutput[] = [];
  const agentStatuses: Record<string, 'fulfilled' | 'rejected'> = {};

  for (const settled of researchSettled) {
    if (settled.status === 'fulfilled') {
      const result = settled.value;
      agentStatuses[result.agent] = result.status;
      yield {
        type: 'status',
        agent: result.agent,
        status: result.status === 'fulfilled' ? 'complete' : 'failed',
        confidence: result.data?.confidence,
        durationMs: result.durationMs,
      };
      if (result.status === 'fulfilled' && result.data) {
        researchResults.push(result.data);
      }
    } else {
      // Promise itself rejected (shouldn't happen — agents catch internally)
      yield { type: 'status', agent: 'research:unknown', status: 'failed' };
    }
  }

  // ── Step 4: Parallel secondary agents (depend on research) ─────────────────
  yield { type: 'status', agent: 'positioning', status: 'running' };
  yield { type: 'status', agent: 'content', status: 'running' };

  const positioningContext = makeContext(request, briefs.positioning);
  const competitorContext = makeContext(request, briefs.competitor);
  const contentContext = makeContext(request, briefs.content);

  const [positioningResult, competitorResult, contentResult] = await Promise.allSettled([
    runPositioningAgent(positioningContext, researchResults),
    runCompetitorAgent(competitorContext, researchResults),
    runContentAgent(contentContext, researchResults),
  ]);

  const secondaryResults: AgentResult<unknown>[] = [];

  for (const [settled, fallbackName] of [
    [positioningResult, 'positioning'],
    [competitorResult, 'competitor'],
    [contentResult, 'content'],
  ] as [PromiseSettledResult<AgentResult<unknown>>, string][]) {
    if (settled.status === 'fulfilled') {
      const result = settled.value;
      agentStatuses[result.agent] = result.status;
      yield {
        type: 'status',
        agent: result.agent,
        status: result.status === 'fulfilled' ? 'complete' : 'failed',
        durationMs: result.durationMs,
      };
      secondaryResults.push(result);
    } else {
      agentStatuses[fallbackName] = 'rejected';
      yield { type: 'status', agent: fallbackName, status: 'failed' };
    }
  }

  // ── Step 5: Synthesis ──────────────────────────────────────────────────────
  yield { type: 'status', agent: 'analysis', status: 'running' };
  yield { type: 'status', agent: 'synthesis', status: 'running' };

  const synthesisContext = makeContext(request, briefs.synthesis);

  const allResults: AgentResult<unknown>[] = [
    ...researchSettled
      .filter((s): s is PromiseFulfilledResult<AgentResult<ResearchOutput>> => s.status === 'fulfilled')
      .map((s) => s.value as AgentResult<unknown>),
    ...secondaryResults,
  ];

  const synthesisResult = await synthesize(synthesisContext, allResults, agentStatuses);

  if (synthesisResult.analysisResult) {
    yield { type: 'analysis', data: synthesisResult.analysisResult };
    yield { type: 'status', agent: 'analysis', status: 'complete' };
  } else {
    yield { type: 'status', agent: 'analysis', status: 'failed' };
  }

  if (synthesisResult.briefResult.status === 'fulfilled' && synthesisResult.briefResult.data) {
    yield { type: 'status', agent: 'synthesis', status: 'complete' };
    yield { type: 'complete', brief: synthesisResult.briefResult.data };
  } else {
    yield { type: 'status', agent: 'synthesis', status: 'failed' };
    yield {
      type: 'error',
      message: synthesisResult.briefResult.error ?? 'Synthesis failed',
    };
  }
}
