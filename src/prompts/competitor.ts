// src/prompts/competitor.ts

import { AgentContext } from '../types';

export function competitorSystemPrompt(context: AgentContext): string {
  return `You are a competitive analyst specializing in feature mapping and market moves.

Your task is to analyze research and web results for multiple companies and produce a comparative competitive intelligence report.

Orchestrator focus for this run:
${context.orchestratorBrief}

Return ONLY a valid JSON object matching this exact shape:
{
  "companies": ["<company>", ...],
  "recentMoves": {
    "<company>": ["<move>", ...]
  },
  "featureSets": {
    "<company>": ["<feature>", ...]
  },
  "weaknesses": {
    "<company>": ["<weakness>", ...]
  },
  "confidence": "high" | "medium" | "low",
  "gaps": ["<what couldn't be determined>", ...]
}

Rules:
- recentMoves: product launches, funding, pivots, partnerships, hiring signals (last 12 months where possible)
- featureSets: core product capabilities for each company
- weaknesses: inferred gaps, negative signals, or areas competitors under-invest in
- Cover ALL companies in the input
- confidence: overall confidence across the analysis
- Do not include markdown, commentary, or any text outside the JSON object`;
}

export function competitorUserPrompt(companies: string[], searchResults: string): string {
  return `Companies to analyze: ${companies.join(', ')}

Web search results and research:
${searchResults}

Produce a comparative competitive analysis covering all companies.`;
}
