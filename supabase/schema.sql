-- Supabase PostgreSQL Schema for:
-- Digital Document Watermarking & Verification System
-- Single-User Workspace Persistence with Strict Row Level Security (RLS)
-- Additive & non-destructive: preserves all existing tables and data.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 0. User Workspace Profile (linked 1:1 with auth.users, including Anonymous Auth sessions)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT 'Workspace Custodian',
  role TEXT NOT NULL DEFAULT 'Document Custodian',
  organization TEXT NOT NULL DEFAULT '',
  avatar_preset TEXT NOT NULL DEFAULT 'unknown',
  avatar_url TEXT,
  custom_avatar_data_url TEXT,
  cover_preset TEXT NOT NULL DEFAULT 'navy-mesh',
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_name TEXT;
BEGIN
  v_email := COALESCE(NEW.email, '');
  v_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
    NULLIF(SPLIT_PART(v_email, '@', 1), ''),
    'Workspace Custodian'
  );

  INSERT INTO public.profiles (id, email, display_name, role, organization, avatar_preset)
  VALUES (
    NEW.id,
    v_email,
    v_name,
    'Document Custodian',
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

-- 0b. Per-Workspace Preferences Store
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

-- 2. Authorized Recipients Directory (No default sample rows)
CREATE TABLE IF NOT EXISTS public.recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  recipient_code TEXT NOT NULL DEFAULT '',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT 'General',
  clearance TEXT NOT NULL DEFAULT 'External Partner' CHECK (clearance IN ('Executive', 'Legal', 'Security', 'External Partner', 'Auditor')),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS recipient_code TEXT NOT NULL DEFAULT '';
ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT '';
ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.recipients ALTER COLUMN department SET DEFAULT 'General';
ALTER TABLE public.recipients ALTER COLUMN clearance SET DEFAULT 'External Partner';
ALTER TABLE public.recipients ALTER COLUMN organization SET DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipients_owner_email ON public.recipients(owner_id, email);

-- 3. Watermarked Document Copies (Recipient-to-Document Attribution Ledger)
CREATE TABLE IF NOT EXISTS public.watermarked_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  watermark_code TEXT NOT NULL UNIQUE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  document_title TEXT NOT NULL DEFAULT '',
  recipient_id UUID NOT NULL REFERENCES public.recipients(id) ON DELETE CASCADE,
  recipient_code TEXT NOT NULL DEFAULT '',
  recipient_name TEXT NOT NULL DEFAULT '',
  recipient_email TEXT NOT NULL DEFAULT '',
  original_sha256 CHAR(64) NOT NULL,
  watermarked_sha256 CHAR(64) NOT NULL,
  overlay_text TEXT NOT NULL,
  color_preset TEXT NOT NULL,
  opacity NUMERIC(3,2) NOT NULL,
  rotation_deg INTEGER NOT NULL,
  font_size INTEGER NOT NULL,
  include_footer_stamp BOOLEAN NOT NULL DEFAULT TRUE,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.watermarked_copies ADD COLUMN IF NOT EXISTS document_title TEXT NOT NULL DEFAULT '';
ALTER TABLE public.watermarked_copies ADD COLUMN IF NOT EXISTS recipient_code TEXT NOT NULL DEFAULT '';
ALTER TABLE public.watermarked_copies ADD COLUMN IF NOT EXISTS recipient_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.watermarked_copies ADD COLUMN IF NOT EXISTS recipient_email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.watermarked_copies ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.watermarked_copies ADD COLUMN IF NOT EXISTS issue_date DATE NOT NULL DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_watermarked_owner ON public.watermarked_copies(owner_id);
CREATE INDEX IF NOT EXISTS idx_watermarked_sha256 ON public.watermarked_copies(watermarked_sha256);

-- 4. Verification Records
CREATE TABLE IF NOT EXISTS public.verification_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  file_name TEXT NOT NULL,
  computed_sha256 CHAR(64) NOT NULL,
  outcome TEXT NOT NULL,
  matched_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  matched_document_title TEXT,
  matched_watermark_id UUID REFERENCES public.watermarked_copies(id) ON DELETE SET NULL,
  matched_watermark_code TEXT,
  matched_recipient_id UUID REFERENCES public.recipients(id) ON DELETE SET NULL,
  matched_recipient_code TEXT,
  matched_recipient_name TEXT,
  matched_recipient_email TEXT,
  matched_recipient_organization TEXT,
  matched_recipient_role TEXT,
  matched_issue_date DATE,
  details TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.verification_records ADD COLUMN IF NOT EXISTS matched_document_title TEXT;
ALTER TABLE public.verification_records ADD COLUMN IF NOT EXISTS matched_watermark_code TEXT;
ALTER TABLE public.verification_records ADD COLUMN IF NOT EXISTS matched_recipient_code TEXT;
ALTER TABLE public.verification_records ADD COLUMN IF NOT EXISTS matched_recipient_name TEXT;
ALTER TABLE public.verification_records ADD COLUMN IF NOT EXISTS matched_recipient_email TEXT;
ALTER TABLE public.verification_records ADD COLUMN IF NOT EXISTS matched_recipient_organization TEXT;
ALTER TABLE public.verification_records ADD COLUMN IF NOT EXISTS matched_recipient_role TEXT;
ALTER TABLE public.verification_records ADD COLUMN IF NOT EXISTS matched_issue_date DATE;
ALTER TABLE public.verification_records DROP CONSTRAINT IF EXISTS verification_records_outcome_check;
ALTER TABLE public.verification_records
  ADD CONSTRAINT verification_records_outcome_check
  CHECK (outcome IN (
    'Original Master Match',
    'Watermarked Copy Match',
    'Modified or Unregistered File',
    'Original Match',
    'Watermarked Match',
    'Unregistered',
    'Metadata Attribution Match'
  ));

CREATE INDEX IF NOT EXISTS idx_verification_owner ON public.verification_records(owner_id);

-- 5. Activity & Audit Logs
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

CREATE INDEX IF NOT EXISTS idx_activity_owner ON public.activity_logs(owner_id);

-- Strict Row Level Security (RLS): Never make tables publicly writable (never use USING (true))
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watermarked_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "activity_logs_own_all" ON public.activity_logs;
CREATE POLICY "activity_logs_own_all" ON public.activity_logs
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
