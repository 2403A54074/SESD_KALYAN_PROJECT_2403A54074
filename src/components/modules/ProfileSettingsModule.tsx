import React, { useEffect, useRef, useState } from 'react';
import { Camera, Database, Download, Palette, Trash2, User } from 'lucide-react';
import portraitAvatarSrc from '../../assets/images/avatar_system_engineer_1795256718084.jpg';
import { useSystem } from '../../context/SystemContext';
import { getStorageMode } from '../../lib/supabaseClient';
import { systemRepository } from '../../services/repository';
import type { AvatarPreset, ThemeMode, WatermarkColorPreset } from '../../types/system';
import { ModulePageHeader } from '../ui/CommonUI';

const PORTRAIT_SRC = portraitAvatarSrc;

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

  const { avatarPreset, customAvatarDataUrl, displayName } = state.settings;

  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'W';

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

  return (
    <div
      className={`${sizeClass} flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700 shrink-0`}
      aria-label="Default profile avatar"
    >
      <User className="h-1/2 w-1/2" />
    </div>
  );
};

export const ProfileSettingsModule: React.FC = () => {
  const {
    supabaseOwnerId,
    state,
    updateSettings,
    setThemeMode,
    clearAllData,
    pushToast,
  } = useSystem();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(state.settings.displayName);
  const [role, setRole] = useState(state.settings.role);
  const [organization, setOrganization] = useState(state.settings.organization);
  const [compactTables, setCompactTables] = useState(state.settings.compactTables);
  const [defaultTemplate, setDefaultTemplate] = useState(
    state.settings.defaultWatermark.overlayTemplate
  );
  const [defaultColor, setDefaultColor] = useState<WatermarkColorPreset>(
    state.settings.defaultWatermark.colorPreset
  );
  const [defaultOpacity, setDefaultOpacity] = useState(state.settings.defaultWatermark.opacity);

  const [supabaseCheckResult, setSupabaseCheckResult] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setDisplayName(state.settings.displayName);
    setRole(state.settings.role);
    setOrganization(state.settings.organization);
    setCompactTables(state.settings.compactTables);
    setDefaultTemplate(state.settings.defaultWatermark.overlayTemplate);
    setDefaultColor(state.settings.defaultWatermark.colorPreset);
    setDefaultOpacity(state.settings.defaultWatermark.opacity);
  }, [state]);

  const storageInfo = getStorageMode();

  const handleDpUpload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      pushToast({
        title: 'Invalid Image',
        description: 'Select a PNG, JPG, or WebP image.',
        variant: 'error',
      });
      return;
    }
    try {
      const dataUrl = await resizeImageToAvatarDataUrl(file);
      updateSettings({
        avatarPreset: 'custom',
        customAvatarDataUrl: dataUrl,
      });
      pushToast({ title: 'Profile Picture Updated', variant: 'success' });
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
      displayName: displayName.trim() || 'Workspace Custodian',
      role: role.trim() || 'Document Custodian',
      organization: organization.trim(),
      compactTables,
      defaultWatermark: {
        ...state.settings.defaultWatermark,
        overlayTemplate: defaultTemplate,
        colorPreset: defaultColor,
        opacity: defaultOpacity,
      },
    });
  };

  const handleExportWorkspaceData = () => {
    const bundle = {
      exportedAt: new Date().toISOString(),
      profile: {
        displayName: state.settings.displayName,
        role: state.settings.role,
        organization: state.settings.organization,
      },
      documents: state.documents,
      recipients: state.recipients,
      watermarkedCopies: state.watermarkedCopies,
      verificationRecords: state.verificationRecords,
      activityLogs: state.activityLogs,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workspace-backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2500);
    pushToast({ title: 'Workspace Data Exported', variant: 'success' });
  };

  return (
    <div>
      <ModulePageHeader
        title="Profile & Settings"
        description="Manage your display name, profile picture, theme preference, basic workspace preferences, data export, and workspace reset."
      />

      {/* Profile Header Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <AvatarDisplay sizeClass="h-16 w-16" textSizeClass="text-lg" />
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {state.settings.displayName}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {state.settings.role}
              {state.settings.organization ? ` · ${state.settings.organization}` : ''}
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
            <span>Upload Photo</span>
          </button>
          <select
            aria-label="Profile picture style"
            value={state.settings.avatarPreset}
            onChange={(e) => updateSettings({ avatarPreset: e.target.value as AvatarPreset })}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200"
          >
            {state.settings.customAvatarDataUrl && <option value="custom">Uploaded Photo</option>}
            <option value="unknown">Default Silhouette</option>
            <option value="initials">Monogram Initials</option>
            <option value="cyan-crest">Cyan Crest</option>
            <option value="violet-crest">Violet Crest</option>
            <option value="portrait">Studio Portrait</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Profile Form & Workspace Preferences */}
        <form
          onSubmit={handleSaveProfile}
          className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Profile &amp; Workspace Preferences
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter display name"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Role / Title
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g., Examination Coordinator"
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
                placeholder="Institution or company name"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={compactTables}
                onChange={(e) => setCompactTables(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 accent-cyan-600"
              />
              <span>Use compact table row spacing</span>
            </label>

            <div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white mb-2">
                Default Watermark Styling
              </h3>
              <input
                type="text"
                value={defaultTemplate}
                onChange={(e) => setDefaultTemplate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 mb-3"
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
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-semibold text-white"
            >
              Save Preferences
            </button>
          </div>
        </form>

        {/* Right Column: Theme, Data Management, Developer Credit */}
        <div className="lg:col-span-5 space-y-5">
          {/* Theme Preference */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Palette className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <span>Theme</span>
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {(['dark', 'light', 'system'] as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setThemeMode(mode)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-colors ${
                    state.settings.themeMode === mode
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Data Export & Workspace Reset */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <span>Storage, Export &amp; Reset</span>
            </h2>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs">
              <span className="font-medium text-slate-800 dark:text-slate-200">Persistence Mode</span>
              <span className="font-mono text-[11px] text-slate-500">
                {storageInfo.mode === 'supabase' && supabaseOwnerId
                  ? 'Supabase RLS + IndexedDB'
                  : 'Browser + IndexedDB'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  const res = await systemRepository.checkSupabaseHealth(supabaseOwnerId);
                  setSupabaseCheckResult(res.message);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                <Database className="h-3.5 w-3.5" />
                <span>Check Database</span>
              </button>
              <button
                type="button"
                onClick={handleExportWorkspaceData}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 px-3 py-1.5 text-xs font-medium text-white"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export Data</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 dark:border-rose-900 px-3 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Reset Workspace</span>
              </button>
            </div>
            {supabaseCheckResult && (
              <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5">
                {supabaseCheckResult}
              </p>
            )}
            {confirmClear && (
              <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs space-y-2.5">
                <p className="font-medium text-amber-950 dark:text-amber-200">
                  Reset workspace and remove all uploaded documents, recipients, watermarked copies, and verification records?
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await clearAllData();
                      setConfirmClear(false);
                    }}
                    className="rounded-md bg-rose-600 text-white px-3 py-1 text-xs font-semibold"
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1 text-xs font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Permanent Developer Attribution */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Developer Attribution
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-white">
                Developed by Kalyan Reddy
              </p>
            </div>
            <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400">
              v2.1
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
