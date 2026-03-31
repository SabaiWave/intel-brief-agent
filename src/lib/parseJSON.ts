// src/lib/parseJSON.ts
// Strips markdown code fences before parsing.
// Models sometimes wrap JSON in ```json ... ``` despite instructions.

export function parseJSON<T>(raw: string): T {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  return JSON.parse(stripped) as T;
}
