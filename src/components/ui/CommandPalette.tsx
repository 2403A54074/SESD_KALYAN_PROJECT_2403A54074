import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Award,
  BookOpen,
  Calendar,
  Compass,
  FileText,
  Gamepad2,
  Inbox,
  Keyboard,
  Music,
  Search,
  Sliders,
  Stamp,
  Terminal,
  Users,
  Webhook,
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
    toggleFocusMode,
    setTourOpen,
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
    if (!state) return [];
    const go = (mod: ModuleId) => () => {
      setActiveModule(mod);
      setCommandPaletteOpen(false);
    };

    const navCommands: CommandItem[] = [
      { id: 'nav-dash', label: 'Dashboard', subtitle: 'Overview & telemetry', category: 'Navigation', icon: <Activity className="h-4 w-4" />, action: go('dashboard') },
      { id: 'nav-upload', label: 'PDF Document Upload', subtitle: 'Upload & hash master PDFs', category: 'Navigation', icon: <FileText className="h-4 w-4" />, action: go('upload') },
      { id: 'nav-wm', label: 'PDF Watermarking', subtitle: 'Stamp visible recipient watermarks', category: 'Navigation', icon: <Stamp className="h-4 w-4" />, action: go('watermarking') },
      { id: 'nav-ver', label: 'Document Verification', subtitle: 'Forensic SHA-256 & metadata verification', category: 'Navigation', icon: <FileText className="h-4 w-4" />, action: go('verification') },
      { id: 'nav-rec', label: 'Recipient Management', subtitle: 'Authorized recipients & clearances', category: 'Navigation', icon: <Users className="h-4 w-4" />, action: go('recipients') },
      { id: 'nav-inb', label: 'Temporary Inboxes', subtitle: 'Ephemeral relay addresses', category: 'Navigation', icon: <Inbox className="h-4 w-4" />, action: go('inboxes') },
      { id: 'nav-wh', label: 'Webhooks & Delivery Logs', subtitle: 'HMAC-SHA256 webhooks', category: 'Navigation', icon: <Webhook className="h-4 w-4" />, action: go('webhooks') },
      { id: 'nav-exp', label: 'Interactive System Explorer', subtitle: 'Architecture & database workflow diagrams', category: 'Workspace', icon: <Compass className="h-4 w-4" />, action: go('explorer') },
      { id: 'nav-play', label: 'Developer Playground', subtitle: 'Payload inspector, JSON formatter, SHA-256 lab', category: 'Workspace', icon: <Terminal className="h-4 w-4" />, action: go('playground') },
      { id: 'nav-prod', label: 'Productivity Centre', subtitle: 'Pomodoro, tasks, notes & shortcuts', category: 'Workspace', icon: <Keyboard className="h-4 w-4" />, action: go('productivity') },
      { id: 'nav-cal', label: 'Schedule & Expiry Calendar', subtitle: 'Inbox TTLs and task due dates', category: 'Workspace', icon: <Calendar className="h-4 w-4" />, action: go('calendar') },
      { id: 'nav-mus', label: 'Ambient & AI Music Studio', subtitle: 'Lyria AI generator & 6 Web Audio soundscapes', category: 'Workspace', icon: <Music className="h-4 w-4" />, action: go('music-studio') },
      { id: 'nav-game', label: 'Relay Sentinel (2D Game)', subtitle: 'Full-viewport vault perimeter defense arcade', category: 'Workspace', icon: <Gamepad2 className="h-4 w-4" />, action: go('game') },
      { id: 'nav-ach', label: 'Achievements Gallery', subtitle: 'Activity-based engineering milestones', category: 'Workspace', icon: <Award className="h-4 w-4" />, action: go('achievements') },
      { id: 'nav-pers', label: 'Personalization Studio', subtitle: 'Themes, accents, layout & accessibility', category: 'Studio', icon: <Sliders className="h-4 w-4" />, action: go('personalization') },
      { id: 'nav-docs', label: 'Documentation & Help Centre', subtitle: 'Architecture docs, FAQ & glossary', category: 'Reference', icon: <BookOpen className="h-4 w-4" />, action: go('docs') },
      {
        id: 'act-theme',
        label: 'Toggle Dark / Light Theme',
        subtitle: 'Switch active color mode immediately',
        category: 'Quick Action',
        icon: <Sliders className="h-4 w-4" />,
        action: () => {
          toggleTheme();
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'act-focus',
        label: state.productivity.focusMode ? 'Exit Focus Mode' : 'Enter Focus Mode',
        subtitle: 'Collapse sidebar for distraction-free work',
        category: 'Quick Action',
        icon: <Compass className="h-4 w-4" />,
        action: () => {
          toggleFocusMode();
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'act-tour',
        label: 'Start Interactive Onboarding Tour',
        subtitle: 'Guided walkthrough of key capabilities',
        category: 'Help',
        icon: <BookOpen className="h-4 w-4" />,
        action: () => {
          setCommandPaletteOpen(false);
          setTourOpen(true);
        },
      },
    ];

    const docItems: CommandItem[] = state.documents.map((doc) => ({
      id: `doc-${doc.id}`,
      label: doc.title,
      subtitle: `Master PDF · ${doc.fileName} · SHA-256 ${doc.sha256Hash.slice(0, 12)}…`,
      category: 'Documents',
      icon: <FileText className="h-4 w-4 text-cyan-500" />,
      action: go('upload'),
    }));

    const recItems: CommandItem[] = state.recipients.map((rec) => ({
      id: `rec-${rec.id}`,
      label: rec.fullName,
      subtitle: `Recipient · ${rec.email} · ${rec.clearance}`,
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
  }, [state, setActiveModule, setCommandPaletteOpen, toggleTheme, toggleFocusMode, setTourOpen]);

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
      aria-label="Global search and command palette"
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
            placeholder="Search documents, SHA-256 hashes, recipients, modules, or quick actions…"
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
              No matching commands, documents, or records found for &ldquo;{query}&rdquo;.
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
          <span>Global Search &amp; Command Palette</span>
          <span className="font-mono">Ctrl/Cmd + K · Esc to close</span>
        </div>
      </div>
    </div>
  );
};
