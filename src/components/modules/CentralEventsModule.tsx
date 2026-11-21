import React, { useMemo, useState } from 'react';
import { Activity, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import type { CentralPipelineEvent } from '../../types/system';
import { CopyValueButton, EmptyState, ModulePageHeader, StatusLabel } from '../ui/CommonUI';

export const CentralEventsModule: React.FC = () => {
  const { state, replayPipelineEvent, refreshView, isRefreshing } = useSystem();
  const [statusFilter, setStatusFilter] = useState<'All' | 'Completed' | 'Failed'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<CentralPipelineEvent | null>(
    state?.pipelineEvents[0] || null
  );

  const summary = useMemo(() => {
    if (!state) return { total: 0, completed: 0, failed: 0, webhooksFired: 0 };
    return {
      total: state.pipelineEvents.length,
      completed: state.pipelineEvents.filter((e) => e.status === 'Completed').length,
      failed: state.pipelineEvents.filter((e) => e.status === 'Failed').length,
      webhooksFired: state.pipelineEvents.reduce((acc, e) => acc + e.dispatchedWebhooks, 0),
    };
  }, [state]);

  if (!state) return null;

  const filtered = state.pipelineEvents.filter((evt) => {
    if (statusFilter !== 'All' && evt.status !== statusFilter) return false;
    const q = searchQuery.toLowerCase();
    return (
      evt.eventType.toLowerCase().includes(q) ||
      evt.correlationId.toLowerCase().includes(q) ||
      evt.sourceModule.toLowerCase().includes(q) ||
      (evt.watermarkCode || '').toLowerCase().includes(q) ||
      (evt.sha256Ref || '').toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <ModulePageHeader
        title="Central Event-Processing Dashboard"
        description="Unified observability stream linking PDF ingestion, SHA-256 fingerprinting, recipient watermarking, demo SMTP relay, and webhook fan-out."
        actions={
          <button
            type="button"
            onClick={() => void refreshView()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Bus</span>
          </button>
        }
      />

      {/* Pipeline Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Pipeline Events</p>
          <p className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
            {summary.total}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Completed Dispatches</p>
          <p className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {summary.completed}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Failed / Attention</p>
          <p className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-rose-600 dark:text-rose-400">
            {summary.failed}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Webhook Fan-Outs</p>
          <p className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
            {summary.webhooksFired}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1">
          {(['All', 'Completed', 'Failed'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1 text-xs font-medium rounded-md ${
                statusFilter === tab
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter correlation ID, event, watermark, SHA-256…"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Activity className="h-5 w-5" />}
          title="No central pipeline events found"
          description="Upload a PDF, issue a watermark, or run the demo SMTP processor to emit events."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Event / Correlation</th>
                  <th className="py-2.5 px-4">Source Module</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Fan-Out</th>
                  <th className="py-2.5 px-4 text-right">Replay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {filtered.map((evt) => (
                  <tr
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                      selectedEvent?.id === evt.id ? 'bg-cyan-500/5' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <p className="font-mono font-semibold text-cyan-700 dark:text-cyan-400">
                        {evt.eventType}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {evt.correlationId}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {evt.sourceModule}
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel status={evt.status} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {evt.dispatchedWebhooks}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void replayPipelineEvent(evt.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Replay</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Event Envelope Inspector */}
          <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              Event Envelope Inspector
            </h2>
            {!selectedEvent ? (
              <p className="text-xs text-slate-500">Select an event row to inspect its JSON envelope.</p>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-violet-700 dark:text-violet-400">
                    {selectedEvent.correlationId}
                  </span>
                  <CopyValueButton
                    value={JSON.stringify(selectedEvent.payload, null, 2)}
                    label="Copy JSON"
                  />
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                  <p>
                    Emitted: <span className="font-mono">{new Date(selectedEvent.createdAt).toLocaleString()}</span>
                  </p>
                  {selectedEvent.sha256Ref && (
                    <p className="break-all">
                      SHA-256 Ref: <span className="font-mono text-cyan-700 dark:text-cyan-400">{selectedEvent.sha256Ref}</span>
                    </p>
                  )}
                </div>
                <pre className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-[11px] font-mono text-slate-800 dark:text-slate-200 overflow-x-auto max-h-72">
                  {JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
