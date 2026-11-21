import React, { useRef, useState } from 'react';
import { CheckCircle2, FileSearch, ShieldAlert, ShieldCheck, Upload } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import type { VerificationRecord } from '../../types/system';
import { getPdfBinary } from '../../utils/cryptoPdf';
import { CopyValueButton, EmptyState, ErrorAlert, ModulePageHeader, StatusLabel } from '../ui/CommonUI';

export const VerificationModule: React.FC = () => {
  const { state, verifyDocumentFile, verifyByHashOrCode } = useSystem();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lookupInput, setLookupInput] = useState('');
  const [latestResult, setLatestResult] = useState<VerificationRecord | null>(
    state?.verificationRecords[0] || null
  );
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!state) return null;

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
      setErrorMsg('Enter a 64-character SHA-256 hash or Watermark ID (e.g. WM-8F2A91).');
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

  const handleQuickVerifySeededWatermark = async () => {
    const firstCopy = state.watermarkedCopies[0];
    if (!firstCopy) return;
    const bytes = getPdfBinary(`wm:${firstCopy.watermarkCode}`);
    if (bytes) {
      setIsVerifying(true);
      const record = await verifyDocumentFile({
        fileName: `${firstCopy.watermarkCode}-suspect-copy.pdf`,
        bytes,
      });
      setLatestResult(record);
      setIsVerifying(false);
    } else {
      const record = await verifyByHashOrCode(firstCopy.watermarkedSha256);
      setLatestResult(record);
    }
  };

  return (
    <div>
      <ModulePageHeader
        title="Forensic Document Verification"
        description="Verify any suspect PDF file or SHA-256 digest against the master vault, watermarked copy ledger, and embedded PDF attribution metadata."
        actions={
          state.watermarkedCopies[0] && (
            <button
              type="button"
              onClick={() => void handleQuickVerifySeededWatermark()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Test Verify {state.watermarkedCopies[0].watermarkCode}</span>
            </button>
          )
        }
      />

      {errorMsg && (
        <div className="mb-5">
          <ErrorAlert message={errorMsg} onDismiss={() => setErrorMsg(null)} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Upload / Lookup Controls */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-6 text-center">
            <Upload className="h-8 w-8 text-cyan-600 dark:text-cyan-400 mx-auto mb-2.5" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Inspect Suspect PDF File
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Computes real SHA-256 and scans PDF Keywords/Subject metadata for RW-ATTR attribution markers.
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
              {isVerifying ? 'Analyzing PDF…' : 'Upload PDF to Verify'}
            </button>
          </div>

          <form
            onSubmit={handleHashVerify}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-3"
          >
            <label className="block text-xs font-semibold text-slate-900 dark:text-white">
              Verify by SHA-256 Digest or Watermark Code
            </label>
            <input
              type="text"
              value={lookupInput}
              onChange={(e) => setLookupInput(e.target.value)}
              placeholder="Paste 64-char SHA-256 or WM-XXXXXX"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isVerifying}
              className="w-full rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 px-4 py-2 text-xs font-medium text-white transition-colors"
            >
              Run Ledger Lookup
            </button>
          </form>
        </div>

        {/* Latest Forensic Verdict */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
            Forensic Attribution Verdict
          </h2>

          {!latestResult ? (
            <EmptyState
              icon={<FileSearch className="h-5 w-5" />}
              title="No verification executed yet"
              description="Upload a suspect PDF or run a hash lookup to inspect recipient attribution."
            />
          ) : (
            <div className="space-y-4">
              <div
                className={`rounded-xl border p-4 flex items-start gap-3 ${
                  latestResult.outcome === 'Unregistered'
                    ? 'border-rose-300 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30'
                    : latestResult.outcome === 'Metadata Attribution Match'
                      ? 'border-amber-300 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30'
                      : 'border-emerald-300 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30'
                }`}
              >
                {latestResult.outcome === 'Unregistered' ? (
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
                  <dt className="text-slate-500 dark:text-slate-400">Inspected Artifact</dt>
                  <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100 truncate">
                    {latestResult.fileName}
                  </dd>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <dt className="text-slate-500 dark:text-slate-400">Attributed Recipient</dt>
                  <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100 truncate">
                    {latestResult.matchedRecipientName
                      ? `${latestResult.matchedRecipientName} (${latestResult.matchedRecipientEmail})`
                      : 'None (Master or Unregistered)'}
                  </dd>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <dt className="text-slate-500 dark:text-slate-400">Matched Document</dt>
                  <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100 truncate">
                    {latestResult.matchedDocumentTitle || 'No matching master document'}
                  </dd>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <dt className="text-slate-500 dark:text-slate-400">Watermark ID / Metadata</dt>
                  <dd className="mt-1 font-mono text-violet-700 dark:text-violet-400 truncate">
                    {latestResult.matchedWatermarkCode || latestResult.embeddedAttribution || '—'}
                  </dd>
                </div>

                <div className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <dt className="text-slate-500 dark:text-slate-400">Computed SHA-256 Digest</dt>
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
        Verification Audit History ({state.verificationRecords.length})
      </h2>
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
                <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                  {rec.fileName}
                </td>
                <td className="py-3 px-4">
                  <StatusLabel status={rec.outcome} />
                </td>
                <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                  {rec.matchedRecipientEmail || '—'}
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-slate-500">
                  {rec.computedSha256.slice(0, 14)}…
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                  {new Date(rec.verifiedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
