# CLAUDE.md — ScoutWork

## Project Identity
- **Product:** ScoutWork
- **Tagline:** Competitive intelligence, on demand.

## What This Does
User submits their company + up to 3 competitors + optional research focus.
Multi-agent orchestration fires parallel agents, collects structured outputs,
runs a two-step synthesis (analysis → brief assembly), and streams status updates
to the UI in real time via Server-Sent Events (SSE).

Final output: a structured competitive intelligence brief in Markdown,
displayed in the UI and downloadable as PDF.

---

## Architecture

```
├── app/
│   ├── api/brief/route.ts          # SSE streaming endpoint → calls orchestrator
│   ├── layout.tsx
│   └── page.tsx                    # Main UI
├── src/
│   ├── agents/                     # Pure TS — no Next.js imports ever
│   │   ├── research.ts             # Tavily search per company
│   │   ├── positioning.ts          # Messaging + pricing signals
│   │   ├── competitor.ts           # Feature gaps, recent moves (Tavily)
│   │   └── content.ts              # SEO + content strategy
│   ├── orchestrator.ts             # Entry point: parses request, dispatches agents
│   ├── synthesis/
│   │   └── synthesize.ts           # Step A: analysis | Step B: brief assembly
│   ├── tools/
│   │   └── tavily.ts               # Tavily API client (typed wrapper)
│   ├── types/
│   │   └── index.ts                # All shared interfaces — source of truth
│   ├── lib/
│   │   ├── cost.ts                 # Token + cost tracking, prints summary per run
│   │   └── parseJSON.ts            # Strips markdown fences from LLM responses
│   └── prompts/
│       ├── orchestrator.ts
│       ├── research.ts
│       ├── positioning.ts
│       ├── competitor.ts
│       ├── content.ts
│       └── synthesis.ts
├── config/
│   └── client.ts                   # Brand config — all user-facing strings
├── planning/                       # Internal docs — gitignored
└── outputs/                        # Generated briefs — gitignored
```

---

## Execution Flow

```
1.  POST /api/brief  →  route.ts opens SSE stream
2.  orchestrator.ts receives BriefingRequest
3.  Orchestrator LLM call → generates per-agent dynamic brief
4.  Promise.allSettled([
      research(yourCompany),
      research(competitor1..N),     ← scales with input
      positioning(allCompanies),
      competitor(allCompanies),
      content(allCompanies)
    ])
5.  Each agent resolves → SSE event: { agent, status, confidence, durationMs }
6.  Full AgentResult<T>[] envelope assembled
7.  synthesize.ts Step A: Analysis LLM call (patterns, gaps, opportunities)
8.  synthesize.ts Step B: Brief assembly LLM call → structured Markdown
9.  SSE event: { type: 'complete', brief: BriefingOutput }
10. UI renders brief, offers PDF download
```

**Critical:** Research runs per-company, not once globally.
3 competitors = 4 parallel research calls (yourCompany + 3).

---

## Agent Responsibilities

| Agent | Tools | Input | Output type |
|---|---|---|---|
| Research | Tavily | one company name | ResearchOutput |
| Positioning | none (reasons over research) | all ResearchOutputs | PositioningOutput |
| Competitor | Tavily | all companies | CompetitorOutput |
| Content | none (reasons over research) | all ResearchOutputs | ContentOutput |
| Analysis | none | all agent outputs | AnalysisOutput |
| Synthesis | none | AnalysisOutput + all outputs | BriefingOutput |

Key output fields added in Phase 3:
- `PositioningOutput.positioningVulnerability` — most exploitable gap in that company's positioning
- `CompetitorOutput.competitiveVerdict` — who's most dangerous, is position strengthening or eroding

---

## Streaming Architecture (SSE)

API route at `app/api/brief/route.ts` uses a `ReadableStream` with SSE encoding.
Each event is JSON: `data: {...}\n\n`

```typescript
{ type: 'status',   agent: string, status: 'running' | 'complete' | 'failed', confidence?: string, durationMs?: number }
{ type: 'analysis', data: AnalysisOutput }
{ type: 'complete', brief: BriefingOutput }
{ type: 'error',    message: string }
```

---

## Key Implementation Rules

### Agents
- `src/agents/` contains ONLY pure TypeScript functions — zero Next.js imports
- Every agent returns `AgentResult<T>` with status — agents never throw
- Every agent output includes `confidence` + `gaps`

### Failure Handling
- `Promise.allSettled` — one failure does not abort the pipeline
- Synthesis receives full envelope including failed agents
- `buildDegradedContext()` in synthesize.ts generates specific gap messages per failed agent
- Final brief `metadata.agentStatuses` records which agents succeeded/failed

### Tavily
- Research and Competitor agents use Tavily
- Positioning and Content agents reason over Research output (no extra API calls)
- Depth controls Tavily `max_results`: quick=3, standard=5, deep=8
- All Tavily calls wrapped in try/catch

### Prompts
- All prompts in `src/prompts/` as exported template functions
- All rewritten in Phase 3 against `planning/brief-rubric.md`
- All LLM responses go through `src/lib/parseJSON.ts` before parsing
- `max_tokens` set generously per agent to prevent JSON truncation

### Output Format
1. Executive Summary (3-5 bullets — verdict first)
2. Company Snapshot
3. Competitor Profiles
4. Positioning Gap Analysis
5. Recent Moves & Signals
6. Content/SEO Opportunities
7. Recommended Actions

---

## Environment Variables

```bash
ANTHROPIC_API_KEY=        # required
TAVILY_API_KEY=           # required
DRY_RUN=true              # optional — zero-cost fixture mode
```

Never commit `.env.local`.

---

## Tech Stack

- **Runtime:** Node.js, TypeScript
- **Framework:** Next.js 14+ (App Router)
- **AI SDK:** `@anthropic-ai/sdk`
- **Search:** Tavily API (`@tavily/core`)
- **Styling:** Tailwind CSS
- **Deployment:** Vercel
- **Model:** `claude-sonnet-4-5` (all agent calls)

---

## UI Design Standards

You are also acting as a senior UI/UX engineer. Default to polished, modern interfaces.

Design direction: Clean, minimal, light mode. White backgrounds, soft borders, generous whitespace.
Feel: Simple SaaS form UI — think Typeform or early Linear (light). No dark mode unless explicitly requested.
Typography: Bold sans-serif headings, muted gray subtitles, clear label hierarchy.
Buttons: Primary = solid black fill, white text. Secondary = outlined. Rounded corners, full-width CTAs.
Inputs: Light border, subtle placeholder text, clean focus states.
Depth selectors: Pill-style segmented control, black fill for selected state.
Always add: hover states, loading states, empty states.
Never ship: dark backgrounds, heavy shadows, neon accents, unstyled buttons, raw HTML tables.

---

## Git Hygiene

If you accidentally commit a secret:
1. Rotate the key immediately
2. `git rm -r --cached .`
3. `git add . && git commit -m "remove tracked secrets"`
4. Consider `git filter-branch` or BFG for history cleanup

Gitignored: `.env*`, `outputs/`, `planning/`, `CLAUDE.md`, `PHASES.md`, `RESUME.md`
