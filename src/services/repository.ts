import { createEmptyState, DEFAULT_WATERMARK_CONFIG } from '../data/seedData';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import type {
  ActivityLogEntry,
  AvatarPreset,
  DocumentClassification,
  Recipient,
  SystemState,
  ThemeMode,
  UserProfileSettings,
  VaultDocument,
  VerificationOutcome,
  VerificationRecord,
  WatermarkColorPreset,
  WatermarkedCopy,
} from '../types/system';
import { clearAllIdbBinaries, hydratePdfBinariesFromStore } from '../utils/cryptoPdf';

const WORKSPACE_STORAGE_KEY = 'rw_doc_vault_workspace_v1';

function normalizeOutcome(raw: string): VerificationOutcome {
  if (raw === 'Watermarked Copy Match' || raw === 'Watermarked Match') {
    return 'Watermarked Copy Match';
  }
  if (raw === 'Original Master Match' || raw === 'Original Match') {
    return 'Original Master Match';
  }
  return 'Modified or Unregistered File';
}

function migrateState(rawState: Partial<SystemState>): SystemState {
  const empty = createEmptyState('dark');
  const rawSettings = (rawState.settings || {}) as Partial<UserProfileSettings>;
  const themeMode: ThemeMode = rawSettings.themeMode || 'dark';
  const resolvedTheme: 'dark' | 'light' =
    themeMode === 'light' ? 'light' : themeMode === 'dark' ? 'dark' : rawSettings.theme || 'dark';

  const recipients: Recipient[] = Array.isArray(rawState.recipients)
    ? rawState.recipients.map((r) => ({
        ...r,
        recipientCode: r.recipientCode || `REC-${r.id.slice(0, 8).toUpperCase()}`,
      }))
    : [];

  const recCodeById = new Map(recipients.map((r) => [r.id, r.recipientCode]));

  const watermarkedCopies: WatermarkedCopy[] = Array.isArray(rawState.watermarkedCopies)
    ? rawState.watermarkedCopies.map((w) => ({
        ...w,
        recipientCode: w.recipientCode || recCodeById.get(w.recipientId) || `REC-${w.recipientId.slice(0, 8).toUpperCase()}`,
        includeCornerBadge: w.includeCornerBadge ?? true,
        issueDate: w.issueDate || (w.issuedAt ? w.issuedAt.slice(0, 10) : new Date().toISOString().slice(0, 10)),
      }))
    : [];

  const verificationRecords: VerificationRecord[] = Array.isArray(rawState.verificationRecords)
    ? rawState.verificationRecords.map((v) => ({
        ...v,
        outcome: normalizeOutcome(String(v.outcome)),
      }))
    : [];

  return {
    documents: Array.isArray(rawState.documents) ? rawState.documents : [],
    recipients,
    watermarkedCopies,
    verificationRecords,
    activityLogs: Array.isArray(rawState.activityLogs) ? rawState.activityLogs : [],
    settings: {
      ...empty.settings,
      ...rawSettings,
      displayName: rawSettings.displayName || empty.settings.displayName,
      role: rawSettings.role || empty.settings.role,
      organization: rawSettings.organization || '',
      avatarPreset: (rawSettings.avatarPreset as AvatarPreset) || 'unknown',
      themeMode,
      theme: resolvedTheme,
      defaultWatermark: {
        ...DEFAULT_WATERMARK_CONFIG,
        ...(rawSettings.defaultWatermark || {}),
      },
    },
  };
}

export class SystemRepository {
  async ensureAnonymousSupabaseSession(): Promise<string | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) return session.user.id;

      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.user?.id) {
        return null;
      }
      return data.user.id;
    } catch {
      return null;
    }
  }

  async loadLocalState(): Promise<SystemState> {
    try {
      const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (raw) {
        const parsed = migrateState(JSON.parse(raw) as Partial<SystemState>);
        await hydratePdfBinariesFromStore([
          ...parsed.documents.map((d) => `doc:${d.id}`),
          ...parsed.watermarkedCopies.map((w) => `wm:${w.watermarkCode}`),
        ]);
        return parsed;
      }
    } catch {
      // ignore corrupted local JSON
    }
    const empty = createEmptyState('dark');
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(empty));
    return empty;
  }

  async hydrateFromSupabase(ownerId: string, localFallback: SystemState): Promise<SystemState> {
    if (!isSupabaseConfigured || !supabase) return localFallback;
    try {
      const [profileRes, wsRes, docsRes, recsRes, wmRes, verRes, logsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('display_name, role, organization, avatar_preset, custom_avatar_data_url, preferences')
          .eq('id', ownerId)
          .maybeSingle(),
        supabase.from('user_workspaces').select('state_json').eq('owner_id', ownerId).maybeSingle(),
        supabase
          .from('documents')
          .select('id, title, file_name, classification, sha256_hash, file_size_bytes, page_count, owner_name, notes, created_at')
          .eq('owner_id', ownerId)
          .order('created_at', { ascending: false }),
        supabase
          .from('recipients')
          .select('id, recipient_code, full_name, email, organization, role, status, notes, created_at, updated_at')
          .eq('owner_id', ownerId)
          .order('created_at', { ascending: false }),
        supabase
          .from('watermarked_copies')
          .select(
            'id, watermark_code, document_id, document_title, recipient_id, recipient_code, recipient_name, recipient_email, original_sha256, watermarked_sha256, overlay_text, color_preset, opacity, rotation_deg, font_size, include_footer_stamp, file_size_bytes, issue_date, issued_at'
          )
          .eq('owner_id', ownerId)
          .order('issued_at', { ascending: false }),
        supabase
          .from('verification_records')
          .select(
            'id, file_name, computed_sha256, outcome, matched_document_id, matched_document_title, matched_watermark_id, matched_watermark_code, matched_recipient_id, matched_recipient_code, matched_recipient_name, matched_recipient_email, matched_recipient_organization, matched_recipient_role, matched_issue_date, details, verified_at'
          )
          .eq('owner_id', ownerId)
          .order('verified_at', { ascending: false }),
        supabase
          .from('activity_logs')
          .select('id, actor, module, action, resource_label, outcome, metadata_summary, created_at')
          .eq('owner_id', ownerId)
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      const documents: VaultDocument[] =
        !docsRes.error && Array.isArray(docsRes.data)
          ? docsRes.data.map((row) => ({
              id: String(row.id),
              title: String(row.title),
              fileName: String(row.file_name),
              classification: row.classification as DocumentClassification,
              sha256Hash: String(row.sha256_hash).trim(),
              fileSizeBytes: Number(row.file_size_bytes || 0),
              pageCount: Number(row.page_count || 1),
              ownerName: String(row.owner_name || ''),
              notes: String(row.notes || ''),
              createdAt: String(row.created_at),
            }))
          : localFallback.documents;

      const recipients: Recipient[] =
        !recsRes.error && Array.isArray(recsRes.data)
          ? recsRes.data.map((row) => ({
              id: String(row.id),
              recipientCode: String(row.recipient_code || `REC-${String(row.id).slice(0, 8).toUpperCase()}`),
              fullName: String(row.full_name),
              email: String(row.email),
              organization: String(row.organization || ''),
              role: String(row.role || ''),
              status: (row.status as 'Active' | 'Suspended') || 'Active',
              notes: String(row.notes || ''),
              createdAt: String(row.created_at),
              updatedAt: row.updated_at ? String(row.updated_at) : undefined,
            }))
          : localFallback.recipients;

      const docTitleById = new Map(documents.map((d) => [d.id, d.title]));
      const recById = new Map(recipients.map((r) => [r.id, r]));

      const watermarkedCopies: WatermarkedCopy[] =
        !wmRes.error && Array.isArray(wmRes.data)
          ? wmRes.data.map((row) => {
              const rec = recById.get(String(row.recipient_id));
              const issuedAt = String(row.issued_at || new Date().toISOString());
              return {
                id: String(row.id),
                watermarkCode: String(row.watermark_code),
                documentId: String(row.document_id),
                documentTitle: String(row.document_title || docTitleById.get(String(row.document_id)) || 'Untitled PDF'),
                recipientId: String(row.recipient_id),
                recipientCode: String(row.recipient_code || rec?.recipientCode || `REC-${String(row.recipient_id).slice(0, 8).toUpperCase()}`),
                recipientName: String(row.recipient_name || rec?.fullName || ''),
                recipientEmail: String(row.recipient_email || rec?.email || ''),
                originalSha256: String(row.original_sha256).trim(),
                watermarkedSha256: String(row.watermarked_sha256).trim(),
                overlayText: String(row.overlay_text || ''),
                colorPreset: (row.color_preset as WatermarkColorPreset) || 'cyan',
                opacity: Number(row.opacity ?? 0.22),
                rotationDeg: Number(row.rotation_deg ?? -38),
                fontSize: Number(row.font_size ?? 24),
                includeFooterStamp: Boolean(row.include_footer_stamp ?? true),
                includeCornerBadge: true,
                fileSizeBytes: Number(row.file_size_bytes || 0),
                issueDate: row.issue_date ? String(row.issue_date).slice(0, 10) : issuedAt.slice(0, 10),
                issuedAt,
              };
            })
          : localFallback.watermarkedCopies;

      const wmById = new Map(watermarkedCopies.map((w) => [w.id, w]));

      const verificationRecords: VerificationRecord[] =
        !verRes.error && Array.isArray(verRes.data)
          ? verRes.data.map((row) => {
              const outcome = normalizeOutcome(String(row.outcome));
              const matchedWm = row.matched_watermark_id ? wmById.get(String(row.matched_watermark_id)) : undefined;
              const matchedRec = row.matched_recipient_id ? recById.get(String(row.matched_recipient_id)) : undefined;
              return {
                id: String(row.id),
                fileName: String(row.file_name),
                computedSha256: String(row.computed_sha256).trim(),
                outcome,
                matchedDocumentId: row.matched_document_id ? String(row.matched_document_id) : undefined,
                matchedDocumentTitle:
                  (row.matched_document_title ? String(row.matched_document_title) : undefined) ||
                  (row.matched_document_id ? docTitleById.get(String(row.matched_document_id)) : undefined),
                matchedWatermarkId: row.matched_watermark_id ? String(row.matched_watermark_id) : undefined,
                matchedWatermarkCode:
                  (row.matched_watermark_code ? String(row.matched_watermark_code) : undefined) ||
                  matchedWm?.watermarkCode,
                matchedRecipientId: row.matched_recipient_id ? String(row.matched_recipient_id) : undefined,
                matchedRecipientCode:
                  outcome === 'Watermarked Copy Match'
                    ? (row.matched_recipient_code ? String(row.matched_recipient_code) : undefined) ||
                      matchedWm?.recipientCode ||
                      matchedRec?.recipientCode
                    : undefined,
                matchedRecipientName:
                  outcome === 'Watermarked Copy Match'
                    ? (row.matched_recipient_name ? String(row.matched_recipient_name) : undefined) ||
                      matchedWm?.recipientName ||
                      matchedRec?.fullName
                    : undefined,
                matchedRecipientEmail:
                  outcome === 'Watermarked Copy Match'
                    ? (row.matched_recipient_email ? String(row.matched_recipient_email) : undefined) ||
                      matchedWm?.recipientEmail ||
                      matchedRec?.email
                    : undefined,
                matchedRecipientOrganization:
                  outcome === 'Watermarked Copy Match'
                    ? (row.matched_recipient_organization ? String(row.matched_recipient_organization) : undefined) ||
                      matchedRec?.organization
                    : undefined,
                matchedRecipientRole:
                  outcome === 'Watermarked Copy Match'
                    ? (row.matched_recipient_role ? String(row.matched_recipient_role) : undefined) ||
                      matchedRec?.role
                    : undefined,
                matchedIssueDate:
                  outcome === 'Watermarked Copy Match'
                    ? (row.matched_issue_date ? String(row.matched_issue_date).slice(0, 10) : undefined) ||
                      matchedWm?.issueDate
                    : undefined,
                details: String(row.details || ''),
                verifiedAt: String(row.verified_at),
              };
            })
          : localFallback.verificationRecords;

      const activityLogs: ActivityLogEntry[] =
        !logsRes.error && Array.isArray(logsRes.data)
          ? logsRes.data.map((row) => ({
              id: String(row.id),
              actor: String(row.actor),
              module: String(row.module),
              action: String(row.action),
              resourceLabel: String(row.resource_label),
              outcome: (row.outcome as 'Success' | 'Warning' | 'Error') || 'Success',
              metadataSummary: String(row.metadata_summary || ''),
              createdAt: String(row.created_at),
            }))
          : localFallback.activityLogs;

      const wsSettings =
        wsRes.data?.state_json && typeof wsRes.data.state_json === 'object'
          ? ((wsRes.data.state_json as Partial<SystemState>).settings as Partial<UserProfileSettings> | undefined)
          : undefined;
      const profileRow = profileRes.data as
        | {
            display_name?: string;
            role?: string;
            organization?: string;
            avatar_preset?: AvatarPreset;
            custom_avatar_data_url?: string | null;
            preferences?: Partial<UserProfileSettings>;
          }
        | null;
      const prefs = (profileRow?.preferences || {}) as Partial<UserProfileSettings>;

      const hasRemoteData =
        documents.length > 0 ||
        recipients.length > 0 ||
        watermarkedCopies.length > 0 ||
        verificationRecords.length > 0 ||
        activityLogs.length > 0;

      const hydrated: SystemState = {
        documents: hasRemoteData ? documents : localFallback.documents,
        recipients: hasRemoteData ? recipients : localFallback.recipients,
        watermarkedCopies: hasRemoteData ? watermarkedCopies : localFallback.watermarkedCopies,
        verificationRecords: hasRemoteData ? verificationRecords : localFallback.verificationRecords,
        activityLogs: hasRemoteData ? activityLogs : localFallback.activityLogs,
        settings: {
          ...localFallback.settings,
          ...(wsSettings || {}),
          ...(prefs.themeMode ? { themeMode: prefs.themeMode } : {}),
          ...(prefs.theme ? { theme: prefs.theme } : {}),
          ...(typeof prefs.compactTables === 'boolean' ? { compactTables: prefs.compactTables } : {}),
          ...(prefs.defaultWatermark
            ? { defaultWatermark: { ...DEFAULT_WATERMARK_CONFIG, ...prefs.defaultWatermark } }
            : {}),
          displayName: profileRow?.display_name || localFallback.settings.displayName,
          role: profileRow?.role || localFallback.settings.role,
          organization: profileRow?.organization ?? localFallback.settings.organization,
          avatarPreset:
            (profileRow?.avatar_preset as AvatarPreset) || localFallback.settings.avatarPreset,
          customAvatarDataUrl:
            profileRow?.custom_avatar_data_url || localFallback.settings.customAvatarDataUrl,
        },
      };

      await hydratePdfBinariesFromStore([
        ...hydrated.documents.map((d) => `doc:${d.id}`),
        ...hydrated.watermarkedCopies.map((w) => `wm:${w.watermarkCode}`),
      ]);

      localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(hydrated));
      return hydrated;
    } catch {
      return localFallback;
    }
  }

  saveLocalState(state: SystemState): void {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(state));
  }

  async syncWorkspaceSettings(state: SystemState, ownerId: string | null): Promise<void> {
    this.saveLocalState(state);
    if (!isSupabaseConfigured || !supabase || !ownerId) return;

    await Promise.all([
      supabase.from('user_workspaces').upsert(
        {
          owner_id: ownerId,
          state_json: { settings: state.settings },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'owner_id' }
      ),
      supabase.from('profiles').upsert(
        {
          id: ownerId,
          email: '',
          display_name: state.settings.displayName,
          role: state.settings.role,
          organization: state.settings.organization,
          avatar_preset: state.settings.avatarPreset,
          custom_avatar_data_url: state.settings.customAvatarDataUrl || null,
          preferences: {
            themeMode: state.settings.themeMode,
            theme: state.settings.theme,
            compactTables: state.settings.compactTables,
            defaultWatermark: state.settings.defaultWatermark,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      ),
    ]);
  }

  async insertDocument(doc: VaultDocument, ownerId: string | null): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !ownerId) return;
    const { error } = await supabase.from('documents').insert({
      id: doc.id,
      owner_id: ownerId,
      title: doc.title,
      file_name: doc.fileName,
      classification: doc.classification,
      sha256_hash: doc.sha256Hash,
      file_size_bytes: doc.fileSizeBytes,
      page_count: doc.pageCount,
      owner_name: doc.ownerName,
      notes: doc.notes,
      created_at: doc.createdAt,
    });
    if (error) console.warn('Supabase document insert notice:', error.message);
  }

  async deleteDocument(docId: string, ownerId: string | null): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !ownerId) return;
    const { error } = await supabase.from('documents').delete().eq('id', docId).eq('owner_id', ownerId);
    if (error) console.warn('Supabase document delete notice:', error.message);
  }

  async insertRecipient(rec: Recipient, ownerId: string | null): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !ownerId) return;
    const { error } = await supabase.from('recipients').insert({
      id: rec.id,
      owner_id: ownerId,
      recipient_code: rec.recipientCode,
      full_name: rec.fullName,
      email: rec.email,
      organization: rec.organization,
      role: rec.role,
      department: rec.role || 'General',
      clearance: 'External Partner',
      status: rec.status,
      notes: rec.notes,
      created_at: rec.createdAt,
      updated_at: rec.updatedAt || rec.createdAt,
    });
    if (error) console.warn('Supabase recipient insert notice:', error.message);
  }

  async updateRecipient(rec: Recipient, ownerId: string | null): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !ownerId) return;
    const { error } = await supabase
      .from('recipients')
      .update({
        recipient_code: rec.recipientCode,
        full_name: rec.fullName,
        email: rec.email,
        organization: rec.organization,
        role: rec.role,
        department: rec.role || 'General',
        status: rec.status,
        notes: rec.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rec.id)
      .eq('owner_id', ownerId);
    if (error) console.warn('Supabase recipient update notice:', error.message);
  }

  async deleteRecipient(recId: string, ownerId: string | null): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !ownerId) return;
    const { error } = await supabase.from('recipients').delete().eq('id', recId).eq('owner_id', ownerId);
    if (error) console.warn('Supabase recipient delete notice:', error.message);
  }

  async insertWatermarkedCopy(copy: WatermarkedCopy, ownerId: string | null): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !ownerId) return;
    const { error } = await supabase.from('watermarked_copies').insert({
      id: copy.id,
      owner_id: ownerId,
      watermark_code: copy.watermarkCode,
      document_id: copy.documentId,
      document_title: copy.documentTitle,
      recipient_id: copy.recipientId,
      recipient_code: copy.recipientCode,
      recipient_name: copy.recipientName,
      recipient_email: copy.recipientEmail,
      original_sha256: copy.originalSha256,
      watermarked_sha256: copy.watermarkedSha256,
      overlay_text: copy.overlayText,
      color_preset: copy.colorPreset,
      opacity: copy.opacity,
      rotation_deg: copy.rotationDeg,
      font_size: copy.fontSize,
      include_footer_stamp: copy.includeFooterStamp,
      file_size_bytes: copy.fileSizeBytes,
      issue_date: copy.issueDate,
      issued_at: copy.issuedAt,
    });
    if (error) console.warn('Supabase watermark insert notice:', error.message);
  }

  async insertVerificationRecord(rec: VerificationRecord, ownerId: string | null): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !ownerId) return;
    const { error } = await supabase.from('verification_records').insert({
      id: rec.id,
      owner_id: ownerId,
      file_name: rec.fileName,
      computed_sha256: rec.computedSha256,
      outcome: rec.outcome,
      matched_document_id: rec.matchedDocumentId || null,
      matched_document_title: rec.matchedDocumentTitle || null,
      matched_watermark_id: rec.matchedWatermarkId || null,
      matched_watermark_code: rec.matchedWatermarkCode || null,
      matched_recipient_id: rec.matchedRecipientId || null,
      matched_recipient_code: rec.matchedRecipientCode || null,
      matched_recipient_name: rec.matchedRecipientName || null,
      matched_recipient_email: rec.matchedRecipientEmail || null,
      matched_recipient_organization: rec.matchedRecipientOrganization || null,
      matched_recipient_role: rec.matchedRecipientRole || null,
      matched_issue_date: rec.matchedIssueDate || null,
      details: rec.details,
      verified_at: rec.verifiedAt,
    });
    if (error) console.warn('Supabase verification insert notice:', error.message);
  }

  async insertActivityLog(log: ActivityLogEntry, ownerId: string | null): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !ownerId) return;
    const { error } = await supabase.from('activity_logs').insert({
      id: log.id,
      owner_id: ownerId,
      actor: log.actor,
      module: log.module,
      action: log.action,
      resource_label: log.resourceLabel,
      outcome: log.outcome,
      metadata_summary: log.metadataSummary,
      created_at: log.createdAt,
    });
    if (error) console.warn('Supabase activity log notice:', error.message);
  }

  async clearAllData(currentTheme: 'dark' | 'light', ownerId: string | null): Promise<SystemState> {
    await clearAllIdbBinaries();
    const empty = createEmptyState(currentTheme);
    if (isSupabaseConfigured && supabase && ownerId) {
      await Promise.all([
        supabase.from('verification_records').delete().eq('owner_id', ownerId),
        supabase.from('watermarked_copies').delete().eq('owner_id', ownerId),
        supabase.from('recipients').delete().eq('owner_id', ownerId),
        supabase.from('documents').delete().eq('owner_id', ownerId),
        supabase.from('activity_logs').delete().eq('owner_id', ownerId),
      ]);
    }
    this.saveLocalState(empty);
    return empty;
  }

  async checkSupabaseHealth(ownerId: string | null): Promise<{ connected: boolean; message: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        connected: false,
        message:
          'Running in Local Browser + IndexedDB persistence mode. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable Supabase sync.',
      };
    }
    if (!ownerId) {
      return {
        connected: false,
        message:
          'Supabase client configured, but no anonymous workspace session is active. Enable Anonymous Sign-Ins in Supabase Auth to sync tables under strict Row Level Security; data is safely persisted in this browser.',
      };
    }
    try {
      const { error } = await supabase.from('documents').select('id', { count: 'exact', head: true });
      if (error) {
        return { connected: false, message: `Supabase check returned: ${error.message}` };
      }
      return {
        connected: true,
        message: 'Connected to Supabase PostgreSQL with Anonymous Session & strict Row Level Security (RLS).',
      };
    } catch (err) {
      return {
        connected: false,
        message: err instanceof Error ? err.message : 'Unable to reach Supabase client.',
      };
    }
  }
}

export const systemRepository = new SystemRepository();
