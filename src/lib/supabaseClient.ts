import { createClient } from '@supabase/supabase-js';

// These are public browser credentials (publishable/anon key only). Never place a service-role key here.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://anuhwoqckoagsfjufaoj.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_r8ZGIQoGP4POvWSFG7To8A_DYNrSUWQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
});
