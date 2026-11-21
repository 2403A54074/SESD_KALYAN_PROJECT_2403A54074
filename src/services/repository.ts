import {
  buildSeededSystemState,
  createDefaultNotifications,
  createDefaultProductivity,
  createEmptyState,
  DEFAULT_PERSONALIZATION_CONFIG,
  ensureSeedBinariesHydrated,
} from '../data/seedData';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import type { SystemState } from '../types/system';
import { clearPdfBinaries } from '../utils/cryptoPdf';

const STORAGE_KEY = 'rw_smtp_relay_system_state_v1';

function migrateState(rawState: SystemState): SystemState {
  const settings = rawState.settings || createEmptyState('dark').settings;
  const personalization = {
    ...DEFAULT_PERSONALIZATION_CONFIG,
    ...(settings.personalization || {}),
    ambientEffects: {
      ...DEFAULT_PERSONALIZATION_CONFIG.ambientEffects,
      ...(settings.personalization?.ambientEffects || {}),
    },
    dashboardWidgets: {
      ...DEFAULT_PERSONALIZATION_CONFIG.dashboardWidgets,
      ...(settings.personalization?.dashboardWidgets || {}),
    },
    notifications: {
      ...DEFAULT_PERSONALIZATION_CONFIG.notifications,
      ...(settings.personalization?.notifications || {}),
    },
    privacy: {
      ...DEFAULT_PERSONALIZATION_CONFIG.privacy,
      ...(settings.personalization?.privacy || {}),
    },
  };

  return {
    ...rawState,
    notifications: Array.isArray(rawState.notifications)
      ? rawState.notifications
      : createDefaultNotifications(),
    productivity: rawState.productivity || createDefaultProductivity(),
    exportedReportsCount:
      typeof rawState.exportedReportsCount === 'number' ? rawState.exportedReportsCount : 0,
    settings: {
      ...settings,
      avatarPreset: settings.avatarPreset || 'unknown',
      coverPreset: settings.coverPreset || 'navy-mesh',
      personalization,
    },
  };
}

export class SystemRepository {
  async loadState(): Promise<SystemState> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = migrateState(JSON.parse(raw) as SystemState);
        await ensureSeedBinariesHydrated(parsed);
        return parsed;
      }
    } catch (err) {
      console.warn('Failed to parse persisted system state, initializing fresh seed:', err);
    }

    const seeded = await buildSeededSystemState('dark');
    await this.saveState(seeded);
    return seeded;
  }

  async saveState(state: SystemState): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  async resetToDemoSeed(currentTheme: 'dark' | 'light'): Promise<SystemState> {
    clearPdfBinaries();
    const seeded = await buildSeededSystemState(currentTheme);
    await this.saveState(seeded);
    return seeded;
  }

  async clearAllData(currentTheme: 'dark' | 'light'): Promise<SystemState> {
    clearPdfBinaries();
    const empty = createEmptyState(currentTheme);
    await this.saveState(empty);
    return empty;
  }

  // Supabase-ready sync check (read-only status probe when configured)
  async checkSupabaseHealth(): Promise<{ connected: boolean; message: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        connected: false,
        message: 'Running in Local Browser Repository mode. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to connect PostgreSQL.',
      };
    }
    try {
      const { error } = await supabase.from('documents').select('id', { count: 'exact', head: true });
      if (error) {
        return { connected: false, message: `Supabase query check returned: ${error.message}` };
      }
      return { connected: true, message: 'Connected to Supabase PostgreSQL schema.' };
    } catch (err) {
      return {
        connected: false,
        message: err instanceof Error ? err.message : 'Unable to reach Supabase client.',
      };
    }
  }
}

export const systemRepository = new SystemRepository();
