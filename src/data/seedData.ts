import type {
  PersonalizationConfig,
  ProductivityState,
  SystemNotification,
  SystemState,
  WatermarkConfig,
} from '../types/system';
import {
  applyVisiblePdfWatermark,
  computeHmacSha256Hex,
  computeSha256Hex,
  generateSamplePdf,
  savePdfBinary,
} from '../utils/cryptoPdf';

export const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
  overlayTemplate: 'CONFIDENTIAL · {{recipient_name}} · {{watermark_id}}',
  colorPreset: 'cyan',
  opacity: 0.22,
  rotationDeg: -38,
  fontSize: 24,
  includeFooterStamp: true,
  includeCornerBadge: true,
};

export const DEFAULT_PERSONALIZATION_CONFIG: PersonalizationConfig = {
  themeMode: 'dark',
  accentColor: 'cyan',
  sidebarAppearance: 'default',
  dashboardLayout: 'standard',
  density: 'comfortable',
  animationIntensity: 'subtle',
  reducedMotion: false,
  fontSize: 'md',
  language: 'en',
  browserTitle: 'Digital Document Watermarking & Ephemeral SMTP–Webhook Relay System',
  faviconAccent: 'cyan',
  ambientEffects: {
    particles: false,
    gradientMovement: true,
    visualizer: true,
    pageTransitions: true,
  },
  dashboardWidgets: {
    showKpis: true,
    showThroughputChart: true,
    showShortcuts: true,
    showRecentActivity: true,
    showFavoritesAndTasks: true,
  },
  notifications: {
    enabled: true,
    soundEnabled: false,
    showAnnouncements: true,
  },
  privacy: {
    maskRecipientEmails: false,
    truncateHashesInOverview: true,
    localAnalyticsOptIn: true,
  },
};

export function createDefaultNotifications(): SystemNotification[] {
  const now = Date.now();
  return [
    {
      id: 'notif-welcome',
      title: 'Workspace Expansion Active',
      message: 'Ambient Music Studio, Personalization Studio, Interactive Explorer, and Developer Playground are ready.',
      category: 'Announcement',
      read: false,
      createdAt: new Date(now - 10 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif-crypto',
      title: 'Web Crypto SHA-256 Engine Ready',
      message: 'All PDF fingerprinting and HMAC-SHA256 webhook signatures execute locally without exposing secrets.',
      category: 'Security',
      read: false,
      createdAt: new Date(now - 90 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif-smtp-demo',
      title: 'Demo SMTP Relay Mode',
      message: 'Ephemeral inbox ingestion operates in local simulation unless linked to an external MX worker.',
      category: 'System',
      read: true,
      createdAt: new Date(now - 300 * 60 * 1000).toISOString(),
    },
  ];
}

export function createDefaultProductivity(): ProductivityState {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400 * 1000).toISOString().slice(0, 10);
  return {
    tasks: [
      {
        id: 'task-1',
        title: 'Verify Q4 Audit PDF watermarked copy for Veritas Assurance',
        dueDate: today,
        priority: 'High',
        completed: false,
        category: 'Audit',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'task-2',
        title: 'Inspect failed HTTP 503 webhook delivery and verify HMAC header',
        dueDate: tomorrow,
        priority: 'Medium',
        completed: false,
        category: 'Engineering',
        createdAt: new Date().toISOString(),
      },
    ],
    notes: 'Architecture Review Notes:\n- Keep RW-ATTR metadata embedded in PDF Keywords for re-saved copy attribution.\n- Rotate demo webhook signing secrets quarterly.',
    focusMode: false,
    pomodoroCompletedCount: 1,
  };
}

export function createEmptyState(theme: 'dark' | 'light' = 'dark'): SystemState {
  return {
    documents: [],
    recipients: [],
    watermarkedCopies: [],
    verificationRecords: [],
    inboxes: [],
    inboundEmails: [],
    webhooks: [],
    webhookDeliveries: [],
    pipelineEvents: [],
    activityLogs: [],
    notifications: [],
    productivity: {
      tasks: [],
      notes: '',
      focusMode: false,
      pomodoroCompletedCount: 0,
    },
    exportedReportsCount: 0,
    settings: {
      displayName: 'N. Kalyan Reddy',
      email: 'kalyan.reddy@relay-security.example',
      role: 'Lead Systems Architect',
      organization: 'RelayWatermark Engineering Lab',
      avatarPreset: 'unknown',
      coverPreset: 'navy-mesh',
      theme,
      compactTables: false,
      defaultWatermark: { ...DEFAULT_WATERMARK_CONFIG },
      supabaseProjectLabel: 'relay-watermark-prod',
      personalization: {
        ...DEFAULT_PERSONALIZATION_CONFIG,
        themeMode: theme,
      },
    },
  };
}

const SAMPLE_DOCS_SPEC = [
  {
    id: 'doc-zt-arch',
    title: 'Zero-Trust Key Escrow & Relay Architecture v2.4',
    fileName: 'zero-trust-relay-architecture-v2.4.pdf',
    classification: 'Confidential' as const,
    ownerName: 'N. Kalyan Reddy',
    notes: 'Core system design specification shared with security reviewers and external auditors.',
    createdOffsetHours: 72,
    sections: [
      {
        heading: '1. Architectural Overview',
        body: 'This specification defines the cryptographic custody model for controlled PDF distribution, SHA-256 baseline fingerprinting, and ephemeral SMTP relay ingestion.',
      },
      {
        heading: '2. Ephemeral SMTP Ingress Isolation',
        body: 'Inbound mail streams are terminated at isolated MX workers, stripped of active scripting payloads, hashed immediately, and dispatched via HMAC-SHA256 signed webhooks.',
      },
    ],
  },
  {
    id: 'doc-soc2-audit',
    title: 'Q4 Vendor Security & Compliance Assessment',
    fileName: 'q4-vendor-compliance-assessment.pdf',
    classification: 'Restricted' as const,
    ownerName: 'N. Kalyan Reddy',
    notes: 'Contains third-party penetration testing findings and remediation SLAs.',
    createdOffsetHours: 48,
    sections: [
      {
        heading: '1. Audit Scope & Controls',
        body: 'Covers key rotation policies, TLS 1.3 transport enforcement, webhook replay protection, and immutable audit trail retention across distributed relay nodes.',
      },
      {
        heading: '2. Finding Attribution Matrix',
        body: 'All exported copies issued to external auditors must carry visible diagonal recipient attribution and page-level SHA-256 reference footers.',
      },
    ],
  },
  {
    id: 'doc-board-brief',
    title: 'Infrastructure Resilience & Incident Playbook',
    fileName: 'infra-resilience-incident-playbook.pdf',
    classification: 'Board Only' as const,
    ownerName: 'N. Kalyan Reddy',
    notes: 'Executive contingency brief for multi-region failover and key revocation drills.',
    createdOffsetHours: 18,
    sections: [
      {
        heading: '1. Failover Objectives',
        body: 'Defines deterministic recovery time objectives under regional database degradation and dead-letter queue replay procedures for downstream webhook consumers.',
      },
    ],
  },
];

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

function hoursFromNowIso(hours: number): string {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

export async function buildSeededSystemState(theme: 'dark' | 'light' = 'dark'): Promise<SystemState> {
  const recipients = [
    {
      id: 'rec-priya',
      fullName: 'Priya Nair',
      email: 'priya.nair@veritas-audit.example',
      organization: 'Veritas Security Audit LLP',
      department: 'External Assurance',
      clearance: 'Auditor' as const,
      status: 'Active' as const,
      notes: 'Lead external auditor for Q4 compliance package.',
      createdAt: hoursAgoIso(120),
    },
    {
      id: 'rec-arjun',
      fullName: 'Arjun Deshmukh',
      email: 'arjun.d@core-platform.example',
      organization: 'Core Platform Engineering',
      department: 'Distributed Systems',
      clearance: 'Security' as const,
      status: 'Active' as const,
      notes: 'Responsible for MTA ingress parser and webhook consumer verification.',
      createdAt: hoursAgoIso(96),
    },
    {
      id: 'rec-elena',
      fullName: 'Elena Vance',
      email: 'e.vance@meridian-counsel.example',
      organization: 'Meridian Legal Partners',
      department: 'IP & Regulatory',
      clearance: 'Legal' as const,
      status: 'Active' as const,
      notes: 'Reviews restricted NDA and IP escrow filings.',
      createdAt: hoursAgoIso(84),
    },
    {
      id: 'rec-marcus',
      fullName: 'Marcus Chen',
      email: 'm.chen@apex-ventures.example',
      organization: 'Apex Strategic Advisory',
      department: 'Board Governance',
      clearance: 'Executive' as const,
      status: 'Suspended' as const,
      notes: 'Access suspended pending quarterly review.',
      createdAt: hoursAgoIso(150),
    },
  ];

  const documents = [];
  const binaryMap = new Map<string, Uint8Array>();

  for (const spec of SAMPLE_DOCS_SPEC) {
    const bytes = await generateSamplePdf({
      title: spec.title,
      classification: spec.classification,
      ownerName: spec.ownerName,
      sections: spec.sections,
    });
    const sha256Hash = await computeSha256Hex(bytes);
    savePdfBinary(`doc:${spec.id}`, bytes);
    binaryMap.set(spec.id, bytes);
    documents.push({
      id: spec.id,
      title: spec.title,
      fileName: spec.fileName,
      classification: spec.classification,
      sha256Hash,
      fileSizeBytes: bytes.byteLength,
      pageCount: 2,
      ownerName: spec.ownerName,
      notes: spec.notes,
      createdAt: hoursAgoIso(spec.createdOffsetHours),
      hasBinaryInSession: true,
    });
  }

  // Generate 2 real watermarked copies so they can be downloaded & verified immediately
  const wmSpecs = [
    {
      id: 'wm-copy-1',
      watermarkCode: 'WM-8F2A91',
      doc: documents[0],
      rec: recipients[0],
      colorPreset: 'cyan' as const,
      issuedOffsetHours: 32,
    },
    {
      id: 'wm-copy-2',
      watermarkCode: 'WM-4C7D18',
      doc: documents[1],
      rec: recipients[2],
      colorPreset: 'violet' as const,
      issuedOffsetHours: 14,
    },
  ];

  const watermarkedCopies = [];
  for (const item of wmSpecs) {
    const sourceBytes = binaryMap.get(item.doc.id)!;
    const cfg: WatermarkConfig = {
      ...DEFAULT_WATERMARK_CONFIG,
      colorPreset: item.colorPreset,
    };
    const result = await applyVisiblePdfWatermark({
      sourceBytes,
      originalSha256: item.doc.sha256Hash,
      recipientName: item.rec.fullName,
      recipientEmail: item.rec.email,
      classification: item.doc.classification,
      watermarkCode: item.watermarkCode,
      config: cfg,
    });
    savePdfBinary(`wm:${item.watermarkCode}`, result.watermarkedBytes);
    watermarkedCopies.push({
      id: item.id,
      watermarkCode: item.watermarkCode,
      documentId: item.doc.id,
      documentTitle: item.doc.title,
      recipientId: item.rec.id,
      recipientName: item.rec.fullName,
      recipientEmail: item.rec.email,
      originalSha256: item.doc.sha256Hash,
      watermarkedSha256: result.watermarkedSha256,
      overlayText: result.overlayText,
      colorPreset: cfg.colorPreset,
      opacity: cfg.opacity,
      rotationDeg: cfg.rotationDeg,
      fontSize: cfg.fontSize,
      includeFooterStamp: cfg.includeFooterStamp,
      fileSizeBytes: result.watermarkedBytes.byteLength,
      issuedAt: hoursAgoIso(item.issuedOffsetHours),
    });
  }

  const verificationRecords = [
    {
      id: 'ver-1',
      fileName: 'zero-trust-relay-architecture-v2.4-WM-8F2A91.pdf',
      computedSha256: watermarkedCopies[0].watermarkedSha256,
      outcome: 'Watermarked Match' as const,
      matchedDocumentId: documents[0].id,
      matchedDocumentTitle: documents[0].title,
      matchedWatermarkCode: watermarkedCopies[0].watermarkCode,
      matchedRecipientName: recipients[0].fullName,
      matchedRecipientEmail: recipients[0].email,
      embeddedAttribution: `${watermarkedCopies[0].watermarkCode} (${recipients[0].email})`,
      details: 'Exact SHA-256 digest match against issued watermarked copy ledger.',
      verifiedAt: hoursAgoIso(10),
    },
    {
      id: 'ver-2',
      fileName: 'q4-vendor-compliance-assessment.pdf',
      computedSha256: documents[1].sha256Hash,
      outcome: 'Original Master Match' as const,
      matchedDocumentId: documents[1].id,
      matchedDocumentTitle: documents[1].title,
      details: 'Matches unwatermarked master vault SHA-256 fingerprint.',
      verifiedAt: hoursAgoIso(6),
    },
  ];

  const inboxes = [
    {
      id: 'inb-1',
      aliasAddress: 'audit-7f3a@ephemeral-relay.demo',
      label: 'Veritas Q4 Audit Dropzone',
      boundDocumentId: documents[0].id,
      boundRecipientId: recipients[0].id,
      autoWatermark: true,
      ttlMinutes: 1440,
      status: 'Active' as const,
      messageCount: 1,
      expiresAt: hoursFromNowIso(18),
      createdAt: hoursAgoIso(6),
    },
    {
      id: 'inb-2',
      aliasAddress: 'legal-9c12@ephemeral-relay.demo',
      label: 'Meridian Counsel Intake',
      boundDocumentId: documents[1].id,
      boundRecipientId: recipients[2].id,
      autoWatermark: true,
      ttlMinutes: 60,
      status: 'Active' as const,
      messageCount: 1,
      expiresAt: hoursFromNowIso(2),
      createdAt: hoursAgoIso(1),
    },
    {
      id: 'inb-3',
      aliasAddress: 'board-01b4@ephemeral-relay.demo',
      label: 'Board Briefing Relay (Expired)',
      boundDocumentId: documents[2].id,
      boundRecipientId: recipients[3].id,
      autoWatermark: false,
      ttlMinutes: 15,
      status: 'Expired' as const,
      messageCount: 0,
      expiresAt: hoursAgoIso(4),
      createdAt: hoursAgoIso(5),
    },
  ];

  const inboundEmails = [
    {
      id: 'mail-1',
      inboxId: inboxes[0].id,
      toAddress: inboxes[0].aliasAddress,
      fromAddress: 'priya.nair@veritas-audit.example',
      subject: 'Signed Audit Evidence Package — Relay Verification',
      bodyPreview: 'Attaching the reviewed architecture brief for automated SHA-256 registration and webhook dispatch.',
      attachmentName: documents[0].fileName,
      attachmentSha256: documents[0].sha256Hash,
      generatedWatermarkCode: watermarkedCopies[0].watermarkCode,
      processingMode: 'demo' as const,
      pipelineStatus: 'Processed' as const,
      stages: {
        envelopeCheck: 'Passed' as const,
        mimeExtraction: 'Passed' as const,
        watermarkDispatch: 'Passed' as const,
        webhookRelay: 'Passed' as const,
      },
      rawHeaders: {
        'Message-ID': '<9f32c81a-demo@veritas-audit.example>',
        'X-Relay-Mode': 'DEMO-SIMULATED-MTA',
        'Authentication-Results': 'demo-relay; spf=pass; dkim=pass',
        'Content-Type': 'multipart/mixed; boundary="----RelayBoundary7F3A"',
      },
      receivedAt: hoursAgoIso(5),
    },
    {
      id: 'mail-2',
      inboxId: inboxes[1].id,
      toAddress: inboxes[1].aliasAddress,
      fromAddress: 'e.vance@meridian-counsel.example',
      subject: 'Compliance Redline Attachment',
      bodyPreview: 'Submitting clean PDF redline for recipient-specific watermarked archiving.',
      attachmentName: documents[1].fileName,
      attachmentSha256: documents[1].sha256Hash,
      generatedWatermarkCode: watermarkedCopies[1].watermarkCode,
      processingMode: 'demo' as const,
      pipelineStatus: 'Processed' as const,
      stages: {
        envelopeCheck: 'Passed' as const,
        mimeExtraction: 'Passed' as const,
        watermarkDispatch: 'Passed' as const,
        webhookRelay: 'Passed' as const,
      },
      rawHeaders: {
        'Message-ID': '<4b18e002-demo@meridian-counsel.example>',
        'X-Relay-Mode': 'DEMO-SIMULATED-MTA',
        'Authentication-Results': 'demo-relay; spf=pass; dkim=pass',
        'Content-Type': 'multipart/mixed; boundary="----RelayBoundary9C12"',
      },
      receivedAt: hoursAgoIso(2),
    },
  ];

  const webhooks = [
    {
      id: 'wh-siem',
      name: 'Enterprise SIEM Collector',
      targetUrl: 'https://siem-ingest.internal.example/v1/relay-events',
      signingSecret: 'whsec_demo_9f4a21c8e7b03d15a6c2',
      subscribedEvents: [
        'document.uploaded' as const,
        'watermark.issued' as const,
        'document.verified' as const,
        'verification.mismatch' as const,
        'smtp.inbound.processed' as const,
      ],
      maxRetries: 3,
      timeoutMs: 5000,
      enabled: true,
      createdAt: hoursAgoIso(110),
    },
    {
      id: 'wh-slack-ops',
      name: 'Security Operations Notifier',
      targetUrl: 'https://hooks.ops.example/services/relay-audit',
      signingSecret: 'whsec_demo_3a81e5d209c41f7b8e12',
      subscribedEvents: ['verification.mismatch' as const, 'watermark.issued' as const],
      maxRetries: 2,
      timeoutMs: 3000,
      enabled: true,
      createdAt: hoursAgoIso(80),
    },
  ];

  const samplePayload1 = {
    event: 'watermark.issued',
    correlation_id: 'corr_91a4f02c',
    watermark_code: watermarkedCopies[0].watermarkCode,
    recipient_email: recipients[0].email,
    sha256: watermarkedCopies[0].watermarkedSha256,
  };
  const sig1 = await computeHmacSha256Hex(webhooks[0].signingSecret, JSON.stringify(samplePayload1));

  const samplePayload2 = {
    event: 'smtp.inbound.processed',
    correlation_id: 'corr_63d8b19e',
    inbox: inboxes[0].aliasAddress,
    attachment_sha256: documents[0].sha256Hash,
    mode: 'demo',
  };
  const sig2 = await computeHmacSha256Hex(webhooks[0].signingSecret, JSON.stringify(samplePayload2));

  const webhookDeliveries = [
    {
      id: 'del-1',
      webhookId: webhooks[0].id,
      webhookName: webhooks[0].name,
      targetUrl: webhooks[0].targetUrl,
      eventType: 'watermark.issued' as const,
      correlationId: 'corr_91a4f02c',
      deliveryMode: 'simulated' as const,
      httpStatus: 200,
      latencyMs: 118,
      signatureHeader: `sha256=${sig1}`,
      payload: samplePayload1,
      responseBody: '{"accepted":true,"ingested_at":"simulated-relay"}',
      status: 'Delivered' as const,
      deliveredAt: hoursAgoIso(32),
    },
    {
      id: 'del-2',
      webhookId: webhooks[0].id,
      webhookName: webhooks[0].name,
      targetUrl: webhooks[0].targetUrl,
      eventType: 'smtp.inbound.processed' as const,
      correlationId: 'corr_63d8b19e',
      deliveryMode: 'simulated' as const,
      httpStatus: 202,
      latencyMs: 142,
      signatureHeader: `sha256=${sig2}`,
      payload: samplePayload2,
      responseBody: '{"queued":true,"relay":"demo-worker"}',
      status: 'Delivered' as const,
      deliveredAt: hoursAgoIso(5),
    },
    {
      id: 'del-3',
      webhookId: webhooks[1].id,
      webhookName: webhooks[1].name,
      targetUrl: webhooks[1].targetUrl,
      eventType: 'watermark.issued' as const,
      correlationId: 'corr_44e2a801',
      deliveryMode: 'simulated' as const,
      httpStatus: 503,
      latencyMs: 3012,
      signatureHeader: `sha256=${sig1.slice(0, 32)}00000000000000000000000000000000`,
      payload: {
        event: 'watermark.issued',
        correlation_id: 'corr_44e2a801',
        watermark_code: watermarkedCopies[1].watermarkCode,
      },
      responseBody: '{"error":"Upstream consumer temporarily unavailable (simulated retry test)"}',
      status: 'Failed' as const,
      deliveredAt: hoursAgoIso(14),
    },
  ];

  const pipelineEvents = [
    {
      id: 'evt-1',
      correlationId: 'corr_91a4f02c',
      eventType: 'watermark.issued' as const,
      sourceModule: 'Watermarking Engine',
      status: 'Completed' as const,
      sha256Ref: watermarkedCopies[0].watermarkedSha256,
      watermarkCode: watermarkedCopies[0].watermarkCode,
      dispatchedWebhooks: 1,
      payload: samplePayload1,
      createdAt: hoursAgoIso(32),
    },
    {
      id: 'evt-2',
      correlationId: 'corr_63d8b19e',
      eventType: 'smtp.inbound.processed' as const,
      sourceModule: 'Demo SMTP Relay',
      status: 'Completed' as const,
      sha256Ref: documents[0].sha256Hash,
      watermarkCode: watermarkedCopies[0].watermarkCode,
      dispatchedWebhooks: 1,
      payload: samplePayload2,
      createdAt: hoursAgoIso(5),
    },
    {
      id: 'evt-3',
      correlationId: 'corr_28b7c440',
      eventType: 'document.verified' as const,
      sourceModule: 'Forensic Verifier',
      status: 'Completed' as const,
      sha256Ref: documents[1].sha256Hash,
      dispatchedWebhooks: 0,
      payload: {
        event: 'document.verified',
        outcome: 'Original Master Match',
        document_id: documents[1].id,
      },
      createdAt: hoursAgoIso(6),
    },
    {
      id: 'evt-4',
      correlationId: 'corr_44e2a801',
      eventType: 'watermark.issued' as const,
      sourceModule: 'Watermarking Engine',
      status: 'Failed' as const,
      sha256Ref: watermarkedCopies[1].watermarkedSha256,
      watermarkCode: watermarkedCopies[1].watermarkCode,
      dispatchedWebhooks: 1,
      payload: {
        event: 'watermark.issued',
        watermark_code: watermarkedCopies[1].watermarkCode,
        error: 'One downstream webhook failed with HTTP 503',
      },
      createdAt: hoursAgoIso(14),
    },
  ];

  const activityLogs = [
    {
      id: 'act-1',
      actor: 'N. Kalyan Reddy',
      module: 'Document Upload',
      action: 'Registered Master PDF',
      resourceLabel: documents[0].fileName,
      outcome: 'Success' as const,
      metadataSummary: `SHA-256 ${documents[0].sha256Hash.slice(0, 16)}…`,
      createdAt: hoursAgoIso(72),
    },
    {
      id: 'act-2',
      actor: 'N. Kalyan Reddy',
      module: 'PDF Watermarking',
      action: 'Issued Recipient Copy',
      resourceLabel: `${watermarkedCopies[0].watermarkCode} → ${recipients[0].email}`,
      outcome: 'Success' as const,
      metadataSummary: `Watermarked SHA-256 ${watermarkedCopies[0].watermarkedSha256.slice(0, 16)}…`,
      createdAt: hoursAgoIso(32),
    },
    {
      id: 'act-3',
      actor: 'Forensic Verifier',
      module: 'Document Verification',
      action: 'Verified Suspect PDF',
      resourceLabel: verificationRecords[0].fileName,
      outcome: 'Success' as const,
      metadataSummary: `Attributed to ${recipients[0].fullName} (${watermarkedCopies[0].watermarkCode})`,
      createdAt: hoursAgoIso(10),
    },
    {
      id: 'act-4',
      actor: 'Demo SMTP Relay',
      module: 'Email Processing (Demo)',
      action: 'Processed Simulated Inbound Mail',
      resourceLabel: inboxes[0].aliasAddress,
      outcome: 'Success' as const,
      metadataSummary: `Extracted ${documents[0].fileName} · Dispatched webhook`,
      createdAt: hoursAgoIso(5),
    },
    {
      id: 'act-5',
      actor: 'Webhook Dispatcher',
      module: 'Webhook Delivery',
      action: 'Delivery Attempt Failed',
      resourceLabel: webhooks[1].name,
      outcome: 'Warning' as const,
      metadataSummary: 'HTTP 503 · Ready for manual retry',
      createdAt: hoursAgoIso(14),
    },
  ];

  return {
    documents: documents.map((d, idx) =>
      idx === 0 ? { ...d, isFavorite: true, lastViewedAt: hoursAgoIso(2) } : d
    ),
    recipients,
    watermarkedCopies,
    verificationRecords,
    inboxes,
    inboundEmails,
    webhooks,
    webhookDeliveries,
    pipelineEvents,
    activityLogs,
    notifications: createDefaultNotifications(),
    productivity: createDefaultProductivity(),
    exportedReportsCount: 0,
    settings: {
      displayName: 'N. Kalyan Reddy',
      email: 'kalyan.reddy@relay-security.example',
      role: 'Lead Systems Architect',
      organization: 'RelayWatermark Engineering Lab',
      avatarPreset: 'unknown',
      coverPreset: 'navy-mesh',
      theme,
      compactTables: false,
      defaultWatermark: { ...DEFAULT_WATERMARK_CONFIG },
      supabaseProjectLabel: 'relay-watermark-prod',
      personalization: {
        ...DEFAULT_PERSONALIZATION_CONFIG,
        themeMode: theme,
      },
    },
  };
}

export async function ensureSeedBinariesHydrated(state: SystemState): Promise<void> {
  // Regenerate deterministic sample PDFs for seeded documents if missing in current browser session
  for (const spec of SAMPLE_DOCS_SPEC) {
    const doc = state.documents.find((d) => d.id === spec.id);
    if (!doc) continue;
    const bytes = await generateSamplePdf({
      title: spec.title,
      classification: spec.classification,
      ownerName: spec.ownerName,
      sections: spec.sections,
    });
    savePdfBinary(`doc:${spec.id}`, bytes);
  }
}
