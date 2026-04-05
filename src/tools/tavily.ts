// src/tools/tavily.ts
// Typed Tavily API client wrapper.
// Used by: research.ts, competitor.ts only.

import { tavily } from '@tavily/core';
import { clientConfig } from '../../config/client';
import { addTavilySearch } from '../lib/cost';

export interface TavilyResult {
  url: string;
  title: string;
  content: string;
  score: number;
}

export interface TavilySearchResponse {
  results: TavilyResult[];
  query: string;
}

function getClient() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY is not set');
  return tavily({ apiKey });
}

export async function tavilySearch(
  query: string,
  depth: 'quick' | 'standard' | 'deep' = 'standard'
): Promise<TavilySearchResponse> {
  const client = getClient();
  const maxResults = clientConfig.depth[depth].tavilyResults;

  addTavilySearch();
  const response = await client.search(query, {
    maxResults,
    searchDepth: depth === 'deep' ? 'advanced' : 'basic',
  });

  const results: TavilyResult[] = (response.results ?? []).map((r) => ({
    url: r.url,
    title: r.title,
    content: r.content,
    score: r.score ?? 0,
  }));

  return { results, query };
}
