'use client';

import { useState, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { clientConfig } from '../config/client';
import { BriefingOutput, SSEEvent } from '../src/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentStatus = 'idle' | 'running' | 'complete' | 'failed';

interface AgentState {
  status: AgentStatus;
  confidence?: string;
  durationMs?: number;
}

type DepthOption = 'quick' | 'standard' | 'deep';

// ─── Agent Status Panel ───────────────────────────────────────────────────────

function statusIcon(status: AgentStatus) {
  if (status === 'running') return <span className="animate-spin inline-block">⟳</span>;
  if (status === 'complete') return <span className="text-green-500">✓</span>;
  if (status === 'failed') return <span className="text-red-400">✗</span>;
  return <span className="w-4 inline-block text-zinc-300">○</span>;
}

function AgentStatusPanel({
  agents,
  onCancel,
  isRunning,
}: {
  agents: Record<string, AgentState>;
  onCancel?: () => void;
  isRunning?: boolean;
}) {
  const entries = Object.entries(agents);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Agent Pipeline
        </p>
        {isRunning && onCancel && (
          <button
            onClick={onCancel}
            className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
      <ul className="space-y-2">
        {entries.map(([name, state]) => {
          const label = (() => {
            if (name.startsWith('research:')) {
              const company = name.split(':')[1];
              return `Research · ${company}`;
            }
            return clientConfig.agents[name as keyof typeof clientConfig.agents]?.label ?? name;
          })();

          return (
            <li key={name} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                {statusIcon(state.status)}
                <span
                  className={
                    state.status === 'running'
                      ? 'text-zinc-900 font-medium'
                      : state.status === 'complete'
                      ? 'text-zinc-700'
                      : state.status === 'failed'
                      ? 'text-red-400'
                      : 'text-zinc-400'
                  }
                >
                  {label}
                </span>
              </span>
              <span className="text-xs text-zinc-400">
                {state.status === 'complete' && (
                  <>
                    {state.confidence && <span className="mr-1.5">{state.confidence}</span>}
                    {state.durationMs && <span>{(state.durationMs / 1000).toFixed(1)}s</span>}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Brief Renderer ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-zinc-900 border-b border-zinc-200 pb-2">
        {title}
      </h2>
      {children}
    </div>
  );
}

function BriefRenderer({ brief }: { brief: BriefingOutput }) {
  const cfg = clientConfig.brief.sections;

  function Prose({ content }: { content: string }) {
    return (
      <div className="prose-sm text-zinc-700 leading-relaxed">
        {content.split('\n\n').map((block, i) => {
          if (/^## /.test(block)) {
            return <h3 key={i} className="mt-5 mb-1 font-semibold text-zinc-800">{block.replace(/^## /, '')}</h3>;
          }
          if (/^### /.test(block)) {
            return <h4 key={i} className="mt-3 mb-1 font-medium text-zinc-700">{block.replace(/^### /, '')}</h4>;
          }
          if (block.startsWith('- ')) {
            const items = block.split('\n').filter(l => l.startsWith('- '));
            return (
              <ul key={i} className="mb-3 space-y-1">
                {items.map((item, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="mt-1 text-zinc-400 flex-none">•</span>
                    <span dangerouslySetInnerHTML={{ __html: item.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p key={i} className="mb-3"
              dangerouslySetInnerHTML={{ __html: block.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>') }}
            />
          );
        })}
      </div>
    );
  }

  const downloadBrief = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = 56;
    const marginY = 56;
    const contentW = pageW - marginX * 2;
    let y = marginY;

    function checkPageBreak(needed: number) {
      if (y + needed > pageH - marginY) {
        doc.addPage();
        y = marginY;
      }
    }

    function writeLine(
      text: string,
      opts: { size: number; bold?: boolean; color?: [number, number, number]; indent?: number }
    ) {
      const { size, bold = false, color = [40, 40, 40], indent = 0 } = opts;
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setTextColor(...color);
      const wrapped = doc.splitTextToSize(text, contentW - indent) as string[];
      for (const line of wrapped) {
        checkPageBreak(size * 1.5);
        doc.text(line, marginX + indent, y);
        y += size * 1.5;
      }
    }

    function writeSection(title: string, body: string) {
      checkPageBreak(32);
      y += 10;
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 20, 20);
      doc.text(title, marginX, y);
      y += 6;
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.5);
      doc.line(marginX, y, pageW - marginX, y);
      y += 12;

      const blocks = body.split('\n\n');
      for (const block of blocks) {
        if (/^#{2,3} /.test(block)) {
          writeLine(block.replace(/^#{2,3} /, ''), { size: 11, bold: true, color: [40, 40, 40] });
          y += 2;
        } else if (block.startsWith('- ')) {
          const items = block.split('\n').filter(l => l.startsWith('- '));
          for (const item of items) {
            const clean = item.slice(2).replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
            checkPageBreak(18);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);
            doc.text('•', marginX + 4, y);
            const wrapped = doc.splitTextToSize(clean, contentW - 16) as string[];
            for (const line of wrapped) {
              checkPageBreak(16);
              doc.text(line, marginX + 14, y);
              y += 15;
            }
          }
          y += 4;
        } else {
          const clean = block.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/^- /gm, '');
          writeLine(clean, { size: 10, color: [60, 60, 60] });
          y += 4;
        }
      }
      y += 6;
    }

    function addFooter() {
      const total = doc.internal.pages.length - 1;
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 180, 180);
        doc.text(
          `${clientConfig.brand.name} · ${clientConfig.product.name}`,
          marginX, pageH - 28
        );
        doc.text(`${p} / ${total}`, pageW - marginX, pageH - 28, { align: 'right' });
        doc.setDrawColor(230, 230, 230);
        doc.setLineWidth(0.5);
        doc.line(marginX, pageH - 36, pageW - marginX, pageH - 36);
      }
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 160, 160);
    doc.text(clientConfig.brand.name.toUpperCase(), marginX, y);
    y += 24;

    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text('Competitive Intelligence Brief', marginX, y);
    y += 30;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`${brief.request.yourCompany} vs ${brief.request.competitors.join(', ')}`, marginX, y);
    y += 16;

    doc.setFontSize(9);
    doc.setTextColor(160, 160, 160);
    doc.text(new Date(brief.metadata.generatedAt).toLocaleString(), marginX, y);
    y += 28;

    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(1);
    doc.line(marginX, y, pageW - marginX, y);
    y += 24;

    checkPageBreak(32);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(cfg.executiveSummary, marginX, y);
    y += 6;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(marginX, y, pageW - marginX, y);
    y += 12;

    for (const bullet of brief.executiveSummary) {
      checkPageBreak(18);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text('•', marginX + 4, y);
      const wrapped = doc.splitTextToSize(bullet, contentW - 16) as string[];
      for (const line of wrapped) {
        checkPageBreak(16);
        doc.text(line, marginX + 14, y);
        y += 15;
      }
    }
    y += 12;

    writeSection(cfg.companySnapshot, brief.companySnapshot);
    writeSection(cfg.competitorProfiles, brief.competitorProfiles);
    writeSection(cfg.positioningGaps, brief.positioningGapAnalysis);
    writeSection(cfg.recentMoves, brief.recentMovesAndSignals);
    writeSection(cfg.contentOpportunities, brief.contentAndSEOOpportunities);

    checkPageBreak(32);
    y += 10;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(cfg.recommendedActions, marginX, y);
    y += 6;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(marginX, y, pageW - marginX, y);
    y += 12;

    brief.recommendedActions.forEach((action, i) => {
      checkPageBreak(20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text(`${i + 1}.`, marginX + 2, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      const wrapped = doc.splitTextToSize(action, contentW - 20) as string[];
      for (const line of wrapped) {
        checkPageBreak(16);
        doc.text(line, marginX + 18, y);
        y += 15;
      }
      y += 4;
    });

    addFooter();

    const slug = brief.request.yourCompany.toLowerCase().replace(/\s+/g, '-');
    doc.save(`intel-brief-${slug}.pdf`);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Competitive Brief</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {brief.request.yourCompany} vs {brief.request.competitors.join(', ')} ·{' '}
            {new Date(brief.metadata.generatedAt).toLocaleString()}
          </p>
          {brief.metadata.degraded && (
            <p className="mt-1 text-xs text-amber-600">
              Partial data — some agents failed: {brief.metadata.degradedAgents?.join(', ')}
            </p>
          )}
        </div>
        <button
          onClick={downloadBrief}
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          {clientConfig.product.downloadLabel}
        </button>
      </div>

      <div className="mb-6 rounded-lg bg-zinc-50 border border-zinc-200 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">
          {cfg.executiveSummary}
        </p>
        <ul className="space-y-1">
          {brief.executiveSummary.map((bullet, i) => (
            <li key={i} className="flex gap-2 text-sm text-zinc-700">
              <span className="mt-0.5 text-zinc-400">•</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      <Section title={cfg.companySnapshot}>
        <Prose content={brief.companySnapshot} />
      </Section>

      <Section title={cfg.competitorProfiles}>
        <Prose content={brief.competitorProfiles} />
      </Section>

      <Section title={cfg.positioningGaps}>
        <Prose content={brief.positioningGapAnalysis} />
      </Section>

      <Section title={cfg.recentMoves}>
        <Prose content={brief.recentMovesAndSignals} />
      </Section>

      <Section title={cfg.contentOpportunities}>
        <Prose content={brief.contentAndSEOOpportunities} />
      </Section>

      <Section title={cfg.recommendedActions}>
        <ol className="space-y-2">
          {brief.recommendedActions.map((action, i) => (
            <li key={i} className="flex gap-3 text-sm text-zinc-700">
              <span className="flex-none font-semibold text-zinc-400">{i + 1}.</span>
              <span>{action}</span>
            </li>
          ))}
        </ol>
      </Section>

      <div className="mt-4 text-xs text-zinc-400">
        Confidence: {brief.metadata.overallConfidence} · Powered by{' '}
        {clientConfig.brand.name}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const cfg = clientConfig.product;
  const depthCfg = clientConfig.depth;

  const [yourCompany, setYourCompany] = useState('');
  const [competitors, setCompetitors] = useState(['', '', '']);
  const [focus, setFocus] = useState('');
  const [depth, setDepth] = useState<DepthOption>('standard');

  const [loading, setLoading] = useState(false);
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>({});
  const [brief, setBrief] = useState<BriefingOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  function updateCompetitor(index: number, value: string) {
    setCompetitors((prev) => prev.map((c, i) => (i === index ? value : c)));
  }

  function updateAgent(name: string, update: Partial<AgentState>) {
    setAgentStates((prev) => ({
      ...prev,
      [name]: { ...(prev[name] ?? { status: 'idle' }), ...update },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!yourCompany.trim()) return;

    const competitorList = competitors.filter((c) => c.trim());
    if (competitorList.length === 0) return;

    setLoading(true);
    setBrief(null);
    setError(null);
    setAgentStates({});

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yourCompany: yourCompany.trim(),
          competitors: competitorList,
          focus: focus.trim() || undefined,
          depth,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        setError('Request failed. Check your API keys and try again.');
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += dec.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6)) as SSEEvent;

            if (event.type === 'status') {
              updateAgent(event.agent, {
                status: event.status === 'running'
                  ? 'running'
                  : event.status === 'complete'
                  ? 'complete'
                  : 'failed',
                confidence: event.confidence,
                durationMs: event.durationMs,
              });
            } else if (event.type === 'complete') {
              setBrief(event.brief);
            } else if (event.type === 'error') {
              setError(event.message);
            }
          } catch {
            // malformed SSE line — skip
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    abortRef.current?.abort();
    setBrief(null);
    setError(null);
    setAgentStates({});
    setLoading(false);
  }

  const hasActivity = Object.keys(agentStates).length > 0;

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-100 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-zinc-900">{clientConfig.brand.name}</span>
          </div>
          {(hasActivity || brief) && (
            <button
              onClick={handleReset}
              className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              ← New brief
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {!brief && (
          <div className="mb-10 max-w-2xl">
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
              {cfg.name}
            </h1>
            <p className="mt-2 text-zinc-500">{cfg.description}</p>
          </div>
        )}

        {!brief && (
          <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                {cfg.inputLabel}
              </label>
              <input
                type="text"
                value={yourCompany}
                onChange={(e) => setYourCompany(e.target.value)}
                placeholder="e.g. Notion"
                disabled={loading}
                className="w-full rounded-lg border border-zinc-200 px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                {cfg.competitorLabel}
              </label>
              <div className="space-y-2">
                {competitors.map((c, i) => (
                  <input
                    key={i}
                    type="text"
                    value={c}
                    onChange={(e) => updateCompetitor(i, e.target.value)}
                    placeholder={`Competitor ${i + 1}${i === 0 ? ' (required)' : ' (optional)'}`}
                    disabled={loading}
                    className="w-full rounded-lg border border-zinc-200 px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none disabled:opacity-50"
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                {cfg.focusLabel}{' '}
                <span className="font-normal text-zinc-400">(optional)</span>
              </label>
              <input
                type="text"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder={cfg.focusPlaceholder}
                disabled={loading}
                className="w-full rounded-lg border border-zinc-200 px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Depth
              </label>
              <div className="flex gap-2">
                {(['quick', 'standard', 'deep'] as DepthOption[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDepth(d)}
                    disabled={loading}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors disabled:opacity-50 ${
                      depth === d
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 text-zinc-600 hover:border-zinc-400'
                    }`}
                  >
                    <span className="font-medium">{depthCfg[d].label}</span>
                    <span className="ml-1 text-xs opacity-60">{depthCfg[d].description}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !yourCompany.trim() || !competitors[0].trim()}
              className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Generating…' : cfg.submitLabel}
            </button>
          </form>
        )}

        {hasActivity && !brief && (
          <div className="mt-8 max-w-2xl">
            <AgentStatusPanel agents={agentStates} onCancel={handleReset} isRunning={loading} />
          </div>
        )}

        {loading && hasActivity && (
          <div className="mt-4 max-w-2xl">
            <p className="text-xs text-zinc-400">
              Agents running in parallel — results stream in as they complete.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-6 max-w-2xl rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {brief && (
          <div className="mt-2">
            <AgentStatusPanel agents={agentStates} isRunning={false} />
            <div className="mt-8">
              <BriefRenderer brief={brief} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
