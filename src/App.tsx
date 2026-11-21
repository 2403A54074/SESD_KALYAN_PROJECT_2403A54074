/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppShell } from './components/layout/AppShell';
import { DashboardModule } from './components/modules/DashboardModule';
import { DocumentsModule } from './components/modules/DocumentsModule';
import { HelpGuideModule } from './components/modules/HelpGuideModule';
import { MusicStudioModule } from './components/modules/MusicStudioModule';
import { ProfileSettingsModule } from './components/modules/ProfileSettingsModule';
import { RecipientsModule } from './components/modules/RecipientsModule';
import { RelaySentinelGame } from './components/modules/RelaySentinelGame';
import { ReportsLogsModule } from './components/modules/ReportsLogsModule';
import { VerificationModule } from './components/modules/VerificationModule';
import { WatermarkingModule } from './components/modules/WatermarkingModule';
import { CommandPalette } from './components/ui/CommandPalette';
import { TableSkeleton } from './components/ui/CommonUI';
import { PdfPreviewModal } from './components/ui/PdfPreviewModal';
import { SystemProvider, useSystem } from './context/SystemContext';

const ActiveModuleViewport: React.FC = () => {
  const { activeModule, isLoading } = useSystem();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 animate-pulse"
            />
          ))}
        </div>
        <TableSkeleton rows={5} cols={5} />
      </div>
    );
  }

  switch (activeModule) {
    case 'dashboard':
      return <DashboardModule />;
    case 'documents':
      return <DocumentsModule />;
    case 'recipients':
      return <RecipientsModule />;
    case 'watermarking':
      return <WatermarkingModule />;
    case 'verification':
      return <VerificationModule />;
    case 'reports':
      return <ReportsLogsModule />;
    case 'help':
      return <HelpGuideModule />;
    case 'settings':
      return <ProfileSettingsModule />;
    case 'music-studio':
      return <MusicStudioModule />;
    default:
      return <DashboardModule />;
  }
};

const RootRouter: React.FC = () => {
  const { activeModule, setActiveModule } = useSystem();

  // Dedicated Full-Viewport Game Shell
  if (activeModule === 'game') {
    return (
      <>
        <RelaySentinelGame onExit={() => setActiveModule('dashboard')} />
        <CommandPalette />
      </>
    );
  }

  return (
    <>
      <AppShell>
        <ActiveModuleViewport />
      </AppShell>
      <PdfPreviewModal />
      <CommandPalette />
    </>
  );
};

export default function App() {
  return (
    <SystemProvider>
      <RootRouter />
    </SystemProvider>
  );
}
