import type { AppDispatch } from '../app/store';
import { logout, setSessionChecked, setTokens } from '../features/auth/authSlice';
import { mockRefreshToken } from './mockBackend';
import {
  clearTokens,
  extractUserFromToken,
  getTokens,
  isTokenExpired,
  storeTokens,
} from './tokenManager';

/**
 * Bootstrap session on app start.
 * Checks localStorage for existing tokens, attempts silent refresh if expired.
 * Sets sessionChecked = true when done (prevents flash of login screen).
 */
export async function bootstrapSession(dispatch: AppDispatch): Promise<void> {
  const tokens = getTokens();

  if (!tokens) {
    dispatch(logout());
    dispatch(setSessionChecked(true));
    return;
  }

  const { token, refreshToken } = tokens;

  if (!isTokenExpired(token)) {
    // Token is still valid
    const user = extractUserFromToken(token);
    dispatch(setTokens({ token, refreshToken, user: user ?? undefined }));
    dispatch(setSessionChecked(true));
    return;
  }

  // Token expired — attempt silent refresh
  try {
    const newTokens = await mockRefreshToken(refreshToken);
    storeTokens(newTokens.token, newTokens.refreshToken);
    const user = extractUserFromToken(newTokens.token);
    dispatch(
      setTokens({
        token: newTokens.token,
        refreshToken: newTokens.refreshToken,
        user: user ?? undefined,
      }),
    );
  } catch {
    // Refresh failed — clear storage and mark unauthenticated
    clearTokens();
    dispatch(logout());
  } finally {
    dispatch(setSessionChecked(true));
  }
}
