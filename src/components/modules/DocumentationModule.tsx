import React, { useMemo, useState } from 'react';
import { BookOpen, Compass, HelpCircle, Lock, MailWarning, Search, ShieldCheck, Webhook } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import { CopyValueButton, ModulePageHeader } from '../ui/CommonUI';

const SUPABASE_SNIPPET = `# .env.local (Frontend public variables only)
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_ANON_KEY="your-public-anon-key"

# Apply /supabase/schema.sql inside the Supabase SQL Editor
# Never place service_role keys in VITE_* environment variables.`;

const GLOSSARY_TERMS = [
  {
    term: 'SHA-256 Fingerprinting',
    definition:
      'A 256-bit cryptographic hash computed locally via Web Crypto API (SubtleCrypto). Even a single altered byte in a PDF produces a completely different 64-character hex digest.',
  },
  {
    term: 'RW-ATTR Metadata Marker',
    definition:
      'A structured attribution token embedded inside the PDF Keywords and Subject properties during watermarking so re-saved PDFs can still be traced back to the issued copy.',
  },
  {
    term: 'HMAC-SHA256 Webhook Signing',
    definition:
      'Keyed-hash message authentication code sent in X-Relay-Signature-256 so downstream consumers can verify webhook payload integrity without exposing the signing secret in transit.',
  },
  {
    term: 'Ephemeral SMTP Inbox (Demo vs Live)',
    definition:
      'Time-limited relay addresses used to ingest email attachments. Browser sessions run a local Demo Mode parser; live MX reception requires an external MTA worker (Postfix/Haraka/Mailgun).',
  },
  {
    term: 'Row Level Security (RLS)',
    definition:
      'PostgreSQL authorization policies enabled across all 10 tables in /supabase/schema.sql so authenticated users can only query their own documents, recipients, and logs.',
  },
];

const HELP_FAQ = [
  {
    q: 'Why does the Email Processing module say Demo Mode?',
    a: 'Web browsers cannot bind TCP port 25/587 or accept public SMTP MX connections. Demo Mode lets you test real MIME attachment extraction, SHA-256 hashing, auto-watermarking, and webhook dispatch safely in-browser.',
  },
  {
    q: 'Can I verify a PDF I downloaded from the Watermarking module?',
    a: 'Yes. Download any watermarked PDF, open Document Verification, and upload it. The verifier computes its SHA-256 hash and immediately identifies the recipient and Watermark ID.',
  },
  {
    q: 'Where are my custom settings and uploaded DP stored?',
    a: 'Preferences, tasks, notes, and custom uploaded display pictures persist in browser localStorage and are structured to sync with Supabase when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured.',
  },
];

export const DocumentationModule: React.FC = () => {
  const { setTourOpen, setActiveModule } = useSystem();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGlossary = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return GLOSSARY_TERMS.filter(
      (g) => g.term.toLowerCase().includes(q) || g.definition.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const filteredFaq = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return HELP_FAQ.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
  }, [searchQuery]);

  return (
    <div>
      <ModulePageHeader
        title="Documentation & Help Centre"
        description="Searchable engineering specification, technical glossary, interactive onboarding tour, and Supabase integration guide."
        actions={
          <>
            <button
              type="button"
              onClick={() => setActiveModule('explorer')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <Compass className="h-3.5 w-3.5 text-cyan-500" />
              <span>System Explorer</span>
            </button>
            <button
              type="button"
              onClick={() => setTourOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-white"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Start Guided Tour</span>
            </button>
          </>
        }
      />

      {/* Search Bar */}
      <div className="relative max-w-md mb-6">
        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search documentation, terms, and FAQ…"
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
        />
      </div>

      <div className="space-y-6">
        {/* Contextual Technical Glossary */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <span>Technical Glossary &amp; Contextual Explanations</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredGlossary.map((item) => (
              <div
                key={item.term}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3.5"
              >
                <p className="text-xs font-semibold text-slate-900 dark:text-white">{item.term}</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.definition}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Help Centre FAQ */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <span>Help Centre FAQ</span>
          </h2>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredFaq.map((item) => (
              <div key={item.q} className="py-3 first:pt-0 last:pb-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{item.q}</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Cryptographic Spec + SMTP Boundary + Supabase */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <span>Dual-Layer Forensic Verification</span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Every watermarked copy receives a unique Watermark ID stamped across every PDF page, hashed with SHA-256, and tagged with <code className="font-mono">RW-ATTR</code> metadata for resilient attribution.
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <MailWarning className="h-4 w-4 text-amber-500" />
              <span>SMTP Receiving Infrastructure Boundary</span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Live external SMTP reception requires deploying a dedicated MTA ingress worker (Haraka, Postfix, or Mailgun Inbound) forwarding MIME payloads into Supabase Edge Functions.
            </p>
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Supabase-Ready Environment Setup
              </h2>
              <CopyValueButton value={SUPABASE_SNIPPET} label="Copy Env" />
            </div>
            <pre className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-[11px] font-mono text-slate-800 dark:text-slate-200 overflow-x-auto">
              {SUPABASE_SNIPPET}
            </pre>
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Webhook className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <span>Security &amp; Secret Hygiene</span>
            </h2>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
              <Lock className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                Zero private secrets or service_role keys exist in frontend source code. Webhook URL testing avoids arbitrary unsafe server-side SSRF calls.
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
