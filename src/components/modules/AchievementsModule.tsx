import React, { useMemo } from 'react';
import {
  Award,
  CheckCircle2,
  ClipboardList,
  FileUp,
  Lock,
  ShieldCheck,
  Stamp,
  Users,
  Webhook,
} from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import type { ModuleId } from '../../types/system';
import { ModulePageHeader } from '../ui/CommonUI';

interface AchievementDef {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  evidence: string;
  targetModule: ModuleId;
  icon: React.ComponentType<{ className?: string }>;
}

export const AchievementsModule: React.FC = () => {
  const { state, setActiveModule } = useSystem();

  const badges = useMemo<AchievementDef[]>(() => {
    if (!state) return [];
    const deliveredCount = state.webhookDeliveries.filter((d) => d.status === 'Delivered').length;
    return [
      {
        id: 'ach-upload',
        title: 'First Document Uploaded',
        description: 'Register a master PDF document into the SHA-256 Vault.',
        unlocked: state.documents.length > 0,
        evidence:
          state.documents.length > 0
            ? `${state.documents.length} master document(s) registered`
            : 'Upload a PDF to unlock',
        targetModule: 'upload',
        icon: FileUp,
      },
      {
        id: 'ach-watermark',
        title: 'First Watermark Generated',
        description: 'Stamp a visible recipient-specific watermark onto a PDF.',
        unlocked: state.watermarkedCopies.length > 0,
        evidence:
          state.watermarkedCopies.length > 0
            ? `${state.watermarkedCopies.length} watermarked cop${state.watermarkedCopies.length === 1 ? 'y' : 'ies'} issued`
            : 'Issue a watermarked PDF to unlock',
        targetModule: 'watermarking',
        icon: Stamp,
      },
      {
        id: 'ach-verify',
        title: 'First Document Verified',
        description: 'Execute a forensic SHA-256 or metadata attribution check.',
        unlocked: state.verificationRecords.length > 0,
        evidence:
          state.verificationRecords.length > 0
            ? `${state.verificationRecords.length} verification run(s) logged`
            : 'Verify a document to unlock',
        targetModule: 'verification',
        icon: ShieldCheck,
      },
      {
        id: 'ach-recipient',
        title: 'First Recipient Added',
        description: 'Register an authorized recipient identity in the directory.',
        unlocked: state.recipients.length > 0,
        evidence:
          state.recipients.length > 0
            ? `${state.recipients.length} recipient(s) registered`
            : 'Add a recipient to unlock',
        targetModule: 'recipients',
        icon: Users,
      },
      {
        id: 'ach-webhook-cfg',
        title: 'First Webhook Configured',
        description: 'Register an HTTPS webhook endpoint with HMAC-SHA256 signing.',
        unlocked: state.webhooks.length > 0,
        evidence:
          state.webhooks.length > 0
            ? `${state.webhooks.length} endpoint(s) configured`
            : 'Configure a webhook to unlock',
        targetModule: 'webhooks',
        icon: Webhook,
      },
      {
        id: 'ach-webhook-ok',
        title: 'First Successful Webhook Delivery',
        description: 'Deliver a signed event payload with an HTTP 2xx receipt.',
        unlocked: deliveredCount > 0,
        evidence:
          deliveredCount > 0
            ? `${deliveredCount} successful delivery receipt(s)`
            : 'Dispatch a test webhook to unlock',
        targetModule: 'webhooks',
        icon: CheckCircle2,
      },
      {
        id: 'ach-report',
        title: 'First Attribution Report Generated',
        description: 'Export a chain-of-custody attribution report (CSV or JSON).',
        unlocked: (state.exportedReportsCount || 0) > 0,
        evidence:
          (state.exportedReportsCount || 0) > 0
            ? `${state.exportedReportsCount} attribution report(s) exported`
            : 'Export CSV or JSON in Activity & Reports to unlock',
        targetModule: 'reports',
        icon: ClipboardList,
      },
    ];
  }, [state]);

  if (!state) return null;

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <div>
      <ModulePageHeader
        title="Engineering Achievements Gallery"
        description="Activity-driven milestones reflecting real cryptographic, watermarking, verification, and relay operations performed in your workspace."
      />

      {/* Summary Strip */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Milestones Unlocked
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Evaluated directly from live system records
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
            {unlockedCount} <span className="text-sm font-normal text-slate-400">/ {badges.length}</span>
          </p>
          <div className="mt-1.5 w-40 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all duration-300"
              style={{ width: `${Math.round((unlockedCount / badges.length) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Badge Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {badges.map((badge) => {
          const Icon = badge.icon;
          return (
            <div
              key={badge.id}
              className={`rounded-xl border p-5 flex flex-col justify-between transition-colors ${
                badge.unlocked
                  ? 'border-cyan-500/40 bg-white dark:bg-slate-900/80'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 opacity-85'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
                      badge.unlocked
                        ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium ${
                      badge.unlocked
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {badge.unlocked ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Unlocked</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-3.5 w-3.5" />
                        <span>Locked</span>
                      </>
                    )}
                  </span>
                </div>

                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {badge.title}
                </h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {badge.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                  {badge.evidence}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveModule(badge.targetModule)}
                  className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline whitespace-nowrap shrink-0"
                >
                  Open
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
