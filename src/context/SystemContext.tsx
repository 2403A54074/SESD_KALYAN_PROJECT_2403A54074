import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createEmptyState } from '../data/seedData';
import { systemRepository } from '../services/repository';
import type {
  ActivityLogEntry,
  DocumentClassification,
  ModuleId,
  Recipient,
  SystemState,
  ThemeMode,
  UserProfileSettings,
  VaultDocument,
  VerificationRecord,
  WatermarkConfig,
  WatermarkedCopy,
} from '../types/system';
import {
  applyVisiblePdfWatermark,
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
  supabaseOwnerId: string | null;
  state: SystemState;
  isLoading: boolean;
  isRefreshing: boolean;
  activeModule: ModuleId;
  setActiveModule: (module: ModuleId) => void;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  refreshView: () => Promise<void>;
  // Document actions
  registerDocument: (params: {
    title: string;
    fileName: string;
    classification: DocumentClassification;
    ownerName: string;
    notes: string;
    bytes: Uint8Array;
  }) => Promise<VaultDocument>;
  deleteDocument: (docId: string) => Promise<void>;
  // Recipient actions
  addRecipient: (recipient: Omit<Recipient, 'id' | 'recipientCode' | 'createdAt'>) => Promise<Recipient>;
  updateRecipient: (recipient: Recipient) => Promise<void>;
  toggleRecipientStatus: (id: string) => Promise<void>;
  deleteRecipient: (id: string) => Promise<void>;
  // Watermarking actions
  issueWatermarksBatch: (params: {
    documentId: string;
    recipientIds: string[];
    config: WatermarkConfig;
  }) => Promise<WatermarkedCopy[]>;
  // Verification actions
  verifyDocumentFile: (params: {
    fileName: string;
    bytes: Uint8Array;
  }) => Promise<VerificationRecord>;
  verifyByHashOrCode: (query: string) => Promise<VerificationRecord>;
  // Profile & settings actions
  updateSettings: (partial: Partial<UserProfileSettings>) => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  clearAllData: () => Promise<void>;
  // Global UI overlays
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  previewTarget: { title: string; bytes: Uint8Array; sha256: string; fileName: string } | null;
  openPdfPreview: (target: { title: string; bytes: Uint8Array; sha256: string; fileName: string }) => void;
  closePdfPreview: () => void;
}

const SystemContext = createContext<SystemContextValue | null>(null);

const MODULE_ROUTES: Record<ModuleId, string> = {
  dashboard: '/',
  documents: '/documents',
  recipients: '/recipients',
  watermarking: '/watermarking',
  verification: '/verification',
  reports: '/reports',
  help: '/help',
  settings: '/settings',
  'music-studio': '/music-studio',
  game: '/game',
};

function pathnameToModule(pathname: string): ModuleId {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/upload' || clean === '/fingerprints') return 'documents';
  if (clean === '/manual' || clean === '/guide') return 'help';
  const matched = (Object.entries(MODULE_ROUTES) as [ModuleId, string][]).find(
    ([, route]) => route === clean
  );
  return matched ? matched[0] : 'dashboard';
}

function makeUuid(): string {
  return crypto.randomUUID();
}

export const SystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [supabaseOwnerId, setSupabaseOwnerId] = useState<string | null>(null);
  const [state, setState] = useState<SystemState>(() => createEmptyState('dark'));
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeModule, setActiveModuleState] = useState<ModuleId>(() =>
    typeof window !== 'undefined' ? pathnameToModule(window.location.pathname) : 'dashboard'
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<{
    title: string;
    bytes: Uint8Array;
    sha256: string;
    fileName: string;
  } | null>(null);

  const stateRef = useRef<SystemState>(state);
  stateRef.current = state;
  const ownerIdRef = useRef<string | null>(supabaseOwnerId);
  ownerIdRef.current = supabaseOwnerId;

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

  const pushToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${crypto.randomUUID().slice(0, 8)}`;
    setToasts((prev) => [{ ...toast, id }, ...prev].slice(0, 4));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  // Hydrate workspace immediately from local store + silently sync Supabase anonymous RLS session
  useEffect(() => {
    let active = true;
    (async () => {
      const localLoaded = await systemRepository.loadLocalState();
      if (!active) return;
      setState(localLoaded);
      setIsLoading(false);

      const ownerId = await systemRepository.ensureAnonymousSupabaseSession();
      if (!active || !ownerId) return;
      setSupabaseOwnerId(ownerId);
      const hydrated = await systemRepository.hydrateFromSupabase(ownerId, localLoaded);
      if (active) setState(hydrated);
    })();

    return () => {
      active = false;
    };
  }, []);

  // Apply theme mode side effects cleanly
  useEffect(() => {
    const mode = state.settings.themeMode || 'dark';
    const resolveDark = () => {
      if (mode === 'system') {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      return mode === 'dark';
    };

    const applyTheme = () => {
      document.documentElement.classList.toggle('dark', resolveDark());
    };

    applyTheme();
    const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const onSystemChange = () => {
      if (stateRef.current.settings.themeMode === 'system') {
        applyTheme();
      }
    };
    mq?.addEventListener?.('change', onSystemChange);
    return () => mq?.removeEventListener?.('change', onSystemChange);
  }, [state.settings.themeMode]);

  const commitState = useCallback((updater: (prev: SystemState) => SystemState) => {
    setState((prev) => {
      const next = updater(prev);
      systemRepository.saveLocalState(next);
      return next;
    });
  }, []);

  const refreshView = useCallback(async () => {
    setIsRefreshing(true);
    const localLoaded = await systemRepository.loadLocalState();
    if (ownerIdRef.current) {
      const hydrated = await systemRepository.hydrateFromSupabase(ownerIdRef.current, localLoaded);
      setState(hydrated);
    } else {
      setState(localLoaded);
    }
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
        id: makeUuid(),
        title: params.title.trim(),
        fileName: params.fileName,
        classification: params.classification,
        sha256Hash,
        fileSizeBytes: params.bytes.byteLength,
        pageCount: inspection.pageCount,
        ownerName: params.ownerName.trim() || 'Document Custodian',
        notes: params.notes.trim(),
        createdAt: new Date().toISOString(),
      };

      await systemRepository.insertDocument(doc, ownerIdRef.current);
      savePdfBinary(`doc:${doc.id}`, params.bytes);

      const log: ActivityLogEntry = {
        id: makeUuid(),
        actor: doc.ownerName,
        module: 'Documents',
        action: 'Uploaded Original PDF',
        resourceLabel: `${doc.title} (DOC-${doc.id.slice(0, 8).toUpperCase()})`,
        outcome: 'Success',
        metadataSummary: `${doc.fileName} (${doc.pageCount}p) · SHA-256 ${sha256Hash.slice(0, 16)}…`,
        createdAt: doc.createdAt,
      };
      void systemRepository.insertActivityLog(log, ownerIdRef.current);

      commitState((prev) => ({
        ...prev,
        documents: [doc, ...prev.documents],
        activityLogs: [log, ...prev.activityLogs],
      }));

      pushToast({
        title: 'PDF Uploaded & Fingerprinted',
        description: `${doc.title} (${doc.pageCount} pages) registered.`,
        variant: 'success',
      });

      return doc;
    },
    [commitState, pushToast]
  );

  const deleteDocument = useCallback(
    async (docId: string) => {
      const target = stateRef.current.documents.find((d) => d.id === docId);
      await systemRepository.deleteDocument(docId, ownerIdRef.current);
      deletePdfBinary(`doc:${docId}`);

      const log: ActivityLogEntry = {
        id: makeUuid(),
        actor: stateRef.current.settings.displayName,
        module: 'Documents',
        action: 'Deleted PDF Document',
        resourceLabel: target?.title || docId,
        outcome: 'Warning',
        metadataSummary: target?.fileName || 'Removed original document',
        createdAt: new Date().toISOString(),
      };
      void systemRepository.insertActivityLog(log, ownerIdRef.current);

      commitState((prev) => ({
        ...prev,
        documents: prev.documents.filter((d) => d.id !== docId),
        watermarkedCopies: prev.watermarkedCopies.filter((w) => w.documentId !== docId),
        activityLogs: [log, ...prev.activityLogs],
      }));
      pushToast({
        title: 'Document Deleted',
        description: target?.title,
        variant: 'info',
      });
    },
    [commitState, pushToast]
  );

  const addRecipient = useCallback(
    async (recipientInput: Omit<Recipient, 'id' | 'recipientCode' | 'createdAt'>) => {
      const now = new Date().toISOString();
      const id = makeUuid();
      const recipientCode = `REC-${id.slice(0, 8).toUpperCase()}`;
      const rec: Recipient = {
        ...recipientInput,
        id,
        recipientCode,
        createdAt: now,
        updatedAt: now,
      };
      await systemRepository.insertRecipient(rec, ownerIdRef.current);

      const log: ActivityLogEntry = {
        id: makeUuid(),
        actor: stateRef.current.settings.displayName,
        module: 'Recipients',
        action: 'Added Recipient',
        resourceLabel: `${rec.fullName} (${rec.recipientCode})`,
        outcome: 'Success',
        metadataSummary: `${rec.email}${rec.organization ? ` · ${rec.organization}` : ''}${rec.role ? ` · ${rec.role}` : ''}`,
        createdAt: now,
      };
      void systemRepository.insertActivityLog(log, ownerIdRef.current);

      commitState((prev) => ({
        ...prev,
        recipients: [rec, ...prev.recipients],
        activityLogs: [log, ...prev.activityLogs],
      }));
      pushToast({
        title: 'Recipient Added',
        description: `${rec.fullName} (${rec.recipientCode})`,
        variant: 'success',
      });
      return rec;
    },
    [commitState, pushToast]
  );

  const updateRecipient = useCallback(
    async (updated: Recipient) => {
      const nextRec: Recipient = {
        ...updated,
        updatedAt: new Date().toISOString(),
      };
      await systemRepository.updateRecipient(nextRec, ownerIdRef.current);

      const log: ActivityLogEntry = {
        id: makeUuid(),
        actor: stateRef.current.settings.displayName,
        module: 'Recipients',
        action: 'Updated Recipient',
        resourceLabel: `${nextRec.fullName} (${nextRec.recipientCode})`,
        outcome: 'Success',
        metadataSummary: `${nextRec.email}${nextRec.organization ? ` · ${nextRec.organization}` : ''}`,
        createdAt: nextRec.updatedAt || new Date().toISOString(),
      };
      void systemRepository.insertActivityLog(log, ownerIdRef.current);

      commitState((prev) => ({
        ...prev,
        recipients: prev.recipients.map((r) => (r.id === nextRec.id ? nextRec : r)),
        activityLogs: [log, ...prev.activityLogs],
      }));
      pushToast({
        title: 'Recipient Updated',
        description: nextRec.fullName,
        variant: 'success',
      });
    },
    [commitState, pushToast]
  );

  const toggleRecipientStatus = useCallback(
    async (id: string) => {
      const target = stateRef.current.recipients.find((r) => r.id === id);
      if (!target) return;
      const nextStatus: 'Active' | 'Suspended' = target.status === 'Active' ? 'Suspended' : 'Active';
      const nextRec: Recipient = {
        ...target,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };
      await systemRepository.updateRecipient(nextRec, ownerIdRef.current);

      const log: ActivityLogEntry = {
        id: makeUuid(),
        actor: stateRef.current.settings.displayName,
        module: 'Recipients',
        action: nextStatus === 'Active' ? 'Activated Recipient' : 'Suspended Recipient',
        resourceLabel: `${target.fullName} (${target.recipientCode})`,
        outcome: nextStatus === 'Suspended' ? 'Warning' : 'Success',
        metadataSummary: `${target.email} set to ${nextStatus}`,
        createdAt: nextRec.updatedAt || new Date().toISOString(),
      };
      void systemRepository.insertActivityLog(log, ownerIdRef.current);

      commitState((prev) => ({
        ...prev,
        recipients: prev.recipients.map((r) => (r.id === id ? nextRec : r)),
        activityLogs: [log, ...prev.activityLogs],
      }));
      pushToast({
        title: `Recipient ${nextStatus === 'Active' ? 'Activated' : 'Suspended'}`,
        description: target.fullName,
        variant: 'info',
      });
    },
    [commitState, pushToast]
  );

  const deleteRecipient = useCallback(
    async (id: string) => {
      const target = stateRef.current.recipients.find((r) => r.id === id);
      await systemRepository.deleteRecipient(id, ownerIdRef.current);

      const log: ActivityLogEntry = {
        id: makeUuid(),
        actor: stateRef.current.settings.displayName,
        module: 'Recipients',
        action: 'Deleted Recipient',
        resourceLabel: target ? `${target.fullName} (${target.recipientCode})` : id,
        outcome: 'Warning',
        metadataSummary: target?.email || 'Removed recipient record',
        createdAt: new Date().toISOString(),
      };
      void systemRepository.insertActivityLog(log, ownerIdRef.current);

      commitState((prev) => ({
        ...prev,
        recipients: prev.recipients.filter((r) => r.id !== id),
        activityLogs: [log, ...prev.activityLogs],
      }));
      pushToast({
        title: 'Recipient Deleted',
        description: target?.fullName || target?.email,
        variant: 'info',
      });
    },
    [commitState, pushToast]
  );

  const issueWatermarksBatch = useCallback(
    async (params: {
      documentId: string;
      recipientIds: string[];
      config: WatermarkConfig;
    }): Promise<WatermarkedCopy[]> => {
      const current = stateRef.current;
      const doc = current.documents.find((d) => d.id === params.documentId);
      if (!doc) throw new Error('Selected original PDF not found.');

      const sourceBytes = getPdfBinary(`doc:${doc.id}`);
      if (!sourceBytes) {
        throw new Error(
          'Original PDF file bytes are not cached in this browser. Re-upload the PDF in Documents to generate new watermarked copies.'
        );
      }

      const uniqueIds = Array.from(new Set(params.recipientIds));
      const targets = current.recipients.filter(
        (r) => uniqueIds.includes(r.id) && r.status === 'Active'
      );
      if (targets.length === 0) {
        throw new Error('Select at least one Active recipient.');
      }

      const issuedCopies: WatermarkedCopy[] = [];
      const newLogs: ActivityLogEntry[] = [];
      const issueDate = new Date().toISOString().slice(0, 10);

      for (const rec of targets) {
        const watermarkCode = `WM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        const result = await applyVisiblePdfWatermark({
          sourceBytes,
          documentId: doc.id,
          originalSha256: doc.sha256Hash,
          recipientCode: rec.recipientCode,
          recipientName: rec.fullName,
          recipientEmail: rec.email,
          classification: doc.classification,
          watermarkCode,
          issueDate,
          config: params.config,
        });

        const copy: WatermarkedCopy = {
          id: makeUuid(),
          watermarkCode,
          documentId: doc.id,
          documentTitle: doc.title,
          recipientId: rec.id,
          recipientCode: rec.recipientCode,
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
          includeCornerBadge: params.config.includeCornerBadge,
          fileSizeBytes: result.watermarkedBytes.byteLength,
          issueDate,
          issuedAt: new Date().toISOString(),
        };

        await systemRepository.insertWatermarkedCopy(copy, ownerIdRef.current);
        savePdfBinary(`wm:${watermarkCode}`, result.watermarkedBytes);

        const log: ActivityLogEntry = {
          id: makeUuid(),
          actor: current.settings.displayName,
          module: 'PDF Watermarking',
          action: 'Generated Watermarked PDF',
          resourceLabel: `${watermarkCode} → ${rec.fullName} (${rec.recipientCode})`,
          outcome: 'Success',
          metadataSummary: `${doc.title} · SHA-256 ${copy.watermarkedSha256.slice(0, 16)}…`,
          createdAt: copy.issuedAt,
        };
        void systemRepository.insertActivityLog(log, ownerIdRef.current);

        issuedCopies.push(copy);
        newLogs.push(log);
      }

      commitState((prev) => ({
        ...prev,
        watermarkedCopies: [...issuedCopies.slice().reverse(), ...prev.watermarkedCopies],
        activityLogs: [...newLogs.slice().reverse(), ...prev.activityLogs],
      }));

      pushToast({
        title:
          issuedCopies.length === 1
            ? `Watermarked PDF ${issuedCopies[0].watermarkCode} Ready`
            : `${issuedCopies.length} Personalized PDFs Generated`,
        description:
          issuedCopies.length === 1
            ? `Issued to ${issuedCopies[0].recipientName}. Original PDF preserved unchanged.`
            : `Original PDF preserved unchanged.`,
        variant: 'success',
      });

      return issuedCopies;
    },
    [commitState, pushToast]
  );

  const verifyDocumentFile = useCallback(
    async (params: { fileName: string; bytes: Uint8Array }): Promise<VerificationRecord> => {
      const current = stateRef.current;
      const inspection = await inspectPdfBytes(params.bytes);
      const computedSha256 = await computeSha256Hex(params.bytes);

      const wmMatch = current.watermarkedCopies.find(
        (w) => w.watermarkedSha256.toLowerCase() === computedSha256.toLowerCase()
      );
      const docMatch = current.documents.find(
        (d) => d.sha256Hash.toLowerCase() === computedSha256.toLowerCase()
      );

      let record: VerificationRecord;

      if (wmMatch) {
        const matchedRecipient = current.recipients.find((r) => r.id === wmMatch.recipientId);
        record = {
          id: makeUuid(),
          fileName: params.fileName,
          computedSha256,
          outcome: 'Watermarked Copy Match',
          matchedDocumentId: wmMatch.documentId,
          matchedDocumentTitle: wmMatch.documentTitle,
          matchedWatermarkId: wmMatch.id,
          matchedWatermarkCode: wmMatch.watermarkCode,
          matchedRecipientId: wmMatch.recipientId,
          matchedRecipientCode: wmMatch.recipientCode || matchedRecipient?.recipientCode,
          matchedRecipientName: wmMatch.recipientName || matchedRecipient?.fullName,
          matchedRecipientEmail: wmMatch.recipientEmail || matchedRecipient?.email,
          matchedRecipientOrganization: matchedRecipient?.organization,
          matchedRecipientRole: matchedRecipient?.role,
          matchedIssueDate: wmMatch.issueDate,
          details: `Exact SHA-256 match with registered watermarked copy ${wmMatch.watermarkCode} issued to ${wmMatch.recipientName} (${wmMatch.recipientCode}) on ${wmMatch.issueDate}.`,
          verifiedAt: new Date().toISOString(),
        };
      } else if (docMatch) {
        record = {
          id: makeUuid(),
          fileName: params.fileName,
          computedSha256,
          outcome: 'Original Master Match',
          matchedDocumentId: docMatch.id,
          matchedDocumentTitle: docMatch.title,
          details: `Exact SHA-256 match with registered original document "${docMatch.title}" (DOC-${docMatch.id.slice(0, 8).toUpperCase()}). No recipient watermark applied.`,
          verifiedAt: new Date().toISOString(),
        };
      } else {
        const metadataHint = inspection.embeddedWatermarkCode
          ? ` Embedded tracking metadata "${inspection.embeddedWatermarkCode}" was found, but the file's SHA-256 digest does not match any unmodified registered copy — no recipient attribution can be confirmed reliably.`
          : ' No exact SHA-256 match found in registered original documents or issued watermarked copies.';
        record = {
          id: makeUuid(),
          fileName: params.fileName,
          computedSha256,
          outcome: 'Modified or Unregistered File',
          details: `Unverified or modified PDF.${metadataHint}`,
          verifiedAt: new Date().toISOString(),
        };
      }

      await systemRepository.insertVerificationRecord(record, ownerIdRef.current);

      const log: ActivityLogEntry = {
        id: makeUuid(),
        actor: current.settings.displayName,
        module: 'Verification',
        action: `Verified ${params.fileName}`,
        resourceLabel: record.outcome,
        outcome: record.outcome === 'Modified or Unregistered File' ? 'Warning' : 'Success',
        metadataSummary:
          record.outcome === 'Watermarked Copy Match' && record.matchedRecipientName
            ? `Copy matched ${record.matchedRecipientName} (${record.matchedWatermarkCode})`
            : `SHA-256 ${computedSha256.slice(0, 16)}…`,
        createdAt: record.verifiedAt,
      };
      void systemRepository.insertActivityLog(log, ownerIdRef.current);

      commitState((prev) => ({
        ...prev,
        verificationRecords: [record, ...prev.verificationRecords],
        activityLogs: [log, ...prev.activityLogs],
      }));

      return record;
    },
    [commitState]
  );

  const verifyByHashOrCode = useCallback(
    async (query: string): Promise<VerificationRecord> => {
      const current = stateRef.current;
      const trimmed = query.trim();
      const lower = trimmed.toLowerCase();

      const wmMatch = current.watermarkedCopies.find(
        (w) =>
          w.watermarkedSha256.toLowerCase() === lower ||
          w.watermarkCode.toLowerCase() === lower
      );
      const docMatch = current.documents.find((d) => d.sha256Hash.toLowerCase() === lower);

      let record: VerificationRecord;

      if (wmMatch) {
        const matchedRecipient = current.recipients.find((r) => r.id === wmMatch.recipientId);
        record = {
          id: makeUuid(),
          fileName: `Lookup: ${trimmed.slice(0, 24)}`,
          computedSha256: wmMatch.watermarkedSha256,
          outcome: 'Watermarked Copy Match',
          matchedDocumentId: wmMatch.documentId,
          matchedDocumentTitle: wmMatch.documentTitle,
          matchedWatermarkId: wmMatch.id,
          matchedWatermarkCode: wmMatch.watermarkCode,
          matchedRecipientId: wmMatch.recipientId,
          matchedRecipientCode: wmMatch.recipientCode || matchedRecipient?.recipientCode,
          matchedRecipientName: wmMatch.recipientName || matchedRecipient?.fullName,
          matchedRecipientEmail: wmMatch.recipientEmail || matchedRecipient?.email,
          matchedRecipientOrganization: matchedRecipient?.organization,
          matchedRecipientRole: matchedRecipient?.role,
          matchedIssueDate: wmMatch.issueDate,
          details: `Matched registered watermarked copy ${wmMatch.watermarkCode} issued to ${wmMatch.recipientName} (${wmMatch.recipientCode}) on ${wmMatch.issueDate}.`,
          verifiedAt: new Date().toISOString(),
        };
      } else if (docMatch) {
        record = {
          id: makeUuid(),
          fileName: `Lookup: ${trimmed.slice(0, 24)}`,
          computedSha256: docMatch.sha256Hash,
          outcome: 'Original Master Match',
          matchedDocumentId: docMatch.id,
          matchedDocumentTitle: docMatch.title,
          details: `Matched registered original document "${docMatch.title}" (DOC-${docMatch.id.slice(0, 8).toUpperCase()}).`,
          verifiedAt: new Date().toISOString(),
        };
      } else {
        record = {
          id: makeUuid(),
          fileName: `Lookup: ${trimmed.slice(0, 24)}`,
          computedSha256: /^[a-f0-9]{64}$/i.test(trimmed) ? trimmed : 'N/A',
          outcome: 'Modified or Unregistered File',
          details:
            'No matching original document or watermark tracking record found in registry.',
          verifiedAt: new Date().toISOString(),
        };
      }

      await systemRepository.insertVerificationRecord(record, ownerIdRef.current);

      const log: ActivityLogEntry = {
        id: makeUuid(),
        actor: current.settings.displayName,
        module: 'Verification',
        action: 'Hash / Tracking ID Lookup',
        resourceLabel: record.outcome,
        outcome: record.outcome === 'Modified or Unregistered File' ? 'Warning' : 'Success',
        metadataSummary:
          record.outcome === 'Watermarked Copy Match' && record.matchedRecipientName
            ? `Copy matched ${record.matchedRecipientName} (${record.matchedWatermarkCode})`
            : trimmed.slice(0, 24),
        createdAt: record.verifiedAt,
      };
      void systemRepository.insertActivityLog(log, ownerIdRef.current);

      commitState((prev) => ({
        ...prev,
        verificationRecords: [record, ...prev.verificationRecords],
        activityLogs: [log, ...prev.activityLogs],
      }));

      return record;
    },
    [commitState]
  );

  const updateSettings = useCallback(
    (partial: Partial<UserProfileSettings>) => {
      commitState((prev) => {
        const nextThemeMode = partial.themeMode || prev.settings.themeMode;
        const resolvedTheme: 'dark' | 'light' =
          nextThemeMode === 'light'
            ? 'light'
            : nextThemeMode === 'dark'
              ? 'dark'
              : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light';

        const next: SystemState = {
          ...prev,
          settings: {
            ...prev.settings,
            ...partial,
            themeMode: nextThemeMode,
            theme: partial.theme || resolvedTheme,
          },
        };
        void systemRepository.syncWorkspaceSettings(next, ownerIdRef.current);
        return next;
      });
      pushToast({ title: 'Profile & Settings Saved', variant: 'success' });
    },
    [commitState, pushToast]
  );

  const setThemeMode = useCallback(
    (mode: ThemeMode) => {
      const resolved: 'dark' | 'light' =
        mode === 'light'
          ? 'light'
          : mode === 'dark'
            ? 'dark'
            : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light';
      commitState((prev) => {
        const next: SystemState = {
          ...prev,
          settings: {
            ...prev.settings,
            themeMode: mode,
            theme: resolved,
          },
        };
        void systemRepository.syncWorkspaceSettings(next, ownerIdRef.current);
        return next;
      });
    },
    [commitState]
  );

  const toggleTheme = useCallback(() => {
    const nextMode: ThemeMode = stateRef.current.settings.theme === 'dark' ? 'light' : 'dark';
    setThemeMode(nextMode);
  }, [setThemeMode]);

  const clearAllData = useCallback(async () => {
    setIsRefreshing(true);
    const theme = stateRef.current.settings.theme || 'dark';
    const empty = await systemRepository.clearAllData(theme, ownerIdRef.current);
    setState(empty);
    setIsRefreshing(false);
    pushToast({
      title: 'Workspace Reset',
      description: 'All documents, recipients, watermarked copies, and verification records removed.',
      variant: 'info',
    });
  }, [pushToast]);

  return (
    <SystemContext.Provider
      value={{
        supabaseOwnerId,
        state,
        isLoading,
        isRefreshing,
        activeModule,
        setActiveModule,
        toasts,
        dismissToast,
        pushToast,
        refreshView,
        registerDocument,
        deleteDocument,
        addRecipient,
        updateRecipient,
        toggleRecipientStatus,
        deleteRecipient,
        issueWatermarksBatch,
        verifyDocumentFile,
        verifyByHashOrCode,
        updateSettings,
        setThemeMode,
        toggleTheme,
        clearAllData,
        commandPaletteOpen,
        setCommandPaletteOpen,
        previewTarget,
        openPdfPreview: (target) => setPreviewTarget(target),
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
