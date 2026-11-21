import React, { useEffect, useMemo } from 'react';
import { Download, FileText, X } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import { createPdfBlobUrl, downloadPdfBytes, formatBytes } from '../../utils/cryptoPdf';
import { CopyValueButton } from './CommonUI';

export const PdfPreviewModal: React.FC = () => {
  const { previewTarget, closePdfPreview } = useSystem();

  const blobUrl = useMemo(() => {
    if (!previewTarget) return null;
    return createPdfBlobUrl(previewTarget.bytes);
  }, [previewTarget]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  if (!previewTarget || !blobUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${previewTarget.title}`}
    >
      <div className="flex h-[88vh] w-full max-w-5xl flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="h-5 w-5 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {previewTarget.title}
              </h2>
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate tabular-nums">
                {previewTarget.fileName} · {formatBytes(previewTarget.bytes.byteLength)} · SHA-256:{' '}
                {previewTarget.sha256.slice(0, 16)}…
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <CopyValueButton value={previewTarget.sha256} label="Copy SHA-256" />
            <button
              type="button"
              onClick={() => downloadPdfBytes(previewTarget.bytes, previewTarget.fileName)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={closePdfPreview}
              aria-label="Close preview"
              className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-slate-100 dark:bg-slate-950">
          <iframe
            title={previewTarget.title}
            src={blobUrl}
            className="h-full w-full border-0"
          />
        </div>
      </div>
    </div>
  );
};
