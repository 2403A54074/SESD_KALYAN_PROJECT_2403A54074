import React, { useMemo, useState } from 'react';
import { ClipboardList, Download, Search } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import {
  downloadPdfBytes,
  formatBytes,
  generateReportPdfBytes,
  shortHash,
} from '../../utils/cryptoPdf';
import { EmptyState, ModulePageHeader, StatusLabel } from '../ui/CommonUI';

type ReportTab = 'attribution' | 'uploads' | 'recipients' | 'watermarks' | 'verifications';

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

function escapeCsv(val: string | number | undefined): string {
  const str = String(val ?? '');
  return `"${str.replaceAll('"', '""')}"`;
}

export const ReportsLogsModule: React.FC = () => {
  const { state, pushToast } = useSystem();
  const [activeTab, setActiveTab] = useState<ReportTab>('attribution');
  const [docFilter, setDocFilter] = useState<string>('all');
  const [recipientFilter, setRecipientFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const rowPad = state.settings.compactTables ? 'py-2 px-3.5' : 'py-3 px-4';
  const q = searchQuery.trim().toLowerCase();

  const attributionRows = useMemo(() => {
    return state.watermarkedCopies.filter((copy) => {
      if (docFilter !== 'all' && copy.documentId !== docFilter) return false;
      if (recipientFilter !== 'all' && copy.recipientId !== recipientFilter) return false;
      return (
        !q ||
        copy.watermarkCode.toLowerCase().includes(q) ||
        copy.documentTitle.toLowerCase().includes(q) ||
        copy.recipientCode.toLowerCase().includes(q) ||
        copy.recipientName.toLowerCase().includes(q) ||
        copy.recipientEmail.toLowerCase().includes(q) ||
        copy.watermarkedSha256.toLowerCase().includes(q)
      );
    });
  }, [state.watermarkedCopies, docFilter, recipientFilter, q]);

  const uploadRows = useMemo(() => {
    return state.documents.filter(
      (doc) =>
        !q ||
        doc.title.toLowerCase().includes(q) ||
        doc.fileName.toLowerCase().includes(q) ||
        doc.ownerName.toLowerCase().includes(q) ||
        doc.sha256Hash.toLowerCase().includes(q)
    );
  }, [state.documents, q]);

  const recipientHistoryRows = useMemo(() => {
    const recLogs = state.activityLogs.filter((l) => l.module === 'Recipients');
    if (recLogs.length > 0) {
      return recLogs.filter(
        (l) =>
          !q ||
          l.action.toLowerCase().includes(q) ||
          l.resourceLabel.toLowerCase().includes(q) ||
          l.metadataSummary.toLowerCase().includes(q)
      );
    }
    return state.recipients
      .filter(
        (r) =>
          !q ||
          r.fullName.toLowerCase().includes(q) ||
          r.recipientCode.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.organization.toLowerCase().includes(q)
      )
      .map((r) => ({
        id: r.id,
        actor: state.settings.displayName,
        module: 'Recipients',
        action: 'Registered Recipient',
        resourceLabel: `${r.fullName} (${r.recipientCode})`,
        outcome: r.status === 'Active' ? ('Success' as const) : ('Warning' as const),
        metadataSummary: `${r.email}${r.organization ? ` · ${r.organization}` : ''}${r.role ? ` · ${r.role}` : ''}`,
        createdAt: r.createdAt,
      }));
  }, [state.activityLogs, state.recipients, state.settings.displayName, q]);

  const verificationRows = useMemo(() => {
    return state.verificationRecords.filter(
      (rec) =>
        !q ||
        rec.fileName.toLowerCase().includes(q) ||
        rec.outcome.toLowerCase().includes(q) ||
        (rec.matchedRecipientName || '').toLowerCase().includes(q) ||
        (rec.matchedDocumentTitle || '').toLowerCase().includes(q) ||
        rec.computedSha256.toLowerCase().includes(q)
    );
  }, [state.verificationRecords, q]);

  const getTabExportData = () => {
    if (activeTab === 'attribution' || activeTab === 'watermarks') {
      return {
        title: activeTab === 'attribution' ? 'Document Attribution Report' : 'Watermark Generation History',
        fileBase: activeTab === 'attribution' ? 'attribution-report' : 'watermark-history',
        headers: ['Tracking ID', 'Document', 'Recipient ID', 'Recipient', 'Email', 'Issue Date', 'Watermarked SHA-256'],
        rows: attributionRows.map((r) => [
          r.watermarkCode,
          r.documentTitle,
          r.recipientCode,
          r.recipientName,
          r.recipientEmail,
          r.issueDate,
          r.watermarkedSha256,
        ]),
      };
    }
    if (activeTab === 'uploads') {
      return {
        title: 'Document Upload History',
        fileBase: 'document-upload-history',
        headers: ['Document ID', 'Title', 'File Name', 'Classification', 'Owner', 'Pages', 'SHA-256'],
        rows: uploadRows.map((d) => [
          `DOC-${d.id.slice(0, 8).toUpperCase()}`,
          d.title,
          d.fileName,
          d.classification,
          d.ownerName,
          String(d.pageCount),
          d.sha256Hash,
        ]),
      };
    }
    if (activeTab === 'recipients') {
      return {
        title: 'Recipient Management History',
        fileBase: 'recipient-management-history',
        headers: ['Action', 'Recipient', 'Outcome', 'Details', 'Timestamp'],
        rows: recipientHistoryRows.map((r) => [
          r.action,
          r.resourceLabel,
          r.outcome,
          r.metadataSummary,
          new Date(r.createdAt).toLocaleString(),
        ]),
      };
    }
    return {
      title: 'Document Verification History',
      fileBase: 'verification-history',
      headers: ['Checked File', 'Outcome', 'Matched Document', 'Recipient', 'Tracking ID', 'SHA-256'],
      rows: verificationRows.map((v) => [
        v.fileName,
        v.outcome,
        v.matchedDocumentTitle || '—',
        v.matchedRecipientName || '—',
        v.matchedWatermarkCode || '—',
        v.computedSha256,
      ]),
    };
  };

  const handleExportCsv = () => {
    const data = getTabExportData();
    const csv = [
      data.headers.map((h) => escapeCsv(h)).join(','),
      ...data.rows.map((row) => row.map((cell) => escapeCsv(cell)).join(',')),
    ].join('\n');
    const fileName = `${data.fileBase}.csv`;
    triggerDownload(csv, fileName, 'text/csv;charset=utf-8');
    pushToast({ title: 'CSV Report Exported', description: fileName, variant: 'success' });
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const data = getTabExportData();
      const pdfBytes = await generateReportPdfBytes({
        title: data.title,
        subtitle: 'Digital Document Watermarking & Verification System',
        headers: data.headers,
        rows: data.rows,
      });
      const fileName = `${data.fileBase}.pdf`;
      downloadPdfBytes(pdfBytes, fileName);
      pushToast({ title: 'PDF Report Exported', description: fileName, variant: 'success' });
    } catch (err) {
      pushToast({
        title: 'PDF Export Failed',
        description: err instanceof Error ? err.message : 'Unable to generate PDF report.',
        variant: 'error',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div>
      <ModulePageHeader
        title="Reports & Activity"
        description="Inspect upload history, recipient management history, watermark generation history, verification history, and export attribution reports as PDF or CSV."
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
              onClick={() => void handleExportPdf()}
              disabled={isExportingPdf}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isExportingPdf ? 'Building PDF…' : 'Export PDF'}</span>
            </button>
          </>
        }
      />

      {/* Tabs + Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1">
          {(
            [
              { id: 'attribution', label: `Attribution Report (${attributionRows.length})` },
              { id: 'uploads', label: `Upload History (${uploadRows.length})` },
              { id: 'recipients', label: `Recipient History (${recipientHistoryRows.length})` },
              { id: 'watermarks', label: `Watermark History (${attributionRows.length})` },
              { id: 'verifications', label: `Verification History (${verificationRows.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {(activeTab === 'attribution' || activeTab === 'watermarks') && (
            <>
              <select
                value={docFilter}
                onChange={(e) => setDocFilter(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="all">All Documents</option>
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

          <div className="relative w-60">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter history…"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {(activeTab === 'attribution' || activeTab === 'watermarks') &&
        (attributionRows.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title="No watermark or attribution records"
            description="Generate watermarked PDFs to populate recipient attribution and issuance history."
          />
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Tracking ID</th>
                  <th className="py-2.5 px-4">Document</th>
                  <th className="py-2.5 px-4">Recipient</th>
                  <th className="py-2.5 px-4">Watermarked SHA-256</th>
                  <th className="py-2.5 px-4 text-right">Issue Date / Checks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {attributionRows.map((row) => {
                  const verCount = state.verificationRecords.filter(
                    (v) => v.matchedWatermarkCode === row.watermarkCode
                  ).length;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className={`${rowPad} font-mono font-semibold text-violet-700 dark:text-violet-400 whitespace-nowrap`}>
                        {row.watermarkCode}
                      </td>
                      <td className={rowPad}>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{row.documentTitle}</p>
                        <p className="text-[11px] font-mono text-slate-500">
                          DOC-{row.documentId.slice(0, 8).toUpperCase()}
                        </p>
                      </td>
                      <td className={rowPad}>
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {row.recipientName}{' '}
                          <span className="font-mono text-[11px] text-cyan-700 dark:text-cyan-400">
                            ({row.recipientCode})
                          </span>
                        </p>
                        <p className="text-[11px] font-mono text-slate-500">{row.recipientEmail}</p>
                      </td>
                      <td className={`${rowPad} font-mono tabular-nums text-cyan-700 dark:text-cyan-400`}>
                        {shortHash(row.watermarkedSha256, 14, 8)}
                      </td>
                      <td className={`${rowPad} text-right font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap`}>
                        {row.issueDate} · {verCount} checks
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

      {activeTab === 'uploads' &&
        (uploadRows.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title="No document uploads recorded"
            description="Uploaded PDFs and their SHA-256 fingerprints appear here."
          />
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Document</th>
                  <th className="py-2.5 px-4">Classification / Owner</th>
                  <th className="py-2.5 px-4">SHA-256 Fingerprint</th>
                  <th className="py-2.5 px-4 text-right">Size</th>
                  <th className="py-2.5 px-4 text-right">Uploaded At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {uploadRows.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className={rowPad}>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{doc.title}</p>
                      <p className="text-[11px] font-mono text-slate-500">
                        DOC-{doc.id.slice(0, 8).toUpperCase()} · {doc.fileName}
                      </p>
                    </td>
                    <td className={rowPad}>
                      <p className="text-slate-800 dark:text-slate-200">{doc.classification}</p>
                      <p className="text-[11px] text-slate-500">{doc.ownerName}</p>
                    </td>
                    <td className={`${rowPad} font-mono tabular-nums text-cyan-700 dark:text-cyan-400`}>
                      {shortHash(doc.sha256Hash, 14, 8)}
                    </td>
                    <td className={`${rowPad} text-right font-mono tabular-nums text-slate-500 whitespace-nowrap`}>
                      {doc.pageCount}p · {formatBytes(doc.fileSizeBytes)}
                    </td>
                    <td className={`${rowPad} text-right font-mono tabular-nums text-slate-500 whitespace-nowrap`}>
                      {new Date(doc.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {activeTab === 'recipients' &&
        (recipientHistoryRows.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title="No recipient management history"
            description="Added, updated, suspended, or removed recipients appear here."
          />
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Recipient</th>
                  <th className="py-2.5 px-4">Details</th>
                  <th className="py-2.5 px-4">Outcome</th>
                  <th className="py-2.5 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {recipientHistoryRows.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className={`${rowPad} font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap`}>
                      {entry.action}
                    </td>
                    <td className={`${rowPad} font-mono text-slate-700 dark:text-slate-300`}>
                      {entry.resourceLabel}
                    </td>
                    <td className={`${rowPad} text-slate-600 dark:text-slate-400`}>
                      {entry.metadataSummary}
                    </td>
                    <td className={rowPad}>
                      <StatusLabel status={entry.outcome} />
                    </td>
                    <td className={`${rowPad} text-right font-mono tabular-nums text-slate-500 whitespace-nowrap`}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {activeTab === 'verifications' &&
        (verificationRows.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title="No verification history available"
            description="PDF verification checks appear here with their cryptographic outcome."
          />
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Checked File</th>
                  <th className="py-2.5 px-4">Outcome</th>
                  <th className="py-2.5 px-4">Matched Document / Recipient</th>
                  <th className="py-2.5 px-4">SHA-256</th>
                  <th className="py-2.5 px-4 text-right">Verified At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {verificationRows.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className={`${rowPad} font-medium text-slate-900 dark:text-slate-100`}>
                      {rec.fileName}
                    </td>
                    <td className={rowPad}>
                      <StatusLabel
                        status={rec.outcome}
                        tone={
                          rec.outcome === 'Modified or Unregistered File'
                            ? 'error'
                            : rec.outcome === 'Watermarked Copy Match'
                              ? 'success'
                              : 'info'
                        }
                      />
                    </td>
                    <td className={rowPad}>
                      <p className="text-slate-800 dark:text-slate-200">
                        {rec.matchedDocumentTitle || '—'}
                      </p>
                      {rec.outcome === 'Watermarked Copy Match' && rec.matchedRecipientName && (
                        <p className="text-[11px] text-slate-500">
                          {rec.matchedRecipientName} ({rec.matchedRecipientCode || rec.matchedRecipientEmail})
                        </p>
                      )}
                    </td>
                    <td className={`${rowPad} font-mono tabular-nums text-cyan-700 dark:text-cyan-400`}>
                      {shortHash(rec.computedSha256, 12, 8)}
                    </td>
                    <td className={`${rowPad} text-right font-mono tabular-nums text-slate-500 whitespace-nowrap`}>
                      {new Date(rec.verifiedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
};
