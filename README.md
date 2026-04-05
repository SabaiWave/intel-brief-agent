# ScoutWork

AI-powered competitive intelligence briefs in minutes.

Submit your company and up to 3 competitors. A team of specialist AI agents runs in parallel, synthesizes findings, and delivers a structured competitive intelligence brief — streamed live to the UI.

---

## What's Built

### Multi-agent pipeline
- **Orchestrator** — generates tailored instructions per agent from the user's request
- **Research agents** — one per company, parallel Tavily web search
- **Positioning agent** — extracts messaging, pricing signals, differentiators
- **Competitor agent** — maps feature sets, recent moves, weaknesses
- **Content agent** — identifies SEO signals, content gaps, channel presence
- **Analysis** — cross-agent synthesis: patterns, gaps, opportunities, threats
- **Synthesis** — assembles the final client-ready brief in Markdown

### Streaming UI
- Live agent status panel with per-agent timing
- Server-Sent Events (SSE) stream from API route to browser
- Partial failure handling — failed agents noted in brief, pipeline continues
- PDF download via jsPDF

### Infrastructure
- Next.js 14+ App Router
- Anthropic Claude (`claude-sonnet-4-5`) for all LLM calls
- Tavily API for web search (research + competitor agents)
- Per-brief cost logging to terminal (LLM + Tavily)

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js (App Router) |
| AI | Anthropic SDK — claude-sonnet-4-5 |
| Search | Tavily API |
| Styling | Tailwind CSS |
| Deployment | Vercel |

---

## Getting Started

```bash
npm install
npm run dev
```

Create `.env.local` in the project root:

```bash
ANTHROPIC_API_KEY=
TAVILY_API_KEY=
```

Open [http://localhost:3000](http://localhost:3000).

**Dry run mode** (no API calls, zero cost):
```bash
DRY_RUN=true
```
Add to `.env.local` to test the full UI and streaming pipeline with fixture data.

---

## Project Structure

```
├── app/
│   ├── api/brief/route.ts      # SSE streaming endpoint
│   ├── layout.tsx
│   └── page.tsx                # Main UI
├── src/
│   ├── agents/                 # research, positioning, competitor, content
│   ├── orchestrator.ts         # pipeline entry point
│   ├── synthesis/synthesize.ts # analysis + brief assembly
│   ├── tools/tavily.ts         # Tavily wrapper
│   ├── prompts/                # all LLM prompt functions
│   ├── types/index.ts          # shared interfaces — source of truth
│   └── lib/
│       ├── cost.ts             # token + cost tracking
│       └── parseJSON.ts        # strips markdown fences from LLM responses
├── config/client.ts            # brand config — all user-facing strings
```

---

## Cost Baseline

Tested at max load (1 company + 3 competitors), April 2026.

Cost summary prints to terminal after each real brief run (LLM + Tavily breakdown per agent).

---

## Roadmap

- [x] Phase 1 — Multi-agent backend (agents, orchestrator, synthesis, Tavily)
- [x] Phase 2 — SSE streaming API + Next.js UI
- [x] Phase 3 — Brief quality, prompt iteration, cost baseline
- [ ] Phase 4 — Brief persistence (Supabase)
- [ ] Phase 5 — Auth (Clerk)
- [ ] Phase 6 — Stripe paywall
- [ ] Phase 7 — UI polish + landing page
- [ ] Phase 8 — Token + cost management
