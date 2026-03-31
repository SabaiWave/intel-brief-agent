# CLAUDE.md — competitive-intel-agent

## Project Identity
- **Product:** Competitive Intelligence Briefing Agent
- **Brand:** Sabai Wave (SBW)
- **Owner:** Alex (sole developer, US citizen, Chiang Mai, Thailand)
- **LLC:** Wyoming LLC — Sabai Wave

## What This Does
User submits their company + up to 3 competitors + optional research focus.
Multi-agent orchestration fires 6-8 parallel agents, collects structured outputs,
runs a two-step synthesis (analysis → brief assembly), and streams status updates
to the UI in real time via Server-Sent Events (SSE).

Final output: a structured competitive intelligence brief in Markdown,
displayed in the UI and downloadable.

---

## Architecture: Pattern B (Next.js as whole project)

```
competitive-intel-agent/
├── app/                          # Next.js App Router
│   ├── api/
│   │   └── brief/
│   │       └── route.ts          # SSE streaming endpoint → calls orchestrator
│   ├── layout.tsx
│   └── page.tsx                  # Main UI
├── src/
│   ├── agents/                   # Pure TS — no Next.js imports ever
│   │   ├── research.ts           # Tavily search per company
│   │   ├── positioning.ts        # Messaging + pricing signals
│   │   ├── competitor.ts         # Feature gaps, recent moves (Tavily)
│   │   └── content.ts            # SEO + content strategy
│   ├── orchestrator.ts           # Entry point: parses request, dispatches agents
│   ├── synthesis/
│   │   └── synthesize.ts         # Step A: analysis | Step B: brief assembly
│   ├── tools/
│   │   └── tavily.ts             # Tavily API client (typed wrapper)
│   ├── types/
│   │   └── index.ts              # All shared interfaces — source of truth
│   └── prompts/
│       ├── orchestrator.ts       # Dynamic brief generation prompt
│       ├── research.ts
│       ├── positioning.ts
│       ├── competitor.ts
│       ├── content.ts
│       └── synthesis.ts
├── outputs/                      # Generated .md briefs saved here
├── planning/                     # Internal docs — not for public GitHub
│   ├── 01_bootstrap.md
│   └── 02_new_vertical.md
├── config/
│   └── client.ts                 # White-label config (brand, colors, copy)
├── CLAUDE.md                     # ← you are here
├── .env.local                    # Never committed
├── .gitignore
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Execution Flow

```
1.  POST /api/brief  →  route.ts opens SSE stream
2.  orchestrator.ts receives BriefingRequest
3.  Orchestrator LLM call → generates per-agent dynamic brief (tailored instructions)
4.  Promise.allSettled([
      research(yourCompany),
      research(competitor1),       ← scales with input, not fixed
      research(competitor2),
      positioning(allCompanies),
      competitor(allCompanies),
      content(allCompanies)
    ])
5.  Each agent resolves → SSE event: { agent, status, confidence }
6.  Full AgentResult<T>[] envelope assembled
7.  synthesize.ts Step A: Analysis LLM call (patterns, gaps, opportunities)
8.  synthesize.ts Step B: Brief assembly LLM call → structured Markdown
9.  SSE event: { type: 'complete', brief: BriefingOutput }
10. UI renders brief, offers download
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

---

## Streaming Architecture (SSE)

API route at `app/api/brief/route.ts` uses a `ReadableStream` with SSE encoding.
Each event is JSON: `data: {...}\n\n`

Event types:
```typescript
{ type: 'status',   agent: string, status: 'running' | 'complete' | 'failed', confidence?: string }
{ type: 'analysis', data: AnalysisOutput }
{ type: 'complete', brief: BriefingOutput }
{ type: 'error',    message: string }
```

Frontend uses `EventSource` API or `fetch` with streaming reader.
Show live agent status panel while brief assembles.

---

## Key Implementation Rules

### Agents
- `src/agents/` contains ONLY pure TypeScript functions
- Zero Next.js imports in `src/` — agents must be framework-agnostic
- Every agent returns a typed output + `confidence` + `gaps`
- Agents never throw — they return `AgentResult<T>` with status

### Failure Handling
- Use `Promise.allSettled` — one failure does not abort the pipeline
- Synthesis receives full envelope including failed agents
- Synthesis prompt instructs: if agent failed, note gap, proceed with available data
- Final brief `metadata.agentStatuses` records which agents succeeded/failed

### Tavily
- Research and Competitor agents use Tavily
- Positioning and Content agents reason over Research output (no extra API calls)
- Depth setting controls Tavily `max_results`: quick=3, standard=5, deep=8
- Wrap all Tavily calls in try/catch — return low-confidence ResearchOutput on failure

### Prompts
- All prompts live in `src/prompts/` as exported template functions
- Prompts accept typed context and return strings
- Orchestrator prompt is the most important — it generates the per-agent brief
  that tailors each agent's focus to the specific user query

### Output Format
Brief sections (in order):
1. Executive Summary (3-5 bullets)
2. Company Snapshot (your company)
3. Competitor Profiles (one per competitor)
4. Positioning Gap Analysis
5. Recent Moves & Signals
6. Content/SEO Opportunities
7. Recommended Actions

### White-labeling
`config/client.ts` contains brand config. Same pattern as ecom-ops-agent.
All user-facing strings sourced from config, not hardcoded.

---

## Environment Variables

```bash
ANTHROPIC_API_KEY=
TAVILY_API_KEY=
```

Both required. App will throw on startup if missing.
Never commit `.env.local`. Add to `.gitignore` before first commit.

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

## What's New vs. ecom-ops-agent (Learning Targets)

| Concept | Status |
|---|---|
| Multi-agent orchestration | NEW |
| Parallel execution with Promise.allSettled | NEW |
| Typed inter-agent contracts | NEW |
| Partial failure + degraded output | NEW |
| SSE streaming to UI | NEW |
| External API integration (Tavily) | NEW |
| Dynamic orchestrator prompting | NEW |
| Agent loop, tool use, system prompts | carried over |
| MCP pattern (runTool) | not used here — pure SDK |
| TypeScript/Node.js patterns | carried over |

---

## Session Workflow

- **Strategy/architecture decisions:** claude.ai chat thread
- **Implementation:** Claude Code (VS Code extension)
- **This file:** source of truth for every Claude Code session
- **Bootstrap prompt:** `planning/01_bootstrap.md` — paste at session start

---

## Git Hygiene (learned from ecom-ops-agent)

```bash
# .gitignore must exist BEFORE first commit
.env.local
.env
outputs/
.next/
node_modules/
```

If you accidentally commit a secret:
1. Rotate the key immediately
2. `git rm -r --cached .`
3. `git add .`
4. `git commit -m "remove tracked secrets"`
5. Consider `git filter-branch` or BFG for history cleanup

---

## Current Status

- [x] Phase 1: Backend (agents, orchestrator, synthesis, Tavily)
- [x] Phase 2: SSE API route + Next.js UI
- [ ] Phase 3: Vercel deployment
- [ ] Phase 4: Token management (budget cap, usage tracking, degraded output on limit)
- [ ] Phase 5: New vertical (via planning/02_new_vertical.md)
