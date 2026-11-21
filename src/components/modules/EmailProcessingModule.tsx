import React, { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Mail, Paperclip, Play, XCircle } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import type { InboundEmailEvent } from '../../types/system';
import { getPdfBinary } from '../../utils/cryptoPdf';
import { EmptyState, ErrorAlert, ModulePageHeader, StatusLabel } from '../ui/CommonUI';

export const EmailProcessingModule: React.FC = () => {
  const { state, processDemoInboundEmail, setActiveModule } = useSystem();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inboxId, setInboxId] = useState(
    state?.inboxes.find((i) => i.status === 'Active')?.id || state?.inboxes[0]?.id || ''
  );
  const [fromAddress, setFromAddress] = useState('external-sender@partner-audit.example');
  const [subject, setSubject] = useState('Signed Security Evidence PDF Submission');
  const [body, setBody] = useState(
    'Please ingest the attached PDF into the SHA-256 registry, stamp recipient attribution, and notify downstream webhooks.'
  );
  const [attachmentSource, setAttachmentSource] = useState<'vault' | 'upload' | 'none'>('vault');
  const [selectedVaultDocId, setSelectedVaultDocId] = useState(state?.documents[0]?.id || '');
  const [uploadedAttachment, setUploadedAttachment] = useState<{
    fileName: string;
    bytes: Uint8Array;
  } | null>(null);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<InboundEmailEvent | null>(
    state?.inboundEmails[0] || null
  );

  if (!state) return null;

  const handleFilePick = async (file?: File) => {
    if (!file) return;
    const buf = await file.arrayBuffer();
    setUploadedAttachment({ fileName: file.name, bytes: new Uint8Array(buf) });
    setAttachmentSource('upload');
  };

  const handleSimulateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inboxId) {
      setErrorMsg('Provision or select a target ephemeral inbox first.');
      return;
    }
    if (!fromAddress.trim() || !subject.trim()) {
      setErrorMsg('Sender address and subject are required.');
      return;
    }

    setErrorMsg(null);
    setIsProcessing(true);

    try {
      let attachment: { fileName: string; bytes: Uint8Array } | undefined;
      if (attachmentSource === 'upload' && uploadedAttachment) {
        attachment = uploadedAttachment;
      } else if (attachmentSource === 'vault' && selectedVaultDocId) {
        const doc = state.documents.find((d) => d.id === selectedVaultDocId);
        const bytes = doc ? getPdfBinary(`doc:${doc.id}`) : undefined;
        if (doc && bytes) {
          attachment = { fileName: doc.fileName, bytes };
        }
      }

      const result = await processDemoInboundEmail({
        inboxId,
        fromAddress: fromAddress.trim(),
        subject: subject.trim(),
        body: body.trim(),
        attachment,
        simulateFailure,
      });
      setSelectedEmail(result);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Demo email pipeline failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div>
      <ModulePageHeader
        title="Email Processing Interface (Demo Mode)"
        description="Simulate inbound SMTP envelope validation, MIME PDF attachment extraction, automatic recipient watermarking, and webhook relay dispatch."
      />

      {/* Explicit Demo Mode Banner */}
      <div className="mb-6 rounded-xl border border-amber-400/50 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-950 dark:text-amber-200">
          <p className="font-semibold">
            CLEARLY LABELLED DEMO MODE — Simulated SMTP Ingress Engine
          </p>
          <p className="mt-1 opacity-90">
            This browser application does not operate a live public SMTP/MX mail server. Submitting this form runs the real PDF SHA-256 hashing, `pdf-lib` watermarking, central event emission, and webhook signature pipeline against simulated RFC-5322 inbound messages.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-5">
          <ErrorAlert message={errorMsg} onDismiss={() => setErrorMsg(null)} />
        </div>
      )}

      {state.inboxes.length === 0 ? (
        <EmptyState
          icon={<Mail className="h-5 w-5" />}
          title="No ephemeral inboxes available"
          description="Provision at least one temporary relay address before simulating inbound SMTP mail."
          actionLabel="Provision Ephemeral Inbox"
          onAction={() => setActiveModule('inboxes')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          {/* Simulator Form */}
          <form
            onSubmit={handleSimulateSubmit}
            className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Simulate Inbound SMTP Message
              </h2>
              <span className="font-mono text-[11px] text-amber-700 dark:text-amber-400">
                DEMO-MTA
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Target Ephemeral Inbox
                </label>
                <select
                  value={inboxId}
                  onChange={(e) => setInboxId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
                >
                  {state.inboxes.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.aliasAddress} ({i.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Simulated Envelope Sender
                </label>
                <input
                  type="email"
                  value={fromAddress}
                  onChange={(e) => setFromAddress(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Email Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Body Content
              </label>
              <textarea
                rows={2}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {/* PDF Attachment Selector */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>MIME PDF Attachment</span>
                </span>
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px]">
                  {(
                    [
                      { id: 'vault', label: 'Vault PDF' },
                      { id: 'upload', label: 'Local File' },
                      { id: 'none', label: 'No Attachment' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAttachmentSource(opt.id)}
                      className={`px-2 py-1 rounded-md font-medium ${
                        attachmentSource === opt.id
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {attachmentSource === 'vault' && (
                <select
                  value={selectedVaultDocId}
                  onChange={(e) => setSelectedVaultDocId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                >
                  {state.documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fileName} — {d.title}
                    </option>
                  ))}
                </select>
              )}

              {attachmentSource === 'upload' && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate">
                    {uploadedAttachment ? uploadedAttachment.fileName : 'No local PDF selected'}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => void handleFilePick(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200"
                  >
                    Choose PDF
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simulateFailure}
                  onChange={(e) => setSimulateFailure(e.target.checked)}
                  className="accent-rose-600"
                />
                <span>Simulate MIME parser error</span>
              </label>

              <button
                type="submit"
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white transition-colors"
              >
                <Play className="h-3.5 w-3.5" />
                <span>{isProcessing ? 'Processing Pipeline…' : 'Run Demo SMTP Pipeline'}</span>
              </button>
            </div>
          </form>

          {/* Inspector Panel */}
          <div className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 flex flex-col">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              MIME &amp; Pipeline Stage Inspector
            </h2>

            {!selectedEmail ? (
              <EmptyState
                icon={<Mail className="h-5 w-5" />}
                title="Select or process a demo email"
                description="Run the simulator on the left or click a processed message below to inspect its 4-stage pipeline execution."
              />
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {selectedEmail.subject}
                    </p>
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                      From: {selectedEmail.fromAddress} → To: {selectedEmail.toAddress}
                    </p>
                  </div>
                  <StatusLabel status={selectedEmail.pipelineStatus} />
                </div>

                {/* 4 Stages */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  {(
                    [
                      { label: '1. Envelope', value: selectedEmail.stages.envelopeCheck },
                      { label: '2. MIME PDF', value: selectedEmail.stages.mimeExtraction },
                      { label: '3. Watermark', value: selectedEmail.stages.watermarkDispatch },
                      { label: '4. Webhook', value: selectedEmail.stages.webhookRelay },
                    ] as const
                  ).map((st) => (
                    <div
                      key={st.label}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5"
                    >
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{st.label}</p>
                      <p className="mt-1 font-semibold flex items-center gap-1 text-slate-900 dark:text-slate-100">
                        {st.value === 'Passed' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : st.value === 'Failed' ? (
                          <XCircle className="h-3.5 w-3.5 text-rose-500" />
                        ) : null}
                        <span>{st.value}</span>
                      </p>
                    </div>
                  ))}
                </div>

                {selectedEmail.attachmentSha256 && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 text-xs space-y-1">
                    <p className="text-slate-500 dark:text-slate-400">
                      Extracted Attachment: <span className="font-mono text-slate-900 dark:text-slate-100">{selectedEmail.attachmentName}</span>
                    </p>
                    <p className="font-mono text-cyan-700 dark:text-cyan-400 break-all">
                      SHA-256: {selectedEmail.attachmentSha256}
                    </p>
                    {selectedEmail.generatedWatermarkCode && (
                      <p className="font-mono text-violet-700 dark:text-violet-400">
                        Auto-Issued Watermark: {selectedEmail.generatedWatermarkCode}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    Simulated RFC-5322 Headers
                  </p>
                  <pre className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">
                    {JSON.stringify(selectedEmail.rawHeaders, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Processed Queue */}
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
        Demo Inbound Processing Queue ({state.inboundEmails.length})
      </h2>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <th className="py-2.5 px-4">Subject / Sender</th>
              <th className="py-2.5 px-4">Target Ephemeral Inbox</th>
              <th className="py-2.5 px-4">Watermark Issued</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4 text-right">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
            {state.inboundEmails.map((mail) => (
              <tr
                key={mail.id}
                onClick={() => setSelectedEmail(mail)}
                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <td className="py-3 px-4">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{mail.subject}</p>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {mail.fromAddress}
                  </p>
                </td>
                <td className="py-3 px-4 font-mono text-cyan-700 dark:text-cyan-400">
                  {mail.toAddress}
                </td>
                <td className="py-3 px-4 font-mono text-violet-700 dark:text-violet-400">
                  {mail.generatedWatermarkCode || '—'}
                </td>
                <td className="py-3 px-4">
                  <StatusLabel status={mail.pipelineStatus} />
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                  {new Date(mail.receivedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
