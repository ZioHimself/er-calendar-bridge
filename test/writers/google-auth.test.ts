import { describe, it, expect } from 'vitest';
import {
  GOOGLE_CALENDAR_SCOPE,
  createGoogleAuthClient,
} from '../../src/writers/google/auth.js';

describe('Google auth (SEC-03)', () => {
  it('exports calendar-only OAuth scope constant', () => {
    expect(GOOGLE_CALENDAR_SCOPE).toBe(
      'https://www.googleapis.com/auth/calendar',
    );
  });

  it('createGoogleAuthClient sets refresh token credentials', () => {
    const client = createGoogleAuthClient({
      googleClientId: 'client-id',
      googleClientSecret: 'client-secret',
      googleRefreshToken: 'refresh-token',
    });
    expect(client.credentials.refresh_token).toBe('refresh-token');
  });
});
