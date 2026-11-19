import { createClient } from '@supabase/supabase-js';

/**
 * Check that `password` is the signed-in person's login password.
 * It signs in on a throw-away client that keeps nothing, so the person's real session is untouched.
 * Returns an error message, or null when the password is right.
 */
export async function verifyLoginPassword(email: string, password: string): Promise<string | null> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return 'The app is not configured to check passwords';
  if (!email) return 'Your account has no email address to check';
  if (!password) return 'Enter your password';

  const probe = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'niza-reauth-probe' },
  });
  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (!error) return null;
  if (/invalid login|invalid credentials/i.test(error.message)) return 'That password is not correct';
  if (/rate|too many/i.test(error.message)) return 'Too many attempts. Wait a minute and try again.';
  return error.message;
}
