import React, { useRef, useState } from 'react';
import { Eye, FilePlus2, FileText, Search, Star, Trash2, UploadCloud } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import type { DocumentClassification } from '../../types/system';
import {
  computeSha256Hex,
  downloadPdfBytes,
  formatBytes,
  generateSamplePdf,
  getPdfBinary,
  inspectPdfBytes,
  shortHash,
} from '../../utils/cryptoPdf';
import {
  CopyValueButton,
  EmptyState,
  ErrorAlert,
  ModulePageHeader,
  TableSkeleton,
} from '../ui/CommonUI';

export const UploadModule: React.FC = () => {
  const {
    state,
    isRefreshing,
    registerDocument,
    deleteDocument,
    toggleDocumentFavorite,
    openPdfPreview,
    setActiveModule,
    pushToast,
  } = useSystem();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pendingFile, setPendingFile] = useState<{
    fileName: string;
    bytes: Uint8Array;
    sha256: string;
    pageCount: number;
  } | null>(null);

  const [title, setTitle] = useState('');
  const [classification, setClassification] = useState<DocumentClassification>('Confidential');
  const [ownerName, setOwnerName] = useState(state?.settings.displayName || 'N. Kalyan Reddy');
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!state) return null;

  const processSelectedBytes = async (fileName: string, bytes: Uint8Array) => {
    setErrorMsg(null);
    setIsProcessing(true);
    try {
      if (bytes.byteLength > 25 * 1024 * 1024) {
        throw new Error('File exceeds the 25 MB browser processing limit.');
      }
      const inspection = await inspectPdfBytes(bytes);
      const sha256 = await computeSha256Hex(bytes);
      setPendingFile({
        fileName,
        bytes,
        sha256,
        pageCount: inspection.pageCount,
      });
      if (!title.trim()) {
        setTitle(inspection.title || fileName.replace(/\.pdf$/i, ''));
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to parse PDF document.');
      setPendingFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = async (file?: File) => {
    if (!file) return;
    const buffer = await file.arrayBuffer();
    await processSelectedBytes(file.name, new Uint8Array(buffer));
  };

  const handleGenerateSample = async () => {
    const sampleTitle = 'Engineering Security & Watermark Control Policy';
    const bytes = await generateSamplePdf({
      title: sampleTitle,
      classification,
      ownerName: ownerName || 'N. Kalyan Reddy',
      sections: [
        {
          heading: '1. Purpose & Fingerprinting Baseline',
          body: 'This sample PDF is generated locally using pdf-lib to validate SHA-256 fingerprinting, visible multi-page watermarking, and forensic verification.',
        },
        {
          heading: '2. Ephemeral Relay Governance',
          body: 'All external distributions require explicit recipient attribution and HMAC-SHA256 signed webhook audit notifications.',
        },
      ],
    });
    setTitle(sampleTitle);
    setNotes('Generated in-browser sample specification for testing.');
    await processSelectedBytes('engineering-watermark-policy.pdf', bytes);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingFile) {
      setErrorMsg('Please select or generate a valid PDF document first.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Document title is required.');
      return;
    }
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      await registerDocument({
        title,
        fileName: pendingFile.fileName,
        classification,
        ownerName,
        notes,
        bytes: pendingFile.bytes,
      });
      setPendingFile(null);
      setTitle('');
      setNotes('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to register PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredDocs = state.documents.filter((doc) => {
    const q = searchQuery.toLowerCase();
    return (
      doc.title.toLowerCase().includes(q) ||
      doc.fileName.toLowerCase().includes(q) ||
      doc.sha256Hash.toLowerCase().includes(q) ||
      doc.classification.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <ModulePageHeader
        title="PDF Document Upload & Vault"
        description="Upload master PDF documents, validate %PDF- headers, compute Web Crypto SHA-256 fingerprints, and store baselines for recipient watermarking."
        actions={
          <button
            type="button"
            onClick={() => void handleGenerateSample()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <FilePlus2 className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>Generate Sample PDF</span>
          </button>
        }
      />

      {errorMsg && (
        <div className="mb-5">
          <ErrorAlert message={errorMsg} onDismiss={() => setErrorMsg(null)} />
        </div>
      )}

      {/* Upload & Registration Form */}
      <form
        onSubmit={handleRegisterSubmit}
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8"
      >
        <div className="lg:col-span-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const file = e.dataTransfer.files?.[0];
              void handleFileChange(file);
            }}
            className={`h-full min-h-60 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
              dragActive
                ? 'border-cyan-500 bg-cyan-500/5'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60'
            }`}
          >
            <UploadCloud className="h-9 w-9 text-cyan-600 dark:text-cyan-400 mb-3" />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {pendingFile ? pendingFile.fileName : 'Drop a PDF file here'}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xs">
              {pendingFile
                ? `${pendingFile.pageCount} page(s) · ${formatBytes(pendingFile.bytes.byteLength)} · Validated`
                : 'Supports standard PDF 1.4–2.0 files up to 25 MB. Parsed client-side with zero external upload.'}
            </p>

            {pendingFile && (
              <div className="mt-4 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 text-left">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Computed SHA-256 Digest
                </p>
                <p className="mt-1 font-mono text-xs text-cyan-700 dark:text-cyan-300 break-all tabular-nums">
                  {pendingFile.sha256}
                </p>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => void handleFileChange(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 px-3.5 py-2 text-xs font-medium text-white transition-colors"
              >
                {isProcessing ? 'Inspecting PDF…' : pendingFile ? 'Choose Another PDF' : 'Select PDF File'}
              </button>
              {pendingFile && (
                <button
                  type="button"
                  onClick={() =>
                    openPdfPreview({
                      title: title || pendingFile.fileName,
                      fileName: pendingFile.fileName,
                      bytes: pendingFile.bytes,
                      sha256: pendingFile.sha256,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Preview</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Document Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Q4 Cryptographic Key Escrow Policy"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Classification Level
              </label>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value as DocumentClassification)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              >
                <option value="Confidential">Confidential</option>
                <option value="Restricted">Restricted</option>
                <option value="Internal">Internal</option>
                <option value="Board Only">Board Only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Document Custodian
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Custody & Distribution Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional audit scope, distribution rules, or retention notes"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Emits <span className="font-mono">document.uploaded</span> event to Central Bus &amp; Webhooks
            </p>
            <button
              type="submit"
              disabled={!pendingFile || isProcessing}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <span>Register Master PDF</span>
            </button>
          </div>
        </div>
      </form>

      {/* Vault List */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          Master Document Vault ({filteredDocs.length})
        </h2>
        <div className="relative w-full sm:w-72">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search title, file, SHA-256…"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      {isRefreshing ? (
        <TableSkeleton rows={3} cols={6} />
      ) : filteredDocs.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="No PDF documents in vault"
          description="Upload a PDF above or generate a sample engineering PDF to compute its SHA-256 baseline."
          actionLabel="Generate Sample PDF"
          onAction={() => void handleGenerateSample()}
        />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Document</th>
                <th className="py-2.5 px-4">Classification</th>
                <th className="py-2.5 px-4">SHA-256 Fingerprint</th>
                <th className="py-2.5 px-4 text-right">Pages / Size</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {filteredDocs.map((doc) => {
                const bytes = getPdfBinary(`doc:${doc.id}`);
                return (
                  <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-start gap-2.5">
                        <button
                          type="button"
                          onClick={() => toggleDocumentFavorite(doc.id)}
                          aria-label={doc.isFavorite ? `Unfavorite ${doc.title}` : `Favorite ${doc.title}`}
                          className="mt-0.5 text-slate-400 hover:text-amber-500 transition-colors shrink-0"
                        >
                          <Star
                            className={`h-3.5 w-3.5 ${
                              doc.isFavorite ? 'fill-amber-400 text-amber-400' : ''
                            }`}
                          />
                        </button>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{doc.title}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {doc.fileName} · {doc.ownerName}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {doc.classification}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono tabular-nums text-cyan-700 dark:text-cyan-400">
                          {shortHash(doc.sha256Hash)}
                        </span>
                        <CopyValueButton value={doc.sha256Hash} label="Hash" />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {doc.pageCount}p · {formatBytes(doc.fileSizeBytes)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (!bytes) {
                              pushToast({
                                title: 'Session Binary Unavailable',
                                description: 'Re-upload this PDF to preview or download its binary bytes.',
                                variant: 'warning',
                              });
                              return;
                            }
                            openPdfPreview({
                              title: doc.title,
                              fileName: doc.fileName,
                              bytes,
                              sha256: doc.sha256Hash,
                            });
                          }}
                          className="rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (bytes) downloadPdfBytes(bytes, doc.fileName);
                          }}
                          disabled={!bytes}
                          className="rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
                        >
                          Download
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveModule('watermarking')}
                          className="rounded-md bg-violet-600 hover:bg-violet-500 px-2.5 py-1 text-xs font-medium text-white"
                        >
                          Watermark
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteDocument(doc.id)}
                          aria-label={`Delete ${doc.title}`}
                          className="rounded-md border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
