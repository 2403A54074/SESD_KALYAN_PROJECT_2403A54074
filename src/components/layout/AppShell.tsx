import React, { useState } from 'react';
import {
  BookOpen,
  ClipboardList,
  FileText,
  Gamepad2,
  LayoutDashboard,
  Menu,
  Moon,
  Music,
  Search,
  Settings,
  ShieldCheck,
  Stamp,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import type { ModuleId } from '../../types/system';
import { AvatarDisplay } from '../modules/ProfileSettingsModule';
import { AmbientMusicControl } from '../ui/AmbientMusicControl';

interface NavGroup {
  label: string;
  items: { id: ModuleId; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'documents', label: 'Documents', icon: FileText },
      { id: 'recipients', label: 'Recipients', icon: Users },
      { id: 'watermarking', label: 'PDF Watermarking', icon: Stamp },
      { id: 'verification', label: 'Document Verification', icon: ShieldCheck },
      { id: 'reports', label: 'Reports & Activity', icon: ClipboardList },
      { id: 'settings', label: 'Profile & Settings', icon: Settings },
    ],
  },
  {
    label: 'Documentation',
    items: [{ id: 'help', label: 'User Manual / Help', icon: BookOpen }],
  },
  {
    label: 'Extras',
    items: [
      { id: 'music-studio', label: 'Ambient Music', icon: Music },
      { id: 'game', label: 'Relay Sentinel', icon: Gamepad2 },
    ],
  },
];

const MODULE_TITLES: Record<ModuleId, string> = {
  dashboard: 'Dashboard',
  documents: 'Documents',
  recipients: 'Recipients',
  watermarking: 'PDF Watermarking',
  verification: 'Document Verification',
  reports: 'Reports & Activity',
  help: 'User Manual / Help Guide',
  settings: 'Profile & Settings',
  'music-studio': 'Ambient Music',
  game: 'Relay Sentinel',
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
  } = useSystem();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          className="text-left focus:outline-none flex items-center gap-2"
        >
          <ShieldCheck className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
          <span className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            DocWatermark
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
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label="Primary navigation">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {group.label}
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
                    className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors text-left whitespace-nowrap ${
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

      {/* Sidebar Workspace Profile Footer */}
      <div className="border-t border-slate-200 dark:border-slate-800 p-3">
        <button
          type="button"
          onClick={() => handleSelectModule('settings')}
          className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
        >
          <AvatarDisplay sizeClass="h-8 w-8" textSizeClass="text-xs" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
              {state.settings.displayName}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {state.settings.organization || state.settings.role}
            </p>
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative z-10 min-h-screen flex bg-slate-50 dark:bg-[#070B14] text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120] sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

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
              <span className="hidden md:inline whitespace-nowrap">
                Digital Document Watermarking &amp; Verification
              </span>
              <span className="hidden md:inline" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-slate-900 dark:text-white truncate">
                {MODULE_TITLES[activeModule]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              aria-label="Quick Search"
              title="Search (Ctrl/Cmd + K)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Search className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              <span className="hidden xl:inline">Search</span>
              <kbd className="hidden sm:inline text-[10px] font-mono text-slate-400">⌘K</kbd>
            </button>

            <AmbientMusicControl />

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle dark or light theme"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              {state.settings.theme === 'dark' ? (
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
              <span className="hidden sm:inline">Watermark PDF</span>
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Persistent Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-4 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl w-full mx-auto">
          <span>Digital Document Watermarking &amp; Verification System</span>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            Developed by Kalyan Reddy
          </span>
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
