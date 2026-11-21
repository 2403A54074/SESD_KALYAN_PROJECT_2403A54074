import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Compass, Database, GitBranch, Layers } from 'lucide-react';
import { ModulePageHeader } from '../ui/CommonUI';

interface ExplorerStep {
  id: string;
  title: string;
  component: string;
  input: string;
  output: string;
  guarantee: string;
}

interface WorkflowSpec {
  id: string;
  label: string;
  summary: string;
  tables: string[];
  steps: ExplorerStep[];
}

const WORKFLOWS: WorkflowSpec[] = [
  {
    id: 'architecture',
    label: 'System Architecture',
    summary: 'Layered modular architecture separating client-side Web Crypto & pdf-lib processing, central event correlation, and Supabase PostgreSQL persistence.',
    tables: ['documents', 'recipients', 'watermarked_copies', 'ephemeral_inboxes', 'webhooks', 'pipeline_events'],
    steps: [
      {
        id: 'arch-1',
        title: '1. Client Custody & Web Crypto Layer',
        component: 'cryptoPdf.ts + UploadModule',
        input: 'Raw PDF File Bytes',
        output: 'Validated %PDF- buffer + 64-char SHA-256 hex digest',
        guarantee: 'Zero external upload required for hashing or visible stamping.',
      },
      {
        id: 'arch-2',
        title: '2. Watermarking & Attribution Layer',
        component: 'pdf-lib Stamping Engine',
        input: 'Master PDF + Recipient Identity + Policy',
        output: 'Visible stamped PDF + RW-ATTR metadata + Watermarked SHA-256',
        guarantee: 'Every page carries visible attribution and cryptographic lineage.',
      },
      {
        id: 'arch-3',
        title: '3. Ephemeral SMTP Relay (Demo / External MTA)',
        component: 'InboxesModule + EmailProcessingModule',
        input: 'RFC-5322 Message + Attachment',
        output: 'Extracted PDF + Auto-Watermarked Copy',
        guarantee: 'Demo Mode runs locally; production uses isolated MX worker.',
      },
      {
        id: 'arch-4',
        title: '4. Event Bus & HMAC Webhook Fan-Out',
        component: 'SystemContext + WebhooksModule',
        input: 'Typed RelayEventType + Correlation ID',
        output: 'HMAC-SHA256 Signed JSON Delivery Receipts',
        guarantee: 'Constant-verifiable X-Relay-Signature-256 headers.',
      },
    ],
  },
  {
    id: 'upload',
    label: 'Document Upload Workflow',
    summary: 'Validates PDF magic bytes, inspects page structure, computes deterministic SHA-256 baseline, and registers document metadata.',
    tables: ['documents', 'pipeline_events', 'activity_logs'],
    steps: [
      {
        id: 'up-1',
        title: '1. Magic Header & Size Guard',
        component: 'hasPdfMagicHeader()',
        input: 'File bytes (<= 25 MB)',
        output: 'Verified %PDF- signature',
        guarantee: 'Rejects spoofed non-PDF files before parsing.',
      },
      {
        id: 'up-2',
        title: '2. PDF Structure Inspection',
        component: 'inspectPdfBytes()',
        input: 'Validated PDF buffer',
        output: 'Page count, Title, Author, Keywords',
        guarantee: 'Handles encrypted or complex PDF object streams safely.',
      },
      {
        id: 'up-3',
        title: '3. SHA-256 Digest & Vault Commit',
        component: 'SubtleCrypto.digest("SHA-256")',
        input: 'Raw Uint8Array',
        output: 'VaultDocument + document.uploaded event',
        guarantee: 'Immutable baseline fingerprint stored for future verification.',
      },
    ],
  },
  {
    id: 'watermark',
    label: 'Watermark Generation Workflow',
    summary: 'Produces a distinct, visibly attributed PDF per authorized recipient without mutating the master vault document.',
    tables: ['documents', 'recipients', 'watermarked_copies', 'webhook_deliveries'],
    steps: [
      {
        id: 'wm-1',
        title: '1. Recipient Clearance Gate',
        component: 'WatermarkingModule',
        input: 'Selected Document + Recipient',
        output: 'Active recipient validation',
        guarantee: 'Blocks issuance to Suspended recipients.',
      },
      {
        id: 'wm-2',
        title: '2. Multi-Page Visual Stamping',
        component: 'applyVisiblePdfWatermark()',
        input: 'Diagonal template, opacity, angle, footer proof',
        output: 'Stamped pages + RW-ATTR metadata keywords',
        guarantee: 'Visible overlay and footer appear on 100% of pages.',
      },
      {
        id: 'wm-3',
        title: '3. Output Hashing & Event Dispatch',
        component: 'SystemContext.issueWatermark()',
        input: 'Modified PDF bytes',
        output: 'WatermarkedCopy + watermark.issued webhook',
        guarantee: 'Distinct watermarked_sha256 recorded for leak attribution.',
      },
    ],
  },
  {
    id: 'verification',
    label: 'Document Verification Workflow',
    summary: 'Dual-layer forensic pipeline matching exact SHA-256 digests first, then falling back to embedded RW-ATTR metadata inspection.',
    tables: ['verification_records', 'watermarked_copies', 'documents'],
    steps: [
      {
        id: 'ver-1',
        title: '1. Suspect Artifact Ingestion',
        component: 'VerificationModule',
        input: 'Suspect PDF or 64-char SHA-256 / WM-Code',
        output: 'Computed SHA-256 + Extracted PDF Keywords',
        guarantee: 'Non-destructive client-side inspection.',
      },
      {
        id: 'ver-2',
        title: '2. Ledger Hash Lookup',
        component: 'verifyDocumentFile()',
        input: 'computedSha256',
        output: 'Watermarked Match OR Original Master Match',
        guarantee: 'Exact 256-bit match pinpoints exact recipient copy.',
      },
      {
        id: 'ver-3',
        title: '3. Metadata Fallback & Mismatch Alert',
        component: 'RW-ATTR Regex Scanner',
        input: 'PDF Keywords & Subject',
        output: 'Metadata Attribution Match OR Unregistered alert',
        guarantee: 'Emits verification.mismatch when altered or unknown.',
      },
    ],
  },
  {
    id: 'email',
    label: 'Email Ingestion Workflow',
    summary: 'Ephemeral alias routing with TTL validation, MIME attachment extraction, and optional auto-watermarking (Demo Mode in browser).',
    tables: ['ephemeral_inboxes', 'inbound_emails', 'watermarked_copies'],
    steps: [
      {
        id: 'em-1',
        title: '1. Envelope & TTL Check',
        component: 'processDemoInboundEmail()',
        input: 'Target @ephemeral-relay.demo address',
        output: 'Active TTL verification',
        guarantee: 'Rejects expired or revoked ephemeral addresses.',
      },
      {
        id: 'em-2',
        title: '2. MIME Attachment Extraction',
        component: 'Demo MIME Parser',
        input: 'Attached PDF payload',
        output: 'Validated PDF + attachment_sha256',
        guarantee: 'Registers unknown PDFs automatically in vault.',
      },
      {
        id: 'em-3',
        title: '3. Auto-Watermark & Relay Dispatch',
        component: 'Bound Recipient Policy',
        input: 'Inbox autoWatermark flag',
        output: 'Watermarked copy + smtp.inbound.processed event',
        guarantee: 'Clearly tagged processingMode: "demo" until live MTA connected.',
      },
    ],
  },
  {
    id: 'webhook',
    label: 'Webhook Delivery Workflow',
    summary: 'Subscribes external consumers to system events with real Web Crypto HMAC-SHA256 signatures and retryable delivery telemetry.',
    tables: ['webhooks', 'webhook_deliveries'],
    steps: [
      {
        id: 'wh-1',
        title: '1. Event Subscription Matching',
        component: 'dispatchEventAndWebhooks()',
        input: 'RelayEventType',
        output: 'Enabled matching WebhookEndpoints',
        guarantee: 'Only enabled endpoints subscribed to the event fire.',
      },
      {
        id: 'wh-2',
        title: '2. HMAC-SHA256 Payload Signing',
        component: 'computeHmacSha256Hex()',
        input: 'Endpoint signingSecret + JSON payload',
        output: 'X-Relay-Signature-256: sha256=<hex>',
        guarantee: 'Consumers verify authenticity without sharing secrets.',
      },
      {
        id: 'wh-3',
        title: '3. Delivery Telemetry & Retry Queue',
        component: 'WebhooksModule',
        input: 'Simulated or CORS-enabled HTTP POST',
        output: 'HTTP Status, Latency ms, Response Body',
        guarantee: 'Failed deliveries can be inspected and manually retried.',
      },
    ],
  },
  {
    id: 'events',
    label: 'Event-Processing Architecture',
    summary: 'Centralized event bus correlating asynchronous actions across modules using deterministic correlation IDs.',
    tables: ['pipeline_events', 'webhook_deliveries', 'activity_logs'],
    steps: [
      {
        id: 'ev-1',
        title: '1. Correlation ID Minting',
        component: 'makeCorrelationId()',
        input: 'Any module mutation',
        output: 'corr_<hex10> identifier',
        guarantee: 'Traces a single user action across event bus and webhooks.',
      },
      {
        id: 'ev-2',
        title: '2. Envelope Standardization',
        component: 'CentralPipelineEvent',
        input: 'Event type, source module, sha256Ref, watermarkCode',
        output: 'Structured JSON envelope',
        guarantee: 'Uniform schema across all 6 event types.',
      },
      {
        id: 'ev-3',
        title: '3. Deterministic Event Replay',
        component: 'replayPipelineEvent()',
        input: 'Historical event ID',
        output: 'Re-signed webhook fan-out',
        guarantee: 'Recovers downstream consumers after outages.',
      },
    ],
  },
  {
    id: 'database',
    label: 'Database Relationships',
    summary: 'Relational schema defined in /supabase/schema.sql with foreign key integrity and Supabase Row Level Security (RLS).',
    tables: ['documents', 'recipients', 'watermarked_copies', 'ephemeral_inboxes', 'inbound_emails', 'webhooks', 'webhook_deliveries'],
    steps: [
      {
        id: 'db-1',
        title: '1. documents (1) ──< (N) watermarked_copies',
        component: 'Foreign Key: document_id',
        input: 'documents.id (UUID PK)',
        output: 'Cascading watermarked copy records',
        guarantee: 'Every watermarked copy references an immutable master SHA-256.',
      },
      {
        id: 'db-2',
        title: '2. recipients (1) ──< (N) watermarked_copies',
        component: 'Foreign Key: recipient_id',
        input: 'recipients.id (UUID PK)',
        output: 'Recipient-attributed copies',
        guarantee: 'Unique index on (owner_id, email) prevents duplicate identities.',
      },
      {
        id: 'db-3',
        title: '3. ephemeral_inboxes (1) ──< (N) inbound_emails',
        component: 'Foreign Key: inbox_id',
        input: 'ephemeral_inboxes.id (UUID PK)',
        output: 'Captured MIME records with JSONB headers',
        guarantee: 'Tracks processing_mode (demo vs live_mta) explicitly.',
      },
      {
        id: 'db-4',
        title: '4. webhooks (1) ──< (N) webhook_deliveries',
        component: 'Foreign Key: webhook_id',
        input: 'webhooks.id (UUID PK)',
        output: 'Delivery audit trail & latency metrics',
        guarantee: 'RLS enabled on all 10 tables in /supabase/schema.sql.',
      },
    ],
  },
];

export const SystemExplorerModule: React.FC = () => {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(WORKFLOWS[0].id);
  const [activeStepIdx, setActiveStepIdx] = useState(0);

  const workflow = WORKFLOWS.find((w) => w.id === selectedWorkflowId) || WORKFLOWS[0];
  const step = workflow.steps[activeStepIdx] || workflow.steps[0];

  const handleSelectWorkflow = (id: string) => {
    setSelectedWorkflowId(id);
    setActiveStepIdx(0);
  };

  return (
    <div>
      <ModulePageHeader
        title="Interactive System Explorer"
        description="Inspect step-by-step data flows, cryptographic boundaries, event correlation, and Supabase PostgreSQL relationships across all system workflows."
      />

      {/* Workflow Selector Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {WORKFLOWS.map((wf) => (
          <button
            key={wf.id}
            type="button"
            onClick={() => handleSelectWorkflow(wf.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              wf.id === workflow.id
                ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {wf.label}
          </button>
        ))}
      </div>

      {/* Interactive Diagram Strip */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Compass className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <span>{workflow.label}</span>
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 max-w-3xl">
              {workflow.summary}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={activeStepIdx === 0}
              onClick={() => setActiveStepIdx((i) => Math.max(0, i - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 disabled:opacity-40"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Prev Step</span>
            </button>
            <button
              type="button"
              disabled={activeStepIdx >= workflow.steps.length - 1}
              onClick={() => setActiveStepIdx((i) => Math.min(workflow.steps.length - 1, i + 1))}
              className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 px-3 py-1.5 text-xs font-semibold text-white"
            >
              <span>Next Step</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Clickable Stage Nodes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {workflow.steps.map((s, idx) => {
            const isActive = idx === activeStepIdx;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveStepIdx(idx)}
                className={`text-left rounded-xl border p-4 transition-colors ${
                  isActive
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <p className="text-[11px] font-mono font-semibold text-violet-700 dark:text-violet-400">
                  Stage {idx + 1} / {workflow.steps.length}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                  {s.title}
                </p>
                <p className="mt-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                  {s.component}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Stage Deep Inspection + Related Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              <span>{step.title}</span>
            </h3>
            <span className="font-mono text-xs text-cyan-700 dark:text-cyan-400">
              {step.component}
            </span>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
              <dt className="text-slate-500 dark:text-slate-400">Input Contract</dt>
              <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{step.input}</dd>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
              <dt className="text-slate-500 dark:text-slate-400">Output Artifact</dt>
              <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{step.output}</dd>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
              <dt className="text-slate-500 dark:text-slate-400">System Guarantee</dt>
              <dd className="mt-1 font-medium text-emerald-700 dark:text-emerald-400">
                {step.guarantee}
              </dd>
            </div>
          </dl>
        </div>

        <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <span>Supabase Schema Tables</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tables participating in this workflow (from <code className="font-mono">/supabase/schema.sql</code>):
          </p>
          <div className="space-y-1.5">
            {workflow.tables.map((t) => (
              <div
                key={t}
                className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-3 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-200"
              >
                <Layers className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                <span>public.{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
