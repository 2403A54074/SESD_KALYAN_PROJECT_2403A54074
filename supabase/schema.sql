-- Supabase PostgreSQL Schema for:
-- Digital Document Watermarking & Ephemeral SMTP–Webhook Relay System
-- Designed for Supabase Auth (Email/Password + OAuth) & Strict Per-User Row Level Security (RLS)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 0. Individual User Profiles (linked 1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'Custodian Operator',
  organization TEXT NOT NULL DEFAULT '',
  avatar_preset TEXT NOT NULL DEFAULT 'unknown',
  custom_avatar_data_url TEXT,
  cover_preset TEXT NOT NULL DEFAULT 'navy-mesh',
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automatically provision a profile row whenever a new user signs up via Email or OAuth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role, organization, avatar_preset)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'user_name', ''),
      SPLIT_PART(COALESCE(NEW.email, 'user@workspace'), '@', 1)
    ),
    'Custodian Operator',
    COALESCE(NEW.raw_user_meta_data ->> 'organization', ''),
    'unknown'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 0b. Per-User Private Workspace State Store
CREATE TABLE IF NOT EXISTS public.user_workspaces (
  owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1. Master Documents Vault
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
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

CREATE INDEX IF NOT EXISTS idx_documents_owner ON public.documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_sha256 ON public.documents(sha256_hash);

-- 2. Authorized Recipients Directory
CREATE TABLE IF NOT EXISTS public.recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
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
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
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

CREATE INDEX IF NOT EXISTS idx_watermarked_owner ON public.watermarked_copies(owner_id);
CREATE INDEX IF NOT EXISTS idx_watermarked_sha256 ON public.watermarked_copies(watermarked_sha256);

-- 4. Verification Records
CREATE TABLE IF NOT EXISTS public.verification_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
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
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
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
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
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
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
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
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
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
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
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
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  actor TEXT NOT NULL,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_label TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('Success', 'Warning', 'Error')),
  metadata_summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS) on ALL tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_workspaces ENABLE ROW LEVEL SECURITY;
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

-- Strict Per-User Policies: each authenticated user can access ONLY their own rows
DROP POLICY IF EXISTS "profiles_own_all" ON public.profiles;
CREATE POLICY "profiles_own_all" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "user_workspaces_own_all" ON public.user_workspaces;
CREATE POLICY "user_workspaces_own_all" ON public.user_workspaces
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "documents_own_all" ON public.documents;
CREATE POLICY "documents_own_all" ON public.documents
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "recipients_own_all" ON public.recipients;
CREATE POLICY "recipients_own_all" ON public.recipients
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "watermarked_copies_own_all" ON public.watermarked_copies;
CREATE POLICY "watermarked_copies_own_all" ON public.watermarked_copies
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "verification_records_own_all" ON public.verification_records;
CREATE POLICY "verification_records_own_all" ON public.verification_records
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "ephemeral_inboxes_own_all" ON public.ephemeral_inboxes;
CREATE POLICY "ephemeral_inboxes_own_all" ON public.ephemeral_inboxes
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "inbound_emails_own_all" ON public.inbound_emails;
CREATE POLICY "inbound_emails_own_all" ON public.inbound_emails
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "webhooks_own_all" ON public.webhooks;
CREATE POLICY "webhooks_own_all" ON public.webhooks
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "webhook_deliveries_own_all" ON public.webhook_deliveries;
CREATE POLICY "webhook_deliveries_own_all" ON public.webhook_deliveries
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "pipeline_events_own_all" ON public.pipeline_events;
CREATE POLICY "pipeline_events_own_all" ON public.pipeline_events
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "activity_logs_own_all" ON public.activity_logs;
CREATE POLICY "activity_logs_own_all" ON public.activity_logs
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
