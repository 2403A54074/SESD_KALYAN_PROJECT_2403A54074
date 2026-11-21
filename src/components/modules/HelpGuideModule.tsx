import React, { useState } from 'react';
import {
  BookOpen,
  ClipboardList,
  FileText,
  Fingerprint,
  Gamepad2,
  LayoutDashboard,
  Music,
  Search,
  Settings,
  ShieldCheck,
  Stamp,
  Users,
} from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import type { ModuleId } from '../../types/system';
import { ModulePageHeader } from '../ui/CommonUI';

interface HelpTopic {
  id: string;
  number: number;
  title: string;
  summary: string;
  targetModule: ModuleId;
  targetLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  steps: string[];
  note?: string;
}

const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'dashboard',
    number: 1,
    title: 'How to use the Dashboard',
    summary: 'Monitor your live document vault counts, recipient totals, and recent activity from one place.',
    targetModule: 'dashboard',
    targetLabel: 'Go to Dashboard',
    icon: LayoutDashboard,
    steps: [
      'Open the Dashboard from the top item in the left sidebar. Every number comes directly from your stored records.',
      'Check the four summary cards: Total Uploaded Documents, Total Generated Watermarked PDFs, Total Registered Recipients, and Total Verification Checks.',
      'Use the quick navigation buttons to jump straight to uploading a PDF, adding a recipient, watermarking, or verifying a file.',
      'Review the Recent Document Activity table at the bottom to track uploads, recipient updates, watermark issuances, and verification checks.',
    ],
  },
  {
    id: 'upload-pdf',
    number: 2,
    title: 'How to upload an original PDF',
    summary: 'Register a confidential PDF in your document library while keeping the original file completely unchanged.',
    targetModule: 'documents',
    targetLabel: 'Open Documents',
    icon: FileText,
    steps: [
      'Go to Documents in the sidebar.',
      'Drag and drop a PDF file into the upload box or click "Select PDF File" to browse your device (up to 25 MB).',
      'Enter the Document Title, choose a Classification (Confidential, Restricted, Internal, or Board Only), type the Owner Name, and add an optional Description.',
      'The system automatically generates a unique Document ID, inspects page count and file size, and calculates the SHA-256 fingerprint.',
      'Click "Save Document". Your original PDF stays unmodified and can be previewed, inspected, or downloaded anytime.',
    ],
  },
  {
    id: 'add-recipients',
    number: 3,
    title: 'How to add recipients manually',
    summary: 'Build your directory of authorized people who will receive personalized PDF copies.',
    targetModule: 'recipients',
    targetLabel: 'Open Recipients',
    icon: Users,
    steps: [
      'Open Recipients from the sidebar.',
      'Click the "Add Recipient" button in the top-right corner.',
      'Enter the Recipient Name, Email Address, Organization, Role, and any optional notes.',
      'Click "Save Recipient". A unique Recipient ID (REC-XXXXXXXX) is generated automatically.',
      'Use the Edit button to update details, Suspend/Activate to control whether a recipient can receive new watermarks, or Delete to remove a record safely.',
    ],
  },
  {
    id: 'customize-watermarks',
    number: 4,
    title: 'How to customize watermarks',
    summary: 'Adjust how identification text appears across every page of generated PDFs.',
    targetModule: 'watermarking',
    targetLabel: 'Open PDF Watermarking',
    icon: Stamp,
    steps: [
      'Open PDF Watermarking from the sidebar.',
      'Edit the Diagonal Watermark Text box. You can include dynamic placeholders such as {{recipient_name}}, {{recipient_id}}, {{document_id}}, {{date}}, and {{watermark_id}}.',
      'Choose a color preset, adjust Opacity, and pick Rotation angle and Font size.',
      'Toggle Footer Identification and the Corner Tracking Badge on or off.',
      'Watch the live A4 layout preview on the right update immediately before generating files.',
    ],
  },
  {
    id: 'generate-watermarks',
    number: 5,
    title: 'How to generate personalized watermarked PDF copies',
    summary: 'Create separate identifiable PDF copies for one or multiple recipients in a single step.',
    targetModule: 'watermarking',
    targetLabel: 'Open PDF Watermarking',
    icon: Stamp,
    steps: [
      'In PDF Watermarking, select an uploaded Original PDF from the dropdown list.',
      'Select one active recipient to create a single copy, or select multiple active recipients to create one separate personalized copy per recipient.',
      'Click "Generate Watermarked PDF" (or "Generate N Watermarked PDFs").',
      'The app creates each copy with pdf-lib, embeds the Recipient Name, Recipient ID, Document ID, Issue Date, and a unique Watermark Tracking ID (WM-XXXXXXXX), and records its new SHA-256 fingerprint.',
      'Your original PDF remains completely untouched.',
    ],
  },
  {
    id: 'preview-download',
    number: 6,
    title: 'How to preview and download PDFs',
    summary: 'Inspect original and watermarked PDFs inside the browser or save them for distribution.',
    targetModule: 'documents',
    targetLabel: 'Open Documents',
    icon: FileText,
    steps: [
      'In Documents, click "Preview" on any uploaded original PDF to view it in the built-in PDF viewer, or click "View Details" to inspect full metadata and SHA-256 fingerprint.',
      'Click "Download" in Documents to save an exact copy of the original file.',
      'In PDF Watermarking, scroll to the Generated Watermarked PDFs table and click "Preview" or "Download" beside any recipient’s copy.',
    ],
  },
  {
    id: 'sha256-explained',
    number: 7,
    title: 'What SHA-256 fingerprints are and why they are used',
    summary: 'Understand how cryptographic hashing detects even a single changed byte in a PDF file.',
    targetModule: 'documents',
    targetLabel: 'Inspect Fingerprints',
    icon: Fingerprint,
    steps: [
      'A SHA-256 fingerprint is a unique 64-character code computed directly from the exact bytes of a PDF file using your browser’s Web Crypto API.',
      'Every registered original PDF has one SHA-256 fingerprint, and every personalized watermarked PDF copy has its own distinct SHA-256 fingerprint.',
      'If even one character, pixel, or metadata field inside a PDF is modified later, the newly calculated SHA-256 fingerprint changes completely.',
      'This lets you verify file integrity reliably without needing to store copies of every external file sent back to you.',
    ],
  },
  {
    id: 'verify-original',
    number: 8,
    title: 'How to verify original PDFs',
    summary: 'Confirm whether a PDF matches an unmodified original master document.',
    targetModule: 'verification',
    targetLabel: 'Open Verification',
    icon: ShieldCheck,
    steps: [
      'Go to Document Verification in the sidebar.',
      'Drag and drop the PDF file or click "Upload PDF to Verify".',
      'Alternatively, paste a 64-character SHA-256 hash into the lookup box and click "Check Registry".',
      'If the file matches an uploaded original exactly, the result displays "Original Master Match" along with the document title and ID.',
    ],
  },
  {
    id: 'verify-watermarked',
    number: 9,
    title: 'How to verify watermarked PDFs',
    summary: 'Check which registered recipient copy matches an inspected PDF or tracking ID.',
    targetModule: 'verification',
    targetLabel: 'Open Verification',
    icon: ShieldCheck,
    steps: [
      'Open Document Verification.',
      'Upload the distributed PDF file, or enter its SHA-256 fingerprint or Watermark Tracking ID (WM-XXXXXXXX) in the lookup field.',
      'When an exact match is found, the system displays "Watermarked Copy Match" together with the Recipient Name, Recipient Email, Recipient ID, Watermark Tracking ID, Original Document details, and Issue Date.',
    ],
  },
  {
    id: 'understand-results',
    number: 10,
    title: 'How to understand verification results',
    summary: 'Interpret each outcome accurately and understand what document traceability can and cannot prove.',
    targetModule: 'verification',
    targetLabel: 'Open Verification',
    icon: ShieldCheck,
    steps: [
      'Original Master Match: The PDF matches an unmodified original file stored in Documents.',
      'Watermarked Copy Match: The PDF matches an unmodified watermarked copy issued to the displayed recipient and tracking ID.',
      'Modified or Unregistered File: The file was altered after generation (such as re-saving, editing, or stripping data) or was never registered in this workspace. No recipient is attributed when no reliable match exists.',
    ],
    note: 'Important limitation: Document watermarking and SHA-256 verification provide traceability and integrity checking for registered copies. They do not prevent copying or prove who leaked a document.',
  },
  {
    id: 'distribution-history',
    number: 11,
    title: 'How to view document distribution history',
    summary: 'Trace which documents were uploaded, which recipients were added, and which copies were issued.',
    targetModule: 'reports',
    targetLabel: 'Open Reports & Activity',
    icon: ClipboardList,
    steps: [
      'Go to Reports & Activity in the sidebar.',
      'Switch between Attribution Report, Upload History, Recipient History, Watermark History, and Verification History tabs.',
      'Use the document dropdown, recipient dropdown, or search box to narrow down specific records.',
    ],
  },
  {
    id: 'export-reports',
    number: 12,
    title: 'How to generate and export reports',
    summary: 'Download clean audit and attribution tables as PDF or CSV files for record keeping.',
    targetModule: 'reports',
    targetLabel: 'Open Reports & Activity',
    icon: ClipboardList,
    steps: [
      'Open Reports & Activity and select the tab you want to export (for example, Attribution Report or Verification History).',
      'Apply any desired document, recipient, or search filters.',
      'Click "Export CSV" to download a spreadsheet-ready file, or click "Export PDF" to generate a formatted landscape PDF report using pdf-lib.',
    ],
  },
  {
    id: 'profile-settings',
    number: 13,
    title: 'How to manage Profile & Settings',
    summary: 'Update your display name, profile photo, theme mode, preferences, backup export, and workspace reset.',
    targetModule: 'settings',
    targetLabel: 'Open Profile & Settings',
    icon: Settings,
    steps: [
      'Open Profile & Settings from the sidebar.',
      'Update your Display Name, Role, Organization, or upload a Profile Picture.',
      'Switch between Dark, Light, and System themes, or adjust default watermark styling.',
      'Use "Export Data" to back up workspace metadata as JSON, or "Reset Workspace" (with confirmation) to clear all stored records.',
    ],
  },
  {
    id: 'ambient-music',
    number: 14,
    title: 'How to use Ambient Music',
    summary: 'Listen to optional synthesized background soundscapes while working. Always off by default.',
    targetModule: 'music-studio',
    targetLabel: 'Open Ambient Music',
    icon: Music,
    steps: [
      'Find Ambient Music under the Extras section at the bottom of the sidebar (or use the quick audio button in the top bar).',
      'Select from six original Web Audio soundscapes: Rain, Ocean, Forest, Space, Original Relaxing Piano Tones, and Deep Focus.',
      'Press Play to start audio, adjust the volume slider, toggle Mute, or switch Loop mode on/off.',
    ],
  },
  {
    id: 'relay-sentinel',
    number: 15,
    title: 'How to play Relay Sentinel',
    summary: 'Take a short break with the built-in 2D arcade defender game under Extras.',
    targetModule: 'game',
    targetLabel: 'Launch Relay Sentinel',
    icon: Gamepad2,
    steps: [
      'Select Relay Sentinel under the Extras section in the sidebar.',
      'Choose Campaign mode (5 waves) or Endless mode.',
      'Move with WASD or Arrow keys, aim with your mouse or pointer, shoot, and use the Dash ability to dodge.',
      'Use the top HUD buttons anytime to Mute sound effects, Pause, Restart, or Exit back to the Dashboard.',
    ],
  },
];

export const HelpGuideModule: React.FC = () => {
  const { setActiveModule } = useSystem();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTopics = HELP_TOPICS.filter((topic) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      topic.title.toLowerCase().includes(q) ||
      topic.summary.toLowerCase().includes(q) ||
      topic.steps.some((s) => s.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="User Manual & Help Guide"
        description="Step-by-step instructions for students, lecturers, and document custodians using the Digital Document Watermarking & Verification System."
        actions={
          <div className="relative w-full sm:w-72">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search help topics…"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        }
      />

      {/* Quick Table of Contents */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Quick Topic Index ({filteredTopics.length})
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filteredTopics.map((topic) => (
            <a
              key={topic.id}
              href={`#help-${topic.id}`}
              className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:border-cyan-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors truncate"
            >
              <span className="font-mono text-cyan-600 dark:text-cyan-400 mr-1.5">
                {String(topic.number).padStart(2, '0')}.
              </span>
              {topic.title}
            </a>
          ))}
        </div>
      </div>

      {/* Step-by-Step Guide Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredTopics.map((topic) => {
          const Icon = topic.icon;
          return (
            <section
              key={topic.id}
              id={`help-${topic.id}`}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        Guide {String(topic.number).padStart(2, '0')}
                      </p>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {topic.title}
                      </h3>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                  {topic.summary}
                </p>

                <ol className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 list-decimal pl-4">
                  {topic.steps.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>

                {topic.note && (
                  <p className="mt-3 rounded-lg border border-amber-300/70 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/30 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200">
                    {topic.note}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveModule(topic.targetModule)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <span>{topic.targetLabel}</span>
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
