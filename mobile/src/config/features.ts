/**
 * Public self-registration for technicians.
 *
 * Enabled by default so demo builds keep the registration screen. Set
 * `EXPO_PUBLIC_ALLOW_REGISTRATION=false` when the build is exposed to the
 * public: the login link disappears and `/(auth)/register` redirects to login.
 *
 * This flag is a UI policy only, not a security boundary. Anyone who can reach
 * the API directly can still call `POST /api/auth/register`; the server or the
 * WAF in front of it must block that endpoint as well.
 */
export const ALLOW_REGISTRATION =
  (process.env.EXPO_PUBLIC_ALLOW_REGISTRATION ?? 'true').trim().toLowerCase() !== 'false';
