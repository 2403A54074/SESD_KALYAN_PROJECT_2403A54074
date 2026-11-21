export type ModuleId =
  | 'dashboard'
  | 'upload'
  | 'fingerprints'
  | 'watermarking'
  | 'verification'
  | 'recipients'
  | 'inboxes'
  | 'email-processing'
  | 'webhooks'
  | 'events'
  | 'reports'
  | 'explorer'
  | 'playground'
  | 'productivity'
  | 'calendar'
  | 'music-studio'
  | 'game'
  | 'achievements'
  | 'personalization'
  | 'settings'
  | 'docs';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  organization: string;
  provider: 'local' | 'supabase';
}

export type DocumentClassification = 'Confidential' | 'Restricted' | 'Internal' | 'Board Only';

export interface VaultDocument {
  id: string;
  title: string;
  fileName: string;
  classification: DocumentClassification;
  sha256Hash: string;
  fileSizeBytes: number;
  pageCount: number;
  ownerName: string;
  notes: string;
  createdAt: string;
  hasBinaryInSession?: boolean;
  isFavorite?: boolean;
  lastViewedAt?: string;
}

export type RecipientClearance = 'Executive' | 'Legal' | 'Security' | 'External Partner' | 'Auditor';

export interface Recipient {
  id: string;
  fullName: string;
  email: string;
  organization: string;
  department: string;
  clearance: RecipientClearance;
  status: 'Active' | 'Suspended';
  notes: string;
  createdAt: string;
}

export type WatermarkColorPreset = 'cyan' | 'violet' | 'navy' | 'crimson';

export interface WatermarkConfig {
  overlayTemplate: string;
  colorPreset: WatermarkColorPreset;
  opacity: number;
  rotationDeg: number;
  fontSize: number;
  includeFooterStamp: boolean;
  includeCornerBadge: boolean;
}

export interface WatermarkedCopy {
  id: string;
  watermarkCode: string;
  documentId: string;
  documentTitle: string;
  recipientId: string;
  recipientName: string;
  recipientEmail: string;
  originalSha256: string;
  watermarkedSha256: string;
  overlayText: string;
  colorPreset: WatermarkColorPreset;
  opacity: number;
  rotationDeg: number;
  fontSize: number;
  includeFooterStamp: boolean;
  fileSizeBytes: number;
  issuedAt: string;
}

export type VerificationOutcome =
  | 'Watermarked Match'
  | 'Original Master Match'
  | 'Metadata Attribution Match'
  | 'Unregistered';

export interface VerificationRecord {
  id: string;
  fileName: string;
  computedSha256: string;
  outcome: VerificationOutcome;
  matchedDocumentId?: string;
  matchedDocumentTitle?: string;
  matchedWatermarkCode?: string;
  matchedRecipientName?: string;
  matchedRecipientEmail?: string;
  embeddedAttribution?: string;
  details: string;
  verifiedAt: string;
}

export interface EphemeralInbox {
  id: string;
  aliasAddress: string;
  label: string;
  boundDocumentId?: string;
  boundRecipientId?: string;
  autoWatermark: boolean;
  ttlMinutes: number;
  status: 'Active' | 'Expired' | 'Revoked';
  messageCount: number;
  expiresAt: string;
  createdAt: string;
}

export interface InboundEmailEvent {
  id: string;
  inboxId: string;
  toAddress: string;
  fromAddress: string;
  subject: string;
  bodyPreview: string;
  attachmentName?: string;
  attachmentSha256?: string;
  generatedWatermarkCode?: string;
  processingMode: 'demo';
  pipelineStatus: 'Processed' | 'Rejected' | 'Failed';
  stages: {
    envelopeCheck: 'Passed' | 'Failed';
    mimeExtraction: 'Passed' | 'Skipped' | 'Failed';
    watermarkDispatch: 'Passed' | 'Skipped' | 'Failed';
    webhookRelay: 'Passed' | 'Skipped' | 'Failed';
  };
  rawHeaders: Record<string, string>;
  receivedAt: string;
}

export type RelayEventType =
  | 'document.uploaded'
  | 'watermark.issued'
  | 'document.verified'
  | 'verification.mismatch'
  | 'inbox.provisioned'
  | 'smtp.inbound.processed';

export interface WebhookEndpoint {
  id: string;
  name: string;
  targetUrl: string;
  signingSecret: string;
  subscribedEvents: RelayEventType[];
  maxRetries: number;
  timeoutMs: number;
  enabled: boolean;
  createdAt: string;
}

export interface WebhookDeliveryLog {
  id: string;
  webhookId: string;
  webhookName: string;
  targetUrl: string;
  eventType: RelayEventType;
  correlationId: string;
  deliveryMode: 'simulated' | 'live_fetch';
  httpStatus: number | null;
  latencyMs: number;
  signatureHeader: string;
  payload: Record<string, unknown>;
  responseBody: string;
  status: 'Delivered' | 'Failed' | 'Retrying';
  deliveredAt: string;
}

export interface CentralPipelineEvent {
  id: string;
  correlationId: string;
  eventType: RelayEventType;
  sourceModule: string;
  status: 'Completed' | 'Processing' | 'Queued' | 'Failed';
  sha256Ref?: string;
  watermarkCode?: string;
  dispatchedWebhooks: number;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ActivityLogEntry {
  id: string;
  actor: string;
  module: string;
  action: string;
  resourceLabel: string;
  outcome: 'Success' | 'Warning' | 'Error';
  metadataSummary: string;
  createdAt: string;
}

export interface PlannerTask {
  id: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  priority: 'Low' | 'Medium' | 'High';
  completed: boolean;
  category: 'Audit' | 'Engineering' | 'Operations' | 'Personal';
  createdAt: string;
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  category: 'System' | 'Security' | 'Announcement';
  read: boolean;
  createdAt: string;
}

export type AccentColorId = 'cyan' | 'violet' | 'emerald' | 'indigo';
export type ThemeMode = 'dark' | 'light' | 'system';
export type SidebarAppearance = 'default' | 'compact' | 'translucent';
export type DashboardLayoutMode = 'standard' | 'compact' | 'focus';
export type AnimationIntensity = 'subtle' | 'expressive' | 'none';
export type FontSizeScale = 'sm' | 'md' | 'lg';
export type LanguageCode = 'en' | 'hi' | 'es';
export type AvatarPreset = 'unknown' | 'custom' | 'initials' | 'cyan-crest' | 'violet-crest' | 'portrait';
export type ProfileCoverPreset = 'navy-mesh' | 'cyan-horizon' | 'violet-aurora' | 'charcoal-grid';

export interface DashboardWidgetsConfig {
  showKpis: boolean;
  showThroughputChart: boolean;
  showShortcuts: boolean;
  showRecentActivity: boolean;
  showFavoritesAndTasks: boolean;
}

export interface PersonalizationConfig {
  themeMode: ThemeMode;
  accentColor: AccentColorId;
  sidebarAppearance: SidebarAppearance;
  dashboardLayout: DashboardLayoutMode;
  density: 'comfortable' | 'compact';
  animationIntensity: AnimationIntensity;
  reducedMotion: boolean;
  fontSize: FontSizeScale;
  language: LanguageCode;
  browserTitle: string;
  faviconAccent: AccentColorId;
  ambientEffects: {
    particles: boolean;
    gradientMovement: boolean;
    visualizer: boolean;
    pageTransitions: boolean;
  };
  dashboardWidgets: DashboardWidgetsConfig;
  notifications: {
    enabled: boolean;
    soundEnabled: boolean;
    showAnnouncements: boolean;
  };
  privacy: {
    maskRecipientEmails: boolean;
    truncateHashesInOverview: boolean;
    localAnalyticsOptIn: boolean;
  };
}

export interface UserProfileSettings {
  displayName: string;
  email: string;
  role: string;
  organization: string;
  avatarPreset: AvatarPreset;
  customAvatarDataUrl?: string;
  coverPreset: ProfileCoverPreset;
  theme: 'dark' | 'light'; // resolved theme for compatibility
  compactTables: boolean;
  defaultWatermark: WatermarkConfig;
  supabaseProjectLabel: string;
  personalization: PersonalizationConfig;
}

export interface ProductivityState {
  tasks: PlannerTask[];
  notes: string;
  focusMode: boolean;
  pomodoroCompletedCount: number;
}

export interface SystemState {
  documents: VaultDocument[];
  recipients: Recipient[];
  watermarkedCopies: WatermarkedCopy[];
  verificationRecords: VerificationRecord[];
  inboxes: EphemeralInbox[];
  inboundEmails: InboundEmailEvent[];
  webhooks: WebhookEndpoint[];
  webhookDeliveries: WebhookDeliveryLog[];
  pipelineEvents: CentralPipelineEvent[];
  activityLogs: ActivityLogEntry[];
  notifications: SystemNotification[];
  productivity: ProductivityState;
  exportedReportsCount: number;
  settings: UserProfileSettings;
}
