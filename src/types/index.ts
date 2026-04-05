// src/types/index.ts
// Source of truth for all shared interfaces.
// All agents, orchestrator, synthesis, and API routes import from here.
// Never define types inline elsewhere.

// ─── Input ────────────────────────────────────────────────────────────────────

export interface BriefingRequest {
  yourCompany: string;
  competitors: string[];          // 1–3 competitors
  focus?: string;                 // optional: "pricing strategy", "product gaps", etc.
  depth?: 'quick' | 'standard' | 'deep'; // controls Tavily result count
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export interface AgentContext {
  request: BriefingRequest;
  orchestratorBrief: string;      // dynamic instructions generated per query
}

// ─── Agent Outputs ────────────────────────────────────────────────────────────

export interface ResearchOutput {
  company: string;
  sources: {
    url: string;
    title: string;
    summary: string;
  }[];
  keyFacts: string[];
  confidence: 'high' | 'medium' | 'low';
  gaps: string[];                 // what couldn't be found — passed to Synthesis
}

export interface PositioningOutput {
  company: string;
  valueProps: string[];
  targetAudience: string;
  pricingSignals: string[];
  messagingTone: string;
  differentiators: string[];
  positioningVulnerability: string;  // single most exploitable gap — feeds Positioning Gap Analysis
  confidence: 'high' | 'medium' | 'low';
  gaps: string[];
}

export interface CompetitorOutput {
  companies: string[];            // covers all competitors in one pass
  recentMoves: Record<string, string[]>;    // company → moves[]
  featureSets: Record<string, string[]>;    // company → features[]
  weaknesses: Record<string, string[]>;     // company → weaknesses[]
  competitiveVerdict: string;     // who's most dangerous, what's most urgent, is position strengthening or eroding
  confidence: 'high' | 'medium' | 'low';
  gaps: string[];
}

export interface ContentOutput {
  company: string;
  topTopics: string[];
  seoSignals: string[];
  contentGaps: string[];
  channelPresence: string[];
  confidence: 'high' | 'medium' | 'low';
  gaps: string[];
}

// ─── Agent Result Envelope ────────────────────────────────────────────────────
// Every agent returns this. Never throws. Pipeline uses Promise.allSettled.

export type AgentName =
  | 'research'
  | 'positioning'
  | 'competitor'
  | 'content'
  | 'analysis'
  | 'synthesis';

export interface AgentResult<T> {
  status: 'fulfilled' | 'rejected';
  agent: AgentName | string;      // string allows per-company variants e.g. "research:Acme"
  data?: T;
  error?: string;
  durationMs?: number;
}

// ─── Synthesis ────────────────────────────────────────────────────────────────

// Step A: Analysis (patterns, gaps, opportunities)
export interface AnalysisOutput {
  positioningGaps: string[];
  opportunities: string[];
  threats: string[];
  patterns: string[];
  strengthsByCompany: Record<string, string[]>;
  weaknessesByCompany: Record<string, string[]>;
}

// Step B: Final brief
export interface BriefingOutput {
  request: BriefingRequest;

  // Brief sections (in display order)
  executiveSummary: string[];           // 3–5 bullets
  companySnapshot: string;             // markdown
  competitorProfiles: string;          // markdown — one section per competitor
  positioningGapAnalysis: string;      // markdown
  recentMovesAndSignals: string;       // markdown
  contentAndSEOOpportunities: string;  // markdown
  recommendedActions: string[];        // 3–7 prioritized actions

  // Metadata
  metadata: {
    generatedAt: string;               // ISO timestamp
    agentStatuses: Record<string, 'fulfilled' | 'rejected'>;
    overallConfidence: 'high' | 'medium' | 'low';
    degraded: boolean;                 // true if any agent failed
    degradedAgents?: string[];         // which agents failed
  };
}

// ─── SSE Stream Events ────────────────────────────────────────────────────────
// These are the event shapes the API route sends to the frontend.

export type SSEEvent =
  | { type: 'status'; agent: string; status: 'running' | 'complete' | 'failed'; confidence?: string; durationMs?: number }
  | { type: 'analysis'; data: AnalysisOutput }
  | { type: 'complete'; brief: BriefingOutput }
  | { type: 'error'; message: string };
