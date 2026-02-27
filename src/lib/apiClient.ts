import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { store } from '../app/store';
import { logout, setTokens } from '../features/auth/authSlice';
import { mockRefreshToken } from './mockBackend';
import { storeTokens } from './tokenManager';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

// Extend config type to carry a per-request retry marker.
// This replaces the old module-level `refreshAttempted` flag, which had a
// critical bug: it was never reset after a failed refresh, so after logout +
// re-login all future 401s would be immediately rejected without attempting
// a refresh.
interface RetryableConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

// Queued requests waiting for an in-flight token refresh to complete
type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  config: RetryableConfig;
};

let isRefreshing = false;

// Module-level queue. Bounded in practice: only 401 responses during the
// ~300 ms refresh window are queued. flushQueue always drains it fully on
// both success and failure paths, so it cannot grow indefinitely.
const pendingQueue: PendingRequest[] = [];

/**
 * Drain the pending queue, either replaying requests with a fresh token
 * or rejecting them all if the refresh failed.
 *
 * IMPORTANT: We snapshot the array before clearing it so that any new 401
 * that arrives mid-flush (and pushes into pendingQueue) is NOT silently
 * dropped — it will be processed on the next refresh cycle.
 */
function flushQueue(error: unknown, token?: string): void {
  // Snapshot then clear immediately so concurrent pushes during the loop
  // go into a fresh queue and are handled by the next refresh cycle.
  const snapshot = pendingQueue.splice(0, pendingQueue.length);

  snapshot.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error);
      return;
    }

    if (!token) {
      // Should never happen (called with neither error nor token), but guard
      // against it explicitly so no Promise ever hangs permanently.
      reject(new Error('Token refresh produced no token'));
      return;
    }

    // Ensure headers object exists before mutating
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${token}`;
    resolve(apiClient(config));
  });
}

// ─── Request interceptor ────────────────────────────────────────────────────
// Reads token via store.getState() at call-time rather than capturing it at
// interceptor-setup time. This avoids a stale-closure bug: if the token were
// captured once during setup it would never reflect refreshed tokens.
apiClient.interceptors.request.use((config) => {
  const token = store.getState().auth.token;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor ───────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const axiosError = error as {
      response?: { status?: number };
      config?: RetryableConfig;
    };
    const status = axiosError.response?.status;
    const config = axiosError.config;

    // Only handle 401s that have a config to replay
    if (status !== 401 || !config) {
      return Promise.reject(error);
    }

    // Per-request guard: if this specific request has already been retried
    // once, don't retry again (prevents infinite 401 → refresh → 401 loops
    // even if the server keeps returning 401 for the replayed request).
    if (config._retry) {
      store.dispatch(logout());
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Another refresh is already in flight — queue this request.
      // It will be replayed (or rejected) when flushQueue is called.
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject, config });
      });
    }

    // Read refresh token fresh from the store (not a stale closure)
    const refreshToken = store.getState().auth.refreshToken;
    if (!refreshToken) {
      store.dispatch(logout());
      return Promise.reject(error);
    }

    isRefreshing = true;

    try {
      const tokens = await mockRefreshToken(refreshToken);
      storeTokens(tokens.token, tokens.refreshToken);
      store.dispatch(
        setTokens({ token: tokens.token, refreshToken: tokens.refreshToken }),
      );

      // Replay all queued requests with the fresh token
      flushQueue(null, tokens.token);
      isRefreshing = false;

      // Replay the original request that triggered the refresh.
      // Mark it _retry so a second 401 on this specific request doesn't loop.
      config._retry = true;
      config.headers = config.headers ?? {};
      config.headers['Authorization'] = `Bearer ${tokens.token}`;
      return apiClient(config);
    } catch (refreshError) {
      // Refresh failed: reject every queued request, then force logout.
      // Reset isRefreshing so future requests (after re-login) can trigger a
      // fresh refresh cycle — without this reset the interceptor would stay
      // locked forever.
      flushQueue(refreshError);
      isRefreshing = false;
      store.dispatch(logout());
      return Promise.reject(refreshError);
    }
  },
);

export default apiClient;
