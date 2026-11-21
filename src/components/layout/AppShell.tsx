import React, { useState } from 'react';
import {
  Activity,
  Award,
  Bell,
  BookOpen,
  Calendar,
  CheckSquare,
  ClipboardList,
  Compass,
  EyeOff,
  FileUp,
  Fingerprint,
  Gamepad2,
  Inbox,
  LayoutDashboard,
  LogOut,
  MailCheck,
  Menu,
  Moon,
  Music,
  Search,
  Settings,
  ShieldCheck,
  Sliders,
  Stamp,
  Sun,
  Terminal,
  Users,
  Webhook,
  X,
} from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import { getTranslations } from '../../i18n/translations';
import type { ModuleId } from '../../types/system';
import { AvatarDisplay } from '../modules/ProfileSettingsModule';
import { AmbientMusicControl } from '../ui/AmbientMusicControl';

interface NavGroup {
  labelKey: 'navOverview' | 'navCustody' | 'navRelay' | 'navWorkspace' | 'navGovernance';
  items: { id: ModuleId; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'navOverview',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    labelKey: 'navCustody',
    items: [
      { id: 'upload', label: 'PDF Upload', icon: FileUp },
      { id: 'fingerprints', label: 'SHA-256 Fingerprints', icon: Fingerprint },
      { id: 'watermarking', label: 'PDF Watermarking', icon: Stamp },
      { id: 'verification', label: 'Document Verification', icon: ShieldCheck },
    ],
  },
  {
    labelKey: 'navRelay',
    items: [
      { id: 'recipients', label: 'Recipients', icon: Users },
      { id: 'inboxes', label: 'Ephemeral Inboxes', icon: Inbox },
      { id: 'email-processing', label: 'Email Processing (Demo)', icon: MailCheck },
      { id: 'webhooks', label: 'Webhooks & Logs', icon: Webhook },
      { id: 'events', label: 'Central Event Bus', icon: Activity },
    ],
  },
  {
    labelKey: 'navWorkspace',
    items: [
      { id: 'explorer', label: 'System Explorer', icon: Compass },
      { id: 'playground', label: 'Developer Playground', icon: Terminal },
      { id: 'productivity', label: 'Productivity Centre', icon: CheckSquare },
      { id: 'calendar', label: 'Expiry Calendar', icon: Calendar },
      { id: 'music-studio', label: 'Ambient & AI Music', icon: Music },
      { id: 'game', label: 'Relay Sentinel (Game)', icon: Gamepad2 },
      { id: 'achievements', label: 'Achievements', icon: Award },
    ],
  },
  {
    labelKey: 'navGovernance',
    items: [
      { id: 'reports', label: 'Activity & Reports', icon: ClipboardList },
      { id: 'personalization', label: 'Personalization Studio', icon: Sliders },
      { id: 'settings', label: 'Profile & Workspace', icon: Settings },
      { id: 'docs', label: 'Docs & Help Centre', icon: BookOpen },
    ],
  },
];

const MODULE_TITLES: Record<ModuleId, string> = {
  dashboard: 'Dashboard',
  upload: 'PDF Document Upload',
  fingerprints: 'SHA-256 Fingerprinting',
  watermarking: 'Visible PDF Watermarking',
  verification: 'Document Verification',
  recipients: 'Recipient Management',
  inboxes: 'Temporary Email Inboxes',
  'email-processing': 'Email Processing (Demo Mode)',
  webhooks: 'Webhook Configuration & Logs',
  events: 'Central Event Processing',
  reports: 'Activity Logs & Attribution Reports',
  explorer: 'Interactive System Explorer',
  playground: 'Developer Playground',
  productivity: 'Productivity Centre',
  calendar: 'Schedule & Expiry Calendar',
  'music-studio': 'Ambient & AI Music Studio',
  game: 'Relay Sentinel (2D Game)',
  achievements: 'Achievements Gallery',
  personalization: 'Personalization Studio',
  settings: 'Profile & Personal Workspace',
  docs: 'Documentation & Help Centre',
};

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    state,
    activeModule,
    setActiveModule,
    toggleTheme,
    toasts,
    dismissToast,
    setCommandPaletteOpen,
    setNotificationsOpen,
    setTourOpen,
    toggleFocusMode,
    logout,
  } = useSystem();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const p = state?.settings.personalization;
  const lang = p?.language || 'en';
  const t = getTranslations(lang);

  const unreadCount =
    state?.notifications.filter((n) => {
      if (!p?.notifications.showAnnouncements && n.category === 'Announcement') return false;
      return !n.read;
    }).length || 0;

  const isFocusMode = Boolean(state?.productivity.focusMode);
  const sidebarAppearance = p?.sidebarAppearance || 'default';
  const sidebarWidthClass = sidebarAppearance === 'compact' ? 'w-56' : 'w-64';
  const sidebarSurfaceClass =
    sidebarAppearance === 'translucent'
      ? 'bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-md'
      : 'bg-white dark:bg-[#0B1120]';

  const handleSelectModule = (id: ModuleId) => {
    setActiveModule(id);
    setMobileMenuOpen(false);
  };

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Brand Wordmark */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4">
        <button
          type="button"
          onClick={() => handleSelectModule('dashboard')}
          className="text-left focus:outline-none"
        >
          <span className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            RelayWatermark
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation"
          className="lg:hidden rounded-md p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Primary modules">
        {NAV_GROUPS.map((group) => (
          <div key={group.labelKey}>
            <p className="px-3 mb-1.5 text-[11px] font-semibold tracking-wide text-slate-400 dark:text-slate-500">
              {t[group.labelKey]}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectModule(item.id)}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-3 ${
                      sidebarAppearance === 'compact' ? 'py-1.5' : 'py-2'
                    } text-xs font-medium transition-colors text-left whitespace-nowrap ${
                      isActive
                        ? 'bg-cyan-500/12 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Sidebar User Switcher + Sign Out */}
      {state && (
        <div className="border-t border-slate-200 dark:border-slate-800 p-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSelectModule('settings')}
            className="flex-1 min-w-0 flex items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
          >
            <AvatarDisplay sizeClass="h-8 w-8" textSizeClass="text-xs" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {state.settings.displayName}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {state.settings.email || state.settings.role}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            title="Sign Out"
            aria-label="Sign out of workspace"
            className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-600 dark:hover:text-rose-400 transition-colors shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative z-10 min-h-screen flex bg-slate-50 dark:bg-[#070B14] text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      {!isFocusMode && (
        <aside
          className={`hidden lg:block ${sidebarWidthClass} shrink-0 border-r border-slate-200 dark:border-slate-800 ${sidebarSurfaceClass} sticky top-0 h-screen`}
        >
          {renderSidebarContent()}
        </aside>
      )}

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-68 max-w-[82vw] bg-white dark:bg-[#0B1120] border-r border-slate-200 dark:border-slate-800 h-full">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#0B1120]/90 backdrop-blur-md px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 min-w-0">
              <span className="hidden md:inline whitespace-nowrap">{t.appShortTitle}</span>
              <span className="hidden md:inline" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-slate-900 dark:text-white truncate">
                {MODULE_TITLES[activeModule]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isFocusMode && (
              <button
                type="button"
                onClick={toggleFocusMode}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-2.5 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-300 whitespace-nowrap shrink-0"
              >
                <EyeOff className="h-3.5 w-3.5" />
                <span>{t.exitFocusMode}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              aria-label="Open Global Search and Command Palette"
              title="Search & Commands (Ctrl/Cmd + K)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Search className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              <span className="hidden xl:inline">{t.quickCommand}</span>
              <kbd className="hidden sm:inline text-[10px] font-mono text-slate-400">⌘K</kbd>
            </button>

            <AmbientMusicControl />

            {p?.notifications.enabled !== false && (
              <button
                type="button"
                onClick={() => setNotificationsOpen(true)}
                aria-label="Open Notification Centre"
                title="Notification Centre"
                className="relative inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Bell className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                {unreadCount > 0 && (
                  <span className="font-mono tabular-nums text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle dark or light theme"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              {state?.settings.theme === 'dark' ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 text-violet-600" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveModule('watermarking')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Stamp className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.watermarkCta}</span>
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Persistent Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-4 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl w-full mx-auto">
          <span>
            Digital Document Watermarking &amp; Ephemeral SMTP–Webhook Relay System
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setTourOpen(true)}
              className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              Guided Tour
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveModule('docs')}
              className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              Architecture Docs
            </button>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {t.footerCredit}.
            </span>
          </div>
        </footer>
      </div>

      {/* Toast Stack */}
      {toasts.length > 0 && (
        <div
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]"
          aria-live="polite"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 shadow-lg flex items-start justify-between gap-2.5"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  {toast.title}
                </p>
                {toast.description && (
                  <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400 truncate">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
