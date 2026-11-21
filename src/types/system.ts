export type ModuleId =
  | 'dashboard'
  | 'documents'
  | 'recipients'
  | 'watermarking'
  | 'verification'
  | 'reports'
  | 'help'
  | 'settings'
  | 'music-studio'
  | 'game';

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
}

export interface Recipient {
  id: string;
  recipientCode: string;
  fullName: string;
  email: string;
  organization: string;
  role: string;
  status: 'Active' | 'Suspended';
  notes: string;
  createdAt: string;
  updatedAt?: string;
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
  recipientCode: string;
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
  includeCornerBadge: boolean;
  fileSizeBytes: number;
  issueDate: string;
  issuedAt: string;
}

export type VerificationOutcome =
  | 'Original Master Match'
  | 'Watermarked Copy Match'
  | 'Modified or Unregistered File';

export interface VerificationRecord {
  id: string;
  fileName: string;
  computedSha256: string;
  outcome: VerificationOutcome;
  matchedDocumentId?: string;
  matchedDocumentTitle?: string;
  matchedWatermarkId?: string;
  matchedWatermarkCode?: string;
  matchedRecipientId?: string;
  matchedRecipientCode?: string;
  matchedRecipientName?: string;
  matchedRecipientEmail?: string;
  matchedRecipientOrganization?: string;
  matchedRecipientRole?: string;
  matchedIssueDate?: string;
  details: string;
  verifiedAt: string;
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

export type ThemeMode = 'dark' | 'light' | 'system';
export type AvatarPreset = 'unknown' | 'custom' | 'initials' | 'cyan-crest' | 'violet-crest' | 'portrait';

export interface UserProfileSettings {
  displayName: string;
  role: string;
  organization: string;
  avatarPreset: AvatarPreset;
  customAvatarDataUrl?: string;
  themeMode: ThemeMode;
  theme: 'dark' | 'light';
  compactTables: boolean;
  defaultWatermark: WatermarkConfig;
}

export interface SystemState {
  documents: VaultDocument[];
  recipients: Recipient[];
  watermarkedCopies: WatermarkedCopy[];
  verificationRecords: VerificationRecord[];
  activityLogs: ActivityLogEntry[];
  settings: UserProfileSettings;
}
