import React, { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Inbox, CheckSquare } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import { ModulePageHeader } from '../ui/CommonUI';

export const CalendarModule: React.FC = () => {
  const { state, toggleTask, setActiveModule } = useSystem();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();

  const eventsByDate = useMemo(() => {
    const map = new Map<
      string,
      {
        tasks: NonNullable<typeof state>['productivity']['tasks'];
        inboxes: NonNullable<typeof state>['inboxes'];
      }
    >();
    if (!state) return map;

    const ensure = (isoDate: string) => {
      if (!map.has(isoDate)) map.set(isoDate, { tasks: [], inboxes: [] });
      return map.get(isoDate)!;
    };

    state.productivity.tasks.forEach((t) => {
      ensure(t.dueDate).tasks.push(t);
    });

    state.inboxes.forEach((inb) => {
      const dateStr = inb.expiresAt.slice(0, 10);
      ensure(dateStr).inboxes.push(inb);
    });

    return map;
  }, [state]);

  if (!state) return null;

  const selectedEntry = eventsByDate.get(selectedDay) || { tasks: [], inboxes: [] };
  const monthLabel = cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div>
      <ModulePageHeader
        title="Expiry & Task Calendar"
        description="Unified monthly schedule displaying Ephemeral Inbox TTL expiration dates alongside Daily Planner tasks."
        actions={
          <button
            type="button"
            onClick={() => setActiveModule('productivity')}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Manage Tasks
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <span>{monthLabel}</span>
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCursor(new Date(year, month - 1, 1))}
                aria-label="Previous month"
                className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-600 dark:text-slate-300"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
                  setSelectedDay(now.toISOString().slice(0, 10));
                }}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setCursor(new Date(year, month + 1, 1))}
                aria-label="Next month"
                className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-600 dark:text-slate-300"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: startWeekday }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-20 rounded-lg bg-slate-50/40 dark:bg-slate-950/30" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayData = eventsByDate.get(iso);
              const isSelected = iso === selectedDay;
              const taskCount = dayData?.tasks.length || 0;
              const inboxCount = dayData?.inboxes.length || 0;

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedDay(iso)}
                  className={`h-20 rounded-lg border p-2 text-left flex flex-col justify-between transition-colors ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <span className="text-xs font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                    {dayNum}
                  </span>
                  <div className="space-y-0.5 text-[10px] font-mono">
                    {taskCount > 0 && (
                      <p className="text-violet-700 dark:text-violet-400 truncate">
                        {taskCount} task{taskCount > 1 ? 's' : ''}
                      </p>
                    )}
                    {inboxCount > 0 && (
                      <p className="text-cyan-700 dark:text-cyan-400 truncate">
                        {inboxCount} expiry
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Details */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 space-y-5">
          <div>
            <p className="text-xs font-mono text-cyan-600 dark:text-cyan-400">{selectedDay}</p>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
              Scheduled Items
            </h2>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2">
              <CheckSquare className="h-3.5 w-3.5 text-violet-500" />
              <span>Tasks Due ({selectedEntry.tasks.length})</span>
            </h3>
            {selectedEntry.tasks.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">No tasks due on this date.</p>
            ) : (
              <div className="space-y-2">
                {selectedEntry.tasks.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-start gap-2 rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 text-xs cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={t.completed}
                      onChange={() => toggleTask(t.id)}
                      className="mt-0.5 accent-cyan-600"
                    />
                    <div>
                      <p className={t.completed ? 'line-through text-slate-400' : 'font-medium text-slate-900 dark:text-slate-100'}>
                        {t.title}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500">
                        {t.priority} · {t.category}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2">
              <Inbox className="h-3.5 w-3.5 text-cyan-500" />
              <span>Ephemeral Inbox Expirations ({selectedEntry.inboxes.length})</span>
            </h3>
            {selectedEntry.inboxes.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">No inbox expirations on this date.</p>
            ) : (
              <div className="space-y-2">
                {selectedEntry.inboxes.map((inb) => (
                  <div
                    key={inb.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 text-xs"
                  >
                    <p className="font-mono font-semibold text-cyan-700 dark:text-cyan-400 truncate">
                      {inb.aliasAddress}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {inb.label} · {inb.status}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
