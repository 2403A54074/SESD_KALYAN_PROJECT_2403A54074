import React, { useState } from 'react';
import { Bell, CheckCheck, Megaphone, Shield, Terminal, Trash2, Volume2, X } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import { ambientBgm } from '../../utils/ambientBgm';

export const NotificationCenterModal: React.FC = () => {
  const {
    state,
    notificationsOpen,
    setNotificationsOpen,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    updatePersonalization,
  } = useSystem();
  const [filter, setFilter] = useState<'All' | 'System' | 'Security' | 'Announcement'>('All');

  if (!notificationsOpen || !state) return null;

  const p = state.settings.personalization;
  const visible = state.notifications.filter((n) => {
    if (!p.notifications.showAnnouncements && n.category === 'Announcement') return false;
    return filter === 'All' ? true : n.category === filter;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Notification Centre"
      onClick={() => setNotificationsOpen(false)}
    >
      <div
        className="w-full max-w-md h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Notification Centre
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setNotificationsOpen(false)}
            aria-label="Close notifications"
            className="rounded-md p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preferences Quick Strip */}
        <div className="border-b border-slate-100 dark:border-slate-800 px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50 dark:bg-slate-950/40">
          <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={p.notifications.soundEnabled}
              onChange={(e) => {
                const enabled = e.target.checked;
                updatePersonalization({
                  notifications: { ...p.notifications, soundEnabled: enabled },
                });
                if (enabled) void ambientBgm.playNotificationChime();
              }}
              className="accent-cyan-600"
            />
            <Volume2 className="h-3.5 w-3.5 text-slate-400" />
            <span>Notification chime</span>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={markAllNotificationsRead}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Mark all read</span>
            </button>
            <button
              type="button"
              onClick={clearNotifications}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-rose-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Category Filter */}
        <div className="px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1">
          {(['All', 'Security', 'System', 'Announcement'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === tab
                  ? 'bg-slate-900 dark:bg-slate-800 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
          {visible.length === 0 ? (
            <div className="px-6 py-16 text-center text-xs text-slate-500 dark:text-slate-400">
              No notifications in this category.
            </div>
          ) : (
            visible.map((item) => {
              const Icon =
                item.category === 'Security'
                  ? Shield
                  : item.category === 'Announcement'
                    ? Megaphone
                    : Terminal;
              return (
                <div
                  key={item.id}
                  onClick={() => markNotificationRead(item.id)}
                  className={`px-5 py-4 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                    !item.read ? 'bg-cyan-500/5' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {item.title}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                      {item.read ? 'Read' : 'Unread'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {item.message}
                  </p>
                  <p className="mt-1.5 text-[10px] font-mono text-slate-400">
                    {item.category} · {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
