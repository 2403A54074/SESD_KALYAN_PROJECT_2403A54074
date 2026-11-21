import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Database,
  Download,
  RotateCcw,
  Shield,
  Trash2,
  User,
} from 'lucide-react';
import portraitAvatarSrc from '../../assets/images/avatar_system_engineer_1795256718084.jpg';
import { useSystem } from '../../context/SystemContext';
import { getStorageMode } from '../../lib/supabaseClient';
import { systemRepository } from '../../services/repository';
import type { AvatarPreset, ProfileCoverPreset, WatermarkColorPreset } from '../../types/system';
import { ModulePageHeader } from '../ui/CommonUI';

const PORTRAIT_SRC = portraitAvatarSrc;

const COVER_STYLES: Record<ProfileCoverPreset, { label: string; bg: string }> = {
  'navy-mesh': {
    label: 'Deep Navy Mesh',
    bg: 'bg-gradient-to-r from-[#0B1120] via-[#13203A] to-[#0F172A]',
  },
  'cyan-horizon': {
    label: 'Cyan Horizon',
    bg: 'bg-gradient-to-r from-[#0B1120] via-[#0E3A4A] to-[#164E63]',
  },
  'violet-aurora': {
    label: 'Violet Aurora',
    bg: 'bg-gradient-to-r from-[#111827] via-[#2E1065] to-[#1E1B4B]',
  },
  'charcoal-grid': {
    label: 'Charcoal Minimal',
    bg: 'bg-gradient-to-r from-[#111827] via-[#1F2937] to-[#0F172A]',
  },
};

async function resizeImageToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported or corrupt image file.'));
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable.'));
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/webp', 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export const AvatarDisplay: React.FC<{
  sizeClass?: string;
  textSizeClass?: string;
}> = ({ sizeClass = 'h-16 w-16', textSizeClass = 'text-lg' }) => {
  const { state } = useSystem();
  const [portraitFailed, setPortraitFailed] = useState(false);

  if (!state) return null;
  const { avatarPreset, customAvatarDataUrl, displayName } = state.settings;

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';

  if (avatarPreset === 'custom' && customAvatarDataUrl) {
    return (
      <img
        src={customAvatarDataUrl}
        alt={displayName}
        className={`${sizeClass} rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0`}
      />
    );
  }

  if (avatarPreset === 'portrait' && !portraitFailed) {
    return (
      <img
        src={PORTRAIT_SRC}
        alt={displayName}
        referrerPolicy="no-referrer"
        onError={() => setPortraitFailed(true)}
        className={`${sizeClass} rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0`}
      />
    );
  }

  if (avatarPreset === 'initials') {
    return (
      <div
        className={`${sizeClass} flex items-center justify-center rounded-xl bg-slate-900 dark:bg-slate-800 text-cyan-400 font-semibold ${textSizeClass} border border-slate-700 shrink-0`}
      >
        {initials}
      </div>
    );
  }

  if (avatarPreset === 'cyan-crest') {
    return (
      <div
        className={`${sizeClass} flex items-center justify-center rounded-xl bg-cyan-600/20 text-cyan-400 font-semibold ${textSizeClass} border border-cyan-500/40 shrink-0`}
      >
        {initials}
      </div>
    );
  }

  if (avatarPreset === 'violet-crest') {
    return (
      <div
        className={`${sizeClass} flex items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 font-semibold ${textSizeClass} border border-violet-500/40 shrink-0`}
      >
        {initials}
      </div>
    );
  }

  // Default: 'unknown' neutral silhouette avatar
  return (
    <div
      className={`${sizeClass} flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700 shrink-0`}
      aria-label="Default unknown profile avatar"
    >
      <User className="h-1/2 w-1/2" />
    </div>
  );
};

export const ProfileSettingsModule: React.FC = () => {
  const {
    state,
    updateSettings,
    updatePersonalization,
    resetDemoData,
    clearAllData,
    pushToast,
  } = useSystem();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(state?.settings.displayName || 'Workspace User');
  const [email, setEmail] = useState(state?.settings.email || '');
  const [role, setRole] = useState(state?.settings.role || 'Custodian Operator');
  const [organization, setOrganization] = useState(state?.settings.organization || '');
  const [defaultTemplate, setDefaultTemplate] = useState(
    state?.settings.defaultWatermark.overlayTemplate || ''
  );
  const [defaultColor, setDefaultColor] = useState<WatermarkColorPreset>(
    state?.settings.defaultWatermark.colorPreset || 'cyan'
  );
  const [defaultOpacity, setDefaultOpacity] = useState(
    state?.settings.defaultWatermark.opacity || 0.22
  );

  const [supabaseCheckResult, setSupabaseCheckResult] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'reset' | 'clear' | null>(null);

  useEffect(() => {
    if (!state) return;
    setDisplayName(state.settings.displayName || 'Workspace User');
    setEmail(state.settings.email || '');
    setRole(state.settings.role || 'Custodian Operator');
    setOrganization(state.settings.organization || '');
    setDefaultTemplate(state.settings.defaultWatermark.overlayTemplate || '');
    setDefaultColor(state.settings.defaultWatermark.colorPreset || 'cyan');
    setDefaultOpacity(state.settings.defaultWatermark.opacity || 0.22);
  }, [state]);

  if (!state) return null;

  const storageInfo = getStorageMode();
  const p = state.settings.personalization;
  const coverStyle = COVER_STYLES[state.settings.coverPreset || 'navy-mesh'];

  const handleDpUpload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      pushToast({ title: 'Invalid Image', description: 'Select a PNG, JPG, or WebP image.', variant: 'error' });
      return;
    }
    try {
      const dataUrl = await resizeImageToAvatarDataUrl(file);
      updateSettings({
        avatarPreset: 'custom',
        customAvatarDataUrl: dataUrl,
      });
      pushToast({ title: 'Display Picture Updated', variant: 'success' });
    } catch (err) {
      pushToast({
        title: 'Upload Failed',
        description: err instanceof Error ? err.message : 'Unable to process image.',
        variant: 'error',
      });
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      displayName: displayName.trim() || 'Workspace User',
      email: email.trim(),
      role: role.trim() || 'Custodian Operator',
      organization: organization.trim(),
      defaultWatermark: {
        ...state.settings.defaultWatermark,
        overlayTemplate: defaultTemplate,
        colorPreset: defaultColor,
        opacity: defaultOpacity,
      },
    });
  };

  const handleExportPersonalData = () => {
    const bundle = {
      exportedAt: new Date().toISOString(),
      profile: {
        displayName: state.settings.displayName,
        email: state.settings.email,
        role: state.settings.role,
        organization: state.settings.organization,
        avatarPreset: state.settings.avatarPreset,
        coverPreset: state.settings.coverPreset,
      },
      personalization: state.settings.personalization,
      productivity: state.productivity,
      counts: {
        documents: state.documents.length,
        watermarkedCopies: state.watermarkedCopies.length,
        recipients: state.recipients.length,
        activityLogs: state.activityLogs.length,
      },
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'personal-workspace-export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2500);
    pushToast({ title: 'Personal Data Exported', variant: 'success' });
  };

  return (
    <div>
      <ModulePageHeader
        title="Profile & Personal Workspace"
        description="Customize your display picture (Unknown default or custom upload), profile cover, connected providers, session hygiene, privacy controls, and data exports."
      />

      {/* Profile Cover & DP Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-hidden mb-6">
        <div className={`h-28 w-full ${coverStyle.bg} relative px-6 flex items-end justify-between pb-3`}>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(COVER_STYLES) as ProfileCoverPreset[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => updateSettings({ coverPreset: key })}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  state.settings.coverPreset === key
                    ? 'bg-white text-slate-900'
                    : 'bg-slate-950/50 text-slate-200 hover:bg-slate-950/75'
                }`}
              >
                {COVER_STYLES[key].label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <AvatarDisplay sizeClass="h-16 w-16" textSizeClass="text-lg" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {state.settings.displayName}
              </h2>
              {state.settings.email && (
                <p className="text-xs font-mono text-slate-600 dark:text-slate-300">
                  {state.settings.email}
                </p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {state.settings.role}
                {state.settings.organization ? ` · ${state.settings.organization}` : ''}
              </p>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                DP Mode:{' '}
                {state.settings.avatarPreset === 'unknown'
                  ? 'Default (Unknown)'
                  : state.settings.avatarPreset}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleDpUpload(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white"
            >
              <Camera className="h-3.5 w-3.5" />
              <span>Upload DP</span>
            </button>
            <button
              type="button"
              onClick={() => updateSettings({ avatarPreset: 'unknown' })}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Keep Unknown Default
            </button>
            <select
              aria-label="Avatar style preset"
              value={state.settings.avatarPreset}
              onChange={(e) => updateSettings({ avatarPreset: e.target.value as AvatarPreset })}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="unknown">Unknown (Default)</option>
              {state.settings.customAvatarDataUrl && <option value="custom">Uploaded Custom DP</option>}
              <option value="initials">Monogram Initials</option>
              <option value="cyan-crest">Cyan Crest</option>
              <option value="violet-crest">Violet Crest</option>
              <option value="portrait">Studio Portrait</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Profile Form & Watermark Defaults */}
        <form
          onSubmit={handleSaveProfile}
          className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Identity &amp; Watermark Policy
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Custodian Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Role Title
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Organization
              </label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
              Default Watermark Policy
            </h3>
            <input
              type="text"
              value={defaultTemplate}
              onChange={(e) => setDefaultTemplate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <select
                value={defaultColor}
                onChange={(e) => setDefaultColor(e.target.value as WatermarkColorPreset)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="cyan">Cyan</option>
                <option value="violet">Violet</option>
                <option value="navy">Navy</option>
                <option value="crimson">Crimson</option>
              </select>
              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span>Opacity</span>
                  <span>{Math.round(defaultOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.08}
                  max={0.45}
                  step={0.02}
                  value={defaultOpacity}
                  onChange={(e) => setDefaultOpacity(parseFloat(e.target.value))}
                  className="w-full accent-cyan-600"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-semibold text-white"
            >
              Save Profile &amp; Defaults
            </button>
          </div>
        </form>

        {/* Right Column: Privacy, Auth Providers, Sessions, Data Export & Deletion */}
        <div className="lg:col-span-5 space-y-5">
          {/* Privacy Controls */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <span>Privacy Controls</span>
            </h2>
            {(
              [
                ['maskRecipientEmails', 'Mask recipient emails in Dashboard overview'],
                ['truncateHashesInOverview', 'Truncate SHA-256 digests in summary views'],
                ['localAnalyticsOptIn', 'Track local achievement & productivity stats'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={p.privacy[key]}
                  onChange={(e) =>
                    updatePersonalization({
                      privacy: { ...p.privacy, [key]: e.target.checked },
                    })
                  }
                  className="accent-cyan-600"
                />
              </label>
            ))}
          </div>

          {/* Repository Storage Status */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              <span>Workspace Storage &amp; Supabase Health</span>
            </h2>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs">
              <span className="font-medium text-slate-800 dark:text-slate-200">Storage Mode</span>
              <span className="font-mono text-[11px] text-slate-500">
                {storageInfo.mode === 'supabase' ? 'Supabase Client Ready' : 'Local Browser Repository'}
              </span>
            </div>
            <button
              type="button"
              onClick={async () => {
                const res = await systemRepository.checkSupabaseHealth();
                setSupabaseCheckResult(res.message);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <Database className="h-3.5 w-3.5" />
              <span>Verify Supabase Connection</span>
            </button>
            {supabaseCheckResult && (
              <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5">
                {supabaseCheckResult}
              </p>
            )}
          </div>

          {/* Export Personal Data & Workspace Reset */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Personal Data Export &amp; Workspace Reset
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportPersonalData}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 px-3 py-1.5 text-xs font-medium text-white"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export Personal Data</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction('reset')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Restore Demo Seed</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction('clear')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 dark:border-rose-900 px-3 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear Workspace Data</span>
              </button>
            </div>

            {confirmAction && (
              <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs space-y-2.5">
                <p className="font-medium text-amber-950 dark:text-amber-200">
                  {confirmAction === 'reset'
                    ? 'Restore initial seeded documents and logs?'
                    : 'Permanently delete all local workspace data and reset profile to empty state?'}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (confirmAction === 'reset') await resetDemoData();
                      else await clearAllData();
                      setConfirmAction(null);
                    }}
                    className="rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3 py-1 text-xs font-semibold"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmAction(null)}
                    className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1 text-xs font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Permanent System Developer Credit (non-editable, visible for every account) */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                System Attribution
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-white">
                Developed by Kalyan Reddy
              </p>
            </div>
            <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400">
              v2.0
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
