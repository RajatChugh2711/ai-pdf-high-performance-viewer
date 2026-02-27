import type { JWTPayload, TokenPair, User } from '../types';

const TOKEN_KEY = 'adt_token';
const REFRESH_TOKEN_KEY = 'adt_refresh_token';

// Base64 encode/decode to "obfuscate" stored tokens (not real encryption)
function encode(value: string): string {
  return btoa(encodeURIComponent(value));
}

function decode(value: string): string {
  try {
    return decodeURIComponent(atob(value));
  } catch {
    return '';
  }
}

export function storeTokens(token: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEY, encode(token));
  localStorage.setItem(REFRESH_TOKEN_KEY, encode(refreshToken));
}

export function getTokens(): TokenPair | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  const rawRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!raw || !rawRefresh) return null;

  const token = decode(raw);
  const refreshToken = decode(rawRefresh);
  if (!token || !refreshToken) return null;

  return { token, refreshToken };
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function decodeToken(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    if (!payload) return null;
    // JWT uses base64url encoding
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(atob(padded)) as JWTPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload) return true;
  // Add 10 second buffer
  return Date.now() / 1000 > payload.exp - 10;
}

export function extractUserFromToken(token: string): User | null {
  const payload = decodeToken(token);
  if (!payload) return null;
  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    role: payload.role,
  };
}
