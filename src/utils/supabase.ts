import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const shouldUseSupabaseProxy = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return !["localhost", "127.0.0.1"].includes(window.location.hostname);
};

const getRuntimeSupabaseUrl = () =>
  shouldUseSupabaseProxy() ? `${window.location.origin}/supabase` : (supabaseUrl as string);

export const supabase = isSupabaseConfigured
  ? createClient(getRuntimeSupabaseUrl(), supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
