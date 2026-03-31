// src/prompts/content.ts

import { AgentContext } from '../types';

export function contentSystemPrompt(context: AgentContext): string {
  return `You are a content strategy and SEO analyst.

Your task is to analyze research outputs and identify content strategy signals, SEO opportunities, and channel presence for a single company.

Orchestrator focus for this run:
${context.orchestratorBrief}

Return ONLY a valid JSON object matching this exact shape:
{
  "company": "<company name>",
  "topTopics": ["<topic>", ...],
  "seoSignals": ["<SEO signal>", ...],
  "contentGaps": ["<content gap>", ...],
  "channelPresence": ["<channel>", ...],
  "confidence": "high" | "medium" | "low",
  "gaps": ["<what couldn't be determined>", ...]
}

Rules:
- topTopics: 4-8 themes this company's content focuses on (blog, docs, case studies, etc.)
- seoSignals: keyword domains, SEO moats, or content volume signals evident in research
- contentGaps: topics or formats they appear to under-invest in — these are opportunities
- channelPresence: where they have active presence (blog, LinkedIn, YouTube, podcast, community, etc.)
- confidence: based on richness of research data provided
- Do not include markdown, commentary, or any text outside the JSON object`;
}

export function contentUserPrompt(company: string, researchSummary: string): string {
  return `Company: ${company}

Research intelligence:
${researchSummary}

Analyze the content strategy and SEO signals for this company.`;
}
