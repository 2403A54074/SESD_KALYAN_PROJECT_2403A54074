import React, { useMemo, useState } from 'react';
import { Download, Eye, Stamp } from 'lucide-react';
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
  const { state, issueWatermark, openPdfPreview, setActiveModule, pushToast } = useSystem();

  const [selectedDocId, setSelectedDocId] = useState(state?.documents[0]?.id || '');
  const [selectedRecipientId, setSelectedRecipientId] = useState(
    state?.recipients.find((r) => r.status === 'Active')?.id || state?.recipients[0]?.id || ''
  );
  const [config, setConfig] = useState<WatermarkConfig>(
    state?.settings.defaultWatermark || {
      overlayTemplate: 'CONFIDENTIAL · {{recipient_name}} · {{watermark_id}}',
      colorPreset: 'cyan',
      opacity: 0.22,
      rotationDeg: -38,
      fontSize: 24,
      includeFooterStamp: true,
      includeCornerBadge: true,
    }
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedDoc = useMemo(
    () => state?.documents.find((d) => d.id === selectedDocId) || state?.documents[0],
    [state, selectedDocId]
  );
  const selectedRecipient = useMemo(
    () => state?.recipients.find((r) => r.id === selectedRecipientId) || state?.recipients[0],
    [state, selectedRecipientId]
  );

  if (!state) return null;

  const previewOverlay = interpolateWatermarkText(config.overlayTemplate, {
    recipientName: selectedRecipient?.fullName || 'Recipient Name',
    recipientEmail: selectedRecipient?.email || 'recipient@example.com',
    watermarkCode: 'WM-PREVIEW',
    dateLabel: new Date().toISOString().slice(0, 10),
  });

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) {
      setErrorMsg('Upload or select a Master PDF document first.');
      return;
    }
    if (!selectedRecipient) {
      setErrorMsg('Create or select an active recipient first.');
      return;
    }
    if (selectedRecipient.status === 'Suspended') {
      setErrorMsg(`Recipient ${selectedRecipient.fullName} is Suspended. Reactivate them in Recipient Management before issuing.`);
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);
    try {
      await issueWatermark({
        documentId: selectedDoc.id,
        recipientId: selectedRecipient.id,
        config,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to apply PDF watermark.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div>
      <ModulePageHeader
        title="Visible Recipient-Specific PDF Watermarking"
        description="Stamp visible diagonal recipient attribution, classification corner stamps, and SHA-256 footer proofs onto every page of a real PDF using pdf-lib."
      />

      {errorMsg && (
        <div className="mb-5">
          <ErrorAlert message={errorMsg} onDismiss={() => setErrorMsg(null)} />
        </div>
      )}

      {state.documents.length === 0 || state.recipients.length === 0 ? (
        <EmptyState
          icon={<Stamp className="h-5 w-5" />}
          title="Master PDF & Recipient Required"
          description="Ensure you have at least one master PDF in the Vault and one recipient in the Directory before generating watermarked copies."
          actionLabel={state.documents.length === 0 ? 'Upload Master PDF' : 'Add Recipient'}
          onAction={() => setActiveModule(state.documents.length === 0 ? 'upload' : 'recipients')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          {/* Controls */}
          <form
            onSubmit={handleIssue}
            className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Source Master PDF
                </label>
                <select
                  value={selectedDoc?.id || ''}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
                >
                  {state.documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.title} ({doc.pageCount}p)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Target Recipient
                </label>
                <select
                  value={selectedRecipient?.id || ''}
                  onChange={(e) => setSelectedRecipientId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
                >
                  {state.recipients.map((rec) => (
                    <option key={rec.id} value={rec.id}>
                      {rec.fullName} ({rec.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Diagonal Watermark Template
              </label>
              <input
                type="text"
                value={config.overlayTemplate}
                onChange={(e) => setConfig({ ...config, overlayTemplate: e.target.value })}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Tokens: {'{{recipient_name}}'}, {'{{recipient_email}}'}, {'{{watermark_id}}'}, {'{{date}}'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Ink Color
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
                  Angle ({config.rotationDeg}°) · Size ({config.fontSize}pt)
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

            <div className="flex flex-wrap items-center gap-6 pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeFooterStamp}
                  onChange={(e) => setConfig({ ...config, includeFooterStamp: e.target.checked })}
                  className="rounded border-slate-300 dark:border-slate-700 accent-cyan-600"
                />
                <span>Embed footer attribution &amp; SHA-256 proof</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeCornerBadge}
                  onChange={(e) => setConfig({ ...config, includeCornerBadge: e.target.checked })}
                  className="rounded border-slate-300 dark:border-slate-700 accent-cyan-600"
                />
                <span>Include page classification header</span>
              </label>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Writes visible stamps &amp; metadata tag, then hashes output PDF
              </p>
              <button
                type="submit"
                disabled={isGenerating}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                <Stamp className="h-3.5 w-3.5" />
                <span>{isGenerating ? 'Stamping PDF…' : 'Generate Watermarked PDF'}</span>
              </button>
            </div>
          </form>

          {/* Live Sheet Visual Preview */}
          <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-slate-900 dark:text-white">
                Page Overlay Simulation
              </h2>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                A4 · All Pages
              </span>
            </div>

            <div className="relative flex-1 min-h-64 rounded-lg border border-slate-200 dark:border-slate-700 bg-white text-slate-800 p-5 overflow-hidden select-none shadow-xs">
              {config.includeCornerBadge && (
                <p className="text-[9px] font-mono text-right text-slate-500">
                  {(selectedDoc?.classification || 'CONFIDENTIAL').toUpperCase()} · WM-PREVIEW · P1/{selectedDoc?.pageCount || 2}
                </p>
              )}
              <div className="mt-3 space-y-2.5 opacity-60">
                <div className="h-3 w-3/5 rounded bg-slate-200" />
                <div className="h-2 w-full rounded bg-slate-100" />
                <div className="h-2 w-11/12 rounded bg-slate-100" />
                <div className="h-2 w-4/5 rounded bg-slate-100" />
                <div className="h-2 w-full rounded bg-slate-100 mt-4" />
                <div className="h-2 w-5/6 rounded bg-slate-100" />
                <div className="h-2 w-3/4 rounded bg-slate-100" />
              </div>

              {/* Diagonal overlay preview */}
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center"
                style={{
                  transform: `rotate(${config.rotationDeg}deg)`,
                  opacity: config.opacity + 0.12,
                }}
              >
                <span
                  className={`font-bold tracking-tight ${COLOR_SWATCH[config.colorPreset].css}`}
                  style={{ fontSize: `${Math.max(12, Math.round(config.fontSize * 0.62))}px` }}
                >
                  {previewOverlay}
                </span>
              </div>

              {config.includeFooterStamp && (
                <p className="absolute bottom-2.5 left-4 right-4 text-[8px] font-mono text-slate-500 truncate border-t border-slate-100 pt-1.5">
                  Issued to: {selectedRecipient?.fullName} &lt;{selectedRecipient?.email}&gt; | Master SHA-256:{' '}
                  {selectedDoc?.sha256Hash.slice(0, 14)}…
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Issued Watermarked Copies Table */}
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
        Issued Watermarked Copies ({state.watermarkedCopies.length})
      </h2>

      {state.watermarkedCopies.length === 0 ? (
        <EmptyState
          icon={<Stamp className="h-5 w-5" />}
          title="No watermarked copies issued yet"
          description="Select a master PDF and recipient above to produce a uniquely fingerprinted PDF copy."
        />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Watermark ID</th>
                <th className="py-2.5 px-4">Document &amp; Recipient</th>
                <th className="py-2.5 px-4">Watermarked SHA-256</th>
                <th className="py-2.5 px-4 text-right">Size / Issued</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {state.watermarkedCopies.map((copy) => {
                const wmBytes = getPdfBinary(`wm:${copy.watermarkCode}`);
                return (
                  <tr key={copy.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-semibold text-violet-700 dark:text-violet-400 whitespace-nowrap">
                      {copy.watermarkCode}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {copy.documentTitle}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {copy.recipientName} · {copy.recipientEmail}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono tabular-nums text-cyan-700 dark:text-cyan-400">
                          {shortHash(copy.watermarkedSha256)}
                        </span>
                        <CopyValueButton value={copy.watermarkedSha256} label="SHA" />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatBytes(copy.fileSizeBytes)} · {new Date(copy.issuedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (!wmBytes) {
                              pushToast({
                                title: 'Session Binary Unavailable',
                                description: 'Watermark binary is kept in active session memory; regenerate to preview.',
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
