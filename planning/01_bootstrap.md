# 01_bootstrap.md — Session Start Prompt

Paste this at the start of every Claude Code session for this project.

---

## Session Bootstrap: competitive-intel-agent

You are working on **competitive-intel-agent**, a Competitive Intelligence Briefing Agent built by Sabai Wave (SBW).

Read `CLAUDE.md` in the project root before doing anything else. That file is the source of truth for architecture, execution flow, agent responsibilities, and implementation rules.

### Project Context

- Multi-agent orchestration system — this is the key learning goal
- Orchestrator dispatches 6-8 agents in parallel using `Promise.allSettled`
- Agents live in `src/agents/` — pure TypeScript, zero Next.js imports
- Next.js App Router handles UI + SSE streaming endpoint
- Results stream to UI in real time as agents complete
- Final output: structured Markdown competitive brief

### Stack

- TypeScript, Node.js
- Next.js 14+ (App Router)
- `@anthropic-ai/sdk` — all LLM calls
- `@tavily/core` — web search (Research + Competitor agents only)
- Tailwind CSS
- Vercel deployment target

### Environment Variables Needed

```
ANTHROPIC_API_KEY=
TAVILY_API_KEY=
```

Both must be in `.env.local` (never `.env`)

### Before Writing Any Code

1. Confirm you've read `CLAUDE.md`
2. Check `src/types/index.ts` — all interfaces are defined there, use them
3. Confirm which phase we're in (see Current Status at bottom of CLAUDE.md)
4. If implementing an agent: check its entry in the Agent Responsibilities table
5. If touching the API route: re-read the SSE architecture section

### Implementation Rules (non-negotiable)

- `src/agents/` = pure TS functions only. No framework imports.
- Every agent returns `AgentResult<T>` — never throws
- `Promise.allSettled` everywhere parallel agents are dispatched
- All prompts are functions in `src/prompts/` — not inline strings
- Tavily: Research + Competitor agents only. Others reason over outputs.
- Config strings from `config/client.ts`, not hardcoded
- LLM responses always go through `src/lib/parseJSON.ts` — never raw `JSON.parse`
- Dry run mode: `DRY_RUN=true` in `.env.local` bypasses all API calls with fixture data (dev/test only)

### Phases

- [x] Phase 1: Backend (agents, orchestrator, synthesis, Tavily)
- [x] Phase 2: SSE API route + Next.js UI
- [ ] Phase 3: Vercel deployment
- [ ] Phase 4: Token management (budget cap, usage tracking, degraded output on limit)
- [ ] Phase 5: New vertical (via planning/02_new_vertical.md)

### Current Session Goal

[REPLACE THIS with what you're building today]

Example:
- "Implement src/agents/research.ts and src/tools/tavily.ts"
- "Build the SSE API route at app/api/brief/route.ts"
- "Build the Next.js UI — streaming status panel + brief renderer"

---

Ready. Read CLAUDE.md and confirm the current project state before proceeding.
