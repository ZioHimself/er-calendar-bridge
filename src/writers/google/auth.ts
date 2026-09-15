import { OAuth2Client } from 'google-auth-library';

/** SEC-03: calendar scope only — use when generating offline refresh tokens. */
export const GOOGLE_CALENDAR_SCOPE =
  'https://www.googleapis.com/auth/calendar';

export type GoogleAuthConfig = Readonly<{
  googleClientId: string;
  googleClientSecret: string;
  googleRefreshToken: string;
}>;

export function createGoogleAuthClient(
  config: GoogleAuthConfig,
): OAuth2Client {
  const client = new OAuth2Client(
    config.googleClientId,
    config.googleClientSecret,
  );
  client.setCredentials({ refresh_token: config.googleRefreshToken });
  return client;
}
