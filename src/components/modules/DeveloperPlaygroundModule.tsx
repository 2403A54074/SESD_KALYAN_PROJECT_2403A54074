import React, { useEffect, useState } from 'react';
import { Code2, Database, Fingerprint, Mail, Play, ShieldCheck, Terminal, Webhook } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import type { RelayEventType } from '../../types/system';
import { computeHmacSha256Hex, computeStringSha256 } from '../../utils/cryptoPdf';
import { CopyValueButton, ModulePageHeader, StatusLabel } from '../ui/CommonUI';

type PlaygroundTab =
  | 'payload'
  | 'json'
  | 'email'
  | 'api'
  | 'simulator'
  | 'sha256'
  | 'db'
  | 'history';

const SAMPLE_EMAIL_RAW = `From: audit-bot@partner-assurance.example
To: audit-7f3a@ephemeral-relay.demo
Subject: Signed Evidence Package Q4
Message-ID: <demo-49281a@partner-assurance.example>
Authentication-Results: demo-relay; spf=pass; dkim=pass
Content-Type: multipart/mixed; boundary="----RelayDemoBoundary"

------RelayDemoBoundary
Content-Type: text/plain; charset="UTF-8"

Attaching signed security control matrix for SHA-256 indexing.
------RelayDemoBoundary
Content-Type: application/pdf; name="q4-evidence.pdf"
Content-Disposition: attachment; filename="q4-evidence.pdf"`;

const DB_RELATIONS = [
  { table: 'public.documents', pk: 'id (UUID)', fks: 'owner_id -> auth.users(id)', role: 'Master PDF metadata & SHA-256 baseline' },
  { table: 'public.recipients', pk: 'id (UUID)', fks: 'owner_id -> auth.users(id)', role: 'Authorized recipients & clearance status' },
  { table: 'public.watermarked_copies', pk: 'id (UUID)', fks: 'document_id -> documents(id), recipient_id -> recipients(id)', role: 'Visible watermark records & output SHA-256' },
  { table: 'public.verification_records', pk: 'id (UUID)', fks: 'matched_document_id, matched_watermark_id, matched_recipient_id', role: 'Forensic verification audit history' },
  { table: 'public.ephemeral_inboxes', pk: 'id (UUID)', fks: 'bound_document_id, bound_recipient_id', role: 'TTL-scoped temporary relay addresses' },
  { table: 'public.inbound_emails', pk: 'id (UUID)', fks: 'inbox_id -> ephemeral_inboxes(id)', role: 'Captured MIME headers & demo/live_mta mode flag' },
  { table: 'public.webhooks', pk: 'id (UUID)', fks: '—', role: 'HTTPS endpoints, retry policy & subscribed events' },
  { table: 'public.webhook_deliveries', pk: 'id (UUID)', fks: 'webhook_id -> webhooks(id)', role: 'Signed delivery receipts & latency telemetry' },
];

export const DeveloperPlaygroundModule: React.FC = () => {
  const { state, triggerWebhookDelivery, pushToast } = useSystem();
  const [activeTab, setActiveTab] = useState<PlaygroundTab>('payload');

  // 1. Payload + HMAC Verifier
  const [hmacSecret, setHmacSecret] = useState('whsec_demo_playground_secret');
  const [payloadText, setPayloadText] = useState(
    JSON.stringify(
      {
        event: 'watermark.issued',
        correlation_id: 'corr_demo_991a',
        watermark_code: 'WM-8F2A91',
        recipient_email: 'priya.nair@veritas-audit.example',
        simulated: true,
      },
      null,
      2
    )
  );
  const [computedHmac, setComputedHmac] = useState('');

  // 2. JSON Formatter
  const [jsonInput, setJsonInput] = useState('{"service":"relay-watermark","mode":"demo","algorithms":["SHA-256","HMAC-SHA256"]}');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // 3. Email Parser Playground
  const [rawEmail, setRawEmail] = useState(SAMPLE_EMAIL_RAW);

  // 5. Event Simulator
  const [simEventType, setSimEventType] = useState<RelayEventType>('watermark.issued');
  const [simWebhookId, setSimWebhookId] = useState(state?.webhooks[0]?.id || '');

  // 6. SHA-256 Avalanche Demo
  const [shaInputA, setShaInputA] = useState('RelayWatermark-Doc-v1');
  const [shaInputB, setShaInputB] = useState('RelayWatermark-Doc-v2');
  const [shaDigestA, setShaDigestA] = useState('');
  const [shaDigestB, setShaDigestB] = useState('');

  useEffect(() => {
    void computeHmacSha256Hex(hmacSecret, payloadText).then(setComputedHmac);
  }, [hmacSecret, payloadText]);

  useEffect(() => {
    void computeStringSha256(shaInputA).then(setShaDigestA);
    void computeStringSha256(shaInputB).then(setShaDigestB);
  }, [shaInputA, shaInputB]);

  if (!state) return null;

  const parseRawEmailPreview = () => {
    const lines = rawEmail.split(/\r?\n/);
    const headers: Record<string, string> = {};
    let bodyStart = lines.length;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '') {
        bodyStart = i + 1;
        break;
      }
      const sep = lines[i].indexOf(':');
      if (sep > 0) {
        headers[lines[i].slice(0, sep).trim()] = lines[i].slice(sep + 1).trim();
      }
    }
    const attachmentMatch = rawEmail.match(/filename="([^"]+)"/);
    return {
      mode: 'SIMULATED_LOCAL_PARSER',
      headers,
      detectedAttachment: attachmentMatch ? attachmentMatch[1] : null,
      bodyLines: lines.slice(bodyStart).join('\n').slice(0, 320),
    };
  };

  const tabs: { id: PlaygroundTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'payload', label: 'Payload & HMAC', icon: Webhook },
    { id: 'json', label: 'JSON Formatter', icon: Code2 },
    { id: 'email', label: 'Email Parser (Demo)', icon: Mail },
    { id: 'api', label: 'API Explorer', icon: Terminal },
    { id: 'simulator', label: 'Event Simulator', icon: Play },
    { id: 'sha256', label: 'SHA-256 Demo', icon: Fingerprint },
    { id: 'db', label: 'DB Relations', icon: Database },
    { id: 'history', label: 'Test History', icon: ShieldCheck },
  ];

  return (
    <div>
      <ModulePageHeader
        title="Developer Playground"
        description="Inspect HMAC-SHA256 webhook signatures, format JSON, test simulated RFC-5322 email parsing, explore API contracts, and audit test deliveries safely without external URL probing."
      />

      <div className="flex flex-wrap gap-1.5 mb-6">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'payload' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Sample Webhook Payload
            </h2>
            <div>
              <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                Test Signing Secret (Local Playground Only)
              </label>
              <input
                type="text"
                value={hmacSecret}
                onChange={(e) => setHmacSecret(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100"
              />
            </div>
            <textarea
              rows={10}
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs font-mono text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Generated HMAC-SHA256 Header
              </h2>
              <CopyValueButton value={`sha256=${computedHmac}`} label="Copy Header" />
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs font-mono break-all text-violet-700 dark:text-violet-300">
              X-Relay-Signature-256: sha256={computedHmac}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Computed dynamically via <code className="font-mono">crypto.subtle.sign(&quot;HMAC&quot;, key, payload)</code>. Any 1-byte modification in the payload produces an entirely different signature.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'json' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              JSON Formatter &amp; Validator
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  try {
                    setJsonInput(JSON.stringify(JSON.parse(jsonInput), null, 2));
                    setJsonError(null);
                  } catch (err) {
                    setJsonError(err instanceof Error ? err.message : 'Invalid JSON');
                  }
                }}
                className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Pretty Format
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    setJsonInput(JSON.stringify(JSON.parse(jsonInput)));
                    setJsonError(null);
                  } catch (err) {
                    setJsonError(err instanceof Error ? err.message : 'Invalid JSON');
                  }
                }}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                Minify
              </button>
            </div>
          </div>
          {jsonError && (
            <p className="text-xs font-mono text-rose-600 dark:text-rose-400">
              Syntax Error: {jsonError}
            </p>
          )}
          <textarea
            rows={12}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs font-mono text-slate-800 dark:text-slate-200"
          />
        </div>
      )}

      {activeTab === 'email' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Sample Raw RFC-5322 Email (Simulated)
              </h2>
              <button
                type="button"
                onClick={() => setRawEmail(SAMPLE_EMAIL_RAW)}
                className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                Reset Sample
              </button>
            </div>
            <textarea
              rows={13}
              value={rawEmail}
              onChange={(e) => setRawEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs font-mono text-slate-800 dark:text-slate-200"
            />
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Parsed MIME Output (Local Demo Parser)
            </h2>
            <pre className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-[11px] font-mono text-slate-800 dark:text-slate-200 overflow-x-auto max-h-80">
              {JSON.stringify(parseRawEmailPreview(), null, 2)}
            </pre>
          </div>
        </div>
      )}

      {activeTab === 'api' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 divide-y divide-slate-100 dark:divide-slate-800">
          {[
            ['POST /functions/v1/documents', 'Registers master PDF SHA-256 baseline in Supabase public.documents.'],
            ['POST /functions/v1/watermarks', 'Applies recipient-specific visible stamp and records watermarked_sha256.'],
            ['POST /functions/v1/verify', 'Matches suspect SHA-256 or RW-ATTR metadata against issued copies.'],
            ['POST /functions/v1/smtp-inbound', 'Ingests authenticated MTA webhook payload into public.inbound_emails.'],
            ['POST /functions/v1/webhooks/dispatch', 'Dispatches HMAC-SHA256 signed payload to subscribed endpoints.'],
          ].map(([endpoint, desc]) => (
            <div key={endpoint} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <p className="font-mono font-semibold text-cyan-700 dark:text-cyan-400">{endpoint}</p>
                <p className="text-slate-600 dark:text-slate-400 mt-0.5">{desc}</p>
              </div>
              <span className="font-mono text-[11px] text-slate-400 whitespace-nowrap">
                Supabase Edge Spec · No unsafe server fetch
              </span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'simulator' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 max-w-2xl space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Simulated Event Dispatcher (Clearly Labelled Demo Event)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Emits a simulated event locally to your selected configured webhook without making unsafe external SSRF requests.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Simulated Event Type</label>
              <select
                value={simEventType}
                onChange={(e) => setSimEventType(e.target.value as RelayEventType)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
              >
                <option value="watermark.issued">watermark.issued</option>
                <option value="document.uploaded">document.uploaded</option>
                <option value="document.verified">document.verified</option>
                <option value="verification.mismatch">verification.mismatch</option>
                <option value="smtp.inbound.processed">smtp.inbound.processed</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Target Webhook</label>
              <select
                value={simWebhookId}
                onChange={(e) => setSimWebhookId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                {state.webhooks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            disabled={!simWebhookId}
            onClick={async () => {
              await triggerWebhookDelivery({
                webhookId: simWebhookId,
                eventType: simEventType,
                payload: { simulated_event: true, source: 'Developer Playground' },
                mode: 'simulated',
              });
              pushToast({ title: 'Simulated Event Logged', variant: 'success' });
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 px-4 py-2 text-xs font-semibold text-white"
          >
            <Play className="h-3.5 w-3.5" />
            <span>Emit Simulated Event</span>
          </button>
        </div>
      )}

      {activeTab === 'sha256' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            SHA-256 Avalanche Effect Demonstration
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Input String A
              </label>
              <input
                type="text"
                value={shaInputA}
                onChange={(e) => setShaInputA(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono"
              />
              <p className="font-mono text-[11px] text-cyan-700 dark:text-cyan-400 break-all">
                {shaDigestA}
              </p>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Input String B
              </label>
              <input
                type="text"
                value={shaInputB}
                onChange={(e) => setShaInputB(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono"
              />
              <p className="font-mono text-[11px] text-violet-700 dark:text-violet-400 break-all">
                {shaDigestB}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'db' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                <th className="py-2.5 px-4">Table</th>
                <th className="py-2.5 px-4">Primary Key</th>
                <th className="py-2.5 px-4">Foreign Keys</th>
                <th className="py-2.5 px-4">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {DB_RELATIONS.map((row) => (
                <tr key={row.table}>
                  <td className="py-3 px-4 font-mono font-semibold text-cyan-700 dark:text-cyan-400">
                    {row.table}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">{row.pk}</td>
                  <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">{row.fks}</td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{row.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                <th className="py-2.5 px-4">Webhook</th>
                <th className="py-2.5 px-4">Event</th>
                <th className="py-2.5 px-4">Mode</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">HTTP / Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {state.webhookDeliveries.map((d) => (
                <tr key={d.id}>
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{d.webhookName}</td>
                  <td className="py-3 px-4 font-mono text-cyan-700 dark:text-cyan-400">{d.eventType}</td>
                  <td className="py-3 px-4 font-mono text-slate-500">{d.deliveryMode}</td>
                  <td className="py-3 px-4"><StatusLabel status={d.status} /></td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                    {d.httpStatus ?? 'ERR'} · {d.latencyMs}ms
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
