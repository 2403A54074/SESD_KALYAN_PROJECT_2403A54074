import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Compass, X } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import type { ModuleId } from '../../types/system';

const TOUR_STEPS: {
  title: string;
  module: ModuleId;
  summary: string;
  tip: string;
}[] = [
  {
    title: '1. Upload & Fingerprint Master PDFs',
    module: 'upload',
    summary:
      'Upload real PDF documents or generate a sample PDF locally. Every file is validated and hashed using Web Crypto SHA-256.',
    tip: 'Use the Star icon on any document to pin it to your Dashboard Favorites.',
  },
  {
    title: '2. Apply Visible Recipient Watermarks',
    module: 'watermarking',
    summary:
      'Stamp diagonal recipient identity, classification headers, and footer SHA-256 proofs onto every PDF page using pdf-lib.',
    tip: 'Download the watermarked PDF and test uploading it in Document Verification.',
  },
  {
    title: '3. Verify Suspect Copies Forensically',
    module: 'verification',
    summary:
      'Verify suspect PDFs via exact SHA-256 ledger matching or embedded RW-ATTR metadata inspection.',
    tip: 'Unregistered or altered documents emit verification.mismatch events.',
  },
  {
    title: '4. Demo Ephemeral SMTP & HMAC Webhooks',
    module: 'email-processing',
    summary:
      'Test simulated inbound SMTP attachment ingestion and inspect real HMAC-SHA256 webhook signatures in Webhooks & Logs.',
    tip: 'Demo Mode clearly separates local browser simulation from external MTA workers.',
  },
  {
    title: '5. Explorer, Playground & Personalization',
    module: 'explorer',
    summary:
      'Inspect interactive architecture diagrams, test payloads in Developer Playground, use Pomodoro & Calendar tools, or play original ambient soundscapes.',
    tip: 'Press Ctrl/Cmd + K anywhere to open Global Search & Command Palette.',
  },
];

export const OnboardingTour: React.FC = () => {
  const { tourOpen, setTourOpen, setActiveModule } = useSystem();
  const [stepIdx, setStepIdx] = useState(0);

  if (!tourOpen) return null;

  const step = TOUR_STEPS[stepIdx];

  const handleGoToStepModule = () => {
    setActiveModule(step.module);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Interactive Workspace Onboarding Tour"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
            <Compass className="h-5 w-5" />
            <span className="text-xs font-mono font-semibold">
              Guided Tour · Step {stepIdx + 1} of {TOUR_STEPS.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setTourOpen(false)}
            aria-label="Close onboarding tour"
            className="rounded-md p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{step.title}</h2>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {step.summary}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 text-xs text-slate-700 dark:text-slate-300">
          <strong className="text-slate-900 dark:text-white">Tip:</strong> {step.tip}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleGoToStepModule}
            className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            Open This Module
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={stepIdx === 0}
              onClick={() => setStepIdx((s) => Math.max(0, s - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 disabled:opacity-40"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>

            {stepIdx < TOUR_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  const next = stepIdx + 1;
                  setStepIdx(next);
                  setActiveModule(TOUR_STEPS[next].module);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3.5 py-1.5 text-xs font-semibold text-white"
              >
                <span>Next</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setTourOpen(false)}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Finish</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
