import React, { useMemo, useState } from 'react';
import { ClipboardList, Download, Search } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import { shortHash } from '../../utils/cryptoPdf';
import { EmptyState, ModulePageHeader, StatusLabel } from '../ui/CommonUI';

function triggerDownload(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export const ReportsLogsModule: React.FC = () => {
  const { state, pushToast, recordReportExport } = useSystem();
  const [activeTab, setActiveTab] = useState<'attribution' | 'activity'>('attribution');
  const [docFilter, setDocFilter] = useState<string>('all');
  const [recipientFilter, setRecipientFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const attributionRows = useMemo(() => {
    if (!state) return [];
    return state.watermarkedCopies.filter((copy) => {
      if (docFilter !== 'all' && copy.documentId !== docFilter) return false;
      if (recipientFilter !== 'all' && copy.recipientId !== recipientFilter) return false;
      const q = searchQuery.toLowerCase();
      return (
        copy.watermarkCode.toLowerCase().includes(q) ||
        copy.documentTitle.toLowerCase().includes(q) ||
        copy.recipientName.toLowerCase().includes(q) ||
        copy.recipientEmail.toLowerCase().includes(q) ||
        copy.watermarkedSha256.toLowerCase().includes(q)
      );
    });
  }, [state, docFilter, recipientFilter, searchQuery]);

  const filteredLogs = useMemo(() => {
    if (!state) return [];
    const q = searchQuery.toLowerCase();
    return state.activityLogs.filter(
      (l) =>
        l.module.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.resourceLabel.toLowerCase().includes(q) ||
        l.actor.toLowerCase().includes(q)
    );
  }, [state, searchQuery]);

  if (!state) return null;

  const handleExportCsv = () => {
    if (activeTab === 'attribution') {
      const headers = [
        'Watermark_ID',
        'Document_Title',
        'Recipient_Name',
        'Recipient_Email',
        'Original_SHA256',
        'Watermarked_SHA256',
        'Issued_At',
      ];
      const rows = attributionRows.map((r) => [
        r.watermarkCode,
        `"${r.documentTitle.replaceAll('"', '""')}"`,
        `"${r.recipientName.replaceAll('"', '""')}"`,
        r.recipientEmail,
        r.originalSha256,
        r.watermarkedSha256,
        r.issuedAt,
      ]);
      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      triggerDownload(csv, 'attribution-report.csv', 'text/csv;charset=utf-8');
      recordReportExport();
    } else {
      const headers = ['Timestamp', 'Actor', 'Module', 'Action', 'Resource', 'Outcome', 'Summary'];
      const rows = filteredLogs.map((l) => [
        l.createdAt,
        `"${l.actor.replaceAll('"', '""')}"`,
        `"${l.module}"`,
        `"${l.action}"`,
        `"${l.resourceLabel.replaceAll('"', '""')}"`,
        l.outcome,
        `"${l.metadataSummary.replaceAll('"', '""')}"`,
      ]);
      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      triggerDownload(csv, 'activity-audit-log.csv', 'text/csv;charset=utf-8');
    }
    pushToast({ title: 'CSV Exported', variant: 'success' });
  };

  const handleExportJson = () => {
    const payload =
      activeTab === 'attribution'
        ? { exportedAt: new Date().toISOString(), type: 'attribution_report', records: attributionRows }
        : { exportedAt: new Date().toISOString(), type: 'activity_logs', records: filteredLogs };
    triggerDownload(
      JSON.stringify(payload, null, 2),
      activeTab === 'attribution' ? 'attribution-report.json' : 'activity-logs.json',
      'application/json'
    );
    if (activeTab === 'attribution') recordReportExport();
    pushToast({ title: 'JSON Report Exported', variant: 'success' });
  };

  return (
    <div>
      <ModulePageHeader
        title="Activity Logs & Attribution Reports"
        description="Inspect chain-of-custody attribution matrices linking master documents to recipient copies and export full CSV or JSON audit trails."
        actions={
          <>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export JSON</span>
            </button>
          </>
        }
      />

      {/* Tabs + Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('attribution')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
              activeTab === 'attribution'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Attribution Reports ({attributionRows.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
              activeTab === 'activity'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            System Activity Logs ({filteredLogs.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab === 'attribution' && (
            <>
              <select
                value={docFilter}
                onChange={(e) => setDocFilter(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="all">All Master Documents</option>
                {state.documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
              <select
                value={recipientFilter}
                onChange={(e) => setRecipientFilter(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="all">All Recipients</option>
                {state.recipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.fullName}
                  </option>
                ))}
              </select>
            </>
          )}

          <div className="relative w-64">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search records…"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {activeTab === 'attribution' ? (
        attributionRows.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title="No attribution records match filters"
            description="Issue a watermarked PDF copy or broaden your document/recipient filters."
          />
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Watermark ID</th>
                  <th className="py-2.5 px-4">Master Document</th>
                  <th className="py-2.5 px-4">Recipient Attribution</th>
                  <th className="py-2.5 px-4">Watermarked SHA-256</th>
                  <th className="py-2.5 px-4 text-right">Verifications / Issued</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {attributionRows.map((row) => {
                  const verCount = state.verificationRecords.filter(
                    (v) => v.matchedWatermarkCode === row.watermarkCode
                  ).length;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-semibold text-violet-700 dark:text-violet-400">
                        {row.watermarkCode}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {row.documentTitle}
                        </p>
                        <p className="text-[11px] font-mono text-slate-500">
                          Master: {shortHash(row.originalSha256, 10, 6)}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {row.recipientName}
                        </p>
                        <p className="text-[11px] font-mono text-slate-500">{row.recipientEmail}</p>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-cyan-700 dark:text-cyan-400">
                        {shortHash(row.watermarkedSha256, 14, 8)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {verCount} checks · {new Date(row.issuedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="No activity logs found"
          description="System actions across all modules will appear here chronologically."
        />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Actor / Module</th>
                <th className="py-2.5 px-4">Action &amp; Resource</th>
                <th className="py-2.5 px-4">Outcome</th>
                <th className="py-2.5 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{log.actor}</p>
                    <p className="text-[11px] text-slate-500">{log.module}</p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-slate-800 dark:text-slate-200">{log.action}</p>
                    <p className="text-[11px] font-mono text-cyan-700 dark:text-cyan-400">
                      {log.resourceLabel}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <StatusLabel status={log.outcome} />
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                    {log.metadataSummary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
