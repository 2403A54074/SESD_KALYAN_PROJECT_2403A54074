import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { systemRepository } from '../services/repository';
import type {
  ActivityLogEntry,
  CentralPipelineEvent,
  DocumentClassification,
  EphemeralInbox,
  InboundEmailEvent,
  ModuleId,
  PersonalizationConfig,
  PlannerTask,
  Recipient,
  RelayEventType,
  SystemNotification,
  SystemState,
  UserProfileSettings,
  VerificationRecord,
  WatermarkConfig,
  WatermarkedCopy,
  WebhookDeliveryLog,
  WebhookEndpoint,
  VaultDocument,
} from '../types/system';
import { ambientBgm } from '../utils/ambientBgm';
import {
  applyVisiblePdfWatermark,
  computeHmacSha256Hex,
  computeSha256Hex,
  deletePdfBinary,
  getPdfBinary,
  inspectPdfBytes,
  savePdfBinary,
} from '../utils/cryptoPdf';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant: 'info' | 'success' | 'warning' | 'error';
}

interface SystemContextValue {
  state: SystemState | null;
  isLoading: boolean;
  isRefreshing: boolean;
  loadError: string | null;
  activeModule: ModuleId;
  setActiveModule: (module: ModuleId) => void;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  refreshView: () => Promise<void>;
  // Module actions
  registerDocument: (params: {
    title: string;
    fileName: string;
    classification: DocumentClassification;
    ownerName: string;
    notes: string;
    bytes: Uint8Array;
  }) => Promise<VaultDocument>;
  deleteDocument: (docId: string) => void;
  issueWatermark: (params: {
    documentId: string;
    recipientId: string;
    config: WatermarkConfig;
  }) => Promise<WatermarkedCopy>;
  verifyDocumentFile: (params: {
    fileName: string;
    bytes: Uint8Array;
  }) => Promise<VerificationRecord>;
  verifyByHashOrCode: (query: string) => Promise<VerificationRecord>;
  addRecipient: (recipient: Omit<Recipient, 'id' | 'createdAt'>) => Recipient;
  toggleRecipientStatus: (id: string) => void;
  deleteRecipient: (id: string) => void;
  provisionInbox: (params: {
    label: string;
    customPrefix?: string;
    boundDocumentId?: string;
    boundRecipientId?: string;
    autoWatermark: boolean;
    ttlMinutes: number;
  }) => Promise<EphemeralInbox>;
  updateInboxStatus: (id: string, status: 'Active' | 'Expired' | 'Revoked') => void;
  extendInboxTtl: (id: string, extraMinutes: number) => void;
  processDemoInboundEmail: (params: {
    inboxId: string;
    fromAddress: string;
    subject: string;
    body: string;
    attachment?: { fileName: string; bytes: Uint8Array };
    simulateFailure?: boolean;
  }) => Promise<InboundEmailEvent>;
  addWebhook: (webhook: Omit<WebhookEndpoint, 'id' | 'createdAt'>) => WebhookEndpoint;
  toggleWebhook: (id: string) => void;
  deleteWebhook: (id: string) => void;
  triggerWebhookDelivery: (params: {
    webhookId: string;
    eventType: RelayEventType;
    payload: Record<string, unknown>;
    mode: 'simulated' | 'live_fetch';
    simulateError?: boolean;
  }) => Promise<WebhookDeliveryLog>;
  retryWebhookDelivery: (deliveryId: string) => Promise<WebhookDeliveryLog | null>;
  replayPipelineEvent: (eventId: string) => Promise<void>;
  updateSettings: (partial: Partial<UserProfileSettings>) => void;
  updatePersonalization: (partial: Partial<PersonalizationConfig>) => void;
  toggleTheme: () => void;
  resetDemoData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  // Document favorites & viewed tracking
  toggleDocumentFavorite: (docId: string) => void;
  markDocumentViewed: (docId: string) => void;
  // Report export counter (for Attribution Achievement)
  recordReportExport: () => void;
  // Productivity
  addTask: (task: Omit<PlannerTask, 'id' | 'createdAt' | 'completed'>) => void;
  toggleTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  updateNotes: (notes: string) => void;
  toggleFocusMode: () => void;
  incrementPomodoro: () => void;
  // Notifications
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  addNotification: (notif: Omit<SystemNotification, 'id' | 'read' | 'createdAt'>) => void;
  // Global UI overlays
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  notificationsOpen: boolean;
  setNotificationsOpen: (open: boolean) => void;
  tourOpen: boolean;
  setTourOpen: (open: boolean) => void;
  // Preview helper
  previewTarget: { title: string; bytes: Uint8Array; sha256: string; fileName: string } | null;
  openPdfPreview: (target: { title: string; bytes: Uint8Array; sha256: string; fileName: string }) => void;
  closePdfPreview: () => void;
}

const SystemContext = createContext<SystemContextValue | null>(null);

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function makeCorrelationId(): string {
  return `corr_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

const MODULE_ROUTES: Record<ModuleId, string> = {
  dashboard: '/',
  upload: '/upload',
  fingerprints: '/fingerprints',
  watermarking: '/watermarking',
  verification: '/verification',
  recipients: '/recipients',
  inboxes: '/inboxes',
  'email-processing': '/email-processing',
  webhooks: '/webhooks',
  events: '/events',
  reports: '/reports',
  explorer: '/explorer',
  playground: '/playground',
  productivity: '/productivity',
  calendar: '/calendar',
  'music-studio': '/music-studio',
  game: '/game',
  achievements: '/achievements',
  personalization: '/personalization',
  settings: '/settings',
  docs: '/docs',
};

function pathnameToModule(pathname: string): ModuleId {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const matched = (Object.entries(MODULE_ROUTES) as [ModuleId, string][]).find(
    ([, route]) => route === clean
  );
  return matched ? matched[0] : 'dashboard';
}

export const SystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SystemState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeModule, setActiveModuleState] = useState<ModuleId>(() =>
    typeof window !== 'undefined' ? pathnameToModule(window.location.pathname) : 'dashboard'
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<{
    title: string;
    bytes: Uint8Array;
    sha256: string;
    fileName: string;
  } | null>(null);

  const stateRef = useRef<SystemState | null>(null);
  stateRef.current = state;

  const setActiveModule = useCallback((module: ModuleId) => {
    setActiveModuleState(module);
    if (typeof window !== 'undefined') {
      const targetPath = MODULE_ROUTES[module] || '/';
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ module }, '', targetPath);
      }
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setActiveModuleState(pathnameToModule(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = makeId('toast');
      setToasts((prev) => [{ ...toast, id }, ...prev].slice(0, 4));
      if (stateRef.current?.settings.personalization?.notifications?.soundEnabled) {
        void ambientBgm.playNotificationChime();
      }
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  // Apply personalization side-effects (themeMode, browserTitle, faviconAccent, fontSize, reducedMotion)
  useEffect(() => {
    if (!state) return;
    const p = state.settings.personalization;
    const resolveDark = () => {
      if (p.themeMode === 'system') {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      return p.themeMode === 'dark';
    };

    const applyTheme = () => {
      const isDark = resolveDark();
      document.documentElement.classList.toggle('dark', isDark);
    };

    applyTheme();
    const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const onSystemChange = () => {
      if (stateRef.current?.settings.personalization.themeMode === 'system') {
        applyTheme();
      }
    };
    mq?.addEventListener?.('change', onSystemChange);

    // Browser title
    document.title = p.browserTitle || 'Digital Document Watermarking & Ephemeral SMTP–Webhook Relay System';

    // Dynamic SVG favicon matching accent
    const colorMap: Record<string, string> = {
      cyan: '#06b6d4',
      violet: '#7c3aed',
      emerald: '#10b981',
      indigo: '#4f46e5',
    };
    const hex = colorMap[p.faviconAccent] || '#06b6d4';
    const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0b1120"/><path d="M9 10h14v3H9zm0 5h10v3H9zm0 5h14v2H9z" fill="${hex}"/></svg>`;
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = `data:image/svg+xml,${encodeURIComponent(svgIcon)}`;

    // Font size scale
    const fontScaleMap = { sm: '14px', md: '16px', lg: '17.5px' };
    document.documentElement.style.fontSize = fontScaleMap[p.fontSize] || '16px';

    // Reduced motion attribute
    document.documentElement.dataset.reducedMotion =
      p.reducedMotion || p.animationIntensity === 'none' ? 'true' : 'false';

    return () => {
      mq?.removeEventListener?.('change', onSystemChange);
    };
  }, [state]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const loaded = await systemRepository.loadStateForUser(null);
        if (mounted) {
          setState(loaded);
        }
      } catch (err) {
        if (!mounted) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to initialize workspace.');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const commitState = useCallback((updater: (prev: SystemState) => SystemState) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      void systemRepository.saveState(next, null);
      return next;
    });
  }, []);

  const dispatchEventAndWebhooks = useCallback(
    async (params: {
      eventType: RelayEventType;
      sourceModule: string;
      sha256Ref?: string;
      watermarkCode?: string;
      payload: Record<string, unknown>;
    }): Promise<{ event: CentralPipelineEvent; deliveries: WebhookDeliveryLog[] }> => {
      const current = stateRef.current;
      const correlationId = makeCorrelationId();
      const matchingHooks = (current?.webhooks || []).filter(
        (w) => w.enabled && w.subscribedEvents.includes(params.eventType)
      );

      const deliveries: WebhookDeliveryLog[] = [];
      for (const hook of matchingHooks) {
        const fullPayload = {
          event: params.eventType,
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
          ...params.payload,
        };
        const sig = await computeHmacSha256Hex(hook.signingSecret, JSON.stringify(fullPayload));
        deliveries.push({
          id: makeId('del'),
          webhookId: hook.id,
          webhookName: hook.name,
          targetUrl: hook.targetUrl,
          eventType: params.eventType,
          correlationId,
          deliveryMode: 'simulated',
          httpStatus: 200,
          latencyMs: 65 + Math.floor(Math.random() * 90),
          signatureHeader: `sha256=${sig}`,
          payload: fullPayload,
          responseBody: '{"accepted":true,"mode":"simulated_local_relay"}',
          status: 'Delivered',
          deliveredAt: new Date().toISOString(),
        });
      }

      const event: CentralPipelineEvent = {
        id: makeId('evt'),
        correlationId,
        eventType: params.eventType,
        sourceModule: params.sourceModule,
        status: 'Completed',
        sha256Ref: params.sha256Ref,
        watermarkCode: params.watermarkCode,
        dispatchedWebhooks: deliveries.length,
        payload: {
          correlation_id: correlationId,
          event: params.eventType,
          ...params.payload,
        },
        createdAt: new Date().toISOString(),
      };

      return { event, deliveries };
    },
    []
  );

  const refreshView = useCallback(async () => {
    setIsRefreshing(true);
    await new Promise((r) => setTimeout(r, 320));
    setIsRefreshing(false);
  }, []);

  const registerDocument = useCallback(
    async (params: {
      title: string;
      fileName: string;
      classification: DocumentClassification;
      ownerName: string;
      notes: string;
      bytes: Uint8Array;
    }) => {
      const inspection = await inspectPdfBytes(params.bytes);
      const sha256Hash = await computeSha256Hex(params.bytes);
      const doc: VaultDocument = {
        id: makeId('doc'),
        title: params.title.trim(),
        fileName: params.fileName,
        classification: params.classification,
        sha256Hash,
        fileSizeBytes: params.bytes.byteLength,
        pageCount: inspection.pageCount,
        ownerName: params.ownerName.trim() || stateRef.current?.settings.displayName || 'Workspace Owner',
        notes: params.notes.trim(),
        createdAt: new Date().toISOString(),
        hasBinaryInSession: true,
      };
      savePdfBinary(`doc:${doc.id}`, params.bytes);

      const { event, deliveries } = await dispatchEventAndWebhooks({
        eventType: 'document.uploaded',
        sourceModule: 'Document Upload',
        sha256Ref: sha256Hash,
        payload: {
          document_id: doc.id,
          title: doc.title,
          file_name: doc.fileName,
          classification: doc.classification,
          sha256: sha256Hash,
          page_count: doc.pageCount,
        },
      });

      const log: ActivityLogEntry = {
        id: makeId('act'),
        actor: doc.ownerName,
        module: 'Document Upload',
        action: 'Registered Master PDF',
        resourceLabel: doc.fileName,
        outcome: 'Success',
        metadataSummary: `${doc.pageCount} pages · SHA-256 ${sha256Hash.slice(0, 16)}…`,
        createdAt: new Date().toISOString(),
      };

      commitState((prev) => ({
        ...prev,
        documents: [doc, ...prev.documents],
        pipelineEvents: [event, ...prev.pipelineEvents],
        webhookDeliveries: [...deliveries, ...prev.webhookDeliveries],
        activityLogs: [log, ...prev.activityLogs],
      }));

      pushToast({
        title: 'PDF Registered & Fingerprinted',
        description: `${doc.fileName} (${doc.pageCount} pages) indexed with SHA-256.`,
        variant: 'success',
      });

      return doc;
    },
    [commitState, dispatchEventAndWebhooks, pushToast]
  );

  const deleteDocument = useCallback(
    (docId: string) => {
      const target = stateRef.current?.documents.find((d) => d.id === docId);
      deletePdfBinary(`doc:${docId}`);
      const log: ActivityLogEntry = {
        id: makeId('act'),
        actor: stateRef.current?.settings.displayName || 'System User',
        module: 'Document Upload',
        action: 'Removed Master PDF',
        resourceLabel: target?.fileName || docId,
        outcome: 'Warning',
        metadataSummary: 'Removed document from active vault',
        createdAt: new Date().toISOString(),
      };
      commitState((prev) => ({
        ...prev,
        documents: prev.documents.filter((d) => d.id !== docId),
        activityLogs: [log, ...prev.activityLogs],
      }));
      pushToast({
        title: 'Document Removed',
        description: target?.fileName,
        variant: 'info',
      });
    },
    [commitState, pushToast]
  );

  const issueWatermark = useCallback(
    async (params: { documentId: string; recipientId: string; config: WatermarkConfig }) => {
      const current = stateRef.current;
      if (!current) throw new Error('System state unavailable.');
      const doc = current.documents.find((d) => d.id === params.documentId);
      const rec = current.recipients.find((r) => r.id === params.recipientId);
      if (!doc || !rec) throw new Error('Document or recipient not found.');

      const sourceBytes = getPdfBinary(`doc:${doc.id}`);
      if (!sourceBytes) {
        throw new Error(
          'Source PDF bytes are unavailable in this session. Re-upload the master PDF in Document Upload to watermark it.'
        );
      }

      const watermarkCode = `WM-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const result = await applyVisiblePdfWatermark({
        sourceBytes,
        originalSha256: doc.sha256Hash,
        recipientName: rec.fullName,
        recipientEmail: rec.email,
        classification: doc.classification,
        watermarkCode,
        config: params.config,
      });

      savePdfBinary(`wm:${watermarkCode}`, result.watermarkedBytes);

      const copy: WatermarkedCopy = {
        id: makeId('wm'),
        watermarkCode,
        documentId: doc.id,
        documentTitle: doc.title,
        recipientId: rec.id,
        recipientName: rec.fullName,
        recipientEmail: rec.email,
        originalSha256: doc.sha256Hash,
        watermarkedSha256: result.watermarkedSha256,
        overlayText: result.overlayText,
        colorPreset: params.config.colorPreset,
        opacity: params.config.opacity,
        rotationDeg: params.config.rotationDeg,
        fontSize: params.config.fontSize,
        includeFooterStamp: params.config.includeFooterStamp,
        fileSizeBytes: result.watermarkedBytes.byteLength,
        issuedAt: new Date().toISOString(),
      };

      const { event, deliveries } = await dispatchEventAndWebhooks({
        eventType: 'watermark.issued',
        sourceModule: 'PDF Watermarking',
        sha256Ref: copy.watermarkedSha256,
        watermarkCode: copy.watermarkCode,
        payload: {
          watermark_code: copy.watermarkCode,
          document_id: doc.id,
          recipient_email: rec.email,
          original_sha256: doc.sha256Hash,
          watermarked_sha256: copy.watermarkedSha256,
        },
      });

      const log: ActivityLogEntry = {
        id: makeId('act'),
        actor: current.settings.displayName,
        module: 'PDF Watermarking',
        action: 'Issued Recipient Copy',
        resourceLabel: `${watermarkCode} → ${rec.email}`,
        outcome: 'Success',
        metadataSummary: `SHA-256 ${copy.watermarkedSha256.slice(0, 16)}…`,
        createdAt: new Date().toISOString(),
      };

      commitState((prev) => ({
        ...prev,
        watermarkedCopies: [copy, ...prev.watermarkedCopies],
        pipelineEvents: [event, ...prev.pipelineEvents],
        webhookDeliveries: [...deliveries, ...prev.webhookDeliveries],
        activityLogs: [log, ...prev.activityLogs],
      }));

      pushToast({
        title: `Watermarked Copy ${watermarkCode} Issued`,
        description: `Attributed to ${rec.fullName} (${rec.email}).`,
        variant: 'success',
      });

      return copy;
    },
    [commitState, dispatchEventAndWebhooks, pushToast]
  );

  const verifyDocumentFile = useCallback(
    async (params: { fileName: string; bytes: Uint8Array }) => {
      const current = stateRef.current;
      if (!current) throw new Error('System state unavailable.');

      const inspection = await inspectPdfBytes(params.bytes);
      const computedSha256 = await computeSha256Hex(params.bytes);

      const wmMatch = current.watermarkedCopies.find(
        (w) => w.watermarkedSha256.toLowerCase() === computedSha256.toLowerCase()
      );
      const docMatch = current.documents.find(
        (d) => d.sha256Hash.toLowerCase() === computedSha256.toLowerCase()
      );

      let record: VerificationRecord;
      let eventType: RelayEventType = 'document.verified';

      if (wmMatch) {
        record = {
          id: makeId('ver'),
          fileName: params.fileName,
          computedSha256,
          outcome: 'Watermarked Match',
          matchedDocumentId: wmMatch.documentId,
          matchedDocumentTitle: wmMatch.documentTitle,
          matchedWatermarkCode: wmMatch.watermarkCode,
          matchedRecipientName: wmMatch.recipientName,
          matchedRecipientEmail: wmMatch.recipientEmail,
          embeddedAttribution: inspection.embeddedAttribution,
          details: `Exact SHA-256 match against watermarked copy ${wmMatch.watermarkCode} issued to ${wmMatch.recipientName}.`,
          verifiedAt: new Date().toISOString(),
        };
      } else if (docMatch) {
        record = {
          id: makeId('ver'),
          fileName: params.fileName,
          computedSha256,
          outcome: 'Original Master Match',
          matchedDocumentId: docMatch.id,
          matchedDocumentTitle: docMatch.title,
          details: `Exact SHA-256 match against unwatermarked master vault document "${docMatch.title}".`,
          verifiedAt: new Date().toISOString(),
        };
      } else if (inspection.embeddedAttribution) {
        const codePrefix = inspection.embeddedAttribution.split(' ')[0];
        const metaCopy = current.watermarkedCopies.find((w) => w.watermarkCode === codePrefix);
        eventType = 'verification.mismatch';
        record = {
          id: makeId('ver'),
          fileName: params.fileName,
          computedSha256,
          outcome: 'Metadata Attribution Match',
          matchedDocumentId: metaCopy?.documentId,
          matchedDocumentTitle: metaCopy?.documentTitle,
          matchedWatermarkCode: metaCopy?.watermarkCode || codePrefix,
          matchedRecipientName: metaCopy?.recipientName,
          matchedRecipientEmail: metaCopy?.recipientEmail,
          embeddedAttribution: inspection.embeddedAttribution,
          details:
            'SHA-256 bytes differ from stored digests (file may have been re-saved), but embedded PDF attribution metadata matched an issued watermark.',
          verifiedAt: new Date().toISOString(),
        };
      } else {
        eventType = 'verification.mismatch';
        record = {
          id: makeId('ver'),
          fileName: params.fileName,
          computedSha256,
          outcome: 'Unregistered',
          details: 'No matching SHA-256 fingerprint or embedded watermark attribution found in the local registry.',
          verifiedAt: new Date().toISOString(),
        };
      }

      const { event, deliveries } = await dispatchEventAndWebhooks({
        eventType,
        sourceModule: 'Forensic Verifier',
        sha256Ref: computedSha256,
        watermarkCode: record.matchedWatermarkCode,
        payload: {
          file_name: params.fileName,
          computed_sha256: computedSha256,
          outcome: record.outcome,
          matched_recipient: record.matchedRecipientEmail || null,
        },
      });

      const log: ActivityLogEntry = {
        id: makeId('act'),
        actor: current.settings.displayName,
        module: 'Document Verification',
        action: `Verified ${params.fileName}`,
        resourceLabel: record.outcome,
        outcome: record.outcome === 'Unregistered' ? 'Warning' : 'Success',
        metadataSummary: record.matchedRecipientEmail
          ? `Attributed to ${record.matchedRecipientEmail}`
          : `SHA-256 ${computedSha256.slice(0, 16)}…`,
        createdAt: new Date().toISOString(),
      };

      commitState((prev) => ({
        ...prev,
        verificationRecords: [record, ...prev.verificationRecords],
        pipelineEvents: [event, ...prev.pipelineEvents],
        webhookDeliveries: [...deliveries, ...prev.webhookDeliveries],
        activityLogs: [log, ...prev.activityLogs],
      }));

      return record;
    },
    [commitState, dispatchEventAndWebhooks]
  );

  const verifyByHashOrCode = useCallback(
    async (query: string) => {
      const current = stateRef.current;
      if (!current) throw new Error('System state unavailable.');
      const trimmed = query.trim();
      const lower = trimmed.toLowerCase();

      const wmMatch = current.watermarkedCopies.find(
        (w) =>
          w.watermarkedSha256.toLowerCase() === lower ||
          w.watermarkCode.toLowerCase() === lower
      );
      const docMatch = current.documents.find((d) => d.sha256Hash.toLowerCase() === lower);

      let record: VerificationRecord;
      let eventType: RelayEventType = 'document.verified';

      if (wmMatch) {
        record = {
          id: makeId('ver'),
          fileName: `Lookup: ${trimmed.slice(0, 20)}`,
          computedSha256: wmMatch.watermarkedSha256,
          outcome: 'Watermarked Match',
          matchedDocumentId: wmMatch.documentId,
          matchedDocumentTitle: wmMatch.documentTitle,
          matchedWatermarkCode: wmMatch.watermarkCode,
          matchedRecipientName: wmMatch.recipientName,
          matchedRecipientEmail: wmMatch.recipientEmail,
          details: `Matched watermarked copy ${wmMatch.watermarkCode} issued to ${wmMatch.recipientName}.`,
          verifiedAt: new Date().toISOString(),
        };
      } else if (docMatch) {
        record = {
          id: makeId('ver'),
          fileName: `Lookup: ${trimmed.slice(0, 20)}`,
          computedSha256: docMatch.sha256Hash,
          outcome: 'Original Master Match',
          matchedDocumentId: docMatch.id,
          matchedDocumentTitle: docMatch.title,
          details: `Matched master document "${docMatch.title}".`,
          verifiedAt: new Date().toISOString(),
        };
      } else {
        eventType = 'verification.mismatch';
        record = {
          id: makeId('ver'),
          fileName: `Lookup: ${trimmed.slice(0, 24)}`,
          computedSha256: trimmed.length === 64 ? trimmed : 'N/A (Watermark Code Lookup)',
          outcome: 'Unregistered',
          details: 'No watermarked copy or master document matches the supplied hash or watermark ID.',
          verifiedAt: new Date().toISOString(),
        };
      }

      const { event, deliveries } = await dispatchEventAndWebhooks({
        eventType,
        sourceModule: 'Forensic Verifier',
        sha256Ref: record.computedSha256,
        watermarkCode: record.matchedWatermarkCode,
        payload: {
          lookup_query: trimmed,
          outcome: record.outcome,
        },
      });

      commitState((prev) => ({
        ...prev,
        verificationRecords: [record, ...prev.verificationRecords],
        pipelineEvents: [event, ...prev.pipelineEvents],
        webhookDeliveries: [...deliveries, ...prev.webhookDeliveries],
      }));

      return record;
    },
    [commitState, dispatchEventAndWebhooks]
  );

  const addRecipient = useCallback(
    (recipientInput: Omit<Recipient, 'id' | 'createdAt'>) => {
      const rec: Recipient = {
        ...recipientInput,
        id: makeId('rec'),
        createdAt: new Date().toISOString(),
      };
      const log: ActivityLogEntry = {
        id: makeId('act'),
        actor: stateRef.current?.settings.displayName || 'System User',
        module: 'Recipient Directory',
        action: 'Added Recipient',
        resourceLabel: `${rec.fullName} <${rec.email}>`,
        outcome: 'Success',
        metadataSummary: `${rec.organization} · ${rec.clearance}`,
        createdAt: new Date().toISOString(),
      };
      commitState((prev) => ({
        ...prev,
        recipients: [rec, ...prev.recipients],
        activityLogs: [log, ...prev.activityLogs],
      }));
      pushToast({
        title: 'Recipient Added',
        description: `${rec.fullName} (${rec.email})`,
        variant: 'success',
      });
      return rec;
    },
    [commitState, pushToast]
  );

  const toggleRecipientStatus = useCallback(
    (id: string) => {
      const target = stateRef.current?.recipients.find((r) => r.id === id);
      if (!target) return;
      const nextStatus = target.status === 'Active' ? 'Suspended' : 'Active';
      const log: ActivityLogEntry = {
        id: makeId('act'),
        actor: stateRef.current?.settings.displayName || 'System User',
        module: 'Recipient Directory',
        action: `Changed Status to ${nextStatus}`,
        resourceLabel: target.email,
        outcome: nextStatus === 'Suspended' ? 'Warning' : 'Success',
        metadataSummary: `Recipient ${target.fullName} marked ${nextStatus}`,
        createdAt: new Date().toISOString(),
      };
      commitState((prev) => ({
        ...prev,
        recipients: prev.recipients.map((r) => (r.id === id ? { ...r, status: nextStatus } : r)),
        activityLogs: [log, ...prev.activityLogs],
      }));
      pushToast({
        title: `Recipient ${nextStatus}`,
        description: target.fullName,
        variant: 'info',
      });
    },
    [commitState, pushToast]
  );

  const deleteRecipient = useCallback(
    (id: string) => {
      const target = stateRef.current?.recipients.find((r) => r.id === id);
      commitState((prev) => ({
        ...prev,
        recipients: prev.recipients.filter((r) => r.id !== id),
      }));
      pushToast({
        title: 'Recipient Removed',
        description: target?.email,
        variant: 'info',
      });
    },
    [commitState, pushToast]
  );

  const provisionInbox = useCallback(
    async (params: {
      label: string;
      customPrefix?: string;
      boundDocumentId?: string;
      boundRecipientId?: string;
      autoWatermark: boolean;
      ttlMinutes: number;
    }) => {
      const token = crypto.randomUUID().slice(0, 4);
      const cleanPrefix = (params.customPrefix || 'relay')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 18) || 'relay';
      const aliasAddress = `${cleanPrefix}-${token}@ephemeral-relay.demo`;
      const now = Date.now();
      const inbox: EphemeralInbox = {
        id: makeId('inb'),
        aliasAddress,
        label: params.label.trim() || 'Temporary Relay Dropzone',
        boundDocumentId: params.boundDocumentId || undefined,
        boundRecipientId: params.boundRecipientId || undefined,
        autoWatermark: params.autoWatermark,
        ttlMinutes: params.ttlMinutes,
        status: 'Active',
        messageCount: 0,
        expiresAt: new Date(now + params.ttlMinutes * 60 * 1000).toISOString(),
        createdAt: new Date(now).toISOString(),
      };

      const { event, deliveries } = await dispatchEventAndWebhooks({
        eventType: 'inbox.provisioned',
        sourceModule: 'Ephemeral Inboxes',
        payload: {
          inbox_id: inbox.id,
          alias_address: inbox.aliasAddress,
          ttl_minutes: inbox.ttlMinutes,
          mode: 'demo',
        },
      });

      const log: ActivityLogEntry = {
        id: makeId('act'),
        actor: stateRef.current?.settings.displayName || 'System User',
        module: 'Ephemeral Inboxes',
        action: 'Provisioned Demo Inbox',
        resourceLabel: inbox.aliasAddress,
        outcome: 'Success',
        metadataSummary: `TTL ${inbox.ttlMinutes} min · Auto-watermark ${inbox.autoWatermark ? 'On' : 'Off'}`,
        createdAt: new Date().toISOString(),
      };

      commitState((prev) => ({
        ...prev,
        inboxes: [inbox, ...prev.inboxes],
        pipelineEvents: [event, ...prev.pipelineEvents],
        webhookDeliveries: [...deliveries, ...prev.webhookDeliveries],
        activityLogs: [log, ...prev.activityLogs],
      }));

      pushToast({
        title: 'Demo Ephemeral Inbox Provisioned',
        description: inbox.aliasAddress,
        variant: 'success',
      });

      return inbox;
    },
    [commitState, dispatchEventAndWebhooks, pushToast]
  );

  const updateInboxStatus = useCallback(
    (id: string, status: 'Active' | 'Expired' | 'Revoked') => {
      commitState((prev) => ({
        ...prev,
        inboxes: prev.inboxes.map((i) => (i.id === id ? { ...i, status } : i)),
      }));
      pushToast({ title: `Inbox marked ${status}`, variant: 'info' });
    },
    [commitState, pushToast]
  );

  const extendInboxTtl = useCallback(
    (id: string, extraMinutes: number) => {
      commitState((prev) => ({
        ...prev,
        inboxes: prev.inboxes.map((i) =>
          i.id === id
            ? {
                ...i,
                status: 'Active',
                ttlMinutes: i.ttlMinutes + extraMinutes,
                expiresAt: new Date(
                  Math.max(Date.now(), new Date(i.expiresAt).getTime()) + extraMinutes * 60 * 1000
                ).toISOString(),
              }
            : i
        ),
      }));
      pushToast({ title: `Extended inbox TTL by ${extraMinutes} min`, variant: 'success' });
    },
    [commitState, pushToast]
  );

  const processDemoInboundEmail = useCallback(
    async (params: {
      inboxId: string;
      fromAddress: string;
      subject: string;
      body: string;
      attachment?: { fileName: string; bytes: Uint8Array };
      simulateFailure?: boolean;
    }) => {
      const current = stateRef.current;
      if (!current) throw new Error('System state unavailable.');
      const inbox = current.inboxes.find((i) => i.id === params.inboxId);
      if (!inbox) throw new Error('Target ephemeral inbox not found.');

      const isExpiredOrRevoked =
        inbox.status !== 'Active' || new Date(inbox.expiresAt).getTime() < Date.now();

      if (isExpiredOrRevoked || params.simulateFailure) {
        const failedMail: InboundEmailEvent = {
          id: makeId('mail'),
          inboxId: inbox.id,
          toAddress: inbox.aliasAddress,
          fromAddress: params.fromAddress,
          subject: params.subject,
          bodyPreview: params.body.slice(0, 180),
          attachmentName: params.attachment?.fileName,
          processingMode: 'demo',
          pipelineStatus: isExpiredOrRevoked ? 'Rejected' : 'Failed',
          stages: {
            envelopeCheck: isExpiredOrRevoked ? 'Failed' : 'Passed',
            mimeExtraction: params.simulateFailure ? 'Failed' : 'Skipped',
            watermarkDispatch: 'Skipped',
            webhookRelay: 'Skipped',
          },
          rawHeaders: {
            'Message-ID': `<${crypto.randomUUID().slice(0, 8)}-demo@relay.local>`,
            'X-Relay-Mode': 'DEMO-SIMULATED-MTA',
            'X-Rejection-Reason': isExpiredOrRevoked
              ? `Inbox status is ${inbox.status} or TTL elapsed`
              : 'Simulated MIME parser failure',
          },
          receivedAt: new Date().toISOString(),
        };

        commitState((prev) => ({
          ...prev,
          inboundEmails: [failedMail, ...prev.inboundEmails],
        }));

        pushToast({
          title: `Demo Email ${failedMail.pipelineStatus}`,
          description: isExpiredOrRevoked
            ? 'Target ephemeral inbox is expired or revoked.'
            : 'Simulated parser failure triggered.',
          variant: 'warning',
        });
        return failedMail;
      }

      let attachmentSha256: string | undefined;
      let generatedWatermarkCode: string | undefined;
      let newlyCreatedDoc: VaultDocument | undefined;
      let newlyCreatedCopy: WatermarkedCopy | undefined;

      if (params.attachment) {
        await inspectPdfBytes(params.attachment.bytes);
        attachmentSha256 = await computeSha256Hex(params.attachment.bytes);

        const existingDoc = current.documents.find((d) => d.sha256Hash === attachmentSha256);
        let sourceDoc = existingDoc;

        if (!sourceDoc) {
          const insp = await inspectPdfBytes(params.attachment.bytes);
          sourceDoc = {
            id: makeId('doc'),
            title: params.subject || params.attachment.fileName,
            fileName: params.attachment.fileName,
            classification: 'Confidential',
            sha256Hash: attachmentSha256,
            fileSizeBytes: params.attachment.bytes.byteLength,
            pageCount: insp.pageCount,
            ownerName: params.fromAddress,
            notes: `Ingested via Demo SMTP Relay (${inbox.aliasAddress})`,
            createdAt: new Date().toISOString(),
            hasBinaryInSession: true,
          };
          savePdfBinary(`doc:${sourceDoc.id}`, params.attachment.bytes);
          newlyCreatedDoc = sourceDoc;
        }

        if (inbox.autoWatermark) {
          const rec =
            current.recipients.find((r) => r.id === inbox.boundRecipientId) ||
            current.recipients[0];
          if (rec) {
            generatedWatermarkCode = `WM-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
            const wmResult = await applyVisiblePdfWatermark({
              sourceBytes: params.attachment.bytes,
              originalSha256: attachmentSha256,
              recipientName: rec.fullName,
              recipientEmail: rec.email,
              classification: sourceDoc.classification,
              watermarkCode: generatedWatermarkCode,
              config: current.settings.defaultWatermark,
            });
            savePdfBinary(`wm:${generatedWatermarkCode}`, wmResult.watermarkedBytes);
            newlyCreatedCopy = {
              id: makeId('wm'),
              watermarkCode: generatedWatermarkCode,
              documentId: sourceDoc.id,
              documentTitle: sourceDoc.title,
              recipientId: rec.id,
              recipientName: rec.fullName,
              recipientEmail: rec.email,
              originalSha256: attachmentSha256,
              watermarkedSha256: wmResult.watermarkedSha256,
              overlayText: wmResult.overlayText,
              colorPreset: current.settings.defaultWatermark.colorPreset,
              opacity: current.settings.defaultWatermark.opacity,
              rotationDeg: current.settings.defaultWatermark.rotationDeg,
              fontSize: current.settings.defaultWatermark.fontSize,
              includeFooterStamp: current.settings.defaultWatermark.includeFooterStamp,
              fileSizeBytes: wmResult.watermarkedBytes.byteLength,
              issuedAt: new Date().toISOString(),
            };
          }
        }
      }

      const mailEvent: InboundEmailEvent = {
        id: makeId('mail'),
        inboxId: inbox.id,
        toAddress: inbox.aliasAddress,
        fromAddress: params.fromAddress,
        subject: params.subject,
        bodyPreview: params.body.slice(0, 220),
        attachmentName: params.attachment?.fileName,
        attachmentSha256,
        generatedWatermarkCode,
        processingMode: 'demo',
        pipelineStatus: 'Processed',
        stages: {
          envelopeCheck: 'Passed',
          mimeExtraction: params.attachment ? 'Passed' : 'Skipped',
          watermarkDispatch: newlyCreatedCopy ? 'Passed' : 'Skipped',
          webhookRelay: 'Passed',
        },
        rawHeaders: {
          'Message-ID': `<${crypto.randomUUID().slice(0, 10)}-demo@ephemeral-relay.demo>`,
          'X-Relay-Mode': 'DEMO-SIMULATED-MTA',
          'Authentication-Results': 'demo-relay; spf=pass; dkim=pass',
          'Return-Path': `<${params.fromAddress}>`,
        },
        receivedAt: new Date().toISOString(),
      };

      const { event, deliveries } = await dispatchEventAndWebhooks({
        eventType: 'smtp.inbound.processed',
        sourceModule: 'Demo SMTP Relay',
        sha256Ref: attachmentSha256,
        watermarkCode: generatedWatermarkCode,
        payload: {
          inbox: inbox.aliasAddress,
          from: params.fromAddress,
          subject: params.subject,
          attachment_sha256: attachmentSha256 || null,
          watermark_code: generatedWatermarkCode || null,
          mode: 'demo',
        },
      });

      const log: ActivityLogEntry = {
        id: makeId('act'),
        actor: 'Demo SMTP Relay',
        module: 'Email Processing (Demo)',
        action: 'Processed Simulated Inbound Email',
        resourceLabel: inbox.aliasAddress,
        outcome: 'Success',
        metadataSummary: generatedWatermarkCode
          ? `Extracted PDF & issued ${generatedWatermarkCode}`
          : `Processed message from ${params.fromAddress}`,
        createdAt: new Date().toISOString(),
      };

      commitState((prev) => ({
        ...prev,
        documents: newlyCreatedDoc ? [newlyCreatedDoc, ...prev.documents] : prev.documents,
        watermarkedCopies: newlyCreatedCopy
          ? [newlyCreatedCopy, ...prev.watermarkedCopies]
          : prev.watermarkedCopies,
        inboxes: prev.inboxes.map((i) =>
          i.id === inbox.id ? { ...i, messageCount: i.messageCount + 1 } : i
        ),
        inboundEmails: [mailEvent, ...prev.inboundEmails],
        pipelineEvents: [event, ...prev.pipelineEvents],
        webhookDeliveries: [...deliveries, ...prev.webhookDeliveries],
        activityLogs: [log, ...prev.activityLogs],
      }));

      pushToast({
        title: 'Demo Inbound Email Processed',
        description: generatedWatermarkCode
          ? `Auto-watermarked attachment as ${generatedWatermarkCode}.`
          : `Dispatched ${deliveries.length} webhook delivery.`,
        variant: 'success',
      });

      return mailEvent;
    },
    [commitState, dispatchEventAndWebhooks, pushToast]
  );

  const addWebhook = useCallback(
    (input: Omit<WebhookEndpoint, 'id' | 'createdAt'>) => {
      const hook: WebhookEndpoint = {
        ...input,
        id: makeId('wh'),
        createdAt: new Date().toISOString(),
      };
      const log: ActivityLogEntry = {
        id: makeId('act'),
        actor: stateRef.current?.settings.displayName || 'System User',
        module: 'Webhooks',
        action: 'Registered Webhook Endpoint',
        resourceLabel: hook.name,
        outcome: 'Success',
        metadataSummary: `${hook.subscribedEvents.length} subscribed events`,
        createdAt: new Date().toISOString(),
      };
      commitState((prev) => ({
        ...prev,
        webhooks: [hook, ...prev.webhooks],
        activityLogs: [log, ...prev.activityLogs],
      }));
      pushToast({ title: 'Webhook Endpoint Saved', description: hook.name, variant: 'success' });
      return hook;
    },
    [commitState, pushToast]
  );

  const toggleWebhook = useCallback(
    (id: string) => {
      commitState((prev) => ({
        ...prev,
        webhooks: prev.webhooks.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)),
      }));
    },
    [commitState]
  );

  const deleteWebhook = useCallback(
    (id: string) => {
      commitState((prev) => ({
        ...prev,
        webhooks: prev.webhooks.filter((w) => w.id !== id),
      }));
      pushToast({ title: 'Webhook Endpoint Deleted', variant: 'info' });
    },
    [commitState, pushToast]
  );

  const triggerWebhookDelivery = useCallback(
    async (params: {
      webhookId: string;
      eventType: RelayEventType;
      payload: Record<string, unknown>;
      mode: 'simulated' | 'live_fetch';
      simulateError?: boolean;
    }) => {
      const hook = stateRef.current?.webhooks.find((w) => w.id === params.webhookId);
      if (!hook) throw new Error('Webhook endpoint not found.');

      const correlationId = makeCorrelationId();
      const bodyObj = {
        event: params.eventType,
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
        ...params.payload,
      };
      const bodyStr = JSON.stringify(bodyObj);
      const signature = await computeHmacSha256Hex(hook.signingSecret, bodyStr);
      const signatureHeader = `sha256=${signature}`;

      let httpStatus: number | null = 200;
      let latencyMs = 84;
      let responseBody = '{"accepted":true,"mode":"simulated_relay"}';
      let status: 'Delivered' | 'Failed' = 'Delivered';

      if (params.mode === 'live_fetch') {
        const start = performance.now();
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), hook.timeoutMs);
          const resp = await fetch(hook.targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Relay-Event': params.eventType,
              'X-Relay-Signature-256': signatureHeader,
              'X-Relay-Correlation-Id': correlationId,
            },
            body: bodyStr,
            signal: controller.signal,
          });
          clearTimeout(timer);
          latencyMs = Math.round(performance.now() - start);
          httpStatus = resp.status;
          const text = await resp.text();
          responseBody = text.slice(0, 400) || `HTTP ${resp.status}`;
          status = resp.ok ? 'Delivered' : 'Failed';
        } catch (err) {
          latencyMs = Math.round(performance.now() - start);
          httpStatus = null;
          status = 'Failed';
          responseBody =
            err instanceof Error
              ? `Live fetch blocked or failed (CORS/network): ${err.message}`
              : 'Network request failed.';
        }
      } else if (params.simulateError) {
        httpStatus = 502;
        latencyMs = 412;
        status = 'Failed';
        responseBody = '{"error":"Simulated upstream 502 Bad Gateway"}';
      }

      const logEntry: WebhookDeliveryLog = {
        id: makeId('del'),
        webhookId: hook.id,
        webhookName: hook.name,
        targetUrl: hook.targetUrl,
        eventType: params.eventType,
        correlationId,
        deliveryMode: params.mode,
        httpStatus,
        latencyMs,
        signatureHeader,
        payload: bodyObj,
        responseBody,
        status,
        deliveredAt: new Date().toISOString(),
      };

      const act: ActivityLogEntry = {
        id: makeId('act'),
        actor: stateRef.current?.settings.displayName || 'Webhook Dispatcher',
        module: 'Webhook Delivery',
        action: `${params.mode === 'live_fetch' ? 'Live' : 'Simulated'} Test Delivery`,
        resourceLabel: hook.name,
        outcome: status === 'Delivered' ? 'Success' : 'Error',
        metadataSummary: `${params.eventType} · ${httpStatus ?? 'Network/CORS Error'} (${latencyMs}ms)`,
        createdAt: new Date().toISOString(),
      };

      commitState((prev) => ({
        ...prev,
        webhookDeliveries: [logEntry, ...prev.webhookDeliveries],
        activityLogs: [act, ...prev.activityLogs],
      }));

      pushToast({
        title: status === 'Delivered' ? 'Webhook Delivered' : 'Webhook Delivery Failed',
        description: `${hook.name} · ${httpStatus ?? 'Network Error'} (${latencyMs}ms)`,
        variant: status === 'Delivered' ? 'success' : 'error',
      });

      return logEntry;
    },
    [commitState, pushToast]
  );

  const retryWebhookDelivery = useCallback(
    async (deliveryId: string) => {
      const existing = stateRef.current?.webhookDeliveries.find((d) => d.id === deliveryId);
      if (!existing) return null;
      return triggerWebhookDelivery({
        webhookId: existing.webhookId,
        eventType: existing.eventType,
        payload: { ...existing.payload, retry_of: existing.id },
        mode: existing.deliveryMode,
        simulateError: false,
      });
    },
    [triggerWebhookDelivery]
  );

  const replayPipelineEvent = useCallback(
    async (eventId: string) => {
      const existing = stateRef.current?.pipelineEvents.find((e) => e.id === eventId);
      if (!existing) return;
      const { event, deliveries } = await dispatchEventAndWebhooks({
        eventType: existing.eventType,
        sourceModule: 'Central Event Replay',
        sha256Ref: existing.sha256Ref,
        watermarkCode: existing.watermarkCode,
        payload: { ...existing.payload, replayed_event_id: existing.id },
      });

      commitState((prev) => ({
        ...prev,
        pipelineEvents: [event, ...prev.pipelineEvents],
        webhookDeliveries: [...deliveries, ...prev.webhookDeliveries],
      }));

      pushToast({
        title: 'Event Replayed',
        description: `${existing.eventType} dispatched to ${deliveries.length} endpoint(s).`,
        variant: 'success',
      });
    },
    [commitState, dispatchEventAndWebhooks, pushToast]
  );

  const updateSettings = useCallback(
    (partial: Partial<UserProfileSettings>) => {
      commitState((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...partial },
      }));
      pushToast({ title: 'Settings Updated', variant: 'success' });
    },
    [commitState, pushToast]
  );

  const updatePersonalization = useCallback(
    (partial: Partial<PersonalizationConfig>) => {
      commitState((prev) => {
        const nextPers = { ...prev.settings.personalization, ...partial };
        const resolvedTheme: 'dark' | 'light' =
          nextPers.themeMode === 'system'
            ? window.matchMedia?.('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light'
            : nextPers.themeMode;
        return {
          ...prev,
          settings: {
            ...prev.settings,
            theme: resolvedTheme,
            compactTables: nextPers.density === 'compact',
            personalization: nextPers,
          },
        };
      });
    },
    [commitState]
  );

  const toggleTheme = useCallback(() => {
    const currentTheme = stateRef.current?.settings.theme || 'dark';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    commitState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        theme: nextTheme,
        personalization: {
          ...prev.settings.personalization,
          themeMode: nextTheme,
        },
      },
    }));
  }, [commitState]);

  const toggleDocumentFavorite = useCallback(
    (docId: string) => {
      commitState((prev) => ({
        ...prev,
        documents: prev.documents.map((d) =>
          d.id === docId ? { ...d, isFavorite: !d.isFavorite } : d
        ),
      }));
    },
    [commitState]
  );

  const markDocumentViewed = useCallback(
    (docId: string) => {
      const nowIso = new Date().toISOString();
      commitState((prev) => ({
        ...prev,
        documents: prev.documents.map((d) =>
          d.id === docId ? { ...d, lastViewedAt: nowIso } : d
        ),
      }));
    },
    [commitState]
  );

  const recordReportExport = useCallback(() => {
    commitState((prev) => ({
      ...prev,
      exportedReportsCount: (prev.exportedReportsCount || 0) + 1,
    }));
  }, [commitState]);

  const addTask = useCallback(
    (taskInput: Omit<PlannerTask, 'id' | 'createdAt' | 'completed'>) => {
      const task: PlannerTask = {
        ...taskInput,
        id: makeId('task'),
        completed: false,
        createdAt: new Date().toISOString(),
      };
      commitState((prev) => ({
        ...prev,
        productivity: {
          ...prev.productivity,
          tasks: [task, ...prev.productivity.tasks],
        },
      }));
      pushToast({ title: 'Task Added', description: task.title, variant: 'success' });
    },
    [commitState, pushToast]
  );

  const toggleTask = useCallback(
    (taskId: string) => {
      commitState((prev) => ({
        ...prev,
        productivity: {
          ...prev.productivity,
          tasks: prev.productivity.tasks.map((t) =>
            t.id === taskId ? { ...t, completed: !t.completed } : t
          ),
        },
      }));
    },
    [commitState]
  );

  const deleteTask = useCallback(
    (taskId: string) => {
      commitState((prev) => ({
        ...prev,
        productivity: {
          ...prev.productivity,
          tasks: prev.productivity.tasks.filter((t) => t.id !== taskId),
        },
      }));
    },
    [commitState]
  );

  const updateNotes = useCallback(
    (notes: string) => {
      commitState((prev) => ({
        ...prev,
        productivity: { ...prev.productivity, notes },
      }));
    },
    [commitState]
  );

  const toggleFocusMode = useCallback(() => {
    commitState((prev) => ({
      ...prev,
      productivity: { ...prev.productivity, focusMode: !prev.productivity.focusMode },
    }));
  }, [commitState]);

  const incrementPomodoro = useCallback(() => {
    commitState((prev) => ({
      ...prev,
      productivity: {
        ...prev.productivity,
        pomodoroCompletedCount: prev.productivity.pomodoroCompletedCount + 1,
      },
    }));
    pushToast({ title: 'Focus Session Complete', description: 'Logged Pomodoro cycle.', variant: 'success' });
  }, [commitState, pushToast]);

  const markNotificationRead = useCallback(
    (id: string) => {
      commitState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      }));
    },
    [commitState]
  );

  const markAllNotificationsRead = useCallback(() => {
    commitState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
    }));
  }, [commitState]);

  const clearNotifications = useCallback(() => {
    commitState((prev) => ({ ...prev, notifications: [] }));
  }, [commitState]);

  const addNotification = useCallback(
    (notif: Omit<SystemNotification, 'id' | 'read' | 'createdAt'>) => {
      const next: SystemNotification = {
        ...notif,
        id: makeId('notif'),
        read: false,
        createdAt: new Date().toISOString(),
      };
      commitState((prev) => ({
        ...prev,
        notifications: [next, ...prev.notifications].slice(0, 30),
      }));
    },
    [commitState]
  );

  const resetDemoData = useCallback(async () => {
    setIsRefreshing(true);
    const theme = stateRef.current?.settings.theme || 'dark';
    const fresh = await systemRepository.resetToDemoSeed(theme, null);
    setState(fresh);
    setIsRefreshing(false);
    pushToast({
      title: 'Demo Dataset Restored',
      description: 'Sample PDFs, SHA-256 digests, and relay logs regenerated.',
      variant: 'success',
    });
  }, [pushToast]);

  const clearAllData = useCallback(async () => {
    setIsRefreshing(true);
    const theme = stateRef.current?.settings.theme || 'dark';
    const empty = await systemRepository.clearAllData(theme, null);
    setState(empty);
    setIsRefreshing(false);
    pushToast({
      title: 'Workspace Cleared',
      description: 'All local documents, logs, and relay records removed.',
      variant: 'info',
    });
  }, [pushToast]);

  const openPdfPreviewWithTracking = useCallback(
    (target: { title: string; bytes: Uint8Array; sha256: string; fileName: string }) => {
      const matched = stateRef.current?.documents.find((d) => d.sha256Hash === target.sha256);
      if (matched) {
        markDocumentViewed(matched.id);
      }
      setPreviewTarget(target);
    },
    [markDocumentViewed]
  );

  return (
    <SystemContext.Provider
      value={{
        state,
        isLoading,
        isRefreshing,
        loadError,
        activeModule,
        setActiveModule,
        toasts,
        dismissToast,
        pushToast,
        refreshView,
        registerDocument,
        deleteDocument,
        issueWatermark,
        verifyDocumentFile,
        verifyByHashOrCode,
        addRecipient,
        toggleRecipientStatus,
        deleteRecipient,
        provisionInbox,
        updateInboxStatus,
        extendInboxTtl,
        processDemoInboundEmail,
        addWebhook,
        toggleWebhook,
        deleteWebhook,
        triggerWebhookDelivery,
        retryWebhookDelivery,
        replayPipelineEvent,
        updateSettings,
        updatePersonalization,
        toggleTheme,
        resetDemoData,
        clearAllData,
        toggleDocumentFavorite,
        markDocumentViewed,
        recordReportExport,
        addTask,
        toggleTask,
        deleteTask,
        updateNotes,
        toggleFocusMode,
        incrementPomodoro,
        markNotificationRead,
        markAllNotificationsRead,
        clearNotifications,
        addNotification,
        commandPaletteOpen,
        setCommandPaletteOpen,
        notificationsOpen,
        setNotificationsOpen,
        tourOpen,
        setTourOpen,
        previewTarget,
        openPdfPreview: openPdfPreviewWithTracking,
        closePdfPreview: () => setPreviewTarget(null),
      }}
    >
      {children}
    </SystemContext.Provider>
  );
};

export function useSystem(): SystemContextValue {
  const ctx = useContext(SystemContext);
  if (!ctx) throw new Error('useSystem must be used inside SystemProvider');
  return ctx;
}
