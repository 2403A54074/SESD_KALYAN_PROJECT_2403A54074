import React, { useState } from 'react';
import { Clock, Inbox, Info, MailPlus } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import { CopyValueButton, EmptyState, ErrorAlert, ModulePageHeader, StatusLabel } from '../ui/CommonUI';

export const InboxesModule: React.FC = () => {
  const {
    state,
    provisionInbox,
    updateInboxStatus,
    extendInboxTtl,
    setActiveModule,
  } = useSystem();

  const [label, setLabel] = useState('');
  const [customPrefix, setCustomPrefix] = useState('');
  const [boundDocumentId, setBoundDocumentId] = useState(state?.documents[0]?.id || '');
  const [boundRecipientId, setBoundRecipientId] = useState(state?.recipients[0]?.id || '');
  const [autoWatermark, setAutoWatermark] = useState(true);
  const [ttlMinutes, setTtlMinutes] = useState(60);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Expired' | 'Revoked'>('All');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!state) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setErrorMsg('Provide a descriptive label for the ephemeral inbox.');
      return;
    }
    setErrorMsg(null);
    await provisionInbox({
      label,
      customPrefix,
      boundDocumentId: boundDocumentId || undefined,
      boundRecipientId: boundRecipientId || undefined,
      autoWatermark,
      ttlMinutes,
    });
    setLabel('');
    setCustomPrefix('');
  };

  const filtered = state.inboxes.filter((i) =>
    statusFilter === 'All' ? true : i.status === statusFilter
  );

  return (
    <div>
      <ModulePageHeader
        title="Temporary Email Inbox Management"
        description="Provision short-lived relay addresses bound to documents and recipients with configurable TTL expiration and auto-watermarking rules."
        actions={
          <button
            type="button"
            onClick={() => setActiveModule('email-processing')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
          >
            <MailPlus className="h-3.5 w-3.5" />
            <span>Open Demo Email Processor</span>
          </button>
        }
      />

      {/* Honest Infrastructure Scope Notice */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-cyan-500/30 bg-cyan-50/70 dark:bg-cyan-950/25 px-4 py-3 text-xs text-slate-700 dark:text-slate-300">
        <Info className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">
            Demo Ephemeral Relay Environment (`@ephemeral-relay.demo`)
          </p>
          <p className="mt-0.5">
            Addresses provisioned here operate in local Demo Mode for testing attachment hashing, auto-watermarking, and webhook dispatch. Receiving external internet email requires deploying an external MX/SMTP ingress worker (Postfix, Haraka, or Mailgun Inbound) pointed at your backend webhook.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-5">
          <ErrorAlert message={errorMsg} onDismiss={() => setErrorMsg(null)} />
        </div>
      )}

      {/* Provision Form */}
      <form
        onSubmit={handleCreate}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 mb-7 space-y-4"
      >
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          Provision Ephemeral Relay Address
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Inbox Purpose Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Q4 Legal Review Drop"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Alias Prefix (Optional)
            </label>
            <input
              type="text"
              value={customPrefix}
              onChange={(e) => setCustomPrefix(e.target.value)}
              placeholder="e.g., legal-nda"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Bound Recipient
            </label>
            <select
              value={boundRecipientId}
              onChange={(e) => setBoundRecipientId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
            >
              <option value="">Any / Default Recipient</option>
              {state.recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName} ({r.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Expiration TTL
            </label>
            <select
              value={ttlMinutes}
              onChange={(e) => setTtlMinutes(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
            >
              <option value={15}>15 minutes</option>
              <option value={60}>1 hour</option>
              <option value={360}>6 hours</option>
              <option value={1440}>24 hours</option>
              <option value={10080}>7 days</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-4">
            <select
              value={boundDocumentId}
              onChange={(e) => setBoundDocumentId(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="">No specific master document bound</option>
              {state.documents.map((d) => (
                <option key={d.id} value={d.id}>
                  Bind Doc: {d.title}
                </option>
              ))}
            </select>

            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoWatermark}
                onChange={(e) => setAutoWatermark(e.target.checked)}
                className="accent-cyan-600"
              />
              <span>Auto-watermark inbound PDF attachments</span>
            </label>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
          >
            Provision Inbox
          </button>
        </div>
      </form>

      {/* Filter Bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1">
          {(['All', 'Active', 'Expired', 'Revoked'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                statusFilter === tab
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="No ephemeral inboxes match filter"
          description="Provision a temporary relay address above to start testing demo SMTP ingestion."
        />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Ephemeral Address</th>
                <th className="py-2.5 px-4">Policy &amp; Binding</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Msgs / Expires</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {filtered.map((inbox) => {
                const rec = state.recipients.find((r) => r.id === inbox.boundRecipientId);
                return (
                  <tr key={inbox.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <p className="font-mono font-semibold text-cyan-700 dark:text-cyan-400">
                        {inbox.aliasAddress}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{inbox.label}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      <p>{rec ? `${rec.fullName} (${rec.email})` : 'Default recipient'}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Auto-watermark: {inbox.autoWatermark ? 'Enabled' : 'Disabled'}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel status={inbox.status} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      <span className="text-slate-900 dark:text-slate-100 font-semibold">
                        {inbox.messageCount}
                      </span>{' '}
                      · {new Date(inbox.expiresAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <CopyValueButton value={inbox.aliasAddress} label="Copy" />
                        <button
                          type="button"
                          onClick={() => extendInboxTtl(inbox.id, 60)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <Clock className="h-3 w-3" />
                          <span>+1h</span>
                        </button>
                        {inbox.status === 'Active' ? (
                          <button
                            type="button"
                            onClick={() => updateInboxStatus(inbox.id, 'Revoked')}
                            className="rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          >
                            Revoke
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => extendInboxTtl(inbox.id, 60)}
                            className="rounded-md bg-cyan-600 hover:bg-cyan-500 px-2.5 py-1 text-xs font-medium text-white"
                          >
                            Reactivate
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
    </div>
  );
};
