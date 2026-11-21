import React, { useMemo, useState } from 'react';
import { CheckSquare, Download, Eye, Search, Square, Stamp } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import type { WatermarkColorPreset, WatermarkConfig } from '../../types/system';
import {
  downloadPdfBytes,
  formatBytes,
  getPdfBinary,
  interpolateWatermarkText,
  shortHash,
} from '../../utils/cryptoPdf';
import { CopyValueButton, EmptyState, ErrorAlert, ModulePageHeader } from '../ui/CommonUI';

const COLOR_SWATCH: Record<WatermarkColorPreset, { label: string; css: string }> = {
  cyan: { label: 'Cyan (#0891B2)', css: 'text-cyan-600 dark:text-cyan-400' },
  violet: { label: 'Violet (#7C3AED)', css: 'text-violet-600 dark:text-violet-400' },
  navy: { label: 'Navy (#0F172A)', css: 'text-slate-900 dark:text-slate-200' },
  crimson: { label: 'Crimson (#DC2626)', css: 'text-rose-600 dark:text-rose-400' },
};

export const WatermarkingModule: React.FC = () => {
  const { state, issueWatermarksBatch, openPdfPreview, setActiveModule, pushToast } = useSystem();

  const [selectedDocId, setSelectedDocId] = useState(state.documents[0]?.id || '');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [config, setConfig] = useState<WatermarkConfig>(state.settings.defaultWatermark);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const rowPad = state.settings.compactTables ? 'py-2 px-3.5' : 'py-3 px-4';

  const selectedDoc = useMemo(
    () => state.documents.find((d) => d.id === selectedDocId) || state.documents[0],
    [state.documents, selectedDocId]
  );

  const activeRecipients = useMemo(
    () => state.recipients.filter((r) => r.status === 'Active'),
    [state.recipients]
  );

  const filteredRecipients = useMemo(() => {
    const q = recipientSearch.trim().toLowerCase();
    return state.recipients.filter(
      (r) =>
        !q ||
        r.fullName.toLowerCase().includes(q) ||
        r.recipientCode.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.organization.toLowerCase().includes(q)
    );
  }, [state.recipients, recipientSearch]);

  const previewRecipient = useMemo(
    () =>
      state.recipients.find((r) => selectedRecipientIds.includes(r.id)) ||
      activeRecipients[0] ||
      state.recipients[0],
    [state.recipients, selectedRecipientIds, activeRecipients]
  );

  const todayDate = new Date().toISOString().slice(0, 10);
  const shortDocId = selectedDoc ? `DOC-${selectedDoc.id.slice(0, 8).toUpperCase()}` : 'DOC-00000000';

  const previewOverlay = interpolateWatermarkText(config.overlayTemplate, {
    recipientName: previewRecipient?.fullName || 'Recipient Name',
    recipientCode: previewRecipient?.recipientCode || 'REC-PREVIEW',
    recipientEmail: previewRecipient?.email || 'recipient@organization.edu',
    documentId: selectedDoc?.id || '00000000',
    watermarkCode: 'WM-PREVIEW',
    dateLabel: todayDate,
  });

  const toggleRecipient = (id: string) => {
    setSelectedRecipientIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllActive = () => {
    setSelectedRecipientIds(activeRecipients.map((r) => r.id));
  };

  const handleClearSelection = () => {
    setSelectedRecipientIds([]);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) {
      setErrorMsg('Upload or select an original PDF document first.');
      return;
    }
    if (selectedRecipientIds.length === 0) {
      setErrorMsg('Select at least one Active recipient to generate watermarked PDFs.');
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);
    try {
      await issueWatermarksBatch({
        documentId: selectedDoc.id,
        recipientIds: selectedRecipientIds,
        config,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate watermarked PDFs.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div>
      <ModulePageHeader
        title="PDF Watermarking"
        description="Select an original PDF, pick one or multiple recipients, customize watermark appearance, and generate individually tracked PDF copies while preserving the original unchanged."
      />

      {errorMsg && (
        <div className="mb-5">
          <ErrorAlert message={errorMsg} onDismiss={() => setErrorMsg(null)} />
        </div>
      )}

      {state.documents.length === 0 || state.recipients.length === 0 ? (
        <EmptyState
          icon={<Stamp className="h-5 w-5" />}
          title="Original PDF & Recipients Required"
          description="Upload at least one PDF in Documents and add at least one recipient in Recipients before generating watermarked copies."
          actionLabel={state.documents.length === 0 ? 'Upload PDF Document' : 'Add Recipient'}
          onAction={() => setActiveModule(state.documents.length === 0 ? 'documents' : 'recipients')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          {/* Configuration & Selection Form */}
          <form
            onSubmit={handleGenerate}
            className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-5"
          >
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                1. Select Original PDF
              </label>
              <select
                value={selectedDoc?.id || ''}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              >
                {state.documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title} ({doc.pageCount}p · DOC-{doc.id.slice(0, 8).toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {/* Multi-select Recipients */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  2. Select Recipients ({selectedRecipientIds.length} selected)
                </label>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={handleSelectAllActive}
                    className="font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
                  >
                    Select All Active ({activeRecipients.length})
                  </button>
                  {selectedRecipientIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="relative mb-2">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  placeholder="Filter recipients by name, ID, email, or organization…"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredRecipients.map((rec) => {
                  const isChecked = selectedRecipientIds.includes(rec.id);
                  const isDisabled = rec.status !== 'Active';
                  return (
                    <button
                      key={rec.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => toggleRecipient(rec.id)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors ${
                        isDisabled
                          ? 'opacity-45 cursor-not-allowed bg-slate-50 dark:bg-slate-950/40'
                          : isChecked
                            ? 'bg-cyan-500/10 text-slate-900 dark:text-white'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isChecked ? (
                          <CheckSquare className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-400 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {rec.fullName}{' '}
                            <span className="font-mono text-[11px] text-cyan-700 dark:text-cyan-400">
                              ({rec.recipientCode})
                            </span>
                          </p>
                          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                            {rec.email}
                            {rec.organization ? ` · ${rec.organization}` : ''}
                            {rec.role ? ` · ${rec.role}` : ''}
                          </p>
                        </div>
                      </div>
                      {isDisabled && (
                        <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 shrink-0">
                          Suspended
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Watermark Customization */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                3. Diagonal Watermark Text
              </label>
              <input
                type="text"
                value={config.overlayTemplate}
                onChange={(e) => setConfig({ ...config, overlayTemplate: e.target.value })}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Tokens: {'{{recipient_name}}'}, {'{{recipient_id}}'}, {'{{recipient_email}}'},{' '}
                {'{{document_id}}'}, {'{{date}}'}, {'{{watermark_id}}'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Color
                </label>
                <select
                  value={config.colorPreset}
                  onChange={(e) =>
                    setConfig({ ...config, colorPreset: e.target.value as WatermarkColorPreset })
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
                >
                  {Object.entries(COLOR_SWATCH).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Opacity ({Math.round(config.opacity * 100)}%)
                </label>
                <input
                  type="range"
                  min={0.08}
                  max={0.45}
                  step={0.02}
                  value={config.opacity}
                  onChange={(e) => setConfig({ ...config, opacity: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-600 mt-2"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Rotation ({config.rotationDeg}°) · Size ({config.fontSize}pt)
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={config.rotationDeg}
                    onChange={(e) => setConfig({ ...config, rotationDeg: Number(e.target.value) })}
                    className="w-1/2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                  >
                    <option value={-45}>-45°</option>
                    <option value={-38}>-38°</option>
                    <option value={-25}>-25°</option>
                    <option value={0}>0°</option>
                  </select>
                  <select
                    value={config.fontSize}
                    onChange={(e) => setConfig({ ...config, fontSize: Number(e.target.value) })}
                    className="w-1/2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                  >
                    <option value={18}>18pt</option>
                    <option value={24}>24pt</option>
                    <option value={30}>30pt</option>
                    <option value={36}>36pt</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeFooterStamp}
                  onChange={(e) => setConfig({ ...config, includeFooterStamp: e.target.checked })}
                  className="rounded border-slate-300 dark:border-slate-700 accent-cyan-600"
                />
                <span>Include footer identification (Recipient, ID, Doc ID, Date, Tracking ID)</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeCornerBadge}
                  onChange={(e) => setConfig({ ...config, includeCornerBadge: e.target.checked })}
                  className="rounded border-slate-300 dark:border-slate-700 accent-cyan-600"
                />
                <span>Include corner tracking badge</span>
              </label>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Original PDF remains unmodified. Each recipient receives one separate copy.
              </p>
              <button
                type="submit"
                disabled={isGenerating || selectedRecipientIds.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                <Stamp className="h-3.5 w-3.5" />
                <span>
                  {isGenerating
                    ? 'Generating PDFs…'
                    : selectedRecipientIds.length > 1
                      ? `Generate ${selectedRecipientIds.length} Watermarked PDFs`
                      : 'Generate Watermarked PDF'}
                </span>
              </button>
            </div>
          </form>

          {/* Live Sheet Visual Preview */}
          <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-slate-900 dark:text-white">
                Watermark Layout Preview
              </h2>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                A4 · All Pages
              </span>
            </div>

            <div className="relative flex-1 min-h-72 rounded-lg border border-slate-200 dark:border-slate-700 bg-white text-slate-800 p-5 overflow-hidden select-none shadow-xs">
              {config.includeCornerBadge && (
                <p className="text-[9px] font-mono text-right text-slate-500">
                  {(selectedDoc?.classification || 'CONFIDENTIAL').toUpperCase()} · {shortDocId} · WM-PREVIEW · P1/{selectedDoc?.pageCount || 1}
                </p>
              )}
              <div className="mt-4 space-y-2.5 opacity-60">
                <div className="h-3 w-3/5 rounded bg-slate-200" />
                <div className="h-2 w-full rounded bg-slate-100" />
                <div className="h-2 w-11/12 rounded bg-slate-100" />
                <div className="h-2 w-4/5 rounded bg-slate-100" />
                <div className="h-2 w-full rounded bg-slate-100 mt-4" />
                <div className="h-2 w-5/6 rounded bg-slate-100" />
                <div className="h-2 w-3/4 rounded bg-slate-100" />
              </div>

              <div
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-4 text-center gap-1"
                style={{
                  transform: `rotate(${config.rotationDeg}deg)`,
                  opacity: config.opacity + 0.14,
                }}
              >
                <span
                  className={`font-bold tracking-tight ${COLOR_SWATCH[config.colorPreset].css}`}
                  style={{ fontSize: `${Math.max(12, Math.round(config.fontSize * 0.58))}px` }}
                >
                  {previewOverlay}
                </span>
                <span className={`text-[10px] font-semibold ${COLOR_SWATCH[config.colorPreset].css}`}>
                  {previewRecipient?.fullName || 'Recipient Name'} ({previewRecipient?.recipientCode || 'REC-PREVIEW'}) · {shortDocId} · {todayDate}
                </span>
              </div>

              {config.includeFooterStamp && (
                <p className="absolute bottom-2.5 left-4 right-4 text-[8px] font-mono text-slate-500 truncate border-t border-slate-100 pt-1.5">
                  Recipient: {previewRecipient?.fullName || 'Recipient Name'} ({previewRecipient?.recipientCode || 'REC-PREVIEW'}) | Doc: {shortDocId} | Date: {todayDate} | Track: WM-PREVIEW
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Issued Watermarked Copies Table */}
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
        Generated Watermarked PDFs ({state.watermarkedCopies.length})
      </h2>

      {state.watermarkedCopies.length === 0 ? (
        <EmptyState
          icon={<Stamp className="h-5 w-5" />}
          title="No watermarked copies generated yet"
          description="Select an original PDF and one or more recipients above to generate personalized watermarked copies."
        />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Tracking ID</th>
                <th className="py-2.5 px-4">Document &amp; Recipient</th>
                <th className="py-2.5 px-4">Watermarked SHA-256</th>
                <th className="py-2.5 px-4 text-right">Issue Date / Size</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {state.watermarkedCopies.map((copy) => {
                const wmBytes = getPdfBinary(`wm:${copy.watermarkCode}`);
                return (
                  <tr key={copy.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className={`${rowPad} font-mono font-semibold text-violet-700 dark:text-violet-400 whitespace-nowrap`}>
                      {copy.watermarkCode}
                    </td>
                    <td className={rowPad}>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {copy.documentTitle}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {copy.recipientName} ({copy.recipientCode}) · {copy.recipientEmail} · DOC-{copy.documentId.slice(0, 8).toUpperCase()}
                      </p>
                    </td>
                    <td className={rowPad}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono tabular-nums text-cyan-700 dark:text-cyan-400">
                          {shortHash(copy.watermarkedSha256)}
                        </span>
                        <CopyValueButton value={copy.watermarkedSha256} label="Copy" />
                      </div>
                    </td>
                    <td className={`${rowPad} text-right font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap`}>
                      {copy.issueDate} · {formatBytes(copy.fileSizeBytes)}
                    </td>
                    <td className={`${rowPad} text-right whitespace-nowrap`}>
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (!wmBytes) {
                              pushToast({
                                title: 'Local Copy Not Cached',
                                description:
                                  'This watermark record is saved, but its PDF bytes are stored locally in the browser where it was generated.',
                                variant: 'warning',
                              });
                              return;
                            }
                            openPdfPreview({
                              title: `${copy.documentTitle} (${copy.watermarkCode})`,
                              fileName: `${copy.watermarkCode}-${copy.recipientName.replace(/\s+/g, '_')}.pdf`,
                              bytes: wmBytes,
                              sha256: copy.watermarkedSha256,
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Preview</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (wmBytes) {
                              downloadPdfBytes(
                                wmBytes,
                                `${copy.watermarkCode}-${copy.recipientName.replace(/\s+/g, '_')}.pdf`
                              );
                            }
                          }}
                          disabled={!wmBytes}
                          className="inline-flex items-center gap-1 rounded-md bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 px-2.5 py-1 text-xs font-medium text-white"
                        >
                          <Download className="h-3 w-3" />
                          <span>Download</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
