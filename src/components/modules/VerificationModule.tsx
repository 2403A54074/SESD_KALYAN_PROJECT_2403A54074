import React, { useRef, useState } from 'react';
import { CheckCircle2, FileSearch, Info, ShieldAlert, Upload } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import type { VerificationRecord } from '../../types/system';
import { CopyValueButton, EmptyState, ErrorAlert, ModulePageHeader, StatusLabel } from '../ui/CommonUI';

export const VerificationModule: React.FC = () => {
  const { state, verifyDocumentFile, verifyByHashOrCode } = useSystem();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragActive, setDragActive] = useState(false);
  const [lookupInput, setLookupInput] = useState('');
  const [latestResult, setLatestResult] = useState<VerificationRecord | null>(
    state.verificationRecords[0] || null
  );
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const rowPad = state.settings.compactTables ? 'py-2 px-3.5' : 'py-3 px-4';

  const handleFileVerify = async (file?: File) => {
    if (!file) return;
    setErrorMsg(null);
    setIsVerifying(true);
    try {
      const buf = await file.arrayBuffer();
      const record = await verifyDocumentFile({
        fileName: file.name,
        bytes: new Uint8Array(buf),
      });
      setLatestResult(record);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'PDF verification failed.');
    } finally {
      setIsVerifying(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleHashVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupInput.trim()) {
      setErrorMsg('Enter a 64-character SHA-256 hash or Watermark Tracking ID (e.g., WM-XXXXXXXX).');
      return;
    }
    setErrorMsg(null);
    setIsVerifying(true);
    try {
      const record = await verifyByHashOrCode(lookupInput);
      setLatestResult(record);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lookup failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div>
      <ModulePageHeader
        title="Document Verification"
        description="Upload a PDF to compute its SHA-256 fingerprint and check whether it matches a registered Original Master, a Watermarked Copy, or a Modified or Unregistered File."
      />

      {errorMsg && (
        <div className="mb-5">
          <ErrorAlert message={errorMsg} onDismiss={() => setErrorMsg(null)} />
        </div>
      )}

      <div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
        <Info className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
        <p>
          Document verification provides cryptographic integrity checking and registered copy traceability. It identifies a registered copy when an exact match exists; it does not prevent copying or prove who leaked a document.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Upload / Lookup Controls */}
        <div className="lg:col-span-5 space-y-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              void handleFileVerify(e.dataTransfer.files?.[0]);
            }}
            className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
              dragActive
                ? 'border-cyan-500 bg-cyan-500/5'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60'
            }`}
          >
            <Upload className="h-8 w-8 text-cyan-600 dark:text-cyan-400 mx-auto mb-2.5" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Verify PDF File
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Computes exact SHA-256 fingerprint and inspects embedded tracking metadata.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => void handleFileVerify(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isVerifying}
              className="mt-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white transition-colors"
            >
              {isVerifying ? 'Verifying PDF…' : 'Upload PDF to Verify'}
            </button>
          </div>

          <form
            onSubmit={handleHashVerify}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-3"
          >
            <label className="block text-xs font-semibold text-slate-900 dark:text-white">
              Or Verify by SHA-256 / Watermark Tracking ID
            </label>
            <input
              type="text"
              value={lookupInput}
              onChange={(e) => setLookupInput(e.target.value)}
              placeholder="Paste 64-char SHA-256 or WM-XXXXXXXX"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isVerifying}
              className="w-full rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 px-4 py-2 text-xs font-medium text-white transition-colors"
            >
              Check Registry
            </button>
          </form>
        </div>

        {/* Latest Verification Verdict */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
            Verification Result
          </h2>

          {!latestResult ? (
            <EmptyState
              icon={<FileSearch className="h-5 w-5" />}
              title="No verification check run yet"
              description="Upload a PDF file or look up a SHA-256 digest / Watermark Tracking ID to check authenticity."
            />
          ) : (
            <div className="space-y-4">
              <div
                className={`rounded-xl border p-4 flex items-start gap-3 ${
                  latestResult.outcome === 'Modified or Unregistered File'
                    ? 'border-rose-300 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30'
                    : 'border-emerald-300 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30'
                }`}
              >
                {latestResult.outcome === 'Modified or Unregistered File' ? (
                  <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {latestResult.outcome}
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                    {latestResult.details}
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <dt className="text-slate-500 dark:text-slate-400">Checked File</dt>
                  <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100 truncate">
                    {latestResult.fileName}
                  </dd>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <dt className="text-slate-500 dark:text-slate-400">Original Document Details</dt>
                  <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100 truncate">
                    {latestResult.matchedDocumentTitle
                      ? `${latestResult.matchedDocumentTitle}${
                          latestResult.matchedDocumentId
                            ? ` (DOC-${latestResult.matchedDocumentId.slice(0, 8).toUpperCase()})`
                            : ''
                        }`
                      : 'None (Unregistered)'}
                  </dd>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <dt className="text-slate-500 dark:text-slate-400">Associated Recipient</dt>
                  <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100 truncate">
                    {latestResult.outcome === 'Watermarked Copy Match' && latestResult.matchedRecipientName
                      ? `${latestResult.matchedRecipientName} (${latestResult.matchedRecipientEmail})`
                      : 'No recipient attribution'}
                  </dd>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <dt className="text-slate-500 dark:text-slate-400">Recipient ID &amp; Tracking ID</dt>
                  <dd className="mt-1 font-mono text-violet-700 dark:text-violet-400 truncate">
                    {latestResult.outcome === 'Watermarked Copy Match' && latestResult.matchedWatermarkCode
                      ? `${latestResult.matchedRecipientCode || '—'} · ${latestResult.matchedWatermarkCode}`
                      : '—'}
                  </dd>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <dt className="text-slate-500 dark:text-slate-400">Issue Date</dt>
                  <dd className="mt-1 font-mono text-slate-900 dark:text-slate-100">
                    {latestResult.outcome === 'Watermarked Copy Match' && latestResult.matchedIssueDate
                      ? latestResult.matchedIssueDate
                      : '—'}
                  </dd>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <dt className="text-slate-500 dark:text-slate-400">Verified At</dt>
                  <dd className="mt-1 font-mono text-slate-900 dark:text-slate-100">
                    {new Date(latestResult.verifiedAt).toLocaleString()}
                  </dd>
                </div>

                <div className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <dt className="text-slate-500 dark:text-slate-400">Computed SHA-256 Fingerprint</dt>
                    <dd className="mt-1 font-mono text-cyan-700 dark:text-cyan-400 break-all">
                      {latestResult.computedSha256}
                    </dd>
                  </div>
                  <CopyValueButton value={latestResult.computedSha256} label="Copy" />
                </div>
              </dl>
            </div>
          )}
        </div>
      </div>

      {/* Verification History */}
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
        Verification History ({state.verificationRecords.length})
      </h2>
      {state.verificationRecords.length === 0 ? (
        <EmptyState
          icon={<FileSearch className="h-5 w-5" />}
          title="No verification history available"
          description="Verification checks you run will be saved here for audit tracking."
        />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">File / Lookup</th>
                <th className="py-2.5 px-4">Outcome</th>
                <th className="py-2.5 px-4">Recipient Attribution</th>
                <th className="py-2.5 px-4">SHA-256</th>
                <th className="py-2.5 px-4 text-right">Verified At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {state.verificationRecords.map((rec) => (
                <tr
                  key={rec.id}
                  onClick={() => setLatestResult(rec)}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
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
                  <td className={`${rowPad} text-slate-600 dark:text-slate-300`}>
                    {rec.outcome === 'Watermarked Copy Match' && rec.matchedRecipientName
                      ? `${rec.matchedRecipientName} (${rec.matchedRecipientCode || rec.matchedWatermarkCode})`
                      : '—'}
                  </td>
                  <td className={`${rowPad} font-mono tabular-nums text-slate-500`}>
                    {rec.computedSha256.slice(0, 14)}…
                  </td>
                  <td className={`${rowPad} text-right font-mono tabular-nums text-slate-500 whitespace-nowrap`}>
                    {new Date(rec.verifiedAt).toLocaleString()}
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
