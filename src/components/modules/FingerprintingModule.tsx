import React, { useRef, useState } from 'react';
import { CheckCircle2, FileSearch, Fingerprint, GitCompare, XCircle } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import { computeSha256Hex, computeStringSha256, formatBytes, shortHash } from '../../utils/cryptoPdf';
import { CopyValueButton, EmptyState, ModulePageHeader } from '../ui/CommonUI';

export const FingerprintingModule: React.FC = () => {
  const { state, setActiveModule } = useSystem();
  const fileRefA = useRef<HTMLInputElement>(null);

  const [sampleText, setSampleText] = useState('');
  const [liveFileResult, setLiveFileResult] = useState<{
    name: string;
    size: number;
    sha256: string;
    durationMs: number;
  } | null>(null);
  const [liveTextHash, setLiveTextHash] = useState<string>('');

  const [compareHashA, setCompareHashA] = useState('');
  const [compareHashB, setCompareHashB] = useState('');

  if (!state) return null;

  const handleComputeFile = async (file?: File) => {
    if (!file) return;
    const t0 = performance.now();
    const buf = await file.arrayBuffer();
    const sha256 = await computeSha256Hex(buf);
    const durationMs = Math.max(1, Math.round(performance.now() - t0));
    setLiveFileResult({
      name: file.name,
      size: file.size,
      sha256,
      durationMs,
    });
    if (!compareHashA) setCompareHashA(sha256);
    else setCompareHashB(sha256);
  };

  const handleTextChange = async (val: string) => {
    setSampleText(val);
    if (!val) {
      setLiveTextHash('');
      return;
    }
    const digest = await computeStringSha256(val);
    setLiveTextHash(digest);
  };

  const hashesEntered = Boolean(compareHashA.trim() && compareHashB.trim());
  const exactMatch =
    hashesEntered && compareHashA.trim().toLowerCase() === compareHashB.trim().toLowerCase();

  return (
    <div>
      <ModulePageHeader
        title="SHA-256 Document Fingerprinting"
        description="Compute deterministic 256-bit cryptographic digests via Web Crypto API (SHA-256), compare master vs watermarked hashes, and audit the fingerprint registry."
      />

      {/* Interactive Hashing Lab + Hash Comparator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <span>Web Crypto SHA-256 Digest Calculator</span>
            </h2>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              SubtleCrypto · SHA-256
            </span>
          </div>

          <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                Hash any local file (PDF or binary)
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Processed locally in browser memory without network transmission
              </p>
            </div>
            <input
              ref={fileRefA}
              type="file"
              className="hidden"
              onChange={(e) => void handleComputeFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileRefA.current?.click()}
              className="rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 px-3.5 py-2 text-xs font-medium text-white whitespace-nowrap shrink-0"
            >
              Compute File Digest
            </button>
          </div>

          {liveFileResult && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {liveFileResult.name}
                </span>
                <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {formatBytes(liveFileResult.size)} · {liveFileResult.durationMs}ms
                </span>
              </div>
              <p className="font-mono text-xs text-cyan-700 dark:text-cyan-300 break-all tabular-nums">
                {liveFileResult.sha256}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <CopyValueButton value={liveFileResult.sha256} label="Copy Digest" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Deterministic Text / Payload String Hasher
            </label>
            <textarea
              rows={2}
              value={sampleText}
              onChange={(e) => void handleTextChange(e.target.value)}
              placeholder="Type or paste text/JSON payload to inspect real-time SHA-256 avalanche effect…"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
            {liveTextHash && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 px-3 py-2">
                <code className="text-[11px] font-mono text-violet-700 dark:text-violet-300 break-all">
                  {liveTextHash}
                </code>
                <CopyValueButton value={liveTextHash} label="Copy" />
              </div>
            )}
          </div>
        </div>

        {/* Digest Comparator */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              <span>Bit-Exact Fingerprint Comparator</span>
            </h2>
            {state.documents[0] && (
              <button
                type="button"
                onClick={() => {
                  setCompareHashA(state.documents[0].sha256Hash);
                  setCompareHashB(
                    state.watermarkedCopies[0]?.watermarkedSha256 || state.documents[0].sha256Hash
                  );
                }}
                className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                Load Vault Sample
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Digest A (Baseline / Master SHA-256)
            </label>
            <input
              type="text"
              value={compareHashA}
              onChange={(e) => setCompareHashA(e.target.value)}
              placeholder="64-character hex SHA-256 digest"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Digest B (Candidate / Watermarked SHA-256)
            </label>
            <input
              type="text"
              value={compareHashB}
              onChange={(e) => setCompareHashB(e.target.value)}
              placeholder="64-character hex SHA-256 digest"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {hashesEntered ? (
            <div
              className={`rounded-lg border p-3.5 flex items-start gap-2.5 text-xs ${
                exactMatch
                  ? 'border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                  : 'border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
              }`}
            >
              {exactMatch ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold">
                  {exactMatch
                    ? 'Bit-Identical Match Confirmed'
                    : 'Cryptographic Divergence Detected'}
                </p>
                <p className="mt-0.5 opacity-85">
                  {exactMatch
                    ? 'Both SHA-256 digests are identical across all 256 bits.'
                    : 'Digests differ. Watermarking or byte modification alters the PDF stream and produces a distinct SHA-256.'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
              Paste two SHA-256 digests or click any fingerprint in the registry below to compare.
            </p>
          )}
        </div>
      </div>

      {/* Fingerprint Registry */}
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
        Registered Document &amp; Watermark Fingerprints
      </h2>

      {state.documents.length === 0 ? (
        <EmptyState
          icon={<FileSearch className="h-5 w-5" />}
          title="No fingerprints recorded"
          description="Upload a PDF document to automatically generate and register its SHA-256 baseline."
          actionLabel="Go to Document Upload"
          onAction={() => setActiveModule('upload')}
        />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Artifact</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">SHA-256 Digest</th>
                <th className="py-2.5 px-4 text-right">Size</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {state.documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                    {doc.title}
                  </td>
                  <td className="py-3 px-4 text-cyan-700 dark:text-cyan-400 font-medium whitespace-nowrap">
                    Master Original
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {shortHash(doc.sha256Hash, 16, 12)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                    {formatBytes(doc.fileSizeBytes)}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <CopyValueButton value={doc.sha256Hash} label="Copy" />
                      <button
                        type="button"
                        onClick={() => setCompareHashA(doc.sha256Hash)}
                        className="rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        Compare A
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {state.watermarkedCopies.map((wm) => (
                <tr key={wm.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {wm.documentTitle}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {wm.watermarkCode} · {wm.recipientEmail}
                    </p>
                  </td>
                  <td className="py-3 px-4 text-violet-700 dark:text-violet-400 font-medium whitespace-nowrap">
                    Watermarked Copy
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {shortHash(wm.watermarkedSha256, 16, 12)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                    {formatBytes(wm.fileSizeBytes)}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <CopyValueButton value={wm.watermarkedSha256} label="Copy" />
                      <button
                        type="button"
                        onClick={() => setCompareHashB(wm.watermarkedSha256)}
                        className="rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        Compare B
                      </button>
                    </div>
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
