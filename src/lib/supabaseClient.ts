import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    supabaseAnonKey.length > 20
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export function getStorageMode(): {
  mode: 'supabase' | 'local';
  label: string;
  detail: string;
} {
  if (isSupabaseConfigured && supabase) {
    return {
      mode: 'supabase',
      label: 'Supabase Client Ready',
      detail: 'Connected via VITE_SUPABASE_URL public client.',
    };
  }
  return {
    mode: 'local',
    label: 'Local Browser Repository',
    detail: 'Persisting state in browser localStorage. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to connect Supabase.',
  };
}
