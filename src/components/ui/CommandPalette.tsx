import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ClipboardList,
  FileText,
  Gamepad2,
  LayoutDashboard,
  Music,
  Search,
  Settings,
  ShieldCheck,
  Sliders,
  Stamp,
  Users,
  X,
} from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import type { ModuleId } from '../../types/system';

interface CommandItem {
  id: string;
  label: string;
  subtitle: string;
  category: string;
  icon: React.ReactNode;
  action: () => void;
}

export const CommandPalette: React.FC = () => {
  const {
    state,
    commandPaletteOpen,
    setCommandPaletteOpen,
    setActiveModule,
    toggleTheme,
  } = useSystem();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      } else if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [commandPaletteOpen]);

  const items = useMemo<CommandItem[]>(() => {
    const go = (mod: ModuleId) => () => {
      setActiveModule(mod);
      setCommandPaletteOpen(false);
    };

    const navCommands: CommandItem[] = [
      { id: 'nav-dash', label: 'Dashboard', subtitle: 'Workspace totals and recent actual activity', category: 'Workspace', icon: <LayoutDashboard className="h-4 w-4" />, action: go('dashboard') },
      { id: 'nav-docs', label: 'Documents', subtitle: 'Upload PDFs and compute SHA-256 fingerprints', category: 'Workspace', icon: <FileText className="h-4 w-4" />, action: go('documents') },
      { id: 'nav-rec', label: 'Recipients', subtitle: 'Add, edit, activate, or suspend recipients', category: 'Workspace', icon: <Users className="h-4 w-4" />, action: go('recipients') },
      { id: 'nav-wm', label: 'PDF Watermarking', subtitle: 'Generate recipient-specific watermarked PDFs', category: 'Workspace', icon: <Stamp className="h-4 w-4" />, action: go('watermarking') },
      { id: 'nav-ver', label: 'Document Verification', subtitle: 'Verify PDFs against original & watermarked hashes', category: 'Workspace', icon: <ShieldCheck className="h-4 w-4" />, action: go('verification') },
      { id: 'nav-rep', label: 'Reports & Activity', subtitle: 'Attribution, upload, recipient, watermark & verification reports', category: 'Workspace', icon: <ClipboardList className="h-4 w-4" />, action: go('reports') },
      { id: 'nav-help', label: 'User Manual / Help Guide', subtitle: 'Step-by-step instructions for every module', category: 'Documentation', icon: <BookOpen className="h-4 w-4" />, action: go('help') },
      { id: 'nav-set', label: 'Profile & Settings', subtitle: 'Display name, profile photo, theme & workspace reset', category: 'Workspace', icon: <Settings className="h-4 w-4" />, action: go('settings') },
      { id: 'nav-mus', label: 'Ambient Music', subtitle: 'Six original Web Audio soundscapes', category: 'Extras', icon: <Music className="h-4 w-4" />, action: go('music-studio') },
      { id: 'nav-game', label: 'Relay Sentinel', subtitle: 'Full-viewport 2D arcade game', category: 'Extras', icon: <Gamepad2 className="h-4 w-4" />, action: go('game') },
      {
        id: 'act-theme',
        label: 'Toggle Dark / Light Theme',
        subtitle: 'Switch active color mode immediately',
        category: 'Action',
        icon: <Sliders className="h-4 w-4" />,
        action: () => {
          toggleTheme();
          setCommandPaletteOpen(false);
        },
      },
    ];

    const docItems: CommandItem[] = state.documents.map((doc) => ({
      id: `doc-${doc.id}`,
      label: doc.title,
      subtitle: `Document · ${doc.fileName} · SHA-256 ${doc.sha256Hash.slice(0, 12)}…`,
      category: 'Documents',
      icon: <FileText className="h-4 w-4 text-cyan-500" />,
      action: go('documents'),
    }));

    const recItems: CommandItem[] = state.recipients.map((rec) => ({
      id: `rec-${rec.id}`,
      label: `${rec.fullName} (${rec.recipientCode})`,
      subtitle: `Recipient · ${rec.email}${rec.role ? ` · ${rec.role}` : ''}`,
      category: 'Recipients',
      icon: <Users className="h-4 w-4 text-violet-500" />,
      action: go('recipients'),
    }));

    const wmItems: CommandItem[] = state.watermarkedCopies.map((wm) => ({
      id: `wm-${wm.id}`,
      label: `${wm.watermarkCode} · ${wm.recipientName}`,
      subtitle: `Watermarked PDF · ${wm.documentTitle}`,
      category: 'Watermarks',
      icon: <Stamp className="h-4 w-4 text-violet-500" />,
      action: go('watermarking'),
    }));

    return [...navCommands, ...docItems, ...wmItems, ...recItems];
  }, [state, setActiveModule, setCommandPaletteOpen, toggleTheme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 14);
    return items
      .filter(
        (i) =>
          i.label.toLowerCase().includes(q) ||
          i.subtitle.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q)
      )
      .slice(0, 18);
  }, [items, query]);

  if (!commandPaletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/70 backdrop-blur-xs pt-20 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Search and command palette"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents, SHA-256 hashes, recipients, or pages…"
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(false)}
            aria-label="Close search palette"
            className="rounded-md p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-slate-500 dark:text-slate-400">
              No matching pages, documents, or recipients found for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.action}
                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 shrink-0">{item.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {item.label}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {item.subtitle}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
                  {item.category}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-4 py-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>Quick Search</span>
          <span className="font-mono">Ctrl/Cmd + K · Esc to close</span>
        </div>
      </div>
    </div>
  );
};
