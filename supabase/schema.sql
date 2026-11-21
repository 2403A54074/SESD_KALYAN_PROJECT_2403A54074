-- Supabase PostgreSQL Schema for:
-- Digital Document Watermarking & Ephemeral SMTP–Webhook Relay System
-- Note: Designed for Supabase Auth + Row Level Security (RLS)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Master Documents Vault
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  classification TEXT NOT NULL CHECK (classification IN ('Confidential', 'Restricted', 'Internal', 'Board Only')),
  sha256_hash CHAR(64) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 1,
  owner_name TEXT NOT NULL,
  notes TEXT DEFAULT '',
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_sha256 ON public.documents(sha256_hash);

-- 2. Authorized Recipients Directory
CREATE TABLE IF NOT EXISTS public.recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT NOT NULL,
  department TEXT NOT NULL,
  clearance TEXT NOT NULL CHECK (clearance IN ('Executive', 'Legal', 'Security', 'External Partner', 'Auditor')),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipients_owner_email ON public.recipients(owner_id, email);

-- 3. Watermarked Document Copies
CREATE TABLE IF NOT EXISTS public.watermarked_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watermark_code TEXT NOT NULL UNIQUE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.recipients(id) ON DELETE CASCADE,
  original_sha256 CHAR(64) NOT NULL,
  watermarked_sha256 CHAR(64) NOT NULL,
  overlay_text TEXT NOT NULL,
  color_preset TEXT NOT NULL,
  opacity NUMERIC(3,2) NOT NULL,
  rotation_deg INTEGER NOT NULL,
  font_size INTEGER NOT NULL,
  include_footer_stamp BOOLEAN NOT NULL DEFAULT TRUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watermarked_sha256 ON public.watermarked_copies(watermarked_sha256);

-- 4. Verification Records
CREATE TABLE IF NOT EXISTS public.verification_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  computed_sha256 CHAR(64) NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('Watermarked Match', 'Original Master Match', 'Metadata Attribution Match', 'Unregistered')),
  matched_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  matched_watermark_id UUID REFERENCES public.watermarked_copies(id) ON DELETE SET NULL,
  matched_recipient_id UUID REFERENCES public.recipients(id) ON DELETE SET NULL,
  details TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Ephemeral SMTP Inboxes (Requires external MTA / Postfix / Haraka / Mailgun MX worker in production)
CREATE TABLE IF NOT EXISTS public.ephemeral_inboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_address TEXT NOT NULL UNIQUE,
  bound_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  bound_recipient_id UUID REFERENCES public.recipients(id) ON DELETE SET NULL,
  auto_watermark BOOLEAN NOT NULL DEFAULT TRUE,
  ttl_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Expired', 'Revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Inbound Email Processing Queue
CREATE TABLE IF NOT EXISTS public.inbound_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id UUID NOT NULL REFERENCES public.ephemeral_inboxes(id) ON DELETE CASCADE,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_preview TEXT NOT NULL,
  attachment_name TEXT,
  attachment_sha256 CHAR(64),
  generated_watermark_code TEXT,
  processing_mode TEXT NOT NULL DEFAULT 'demo' CHECK (processing_mode IN ('demo', 'live_mta')),
  pipeline_status TEXT NOT NULL CHECK (pipeline_status IN ('Processed', 'Rejected', 'Failed')),
  raw_headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Webhook Endpoints
CREATE TABLE IF NOT EXISTS public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  target_url TEXT NOT NULL,
  signing_secret_hint TEXT NOT NULL,
  subscribed_events TEXT[] NOT NULL DEFAULT '{}',
  max_retries INTEGER NOT NULL DEFAULT 3,
  timeout_ms INTEGER NOT NULL DEFAULT 5000,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Webhook Delivery Logs
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  delivery_mode TEXT NOT NULL CHECK (delivery_mode IN ('simulated', 'live_fetch')),
  http_status INTEGER,
  latency_ms INTEGER NOT NULL,
  signature_header TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Delivered', 'Failed', 'Retrying')),
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Central Pipeline Events
CREATE TABLE IF NOT EXISTS public.pipeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source_module TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Completed', 'Processing', 'Queued', 'Failed')),
  sha256_ref CHAR(64),
  watermark_code TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Activity & Audit Logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor TEXT NOT NULL,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_label TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('Success', 'Warning', 'Error')),
  metadata_summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watermarked_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ephemeral_inboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
