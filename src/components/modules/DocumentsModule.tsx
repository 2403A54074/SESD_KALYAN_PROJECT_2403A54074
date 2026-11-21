import React, { useRef, useState } from 'react';
import {
  Download,
  Eye,
  FileText,
  Fingerprint,
  Info,
  Search,
  Stamp,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import type { DocumentClassification, VaultDocument } from '../../types/system';
import {
  computeSha256Hex,
  downloadPdfBytes,
  formatBytes,
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

export const DocumentsModule: React.FC = () => {
  const {
    state,
    isRefreshing,
    registerDocument,
    deleteDocument,
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
  const [ownerName, setOwnerName] = useState('');
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [detailDoc, setDetailDoc] = useState<VaultDocument | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const rowPad = state.settings.compactTables ? 'py-2 px-3.5' : 'py-3 px-4';

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

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingFile) {
      setErrorMsg('Please select a valid PDF file first.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Document title is required.');
      return;
    }
    if (!ownerName.trim()) {
      setErrorMsg('Owner name is required.');
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
      setOwnerName('');
      setNotes('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload document.');
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
      doc.classification.toLowerCase().includes(q) ||
      doc.ownerName.toLowerCase().includes(q) ||
      `DOC-${doc.id.slice(0, 8)}`.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <ModulePageHeader
        title="Documents"
        description="Upload original PDF documents, record classification, owner name, and description, compute SHA-256 fingerprints, and preview or download registered originals."
      />

      {errorMsg && (
        <div className="mb-5">
          <ErrorAlert message={errorMsg} onDismiss={() => setErrorMsg(null)} />
        </div>
      )}

      {/* Upload & Metadata Form (no prefilled fields) */}
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
              {pendingFile ? pendingFile.fileName : 'Drop an original PDF document here'}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xs">
              {pendingFile
                ? `${pendingFile.pageCount} page(s) · ${formatBytes(pendingFile.bytes.byteLength)} · Valid PDF header`
                : 'Supports standard PDF files up to 25 MB. Fingerprinted client-side using Web Crypto SHA-256.'}
            </p>

            {pendingFile && (
              <div className="mt-4 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 text-left">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Fingerprint className="h-3.5 w-3.5 text-cyan-500" />
                    <span>SHA-256 Fingerprint</span>
                  </p>
                  <CopyValueButton value={pendingFile.sha256} label="Copy" />
                </div>
                <p className="mt-1.5 font-mono text-xs text-cyan-700 dark:text-cyan-300 break-all tabular-nums">
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
                {isProcessing ? 'Calculating SHA-256…' : pendingFile ? 'Choose Another PDF' : 'Select PDF File'}
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
                placeholder="Enter document title"
                required
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Classification
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
                Owner Name
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Enter document owner name"
                required
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Description
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional document description or distribution context"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              A unique Document ID is generated automatically. Original PDF stays unchanged.
            </p>
            <button
              type="submit"
              disabled={!pendingFile || isProcessing}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <span>Save Document</span>
            </button>
          </div>
        </div>
      </form>

      {/* Registered Documents List */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          Uploaded Documents ({filteredDocs.length})
        </h2>
        <div className="relative w-full sm:w-72">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search title, ID, owner, SHA-256…"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      {isRefreshing ? (
        <TableSkeleton rows={3} cols={5} />
      ) : filteredDocs.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="No documents uploaded yet"
          description="Select an original PDF file above to calculate its SHA-256 fingerprint and add it to your document library."
        />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Document &amp; ID</th>
                <th className="py-2.5 px-4">Classification &amp; Owner</th>
                <th className="py-2.5 px-4">SHA-256 Fingerprint</th>
                <th className="py-2.5 px-4 text-right">Pages / Size</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {filteredDocs.map((doc) => {
                const bytes = getPdfBinary(`doc:${doc.id}`);
                const docCode = `DOC-${doc.id.slice(0, 8).toUpperCase()}`;
                return (
                  <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className={rowPad}>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{doc.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {docCode} · {doc.fileName}
                      </p>
                      {doc.notes && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                          {doc.notes}
                        </p>
                      )}
                    </td>
                    <td className={`${rowPad} whitespace-nowrap`}>
                      <p className="font-medium text-slate-800 dark:text-slate-200">{doc.classification}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{doc.ownerName}</p>
                    </td>
                    <td className={rowPad}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono tabular-nums text-cyan-700 dark:text-cyan-400">
                          {shortHash(doc.sha256Hash)}
                        </span>
                        <CopyValueButton value={doc.sha256Hash} label="Copy" />
                      </div>
                    </td>
                    <td className={`${rowPad} text-right font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap`}>
                      {doc.pageCount}p · {formatBytes(doc.fileSizeBytes)}
                    </td>
                    <td className={`${rowPad} text-right whitespace-nowrap`}>
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDetailDoc(doc)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <Info className="h-3 w-3" />
                          <span>Details</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!bytes) {
                              pushToast({
                                title: 'Original PDF Bytes Not Cached',
                                description:
                                  'Document metadata & SHA-256 are saved, but the PDF file bytes were cleared from local IndexedDB storage. Re-upload this PDF if needed.',
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
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Preview</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (bytes) downloadPdfBytes(bytes, doc.fileName);
                          }}
                          disabled={!bytes}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
                        >
                          <Download className="h-3 w-3" />
                          <span>Download</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveModule('watermarking')}
                          className="inline-flex items-center gap-1 rounded-md bg-violet-600 hover:bg-violet-500 px-2.5 py-1 text-xs font-medium text-white"
                        >
                          <Stamp className="h-3 w-3" />
                          <span>Watermark</span>
                        </button>
                        {confirmDeleteId === doc.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                void deleteDocument(doc.id);
                                setConfirmDeleteId(null);
                              }}
                              className="rounded-md bg-rose-600 px-2 py-1 text-xs font-semibold text-white"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(doc.id)}
                            aria-label={`Delete ${doc.title}`}
                            className="rounded-md border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Document Details Modal */}
      {detailDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Document Details"
          onClick={() => setDetailDoc(null)}
        >
          <div
            className="w-full max-w-xl rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <p className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400">
                  DOC-{detailDoc.id.slice(0, 8).toUpperCase()}
                </p>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {detailDoc.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailDoc(null)}
                aria-label="Close document details"
                className="rounded-md p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <dt className="text-slate-500 dark:text-slate-400">File Name</dt>
                <dd className="mt-1 font-mono text-slate-900 dark:text-slate-100 break-all">
                  {detailDoc.fileName}
                </dd>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <dt className="text-slate-500 dark:text-slate-400">Classification</dt>
                <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {detailDoc.classification}
                </dd>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <dt className="text-slate-500 dark:text-slate-400">Owner Name</dt>
                <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                  {detailDoc.ownerName}
                </dd>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <dt className="text-slate-500 dark:text-slate-400">Pages &amp; File Size</dt>
                <dd className="mt-1 font-mono text-slate-900 dark:text-slate-100">
                  {detailDoc.pageCount} page(s) · {formatBytes(detailDoc.fileSizeBytes)}
                </dd>
              </div>
              <div className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <dt className="text-slate-500 dark:text-slate-400">Description</dt>
                <dd className="mt-1 text-slate-800 dark:text-slate-200">
                  {detailDoc.notes || 'No description entered.'}
                </dd>
              </div>
              <div className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <dt className="text-slate-500 dark:text-slate-400">SHA-256 Fingerprint</dt>
                  <dd className="mt-1 font-mono text-cyan-700 dark:text-cyan-400 break-all">
                    {detailDoc.sha256Hash}
                  </dd>
                </div>
                <CopyValueButton value={detailDoc.sha256Hash} label="Copy" />
              </div>
              <div className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <dt className="text-slate-500 dark:text-slate-400">Uploaded Timestamp</dt>
                <dd className="mt-1 font-mono text-slate-900 dark:text-slate-100">
                  {new Date(detailDoc.createdAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
};
