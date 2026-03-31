// src/prompts/orchestrator.ts
// Generates per-agent dynamic brief instructions tailored to the user's query.

import { BriefingRequest } from '../types';

export function orchestratorPrompt(request: BriefingRequest): string {
  const competitors = request.competitors.join(', ');
  const focus = request.focus
    ? `The user's specific research focus is: "${request.focus}". Tailor each agent's instructions toward this focus.`
    : 'No specific focus was provided — produce a balanced competitive overview.';

  return `You are the orchestrator for a competitive intelligence pipeline.

A user has requested a competitive brief with the following inputs:
- Their company: ${request.yourCompany}
- Competitors: ${competitors}
- Depth: ${request.depth ?? 'standard'}
- ${focus}

Your task: generate a concise, tailored instruction brief for each of the following agents. These briefs will be injected into each agent's system prompt to focus their analysis.

Return a JSON object with exactly these keys:
{
  "research": "...",
  "positioning": "...",
  "competitor": "...",
  "content": "...",
  "synthesis": "..."
}

Guidelines per agent:
- research: What to prioritize when gathering raw intelligence about each company (e.g., funding, product, go-to-market, team, pricing).
- positioning: What messaging and positioning angles matter most given the focus.
- competitor: What feature gaps, product moves, or strategic signals to watch for.
- content: What SEO topics, content types, or channel gaps are most relevant.
- synthesis: What the final brief should emphasize — what conclusions would be most actionable for the user.

Keep each instruction to 2-4 sentences. Be specific to the companies and focus provided.`;
}
