// app/api/brief/route.ts
// SSE streaming endpoint.
// POST /api/brief → opens a ReadableStream, iterates the orchestrator generator,
// encodes each SSEEvent as "data: {...}\n\n" and flushes to the client.

import { NextRequest } from 'next/server';
import { runOrchestrator } from '../../../src/orchestrator';
import { BriefingRequest, SSEEvent } from '../../../src/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function encode(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest) {
  let request: BriefingRequest;

  try {
    request = (await req.json()) as BriefingRequest;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!request.yourCompany || !request.competitors?.length) {
    return new Response(
      JSON.stringify({ error: 'yourCompany and at least one competitor are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      try {
        for await (const event of runOrchestrator(request)) {
          controller.enqueue(enc.encode(encode(event)));
        }
      } catch (err) {
        const errorEvent: SSEEvent = {
          type: 'error',
          message: err instanceof Error ? err.message : 'Pipeline error',
        };
        controller.enqueue(enc.encode(encode(errorEvent)));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
