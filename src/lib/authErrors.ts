/**
 * Maps raw Supabase auth error messages to clear, user-friendly copy.
 * Never show raw error objects to users.
 */
const ERROR_MAP: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'Incorrect email or password. Please try again.'],
  [/otp_expired|expired/i, 'This code has expired. Please request a new one.'],
  [/over_email_send_rate_limit|rate.?limit/i, 'Too many code requests. Please wait a minute before trying again.'],
  [/token|otp|code.*(invalid|incorrect)/i, 'The code you entered is incorrect. Please check and try again.'],
  [/email not confirmed|not confirmed/i, 'Your email is not verified yet. Please use "Login with email code" to receive a 6-digit code.'],
  [/user.*not found|no user/i, 'We could not find an account with those details.'],
  [/same.*(email|address)|already.*current/i, 'Please enter a different email address than your current one.'],
  [/new email.*required|email.*required/i, 'Please enter a new email address.'],
  [/anonymous|anonymous_sign/i, 'This sign-in method is not available. Please use your password.'],
  [/fetch|network|503|timeout/i, 'Connection problem. Please check your internet and try again.'],
];

export function friendlyAuthError(
  message: string | null | undefined,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (!message) return fallback;
  for (const [pattern, text] of ERROR_MAP) {
    if (pattern.test(message)) return text;
  }
  return message.length > 140 ? fallback : message;
}
