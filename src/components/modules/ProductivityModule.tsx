import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckSquare,
  Clock,
  Download,
  Eye,
  Keyboard,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Star,
  Trash2,
} from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import type { PlannerTask } from '../../types/system';
import { ambientBgm } from '../../utils/ambientBgm';
import { getPdfBinary } from '../../utils/cryptoPdf';
import { EmptyState, ModulePageHeader } from '../ui/CommonUI';

const POMODORO_MODES = {
  focus: { label: 'Focus (25m)', minutes: 25 },
  short: { label: 'Short Break (5m)', minutes: 5 },
  long: { label: 'Long Break (15m)', minutes: 15 },
};

export const ProductivityModule: React.FC = () => {
  const {
    state,
    addTask,
    toggleTask,
    deleteTask,
    updateNotes,
    toggleFocusMode,
    incrementPomodoro,
    toggleDocumentFavorite,
    openPdfPreview,
    setActiveModule,
    setCommandPaletteOpen,
  } = useSystem();

  const [pomoMode, setPomoMode] = useState<'focus' | 'short' | 'long'>('focus');
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [taskPriority, setTaskPriority] = useState<PlannerTask['priority']>('Medium');
  const [taskCategory, setTaskCategory] = useState<PlannerTask['category']>('Engineering');

  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          if (pomoMode === 'focus') {
            incrementPomodoro();
          }
          if (state?.settings.personalization.notifications.soundEnabled) {
            void ambientBgm.playNotificationChime();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, pomoMode, incrementPomodoro, state?.settings.personalization.notifications.soundEnabled]);

  const favoriteDocs = useMemo(
    () => (state?.documents || []).filter((d) => d.isFavorite),
    [state?.documents]
  );

  const recentDocs = useMemo(
    () =>
      [...(state?.documents || [])]
        .filter((d) => Boolean(d.lastViewedAt))
        .sort((a, b) => (b.lastViewedAt || '').localeCompare(a.lastViewedAt || ''))
        .slice(0, 5),
    [state?.documents]
  );

  if (!state) return null;

  const switchPomoMode = (mode: 'focus' | 'short' | 'long') => {
    setTimerRunning(false);
    setPomoMode(mode);
    setSecondsLeft(POMODORO_MODES[mode].minutes * 60);
  };

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    addTask({
      title: taskTitle.trim(),
      dueDate: taskDue,
      priority: taskPriority,
      category: taskCategory,
    });
    setTaskTitle('');
  };

  const handleDownloadNotes = () => {
    const blob = new Blob([state.productivity.notes], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'workspace-notes.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div>
      <ModulePageHeader
        title="Productivity Centre"
        description="Optional personal workspace tools: Pomodoro timer, distraction-free Focus Mode, daily task planner, notes, favorites, and keyboard shortcuts."
        actions={
          <>
            <button
              type="button"
              onClick={() => setActiveModule('calendar')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Calendar View</span>
            </button>
            <button
              type="button"
              onClick={toggleFocusMode}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap"
            >
              {state.productivity.focusMode ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span>Exit Focus Mode</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span>Focus Mode</span>
                </>
              )}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        {/* Pomodoro Timer */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <span>Pomodoro Timer</span>
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {state.productivity.pomodoroCompletedCount} completed
            </span>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1">
            {(['focus', 'short', 'long'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchPomoMode(m)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  pomoMode === m
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {POMODORO_MODES[m].label}
              </button>
            ))}
          </div>

          <div className="py-5 text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
            <p className="text-5xl font-mono font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
              {mins}:{secs}
            </p>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {timerRunning ? 'Timer active' : 'Paused'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => setTimerRunning((r) => !r)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-semibold text-white"
            >
              {timerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{timerRunning ? 'Pause' : 'Start'}</span>
            </button>
            <button
              type="button"
              onClick={() => switchPomoMode(pomoMode)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </section>

        {/* Daily Planner & Tasks */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              <span>Daily Planner &amp; Tasks ({state.productivity.tasks.length})</span>
            </h2>
          </div>

          <form onSubmit={handleAddTask} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Add security review, audit, or engineering task…"
              className="sm:col-span-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            />
            <input
              type="date"
              value={taskDue}
              onChange={(e) => setTaskDue(e.target.value)}
              className="sm:col-span-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
            />
            <select
              value={taskPriority}
              onChange={(e) => setTaskPriority(e.target.value as PlannerTask['priority'])}
              className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-2 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <button
              type="submit"
              className="sm:col-span-2 inline-flex items-center justify-center gap-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3 py-2 text-xs font-semibold text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </button>
          </form>

          {state.productivity.tasks.length === 0 ? (
            <EmptyState
              icon={<CheckSquare className="h-5 w-5" />}
              title="No tasks scheduled"
              description="Add a task above to track daily audit and engineering milestones."
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-60 overflow-y-auto">
              {state.productivity.tasks.map((task) => (
                <div key={task.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <label className="flex items-center gap-2.5 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => toggleTask(task.id)}
                      className="accent-cyan-600 shrink-0"
                    />
                    <div className="min-w-0">
                      <p
                        className={`font-medium truncate ${
                          task.completed
                            ? 'line-through text-slate-400'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {task.title}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        Due {task.dueDate} · {task.priority} · {task.category}
                      </p>
                    </div>
                  </label>
                  <button
                    type="button"
                    onClick={() => deleteTask(task.id)}
                    aria-label={`Delete task ${task.title}`}
                    className="text-slate-400 hover:text-rose-500 p-1 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Personal Notes + Favorites & Recently Viewed + Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Personal Notes
            </h2>
            <button
              type="button"
              onClick={handleDownloadNotes}
              className="inline-flex items-center gap-1 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export .txt</span>
            </button>
          </div>
          <textarea
            rows={7}
            value={state.productivity.notes}
            onChange={(e) => updateNotes(e.target.value)}
            placeholder="Write engineering notes, audit observations, or checklists…"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs font-mono text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none"
          />
        </section>

        <section className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-amber-400" />
              <span>Favorite Documents ({favoriteDocs.length})</span>
            </h2>
            {favoriteDocs.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Star a document in PDF Upload to pin it here.
              </p>
            ) : (
              <div className="space-y-2">
                {favoriteDocs.map((doc) => {
                  const bytes = getPdfBinary(`doc:${doc.id}`);
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs"
                    >
                      <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                        {doc.title}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {bytes && (
                          <button
                            type="button"
                            onClick={() =>
                              openPdfPreview({
                                title: doc.title,
                                fileName: doc.fileName,
                                bytes,
                                sha256: doc.sha256Hash,
                              })
                            }
                            aria-label={`Preview ${doc.title}`}
                            className="p-1 text-cyan-600 dark:text-cyan-400"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleDocumentFavorite(doc.id)}
                          aria-label={`Unstar ${doc.title}`}
                          className="p-1 text-amber-400"
                        >
                          <Star className="h-3.5 w-3.5 fill-amber-400" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white mb-2">
              Recently Viewed Documents
            </h3>
            {recentDocs.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Preview any PDF to record it here.
              </p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {recentDocs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-slate-600 dark:text-slate-300">
                    <span className="truncate">{d.title}</span>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {new Date(d.lastViewedAt!).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Keyboard Shortcuts & Quick Actions */}
        <section className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <span>Shortcuts</span>
            </h2>
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              Open Palette
            </button>
          </div>
          <div className="space-y-2 text-xs">
            {[
              ['Ctrl/Cmd + K', 'Command Palette & Global Search'],
              ['Esc', 'Close Active Modal / Palette'],
              ['Focus Mode', 'Collapse sidebar & header chrome'],
            ].map(([keys, desc]) => (
              <div
                key={keys}
                className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2"
              >
                <span className="text-slate-600 dark:text-slate-400">{desc}</span>
                <kbd className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-1.5 py-0.5 text-[10px] font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  {keys}
                </kbd>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
