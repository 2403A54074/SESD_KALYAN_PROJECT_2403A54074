import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  FileText,
  FileUp,
  RefreshCw,
  ShieldCheck,
  Stamp,
  UserPlus,
  Users,
} from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import { EmptyState, ModulePageHeader, StatusLabel, TableSkeleton } from '../ui/CommonUI';

export const DashboardModule: React.FC = () => {
  const { state, isRefreshing, refreshView, setActiveModule } = useSystem();
  const [activityFilter, setActivityFilter] = useState<'All' | 'Success' | 'Warning' | 'Error'>('All');

  const stats = useMemo(() => {
    const activeRecipients = state.recipients.filter((r) => r.status === 'Active').length;
    const matchedVerifications = state.verificationRecords.filter(
      (v) => v.outcome !== 'Modified or Unregistered File'
    ).length;
    return {
      documents: state.documents.length,
      watermarks: state.watermarkedCopies.length,
      recipients: state.recipients.length,
      activeRecipients,
      verifications: state.verificationRecords.length,
      matchedVerifications,
    };
  }, [state]);

  const recentLogs = useMemo(() => {
    return state.activityLogs
      .filter((log) => (activityFilter === 'All' ? true : log.outcome === activityFilter))
      .slice(0, 10);
  }, [state.activityLogs, activityFilter]);

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Dashboard"
        description="Overview of uploaded PDFs, registered recipients, generated watermarked copies, and verification activity."
        actions={
          <>
            <button
              type="button"
              onClick={() => setActiveModule('help')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>User Manual</span>
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
              onClick={() => setActiveModule('documents')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <FileUp className="h-3.5 w-3.5" />
              <span>Upload PDF</span>
            </button>
          </>
        }
      />

      {/* 4 Core KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setActiveModule('documents')}
          className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 hover:border-cyan-500/50 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">Total Uploaded Documents</span>
            <FileText className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <p className="mt-2.5 text-2xl font-semibold text-slate-900 dark:text-white font-mono tabular-nums">
            {stats.documents}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            SHA-256 fingerprinted originals
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveModule('watermarking')}
          className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 hover:border-violet-500/50 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">Total Watermarked PDFs</span>
            <Stamp className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <p className="mt-2.5 text-2xl font-semibold text-slate-900 dark:text-white font-mono tabular-nums">
            {stats.watermarks}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Recipient-tracked copies generated
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveModule('recipients')}
          className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 hover:border-cyan-500/50 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">Total Registered Recipients</span>
            <Users className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <p className="mt-2.5 text-2xl font-semibold text-slate-900 dark:text-white font-mono tabular-nums">
            {stats.recipients}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {stats.activeRecipients} active
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveModule('verification')}
          className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 hover:border-emerald-500/50 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">Total Verification Checks</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2.5 text-2xl font-semibold text-slate-900 dark:text-white font-mono tabular-nums">
            {stats.verifications}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {stats.matchedVerifications} verified matches
          </p>
        </button>
      </div>

      {/* Quick Workflow Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            module: 'documents' as const,
            title: 'Upload & Fingerprint PDF',
            sub: 'Register an original document',
            icon: FileUp,
          },
          {
            module: 'recipients' as const,
            title: 'Add Recipient',
            sub: 'Register an authorized recipient',
            icon: UserPlus,
          },
          {
            module: 'watermarking' as const,
            title: 'Generate Watermarked PDFs',
            sub: 'Issue personalized copies',
            icon: Stamp,
          },
          {
            module: 'verification' as const,
            title: 'Verify a PDF',
            sub: 'Check SHA-256 & tracking ID',
            icon: ShieldCheck,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.module}
              type="button"
              onClick={() => setActiveModule(item.module)}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 px-4 py-3 text-left hover:border-cyan-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
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

      {/* Recent Actual Activity */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Recent Document Activity
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
              View Reports
            </button>
          </div>
        </div>

        {isRefreshing ? (
          <TableSkeleton rows={4} cols={5} />
        ) : recentLogs.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="No document activity yet"
            description="Upload a PDF document, add a recipient manually, generate watermarks, or verify a PDF to record actual activity here."
            actionLabel="Upload First PDF"
            onAction={() => setActiveModule('documents')}
          />
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Module</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Document / Resource</th>
                  <th className="py-2.5 px-4">Outcome</th>
                  <th className="py-2.5 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {recentLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {log.module}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{log.action}</td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {log.resourceLabel}
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
    </div>
  );
};
