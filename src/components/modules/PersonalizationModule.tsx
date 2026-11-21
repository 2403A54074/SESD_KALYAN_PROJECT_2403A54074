import React from 'react';
import { Accessibility, Eye, Globe, Layout, Monitor, Moon, Palette, Sparkles, Sun } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import type {
  AccentColorId,
  AnimationIntensity,
  DashboardLayoutMode,
  FontSizeScale,
  LanguageCode,
  SidebarAppearance,
  ThemeMode,
} from '../../types/system';
import { ModulePageHeader } from '../ui/CommonUI';

const ACCENT_OPTIONS: { id: AccentColorId; label: string; hex: string }[] = [
  { id: 'cyan', label: 'Cyan', hex: '#06b6d4' },
  { id: 'violet', label: 'Violet', hex: '#7c3aed' },
  { id: 'emerald', label: 'Emerald', hex: '#10b981' },
  { id: 'indigo', label: 'Indigo', hex: '#4f46e5' },
];

export const PersonalizationModule: React.FC = () => {
  const { state, updatePersonalization, pushToast } = useSystem();
  if (!state) return null;

  const p = state.settings.personalization;

  return (
    <div>
      <ModulePageHeader
        title="Personalization Studio"
        description="Customize theme mode, accent palette, sidebar and dashboard layout, typography scale, ambient visual effects, browser branding, and accessibility."
        actions={
          <button
            type="button"
            onClick={() =>
              pushToast({
                title: 'Personalization Synced',
                description: 'All appearance preferences saved to your workspace profile.',
                variant: 'success',
              })
            }
            className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap"
          >
            Confirm Preferences
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Theme & Accent */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Theme &amp; Accent Palette
            </h2>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">Color Mode</p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'dark', label: 'Dark', icon: Moon },
                  { id: 'light', label: 'Light', icon: Sun },
                  { id: 'system', label: 'System', icon: Monitor },
                ] as { id: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }[]
              ).map((opt) => {
                const Icon = opt.icon;
                const active = p.themeMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updatePersonalization({ themeMode: opt.id })}
                    className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
              Primary Accent Color
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ACCENT_OPTIONS.map((acc) => {
                const active = p.accentColor === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => updatePersonalization({ accentColor: acc.id, faviconAccent: acc.id })}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      active
                        ? 'border-cyan-500 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span
                      className="h-3 w-3 rounded-sm shrink-0"
                      style={{ backgroundColor: acc.hex }}
                    />
                    <span>{acc.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Sidebar Appearance
              </label>
              <select
                value={p.sidebarAppearance}
                onChange={(e) =>
                  updatePersonalization({ sidebarAppearance: e.target.value as SidebarAppearance })
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="default">Solid Navy / Crisp White</option>
                <option value="compact">Compact Rail</option>
                <option value="translucent">Translucent Slate Glass</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Interface Density
              </label>
              <select
                value={p.density}
                onChange={(e) =>
                  updatePersonalization({ density: e.target.value as 'comfortable' | 'compact' })
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact High-Density</option>
              </select>
            </div>
          </div>
        </section>

        {/* Dashboard Layout & Widgets */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Layout className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Dashboard Layout &amp; Widgets
            </h2>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Dashboard Arrangement
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'standard', label: 'Standard' },
                  { id: 'compact', label: 'Compact Grid' },
                  { id: 'focus', label: 'Metrics Focus' },
                ] as { id: DashboardLayoutMode; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updatePersonalization({ dashboardLayout: opt.id })}
                  className={`rounded-lg border py-2 text-xs font-medium ${
                    p.dashboardLayout === opt.id
                      ? 'border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Visible Dashboard Widgets
            </p>
            {(
              [
                ['showKpis', 'Primary KPI Summary Strip'],
                ['showThroughputChart', 'Subsystem Pipeline Throughput Chart'],
                ['showShortcuts', 'Operational Workflow Shortcuts'],
                ['showFavoritesAndTasks', 'Favorite Documents & Daily Tasks Strip'],
                ['showRecentActivity', 'Recent System Activity Table'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 cursor-pointer py-1">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={p.dashboardWidgets[key]}
                  onChange={(e) =>
                    updatePersonalization({
                      dashboardWidgets: { ...p.dashboardWidgets, [key]: e.target.checked },
                    })
                  }
                  className="accent-cyan-600"
                />
              </label>
            ))}
          </div>
        </section>

        {/* Ambient Visual Experience & Accessibility */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Ambient Visual Effects &amp; Motion
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Animation Intensity
              </label>
              <select
                value={p.animationIntensity}
                onChange={(e) =>
                  updatePersonalization({ animationIntensity: e.target.value as AnimationIntensity })
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="subtle">Subtle (Recommended)</option>
                <option value="expressive">Expressive</option>
                <option value="none">None (Static)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Typography Scale
              </label>
              <select
                value={p.fontSize}
                onChange={(e) =>
                  updatePersonalization({ fontSize: e.target.value as FontSizeScale })
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="sm">Compact (14px base)</option>
                <option value="md">Standard (16px base)</option>
                <option value="lg">Large Accessible (17.5px base)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 cursor-pointer py-1">
              <span className="inline-flex items-center gap-2">
                <Accessibility className="h-3.5 w-3.5 text-cyan-500" />
                <span>Reduced-Motion Accessibility Mode</span>
              </span>
              <input
                type="checkbox"
                checked={p.reducedMotion}
                onChange={(e) => updatePersonalization({ reducedMotion: e.target.checked })}
                className="accent-cyan-600"
              />
            </label>

            {(
              [
                ['particles', 'Animated Particle Canvas Background'],
                ['gradientMovement', 'Subtle Ambient Gradient Glow'],
                ['visualizer', 'Live Web Audio Frequency Visualizer'],
                ['pageTransitions', 'Smooth Module View Transitions'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 cursor-pointer py-1">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={p.ambientEffects[key]}
                  onChange={(e) =>
                    updatePersonalization({
                      ambientEffects: { ...p.ambientEffects, [key]: e.target.checked },
                    })
                  }
                  className="accent-cyan-600"
                />
              </label>
            ))}
          </div>
        </section>

        {/* Browser Branding & Language */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Language, Browser Title &amp; Favicon
            </h2>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Interface Language
            </label>
            <select
              value={p.language}
              onChange={(e) => updatePersonalization({ language: e.target.value as LanguageCode })}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="en">English (EN)</option>
              <option value="hi">हिन्दी (HI)</option>
              <option value="es">Español (ES)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Browser Tab Title
            </label>
            <input
              type="text"
              value={p.browserTitle}
              onChange={(e) => updatePersonalization({ browserTitle: e.target.value })}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Dynamic SVG Favicon Accent
            </label>
            <div className="flex items-center gap-2">
              {ACCENT_OPTIONS.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => updatePersonalization({ faviconAccent: acc.id })}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                    p.faviconAccent === acc.id
                      ? 'border-cyan-500 bg-cyan-500/10 text-slate-900 dark:text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Eye className="h-3 w-3" style={{ color: acc.hex }} />
                  <span>{acc.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
