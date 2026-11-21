import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  XCircle,
} from 'lucide-react';

export const StatusLabel: React.FC<{
  status: string;
  tone?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
}> = ({ status, tone }) => {
  const resolvedTone =
    tone ||
    (/active|success|delivered|completed|passed|match/i.test(status)
      ? 'success'
      : /retrying|warning|suspended|expired|metadata/i.test(status)
        ? 'warning'
        : /failed|error|revoked|rejected|unregistered/i.test(status)
          ? 'error'
          : /processing|queued|demo/i.test(status)
            ? 'info'
            : 'neutral');

  const styles: Record<string, string> = {
    success: 'text-emerald-700 dark:text-emerald-400',
    warning: 'text-amber-700 dark:text-amber-400',
    error: 'text-rose-700 dark:text-rose-400',
    info: 'text-cyan-700 dark:text-cyan-400',
    neutral: 'text-slate-600 dark:text-slate-400',
  };

  const Icon =
    resolvedTone === 'success'
      ? CheckCircle2
      : resolvedTone === 'warning'
        ? AlertTriangle
        : resolvedTone === 'error'
          ? XCircle
          : Clock;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${styles[resolvedTone]}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{status}</span>
    </span>
  );
};

export const CopyValueButton: React.FC<{
  value: string;
  label?: string;
  className?: string;
}> = ({ value, label = 'Copy', className = '' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked fallback
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${className}`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-500" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 text-slate-400" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
};

export const ModulePageHeader: React.FC<{
  title: string;
  description: string;
  actions?: React.ReactNode;
}> = ({ title, description, actions }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-5 mb-6">
    <div className="min-w-0">
      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-white text-balance">
        {title}
      </h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
        {description}
      </p>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
  </div>
);

export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ icon, title, description, actionLabel, onAction }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 px-6 py-12 text-center">
    <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400">
      {icon}
    </div>
    <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-md">{description}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-5 inline-flex items-center justify-center rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export const ErrorAlert: React.FC<{
  title?: string;
  message: string;
  onDismiss?: () => void;
}> = ({ title = 'Operation Error', message, onDismiss }) => (
  <div
    role="alert"
    className="flex items-start justify-between gap-3 rounded-xl border border-rose-300 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-900 dark:text-rose-200"
  >
    <div className="flex items-start gap-2.5">
      <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-rose-800 dark:text-rose-300 mt-0.5">{message}</p>
      </div>
    </div>
    {onDismiss && (
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs font-medium text-rose-700 dark:text-rose-300 hover:underline shrink-0"
      >
        Dismiss
      </button>
    )}
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 4,
  cols = 5,
}) => (
  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 overflow-hidden">
    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="grid gap-4 px-4 py-3.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((__, cIdx) => (
            <div
              key={cIdx}
              className="h-4 rounded bg-slate-200/80 dark:bg-slate-800 animate-pulse"
            />
          ))}
        </div>
      ))}
    </div>
  </div>
);
