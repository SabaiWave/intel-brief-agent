// src/lib/cost.ts
// Tracks token usage and Tavily search counts across a brief run.
// Call addLLMUsage() after each Anthropic call, addTavilySearch() after each Tavily call.
// Call printCostSummary() at the end of the orchestrator run.

// Pricing as of early 2025 — update if Anthropic changes rates
const SONNET_INPUT_PER_M = 3.0;   // $ per 1M input tokens
const SONNET_OUTPUT_PER_M = 15.0; // $ per 1M output tokens
const TAVILY_PER_SEARCH = 0.01;   // $ per search (paid tier estimate)

// Max output token caps currently set per agent (keep in sync with agent files)
// Input tokens scale with depth (more Tavily content = more input) — we use a
// conservative high estimate for worst-case input based on observed runs.
const WORST_CASE_OUTPUT_CAPS = {
  orchestrator:  2048,
  research:      2048,  // per company
  positioning:   2048,  // per company
  competitor:    4096,
  content:       2048,  // per company
  analysis:      4096,
  synthesis:     8192,
};

// Worst-case input token estimates per agent at deep depth (empirical upper bound)
const WORST_CASE_INPUT_ESTIMATES = {
  orchestrator:  1000,
  research:      6000,  // per company — 2 Tavily searches × deep results
  positioning:   2000,  // per company — reasoned over research summary
  competitor:    12000, // all companies × 2 Tavily searches
  content:       2000,  // per company — reasoned over research summary
  analysis:      8000,  // full agent summary of all outputs
  synthesis:     10000, // analysis JSON + full agent summary
};

// Tavily searches per brief (fixed regardless of depth — only result count changes)
// research: 2 searches × n companies, competitor: 2 searches
function tavilySearchesForCompanyCount(n: number): number {
  return 2 * n + 2; // n research agents × 2 + competitor × 2
}

interface UsageEntry {
  agent: string;
  inputTokens: number;
  outputTokens: number;
}

const usageLog: UsageEntry[] = [];
let tavilySearchCount = 0;
let briefCompanyCount = 1; // yourCompany + competitors

export function addLLMUsage(agent: string, usage: { input_tokens: number; output_tokens: number }) {
  usageLog.push({
    agent,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
  });
}

export function addTavilySearch() {
  tavilySearchCount++;
}

export function setBriefCompanyCount(n: number) {
  briefCompanyCount = n;
}

export function resetCostTracker() {
  usageLog.length = 0;
  tavilySearchCount = 0;
  briefCompanyCount = 1;
}

function calcCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * SONNET_INPUT_PER_M
       + (outputTokens / 1_000_000) * SONNET_OUTPUT_PER_M;
}

function worstCaseCost(companyCount: number): { llm: number; tavily: number; total: number } {
  const n = companyCount;

  const totalOutput =
    WORST_CASE_OUTPUT_CAPS.orchestrator +
    WORST_CASE_OUTPUT_CAPS.research     * n +
    WORST_CASE_OUTPUT_CAPS.positioning  * n +
    WORST_CASE_OUTPUT_CAPS.competitor   +
    WORST_CASE_OUTPUT_CAPS.content      * n +
    WORST_CASE_OUTPUT_CAPS.analysis     +
    WORST_CASE_OUTPUT_CAPS.synthesis;

  const totalInput =
    WORST_CASE_INPUT_ESTIMATES.orchestrator +
    WORST_CASE_INPUT_ESTIMATES.research     * n +
    WORST_CASE_INPUT_ESTIMATES.positioning  * n +
    WORST_CASE_INPUT_ESTIMATES.competitor   +
    WORST_CASE_INPUT_ESTIMATES.content      * n +
    WORST_CASE_INPUT_ESTIMATES.analysis     +
    WORST_CASE_INPUT_ESTIMATES.synthesis;

  const llm = calcCost(totalInput, totalOutput);
  const tavily = tavilySearchesForCompanyCount(n) * TAVILY_PER_SEARCH;
  return { llm, tavily, total: llm + tavily };
}

export function printCostSummary() {
  if (usageLog.length === 0) return;

  const totalInput  = usageLog.reduce((s, e) => s + e.inputTokens,  0);
  const totalOutput = usageLog.reduce((s, e) => s + e.outputTokens, 0);
  const llmCost     = calcCost(totalInput, totalOutput);
  const tavCost     = tavilySearchCount * TAVILY_PER_SEARCH;
  const totalCost   = llmCost + tavCost;

  const worst = worstCaseCost(briefCompanyCount);

  console.log('\n─────────────────────────────────────────');
  console.log('  BRIEF COST SUMMARY');
  console.log('─────────────────────────────────────────');
  console.log('  Agent breakdown (actual):');
  for (const e of usageLog) {
    const cost = calcCost(e.inputTokens, e.outputTokens);
    console.log(`    ${e.agent.padEnd(28)} in:${String(e.inputTokens).padStart(5)}  out:${String(e.outputTokens).padStart(4)}  $${cost.toFixed(4)}`);
  }
  console.log('─────────────────────────────────────────');
  console.log(`  Total tokens    in:${String(totalInput).padStart(6)}  out:${String(totalOutput).padStart(5)}`);
  console.log(`  LLM cost        $${llmCost.toFixed(4)}  (claude-sonnet-4-5)`);
  console.log(`  Tavily cost     $${tavCost.toFixed(4)}  (${tavilySearchCount} searches × $${TAVILY_PER_SEARCH})`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  ACTUAL TOTAL    $${totalCost.toFixed(4)}`);
  console.log(`  WORST CASE      $${worst.total.toFixed(4)}  (all caps hit — llm $${worst.llm.toFixed(4)} + tavily $${worst.tavily.toFixed(4)})`);
  console.log('─────────────────────────────────────────\n');
}
