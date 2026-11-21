/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppShell } from './components/layout/AppShell';
import { AchievementsModule } from './components/modules/AchievementsModule';
import { CalendarModule } from './components/modules/CalendarModule';
import { CentralEventsModule } from './components/modules/CentralEventsModule';
import { DashboardModule } from './components/modules/DashboardModule';
import { DeveloperPlaygroundModule } from './components/modules/DeveloperPlaygroundModule';
import { DocumentationModule } from './components/modules/DocumentationModule';
import { EmailProcessingModule } from './components/modules/EmailProcessingModule';
import { FingerprintingModule } from './components/modules/FingerprintingModule';
import { InboxesModule } from './components/modules/InboxesModule';
import { MusicStudioModule } from './components/modules/MusicStudioModule';
import { PersonalizationModule } from './components/modules/PersonalizationModule';
import { ProductivityModule } from './components/modules/ProductivityModule';
import { ProfileSettingsModule } from './components/modules/ProfileSettingsModule';
import { RecipientsModule } from './components/modules/RecipientsModule';
import { RelaySentinelGame } from './components/modules/RelaySentinelGame';
import { ReportsLogsModule } from './components/modules/ReportsLogsModule';
import { SystemExplorerModule } from './components/modules/SystemExplorerModule';
import { UploadModule } from './components/modules/UploadModule';
import { VerificationModule } from './components/modules/VerificationModule';
import { WatermarkingModule } from './components/modules/WatermarkingModule';
import { WebhooksModule } from './components/modules/WebhooksModule';
import { AmbientVisualLayer } from './components/ui/AmbientVisualLayer';
import { CommandPalette } from './components/ui/CommandPalette';
import { ErrorAlert, TableSkeleton } from './components/ui/CommonUI';
import { NotificationCenterModal } from './components/ui/NotificationCenterModal';
import { OnboardingTour } from './components/ui/OnboardingTour';
import { PdfPreviewModal } from './components/ui/PdfPreviewModal';
import { SystemProvider, useSystem } from './context/SystemContext';

const ActiveModuleViewport: React.FC = () => {
  const { state, activeModule, isLoading, loadError } = useSystem();

  if (loadError) {
    return (
      <div className="py-12 max-w-xl mx-auto">
        <ErrorAlert title="Initialization Error" message={loadError} />
      </div>
    );
  }

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

  const p = state?.settings.personalization;
  const animateTransitions = Boolean(
    p?.ambientEffects.pageTransitions && !p.reducedMotion && p.animationIntensity !== 'none'
  );

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <DashboardModule />;
      case 'upload':
        return <UploadModule />;
      case 'fingerprints':
        return <FingerprintingModule />;
      case 'watermarking':
        return <WatermarkingModule />;
      case 'verification':
        return <VerificationModule />;
      case 'recipients':
        return <RecipientsModule />;
      case 'inboxes':
        return <InboxesModule />;
      case 'email-processing':
        return <EmailProcessingModule />;
      case 'webhooks':
        return <WebhooksModule />;
      case 'events':
        return <CentralEventsModule />;
      case 'reports':
        return <ReportsLogsModule />;
      case 'explorer':
        return <SystemExplorerModule />;
      case 'playground':
        return <DeveloperPlaygroundModule />;
      case 'productivity':
        return <ProductivityModule />;
      case 'calendar':
        return <CalendarModule />;
      case 'music-studio':
        return <MusicStudioModule />;
      case 'achievements':
        return <AchievementsModule />;
      case 'personalization':
        return <PersonalizationModule />;
      case 'settings':
        return <ProfileSettingsModule />;
      case 'docs':
        return <DocumentationModule />;
      default:
        return <DashboardModule />;
    }
  };

  return (
    <div key={activeModule} className={animateTransitions ? 'animate-page-enter' : ''}>
      {renderModule()}
    </div>
  );
};

const RootRouter: React.FC = () => {
  const { activeModule, setActiveModule } = useSystem();

  // Dedicated Full-Viewport Game Shell without website navbars or footers
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
      <AmbientVisualLayer />
      <AppShell>
        <ActiveModuleViewport />
      </AppShell>
      <PdfPreviewModal />
      <CommandPalette />
      <NotificationCenterModal />
      <OnboardingTour />
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
