import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Calendar,
  CheckSquare,
  FileCheck2,
  FileUp,
  Fingerprint,
  Inbox,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Square,
  Stamp,
  Star,
  Webhook,
} from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import { EmptyState, ModulePageHeader, StatusLabel, TableSkeleton } from '../ui/CommonUI';

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const local = parts[0];
  const maskedLocal = local.length <= 2 ? `${local[0] || '*'}*` : `${local.slice(0, 2)}***`;
  return `${maskedLocal}@${parts[1]}`;
}

export const DashboardModule: React.FC = () => {
  const {
    state,
    isRefreshing,
    refreshView,
    setActiveModule,
    resetDemoData,
    toggleTask,
    toggleDocumentFavorite,
  } = useSystem();
  const [activityFilter, setActivityFilter] = useState<'All' | 'Success' | 'Warning' | 'Error'>('All');
  const [chartMetric, setChartMetric] = useState<'all' | 'watermarks' | 'webhooks'>('all');

  const stats = useMemo(() => {
    if (!state) return null;
    const activeInboxes = state.inboxes.filter((i) => i.status === 'Active').length;
    const deliveredHooks = state.webhookDeliveries.filter((d) => d.status === 'Delivered').length;
    const totalHooks = state.webhookDeliveries.length;
    const deliveryRate = totalHooks > 0 ? Math.round((deliveredHooks / totalHooks) * 100) : 100;
    return {
      documents: state.documents.length,
      fingerprints: state.documents.length + state.watermarkedCopies.length,
      watermarks: state.watermarkedCopies.length,
      activeInboxes,
      totalInboxes: state.inboxes.length,
      verifications: state.verificationRecords.length,
      deliveredHooks,
      totalHooks,
      deliveryRate,
    };
  }, [state]);

  const chartData = useMemo(() => {
    if (!state) return [];
    return [
      { label: 'Upload', count: state.documents.length, secondary: state.documents.length },
      {
        label: 'SHA-256',
        count: state.documents.length + state.watermarkedCopies.length,
        secondary: state.watermarkedCopies.length,
      },
      {
        label: 'Watermarks',
        count: state.watermarkedCopies.length,
        secondary: state.watermarkedCopies.length,
      },
      {
        label: 'Verified',
        count: state.verificationRecords.length,
        secondary: state.verificationRecords.filter((v) => v.outcome !== 'Unregistered').length,
      },
      {
        label: 'SMTP Demo',
        count: state.inboundEmails.length,
        secondary: state.inboundEmails.filter((e) => e.pipelineStatus === 'Processed').length,
      },
      {
        label: 'Webhooks',
        count: state.webhookDeliveries.length,
        secondary: state.webhookDeliveries.filter((w) => w.status === 'Delivered').length,
      },
    ];
  }, [state]);

  const filteredLogs = useMemo(() => {
    if (!state) return [];
    return state.activityLogs
      .filter((log) => (activityFilter === 'All' ? true : log.outcome === activityFilter))
      .slice(0, 7);
  }, [state, activityFilter]);

  const favoriteDocs = useMemo(() => {
    if (!state) return [];
    return state.documents.filter((d) => d.isFavorite).slice(0, 4);
  }, [state]);

  const openTasks = useMemo(() => {
    if (!state) return [];
    return state.productivity.tasks.filter((t) => !t.completed).slice(0, 5);
  }, [state]);

  if (!state || !stats) return null;

  const p = state.settings.personalization;
  const widgets = p.dashboardWidgets;
  const isCompact = p.dashboardLayout === 'compact' || p.density === 'compact';
  const cardPad = isCompact ? 'p-4' : 'p-5';
  const sectionGap = isCompact ? 'mb-4' : 'mb-6';
  const maxChartVal = Math.max(1, ...chartData.map((d) => d.count));

  const formatResource = (text: string) => {
    let out = text;
    if (p.privacy.maskRecipientEmails && out.includes('@')) {
      out = out.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => maskEmail(m));
    }
    if (p.privacy.truncateHashesInOverview) {
      out = out.replace(/[a-f0-9]{24,64}/gi, (h) => `${h.slice(0, 10)}…${h.slice(-4)}`);
    }
    return out;
  };

  return (
    <div>
      <ModulePageHeader
        title="System Overview"
        description="Real-time telemetry across SHA-256 document fingerprinting, recipient PDF watermarking, demo ephemeral SMTP relay, and webhook dispatch."
        actions={
          <>
            <button
              type="button"
              onClick={() => setActiveModule('personalization')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Customize</span>
            </button>
            <button
              type="button"
              onClick={() => void refreshView()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModule('upload')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <FileUp className="h-3.5 w-3.5" />
              <span>Upload PDF</span>
            </button>
          </>
        }
      />

      {/* Primary KPI Grid */}
      {widgets.showKpis && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${sectionGap}`}>
          <button
            type="button"
            onClick={() => setActiveModule('upload')}
            className={`text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 ${cardPad} hover:border-cyan-500/50 transition-colors`}
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium">Master PDF Vault</span>
              <Fingerprint className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white font-mono tabular-nums">
              {stats.documents}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {stats.fingerprints} total SHA-256 digests
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('watermarking')}
            className={`text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 ${cardPad} hover:border-violet-500/50 transition-colors`}
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium">Watermarked Copies</span>
              <Stamp className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white font-mono tabular-nums">
              {stats.watermarks}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {state.recipients.length} registered recipients
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('inboxes')}
            className={`text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 ${cardPad} hover:border-cyan-500/50 transition-colors`}
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium">Ephemeral Inboxes</span>
              <Inbox className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white font-mono tabular-nums">
              {stats.activeInboxes}
              <span className="text-sm font-normal text-slate-400"> / {stats.totalInboxes}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Demo SMTP relay mode</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('webhooks')}
            className={`text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 ${cardPad} hover:border-violet-500/50 transition-colors`}
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium">Webhook Delivery Rate</span>
              <Webhook className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white font-mono tabular-nums">
              {stats.deliveryRate}%
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {stats.deliveredHooks} of {stats.totalHooks} deliveries OK
            </p>
          </button>
        </div>
      )}

      {/* Main Split: Pipeline Volume Chart + Quick Actions */}
      {(widgets.showThroughputChart || widgets.showShortcuts) && p.dashboardLayout !== 'focus' && (
        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${sectionGap}`}>
          {widgets.showThroughputChart && (
            <div
              className={`${
                widgets.showShortcuts ? 'lg:col-span-2' : 'lg:col-span-3'
              } rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 ${cardPad}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Pipeline Throughput by Subsystem
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Live counts computed from registered documents, watermarks, verifications, and relay events
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1">
                  {(
                    [
                      { id: 'all', label: 'All Volume' },
                      { id: 'watermarks', label: 'Verified / OK' },
                      { id: 'webhooks', label: 'Compare' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setChartMetric(tab.id)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        chartMetric === tab.id
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-56 w-full flex items-end gap-3 sm:gap-5 pt-4 pb-2 px-2 border-t border-slate-100 dark:border-slate-800/80">
                {chartData.map((bar) => {
                  const primaryPct = Math.max(8, Math.round((bar.count / maxChartVal) * 100));
                  const secondaryPct = Math.max(6, Math.round((bar.secondary / maxChartVal) * 100));
                  return (
                    <div
                      key={bar.label}
                      className="flex-1 flex flex-col items-center h-full justify-end group"
                    >
                      <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 mb-1.5">
                        {chartMetric === 'watermarks' ? bar.secondary : bar.count}
                      </div>
                      <div className="w-full max-w-14 flex items-end justify-center gap-1.5 h-36">
                        {chartMetric !== 'watermarks' && (
                          <div
                            className="w-full rounded-t-md bg-cyan-500/85 dark:bg-cyan-500/80 transition-all duration-200 group-hover:bg-cyan-400"
                            style={{ height: `${primaryPct}%` }}
                            title={`${bar.label}: ${bar.count}`}
                          />
                        )}
                        {chartMetric !== 'all' && (
                          <div
                            className="w-full rounded-t-md bg-violet-500/85 dark:bg-violet-500/80 transition-all duration-200 group-hover:bg-violet-400"
                            style={{ height: `${secondaryPct}%` }}
                            title={`${bar.label} verified/succeeded: ${bar.secondary}`}
                          />
                        )}
                      </div>
                      <span className="mt-2.5 text-[11px] font-medium text-slate-600 dark:text-slate-400 truncate max-w-full">
                        {bar.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {widgets.showShortcuts && (
            <div
              className={`${
                widgets.showThroughputChart ? '' : 'lg:col-span-3'
              } rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 ${cardPad} flex flex-col justify-between`}
            >
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Workflow Shortcuts
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-4">
                  Jump directly to core engineering operations
                </p>
                <div className="space-y-2.5">
                  {[
                    {
                      module: 'watermarking' as const,
                      title: 'Stamp Recipient Watermark',
                      sub: 'Apply visible PDF watermark & SHA-256 seal',
                      icon: Stamp,
                    },
                    {
                      module: 'verification' as const,
                      title: 'Verify Suspect PDF',
                      sub: 'Match SHA-256 or embedded PDF attribution',
                      icon: ShieldCheck,
                    },
                    {
                      module: 'email-processing' as const,
                      title: 'Simulate SMTP Inbound Mail',
                      sub: 'Test demo MIME parser & auto-watermarking',
                      icon: MailCheck,
                    },
                    {
                      module: 'events' as const,
                      title: 'Inspect Central Event Bus',
                      sub: `${state.pipelineEvents.length} recorded pipeline events`,
                      icon: Activity,
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.module}
                        type="button"
                        onClick={() => setActiveModule(item.module)}
                        className="w-full flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-left hover:border-cyan-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {item.title}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {item.sub}
                            </p>
                          </div>
                        </div>
                        <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Verifications logged</span>
                <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-200">
                  {stats.verifications}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Favorites & Planner Tasks Widget */}
      {widgets.showFavoritesAndTasks && p.dashboardLayout !== 'focus' && (
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${sectionGap}`}>
          <div
            className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 ${cardPad}`}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Pinned Favorite Documents
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModule('productivity')}
                className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                Productivity Centre
              </button>
            </div>
            {favoriteDocs.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
                No starred documents yet. Star any master PDF in Document Upload to pin it here.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {favoriteDocs.map((doc) => (
                  <div key={doc.id} className="py-2.5 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveModule('upload')}
                      className="min-w-0 text-left hover:text-cyan-600 dark:hover:text-cyan-400"
                    >
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {doc.title}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                        {doc.classification} · SHA-256 {doc.sha256Hash.slice(0, 12)}…
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleDocumentFavorite(doc.id)}
                      aria-label={`Unstar ${doc.title}`}
                      className="text-amber-500 hover:text-amber-400 p-1 shrink-0"
                    >
                      <Star className="h-3.5 w-3.5 fill-amber-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 ${cardPad}`}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Upcoming Engineering Tasks
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModule('calendar')}
                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>Calendar</span>
              </button>
            </div>
            {openTasks.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
                All tasks completed. Add new tasks in the Productivity Centre.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {openTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => toggleTask(task.id)}
                    className="w-full py-2.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 px-1 rounded transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Square className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                        {task.title}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                      {task.dueDate} · {task.priority}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Activity Table */}
      {widgets.showRecentActivity && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Recent System Activity
            </h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1">
                {(['All', 'Success', 'Warning', 'Error'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setActivityFilter(f)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      activityFilter === f
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setActiveModule('reports')}
                className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline whitespace-nowrap"
              >
                View All Reports
              </button>
            </div>
          </div>

          {isRefreshing ? (
            <TableSkeleton rows={5} cols={5} />
          ) : filteredLogs.length === 0 ? (
            <EmptyState
              icon={<FileCheck2 className="h-5 w-5" />}
              title="No matching activity logs"
              description="No audit entries match the selected filter, or the workspace has been cleared."
              actionLabel="Restore Demo Dataset"
              onAction={() => void resetDemoData()}
            />
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-4">Module</th>
                    <th className="py-2.5 px-4">Action</th>
                    <th className="py-2.5 px-4">Resource</th>
                    <th className="py-2.5 px-4">Outcome</th>
                    <th className="py-2.5 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                  {filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {log.module}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{log.action}</td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 max-w-xs truncate">
                        {formatResource(log.resourceLabel)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusLabel status={log.outcome} />
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
