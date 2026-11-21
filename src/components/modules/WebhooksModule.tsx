import React, { useState } from 'react';
import { Eye, EyeOff, Plus, RotateCw, Send, Trash2, Webhook } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import type { RelayEventType, WebhookDeliveryLog } from '../../types/system';
import { CopyValueButton, EmptyState, ErrorAlert, ModulePageHeader, StatusLabel } from '../ui/CommonUI';

const ALL_EVENTS: RelayEventType[] = [
  'document.uploaded',
  'watermark.issued',
  'document.verified',
  'verification.mismatch',
  'inbox.provisioned',
  'smtp.inbound.processed',
];

export const WebhooksModule: React.FC = () => {
  const {
    state,
    addWebhook,
    toggleWebhook,
    deleteWebhook,
    triggerWebhookDelivery,
    retryWebhookDelivery,
  } = useSystem();

  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [signingSecret, setSigningSecret] = useState(
    () => `whsec_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
  );
  const [subscribedEvents, setSubscribedEvents] = useState<RelayEventType[]>([
    'watermark.issued',
    'smtp.inbound.processed',
  ]);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [deliveryMode, setDeliveryMode] = useState<'simulated' | 'live_fetch'>('simulated');
  const [selectedDelivery, setSelectedDelivery] = useState<WebhookDeliveryLog | null>(
    state?.webhookDeliveries[0] || null
  );
  const [statusFilter, setStatusFilter] = useState<'All' | 'Delivered' | 'Failed'>('All');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!state) return null;

  const toggleEventSubscription = (evt: RelayEventType) => {
    setSubscribedEvents((prev) =>
      prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt]
    );
  };

  const handleAddWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !targetUrl.trim()) {
      setErrorMsg('Endpoint name and HTTPS target URL are required.');
      return;
    }
    try {
      const parsed = new URL(targetUrl.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      setErrorMsg('Enter a valid http:// or https:// webhook URL.');
      return;
    }
    if (subscribedEvents.length === 0) {
      setErrorMsg('Select at least one relay event subscription.');
      return;
    }
    setErrorMsg(null);
    addWebhook({
      name: name.trim(),
      targetUrl: targetUrl.trim(),
      signingSecret: signingSecret.trim(),
      subscribedEvents,
      maxRetries: 3,
      timeoutMs: 5000,
      enabled: true,
    });
    setName('');
    setTargetUrl('');
    setSigningSecret(`whsec_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`);
  };

  const filteredDeliveries = state.webhookDeliveries.filter((d) =>
    statusFilter === 'All' ? true : d.status === statusFilter
  );

  return (
    <div>
      <ModulePageHeader
        title="Webhook Configuration & Delivery Logs"
        description="Configure HTTPS webhook consumers, compute HMAC-SHA256 payload signatures (X-Relay-Signature-256), dispatch test events, and inspect delivery receipts."
      />

      {errorMsg && (
        <div className="mb-5">
          <ErrorAlert message={errorMsg} onDismiss={() => setErrorMsg(null)} />
        </div>
      )}

      {/* Endpoint Registration + Delivery Mode Switch */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        <form
          onSubmit={handleAddWebhook}
          className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <span>Register Webhook Endpoint</span>
            </h2>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setDeliveryMode('simulated')}
                className={`px-2 py-1 rounded-md font-medium ${
                  deliveryMode === 'simulated'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                    : 'text-slate-500'
                }`}
              >
                Simulated Test
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMode('live_fetch')}
                className={`px-2 py-1 rounded-md font-medium ${
                  deliveryMode === 'live_fetch'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                    : 'text-slate-500'
                }`}
              >
                Live Browser POST
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Endpoint Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Audit Trail Collector"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Target URL
              </label>
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://api.example.com/webhooks/relay"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              HMAC-SHA256 Signing Secret (Stored Locally Only)
            </label>
            <input
              type="text"
              value={signingSecret}
              onChange={(e) => setSigningSecret(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-2">
              Subscribed Events
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {ALL_EVENTS.map((evt) => (
                <label
                  key={evt}
                  className="inline-flex items-center gap-2 text-xs font-mono text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={subscribedEvents.includes(evt)}
                    onChange={() => toggleEventSubscription(evt)}
                    className="accent-cyan-600"
                  />
                  <span>{evt}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {deliveryMode === 'live_fetch'
                ? 'Live POST requires CORS enabled on target endpoint.'
                : 'Simulated mode tests HMAC signing without external network calls.'}
            </span>
            <button
              type="submit"
              className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              Save Endpoint
            </button>
          </div>
        </form>

        {/* Configured Endpoints List */}
        <div className="lg:col-span-6 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Configured Endpoints ({state.webhooks.length})
          </h2>

          {state.webhooks.length === 0 ? (
            <EmptyState
              icon={<Webhook className="h-5 w-5" />}
              title="No webhooks configured"
              description="Add a webhook endpoint on the left to receive HMAC-SHA256 signed relay payloads."
            />
          ) : (
            <div className="space-y-3">
              {state.webhooks.map((hook) => {
                const isRevealed = revealedSecrets[hook.id];
                return (
                  <div
                    key={hook.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-4 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {hook.name}
                        </p>
                        <p className="text-xs font-mono text-cyan-700 dark:text-cyan-400 truncate">
                          {hook.targetUrl}
                        </p>
                      </div>
                      <StatusLabel status={hook.enabled ? 'Active' : 'Suspended'} />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span>
                          Secret:{' '}
                          {isRevealed
                            ? hook.signingSecret
                            : `${hook.signingSecret.slice(0, 10)}••••••••`}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedSecrets((prev) => ({ ...prev, [hook.id]: !isRevealed }))
                          }
                          aria-label="Toggle secret visibility"
                          className="p-1 hover:text-slate-900 dark:hover:text-white"
                        >
                          {isRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                      </div>
                      <span className="font-mono">
                        {hook.subscribedEvents.length} events · max {hook.maxRetries} retries
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            const del = await triggerWebhookDelivery({
                              webhookId: hook.id,
                              eventType: hook.subscribedEvents[0] || 'watermark.issued',
                              payload: { test: true, triggered_by: 'manual_test_dispatch' },
                              mode: deliveryMode,
                            });
                            setSelectedDelivery(del);
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-violet-600 hover:bg-violet-500 px-2.5 py-1 text-xs font-medium text-white"
                        >
                          <Send className="h-3 w-3" />
                          <span>Send Test</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const del = await triggerWebhookDelivery({
                              webhookId: hook.id,
                              eventType: hook.subscribedEvents[0] || 'watermark.issued',
                              payload: { test: true, simulated_failure: true },
                              mode: 'simulated',
                              simulateError: true,
                            });
                            setSelectedDelivery(del);
                          }}
                          className="rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          Simulate 502
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleWebhook(hook.id)}
                          className="rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200"
                        >
                          {hook.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteWebhook(hook.id)}
                          aria-label={`Delete ${hook.name}`}
                          className="rounded-md border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delivery Logs & Payload Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Webhook Delivery Logs ({filteredDeliveries.length})
            </h2>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1">
              {(['All', 'Delivered', 'Failed'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                    statusFilter === tab
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                      : 'text-slate-500'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Endpoint / Event</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">HTTP / Latency</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {filteredDeliveries.map((del) => (
                  <tr
                    key={del.id}
                    onClick={() => setSelectedDelivery(del)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {del.webhookName}
                      </p>
                      <p className="text-[11px] font-mono text-cyan-700 dark:text-cyan-400">
                        {del.eventType} · {del.deliveryMode}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel status={del.status} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {del.httpStatus ?? 'ERR'} · {del.latencyMs}ms
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {del.status === 'Failed' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void retryWebhookDelivery(del.id);
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <RotateCw className="h-3 w-3" />
                          <span>Retry</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
            Delivery Payload &amp; HMAC Inspector
          </h2>
          {!selectedDelivery ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select a delivery row to inspect its signed JSON payload and response.
            </p>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-slate-500 dark:text-slate-400">
                  {selectedDelivery.correlationId}
                </span>
                <CopyValueButton value={selectedDelivery.signatureHeader} label="Copy HMAC" />
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5">
                <p className="text-[10px] font-mono text-slate-500">X-Relay-Signature-256</p>
                <p className="font-mono text-[11px] text-violet-700 dark:text-violet-300 break-all mt-0.5">
                  {selectedDelivery.signatureHeader}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Request JSON Payload
                </p>
                <pre className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-[11px] font-mono text-slate-800 dark:text-slate-200 overflow-x-auto max-h-48">
                  {JSON.stringify(selectedDelivery.payload, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Response Body
                </p>
                <pre className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">
                  {selectedDelivery.responseBody}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
