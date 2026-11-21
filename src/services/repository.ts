import {
  buildSeededSystemState,
  createDefaultNotifications,
  createDefaultProductivity,
  createEmptyState,
  DEFAULT_PERSONALIZATION_CONFIG,
  ensureSeedBinariesHydrated,
} from '../data/seedData';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import type { AuthUser, AvatarPreset, ProfileCoverPreset, SystemState } from '../types/system';
import { clearPdfBinaries } from '../utils/cryptoPdf';

const STORAGE_KEY_PREFIX = 'rw_smtp_relay_state_v2_';

function storageKeyForUser(userId?: string | null): string {
  return `${STORAGE_KEY_PREFIX}${userId || 'guest'}`;
}

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

export interface SupabaseProfileRow {
  id: string;
  email: string;
  display_name: string;
  role: string;
  organization: string;
  avatar_preset: AvatarPreset;
  avatar_url?: string | null;
  custom_avatar_data_url?: string | null;
  cover_preset: ProfileCoverPreset;
  preferences?: Record<string, unknown> | null;
}

export class SystemRepository {
  async loadStateForUser(user?: AuthUser | null): Promise<SystemState> {
    const key = storageKeyForUser(user?.id);

    // When Supabase is configured and user is authenticated via Supabase, prefer their private RLS-protected row
    if (isSupabaseConfigured && supabase && user?.provider === 'supabase') {
      try {
        const { data: wsRow } = await supabase
          .from('user_workspaces')
          .select('state_json')
          .eq('owner_id', user.id)
          .maybeSingle();

        if (wsRow?.state_json && typeof wsRow.state_json === 'object') {
          const parsed = migrateState(wsRow.state_json as SystemState);
          await ensureSeedBinariesHydrated(parsed);
          localStorage.setItem(key, JSON.stringify(parsed));
          return parsed;
        }
      } catch (err) {
        console.warn('Supabase workspace table lookup fell back to user-scoped local store:', err);
      }
    }

    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = migrateState(JSON.parse(raw) as SystemState);
        await ensureSeedBinariesHydrated(parsed);
        return parsed;
      }
    } catch (err) {
      console.warn('Failed to parse persisted system state, initializing fresh seed:', err);
    }

    const seeded = await buildSeededSystemState('dark', user || undefined);
    await this.saveState(seeded, user);
    return seeded;
  }

  async saveState(state: SystemState, user?: AuthUser | null): Promise<void> {
    const key = storageKeyForUser(user?.id);
    localStorage.setItem(key, JSON.stringify(state));

    if (isSupabaseConfigured && supabase && user?.provider === 'supabase') {
      void supabase
        .from('user_workspaces')
        .upsert(
          {
            owner_id: user.id,
            state_json: state,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'owner_id' }
        )
        .then(({ error }) => {
          if (error) {
            console.warn('Supabase workspace sync notice:', error.message);
          }
        });
    }
  }

  async fetchOrCreateSupabaseProfile(params: {
    id: string;
    email: string;
    fallbackName: string;
    fallbackOrganization?: string;
    fallbackAvatarUrl?: string;
  }): Promise<SupabaseProfileRow | null> {
    if (!isSupabaseConfigured || !supabase) return null;

    const { data: existing, error: fetchErr } = await supabase
      .from('profiles')
      .select(
        'id, email, display_name, role, organization, avatar_preset, avatar_url, custom_avatar_data_url, cover_preset, preferences'
      )
      .eq('id', params.id)
      .maybeSingle();

    if (fetchErr) {
      console.warn('Profile table lookup notice:', fetchErr.message);
      return null;
    }

    if (existing) {
      const row = existing as SupabaseProfileRow;
      // Backfill Google avatar URL if user logged in via Google and doesn't have a saved avatar_url yet
      if (params.fallbackAvatarUrl && !row.avatar_url) {
        const nextPreset: AvatarPreset =
          row.avatar_preset === 'unknown' && !row.custom_avatar_data_url
            ? 'google'
            : row.avatar_preset;
        await supabase
          .from('profiles')
          .update({
            avatar_url: params.fallbackAvatarUrl,
            avatar_preset: nextPreset,
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.id);
        return {
          ...row,
          avatar_url: params.fallbackAvatarUrl,
          avatar_preset: nextPreset,
        };
      }
      return row;
    }

    const initialPreset: AvatarPreset = params.fallbackAvatarUrl ? 'google' : 'unknown';

    const { data: inserted, error: insertErr } = await supabase
      .from('profiles')
      .upsert(
        {
          id: params.id,
          email: params.email,
          display_name: params.fallbackName,
          role: 'Custodian Operator',
          organization: params.fallbackOrganization || '',
          avatar_preset: initialPreset,
          avatar_url: params.fallbackAvatarUrl || null,
          cover_preset: 'navy-mesh',
        },
        { onConflict: 'id' }
      )
      .select(
        'id, email, display_name, role, organization, avatar_preset, avatar_url, custom_avatar_data_url, cover_preset, preferences'
      )
      .single();

    if (insertErr) {
      console.warn('Profile creation notice:', insertErr.message);
      return null;
    }

    return inserted as SupabaseProfileRow;
  }

  async syncSupabaseProfile(userId: string, state: SystemState): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          email: state.settings.email,
          display_name: state.settings.displayName,
          role: state.settings.role,
          organization: state.settings.organization,
          avatar_preset: state.settings.avatarPreset,
          avatar_url: state.settings.avatarUrl || null,
          custom_avatar_data_url: state.settings.customAvatarDataUrl || null,
          cover_preset: state.settings.coverPreset,
          preferences: state.settings.personalization as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    if (error) {
      console.warn('Supabase profile update notice:', error.message);
    }
  }

  async resetToDemoSeed(currentTheme: 'dark' | 'light', user?: AuthUser | null): Promise<SystemState> {
    clearPdfBinaries();
    const seeded = await buildSeededSystemState(currentTheme, user || undefined);
    await this.saveState(seeded, user);
    return seeded;
  }

  async clearAllData(currentTheme: 'dark' | 'light', user?: AuthUser | null): Promise<SystemState> {
    clearPdfBinaries();
    const empty = createEmptyState(currentTheme);
    if (user) {
      empty.settings.displayName = user.displayName;
      empty.settings.email = user.email;
      empty.settings.role = user.role;
      empty.settings.organization = user.organization;
    }
    await this.saveState(empty, user);
    return empty;
  }

  // Supabase-ready sync check (read-only status probe when configured)
  async checkSupabaseHealth(): Promise<{ connected: boolean; message: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        connected: false,
        message:
          'Running in Local Browser Repository mode. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to connect PostgreSQL.',
      };
    }
    try {
      const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
      if (error) {
        return { connected: false, message: `Supabase query check returned: ${error.message}` };
      }
      return { connected: true, message: 'Connected to Supabase PostgreSQL schema with RLS active.' };
    } catch (err) {
      return {
        connected: false,
        message: err instanceof Error ? err.message : 'Unable to reach Supabase client.',
      };
    }
  }
}

export const systemRepository = new SystemRepository();
