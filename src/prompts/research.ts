// src/prompts/research.ts

import { AgentContext } from '../types';

export function researchSystemPrompt(context: AgentContext): string {
  return `You are a competitive intelligence research analyst.

Your task is to synthesize web search results about a company into structured intelligence.

Orchestrator focus for this run:
${context.orchestratorBrief}

Return ONLY a valid JSON object matching this exact shape:
{
  "company": "<company name>",
  "keyFacts": ["<fact>", ...],
  "confidence": "high" | "medium" | "low",
  "gaps": ["<what couldn't be determined>", ...]
}

Rules:
- keyFacts: 5-10 concise, specific facts extracted from the sources (pricing, product, funding, positioning, team size, GTM, etc.)
- confidence: "high" if sources were rich and recent; "medium" if partial; "low" if sources were sparse or old
- gaps: things you couldn't find or verify — be honest, this is used downstream
- Do not include markdown, commentary, or any text outside the JSON object`;
}

export function researchUserPrompt(company: string, searchResults: string): string {
  return `Company: ${company}

Web search results:
${searchResults}

Extract structured competitive intelligence from these results.`;
}
