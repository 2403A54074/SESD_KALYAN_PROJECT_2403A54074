import type { SystemState, WatermarkConfig } from '../types/system';

export const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
  overlayTemplate: 'CONFIDENTIAL · {{recipient_name}} · {{watermark_id}}',
  colorPreset: 'cyan',
  opacity: 0.22,
  rotationDeg: -38,
  fontSize: 24,
  includeFooterStamp: true,
  includeCornerBadge: true,
};

export function createEmptyState(theme: 'dark' | 'light' = 'dark'): SystemState {
  return {
    documents: [],
    recipients: [],
    watermarkedCopies: [],
    verificationRecords: [],
    activityLogs: [],
    settings: {
      displayName: 'Workspace Custodian',
      role: 'Document Custodian',
      organization: '',
      avatarPreset: 'unknown',
      themeMode: theme,
      theme,
      compactTables: false,
      defaultWatermark: { ...DEFAULT_WATERMARK_CONFIG },
    },
  };
}
