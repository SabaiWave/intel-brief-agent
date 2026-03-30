// config/client.ts
// White-label configuration for Sabai Wave.
// All user-facing strings sourced from here — never hardcoded elsewhere.

export const clientConfig = {
  brand: {
    name: 'Sabai Wave',
    shortName: 'SBW',
    tagline: 'Competitive intelligence, accelerated.',
    url: 'https://sabaiwave.com',
  },

  product: {
    name: 'Intel Brief',
    description: 'AI-powered competitive intelligence in minutes.',
    inputLabel: 'Your company',
    competitorLabel: 'Competitors',
    focusLabel: 'Research focus',
    focusPlaceholder: 'e.g. pricing strategy, product gaps, GTM approach',
    submitLabel: 'Generate Brief',
    downloadLabel: 'Download Brief',
  },

  agents: {
    research: { label: 'Research', description: 'Gathering web intelligence' },
    positioning: { label: 'Positioning', description: 'Analyzing messaging & pricing' },
    competitor: { label: 'Competitor', description: 'Mapping features & recent moves' },
    content: { label: 'Content', description: 'Scanning SEO & content strategy' },
    analysis: { label: 'Analysis', description: 'Finding patterns & gaps' },
    synthesis: { label: 'Synthesis', description: 'Assembling your brief' },
  },

  brief: {
    sections: {
      executiveSummary: 'Executive Summary',
      companySnapshot: 'Your Company',
      competitorProfiles: 'Competitor Profiles',
      positioningGaps: 'Positioning Gap Analysis',
      recentMoves: 'Recent Moves & Signals',
      contentOpportunities: 'Content & SEO Opportunities',
      recommendedActions: 'Recommended Actions',
    },
  },

  depth: {
    quick: { label: 'Quick', description: '~30 seconds', tavilyResults: 3 },
    standard: { label: 'Standard', description: '~60 seconds', tavilyResults: 5 },
    deep: { label: 'Deep', description: '~2 minutes', tavilyResults: 8 },
  },
} as const;

export type ClientConfig = typeof clientConfig;
