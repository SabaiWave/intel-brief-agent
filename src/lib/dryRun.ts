// src/lib/dryRun.ts
// When DRY_RUN=true in .env.local, the orchestrator yields fixture SSE events
// instead of making any API calls. Zero Anthropic or Tavily usage.
// Never import this in production paths — only used by the orchestrator guard.

import {
  AgentResult,
  AnalysisOutput,
  BriefingOutput,
  BriefingRequest,
  CompetitorOutput,
  ContentOutput,
  PositioningOutput,
  ResearchOutput,
  SSEEvent,
} from '../types';

export const isDryRun = process.env.DRY_RUN === 'true';

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function makeResearch(company: string): AgentResult<ResearchOutput> {
  return {
    status: 'fulfilled',
    agent: `research:${company}`,
    durationMs: 800,
    data: {
      company,
      sources: [
        { url: 'https://example.com/1', title: `${company} overview`, summary: 'Fixture source.' },
      ],
      keyFacts: [
        `${company} is a SaaS company targeting mid-market teams`,
        `${company} raised $50M Series B in 2023`,
        `${company} pricing starts at $12/user/month`,
        `${company} has strong product-led growth motion`,
        `${company} recently launched an AI features suite`,
      ],
      confidence: 'high',
      gaps: [],
    },
  };
}

function makePositioning(company: string): PositioningOutput {
  return {
    company,
    valueProps: ['Easy onboarding', 'Deep integrations', 'AI-native workflows'],
    targetAudience: 'Mid-market product and ops teams',
    pricingSignals: ['Freemium tier', 'Per-seat pricing', 'Enterprise contract available'],
    messagingTone: 'Friendly, productivity-focused, slightly technical',
    differentiators: ['Speed of setup', 'Breadth of integrations'],
    confidence: 'high',
    gaps: [],
  };
}

function makeCompetitor(companies: string[]): AgentResult<CompetitorOutput> {
  const recentMoves: Record<string, string[]> = {};
  const featureSets: Record<string, string[]> = {};
  const weaknesses: Record<string, string[]> = {};

  for (const c of companies) {
    recentMoves[c] = [`${c} launched AI assistant`, `${c} expanded to APAC`];
    featureSets[c] = ['Docs', 'Tasks', 'Databases', 'Automations'];
    weaknesses[c] = ['Slow mobile app', 'Limited offline support'];
  }

  return {
    status: 'fulfilled',
    agent: 'competitor',
    durationMs: 1200,
    data: { companies, recentMoves, featureSets, weaknesses, confidence: 'high', gaps: [] },
  };
}

function makeContent(company: string): ContentOutput {
  return {
    company,
    topTopics: ['Productivity', 'Remote work', 'AI tools', 'Team collaboration'],
    seoSignals: ['High domain authority', 'Strong blog cadence', 'Case study library'],
    contentGaps: ['Video tutorials', 'Community forum', 'Developer docs'],
    channelPresence: ['Blog', 'LinkedIn', 'YouTube', 'G2 reviews'],
    confidence: 'high',
    gaps: [],
  };
}

function makeAnalysis(request: BriefingRequest): AnalysisOutput {
  const allCompanies = [request.yourCompany, ...request.competitors];
  const strengthsByCompany: Record<string, string[]> = {};
  const weaknessesByCompany: Record<string, string[]> = {};
  for (const c of allCompanies) {
    strengthsByCompany[c] = ['Strong brand', 'Good integrations'];
    weaknessesByCompany[c] = ['Weak mobile', 'Limited API'];
  }
  return {
    positioningGaps: [
      `${request.yourCompany} under-invests in community-led growth`,
      'Competitors are moving faster on AI feature announcements',
    ],
    opportunities: [
      'Video content is an untapped channel vs. competitors',
      'Enterprise tier could be differentiated on compliance features',
    ],
    threats: [
      'Largest competitor raised $200M — expect aggressive pricing moves',
      'AI features becoming table stakes within 12 months',
    ],
    patterns: [
      'All competitors are converging on all-in-one positioning',
      'PLG is dominant GTM across the space',
    ],
    strengthsByCompany,
    weaknessesByCompany,
  };
}

function makeBrief(request: BriefingRequest, analysis: AnalysisOutput): BriefingOutput {
  const competitors = request.competitors.join(', ');
  return {
    request,
    executiveSummary: [
      `${request.yourCompany} has strong PLG foundations but lags on AI narrative vs. ${request.competitors[0]}.`,
      'Competitors are consolidating around all-in-one positioning — differentiation window is narrowing.',
      'Video content and community are clear white-space opportunities.',
      'Enterprise compliance features represent an underexplored revenue lever.',
    ],
    companySnapshot: `## ${request.yourCompany}\n\n${request.yourCompany} is a well-positioned SaaS player in the productivity space with a strong product-led growth motion. Recent AI feature launches have been well-received, though marketing amplification lags behind competitors like ${competitors}.\n\nCore strengths lie in ease of onboarding and breadth of integrations. Key gaps include mobile experience and developer ecosystem depth.`,
    competitorProfiles: request.competitors
      .map(
        (c) =>
          `## ${c}\n\n${c} is aggressively investing in AI and recently expanded into APAC. Their freemium funnel is strong, though enterprise deals remain their primary revenue driver. Weaknesses include a sluggish mobile app and limited offline functionality.`
      )
      .join('\n\n'),
    positioningGapAnalysis: `${request.yourCompany} is losing ground on AI narrative. While the product capability exists, competitors are winning the messaging battle with more frequent launches and stronger content amplification.\n\nThe biggest gap is community — no competitor owns this channel well, making it a clear opportunity.`,
    recentMovesAndSignals: `- **${request.competitors[0]}** raised a major round; expect pricing pressure and accelerated feature shipping.\n- All major competitors announced AI assistants in Q1 2025.\n- Several competitors are experimenting with usage-based pricing models.`,
    contentAndSEOOpportunities: `**Video tutorials** are underserved across the category — a consistent YouTube presence could drive significant organic acquisition.\n\n**SEO gap:** Long-tail "how to" queries around workflow automation are high-volume and low-competition.\n\n**Community:** A user forum or Slack community would differentiate ${request.yourCompany} from competitors who rely solely on G2 reviews.`,
    recommendedActions: [
      `Launch a structured AI narrative campaign — position ${request.yourCompany} as the AI-native choice before competitors own that framing.`,
      'Start a YouTube channel focused on workflow tutorials — 2 videos/month minimum.',
      'Build a public product roadmap to counter competitor transparency plays.',
      'Evaluate a usage-based pricing tier to reduce enterprise sales friction.',
      'Invest in a developer API and docs to expand the integration ecosystem.',
    ],
    metadata: {
      generatedAt: new Date().toISOString(),
      agentStatuses: {
        [`research:${request.yourCompany}`]: 'fulfilled',
        ...Object.fromEntries(request.competitors.map((c) => [`research:${c}`, 'fulfilled'])),
        positioning: 'fulfilled',
        competitor: 'fulfilled',
        content: 'fulfilled',
        analysis: 'fulfilled',
        synthesis: 'fulfilled',
      },
      overallConfidence: 'high',
      degraded: false,
    },
  };
}

export async function* runDryOrchestrator(
  request: BriefingRequest
): AsyncGenerator<SSEEvent> {
  const allCompanies = [request.yourCompany, ...request.competitors];

  // Research — announce + complete each with a short delay
  for (const company of allCompanies) {
    yield { type: 'status', agent: `research:${company}`, status: 'running' };
  }
  yield { type: 'status', agent: 'competitor', status: 'running' };

  await delay(600);

  for (const company of allCompanies) {
    const result = makeResearch(company);
    yield {
      type: 'status',
      agent: `research:${company}`,
      status: 'complete',
      confidence: result.data?.confidence,
      durationMs: result.durationMs,
    };
    await delay(200);
  }

  // Secondary agents
  yield { type: 'status', agent: 'positioning', status: 'running' };
  yield { type: 'status', agent: 'content', status: 'running' };
  await delay(500);

  const competitorResult = makeCompetitor(allCompanies);
  yield { type: 'status', agent: 'competitor', status: 'complete', durationMs: competitorResult.durationMs };

  yield { type: 'status', agent: 'positioning', status: 'complete', durationMs: 600 };
  yield { type: 'status', agent: 'content', status: 'complete', durationMs: 550 };

  // Synthesis
  yield { type: 'status', agent: 'analysis', status: 'running' };
  yield { type: 'status', agent: 'synthesis', status: 'running' };
  await delay(700);

  const analysis = makeAnalysis(request);
  yield { type: 'analysis', data: analysis };
  yield { type: 'status', agent: 'analysis', status: 'complete', durationMs: 700 };

  await delay(400);

  const brief = makeBrief(request, analysis);
  yield { type: 'status', agent: 'synthesis', status: 'complete', durationMs: 400 };
  yield { type: 'complete', brief };
}
