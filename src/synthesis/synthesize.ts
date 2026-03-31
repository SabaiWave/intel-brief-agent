// src/synthesis/synthesize.ts
// Two-step synthesis:
//   Step A: Analysis LLM call — patterns, gaps, opportunities
//   Step B: Brief assembly LLM call — structured Markdown brief
// Never throws — returns a result envelope.

import Anthropic from '@anthropic-ai/sdk';
import { analysisSystemPrompt, analysisUserPrompt, briefSystemPrompt, briefUserPrompt } from '../prompts/synthesis';
import { parseJSON } from '../lib/parseJSON';
import {
  AgentContext,
  AgentResult,
  AnalysisOutput,
  BriefingOutput,
  CompetitorOutput,
  ContentOutput,
  PositioningOutput,
  ResearchOutput,
} from '../types';

const anthropic = new Anthropic();

interface SynthesisResult {
  analysisResult: AnalysisOutput | null;
  briefResult: AgentResult<BriefingOutput>;
}

function buildAgentSummary(allResults: AgentResult<unknown>[]): string {
  const sections: string[] = [];

  for (const result of allResults) {
    if (result.status !== 'fulfilled' || !result.data) {
      sections.push(`## ${result.agent} — FAILED\nError: ${result.error ?? 'unknown'}`);
      continue;
    }

    const data = result.data;

    if (result.agent.startsWith('research:')) {
      const r = data as ResearchOutput;
      sections.push(
        `## Research: ${r.company}\n` +
        `Key facts:\n${r.keyFacts.map((f) => `- ${f}`).join('\n')}\n` +
        `Confidence: ${r.confidence}\n` +
        (r.gaps.length > 0 ? `Gaps: ${r.gaps.join(', ')}` : '')
      );
    } else if (result.agent === 'positioning') {
      const items = data as PositioningOutput[];
      for (const p of items) {
        sections.push(
          `## Positioning: ${p.company}\n` +
          `Value props: ${p.valueProps.join(', ')}\n` +
          `Target audience: ${p.targetAudience}\n` +
          `Pricing signals: ${p.pricingSignals.join(', ')}\n` +
          `Tone: ${p.messagingTone}\n` +
          `Differentiators: ${p.differentiators.join(', ')}\n` +
          `Confidence: ${p.confidence}`
        );
      }
    } else if (result.agent === 'competitor') {
      const c = data as CompetitorOutput;
      sections.push(
        `## Competitor Analysis\n` +
        `Companies: ${c.companies.join(', ')}\n` +
        Object.entries(c.recentMoves)
          .map(([co, moves]) => `${co} recent moves: ${moves.join(', ')}`)
          .join('\n') +
        '\n' +
        Object.entries(c.featureSets)
          .map(([co, features]) => `${co} features: ${features.join(', ')}`)
          .join('\n') +
        '\n' +
        Object.entries(c.weaknesses)
          .map(([co, weak]) => `${co} weaknesses: ${weak.join(', ')}`)
          .join('\n') +
        `\nConfidence: ${c.confidence}`
      );
    } else if (result.agent === 'content') {
      const items = data as ContentOutput[];
      for (const ct of items) {
        sections.push(
          `## Content: ${ct.company}\n` +
          `Top topics: ${ct.topTopics.join(', ')}\n` +
          `SEO signals: ${ct.seoSignals.join(', ')}\n` +
          `Content gaps: ${ct.contentGaps.join(', ')}\n` +
          `Channel presence: ${ct.channelPresence.join(', ')}\n` +
          `Confidence: ${ct.confidence}`
        );
      }
    }
  }

  return sections.join('\n\n');
}

export async function synthesize(
  context: AgentContext,
  allResults: AgentResult<unknown>[],
  agentStatuses: Record<string, 'fulfilled' | 'rejected'>
): Promise<SynthesisResult> {
  const agentSummary = buildAgentSummary(allResults);

  // ── Step A: Analysis ───────────────────────────────────────────────────────
  let analysisOutput: AnalysisOutput | null = null;

  try {
    const analysisMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: analysisSystemPrompt(context),
      messages: [{ role: 'user', content: analysisUserPrompt(agentSummary) }],
    });

    const raw = analysisMessage.content[0].type === 'text' ? analysisMessage.content[0].text : '';
    analysisOutput = parseJSON<AnalysisOutput>(raw);
  } catch {
    // Analysis failed — proceed to brief without it
    analysisOutput = null;
  }

  // ── Step B: Brief Assembly ─────────────────────────────────────────────────
  const start = Date.now();

  try {
    const briefMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: briefSystemPrompt(context),
      messages: [
        {
          role: 'user',
          content: briefUserPrompt(
            analysisOutput ?? {
              positioningGaps: [],
              opportunities: [],
              threats: [],
              patterns: [],
              strengthsByCompany: {},
              weaknessesByCompany: {},
            },
            agentSummary
          ),
        },
      ],
    });

    const raw = briefMessage.content[0].type === 'text' ? briefMessage.content[0].text : '';
    const parsed = parseJSON<Omit<BriefingOutput, 'request' | 'metadata'>>(raw);

    const failedAgents = Object.entries(agentStatuses)
      .filter(([, s]) => s === 'rejected')
      .map(([name]) => name);

    const output: BriefingOutput = {
      ...parsed,
      request: context.request,
      metadata: {
        generatedAt: new Date().toISOString(),
        agentStatuses,
        overallConfidence: failedAgents.length === 0 ? 'high' : failedAgents.length <= 2 ? 'medium' : 'low',
        degraded: failedAgents.length > 0,
        degradedAgents: failedAgents.length > 0 ? failedAgents : undefined,
      },
    };

    return {
      analysisResult: analysisOutput,
      briefResult: {
        status: 'fulfilled',
        agent: 'synthesis',
        data: output,
        durationMs: Date.now() - start,
      },
    };
  } catch (err) {
    return {
      analysisResult: analysisOutput,
      briefResult: {
        status: 'rejected',
        agent: 'synthesis',
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      },
    };
  }
}
