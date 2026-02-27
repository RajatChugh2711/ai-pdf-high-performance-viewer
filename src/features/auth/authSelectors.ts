import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';

const selectAuthState = (state: RootState) => state.auth;

export const selectToken = createSelector(
  selectAuthState,
  (auth) => auth.token,
);

export const selectRefreshToken = createSelector(
  selectAuthState,
  (auth) => auth.refreshToken,
);

export const selectUser = createSelector(selectAuthState, (auth) => auth.user);

export const selectAuthStatus = createSelector(
  selectAuthState,
  (auth) => auth.status,
);

export const selectSessionChecked = createSelector(
  selectAuthState,
  (auth) => auth.sessionChecked,
);

export const selectAuthError = createSelector(
  selectAuthState,
  (auth) => auth.error,
);

export const selectIsAuthenticated = createSelector(
  selectAuthState,
  (auth) => auth.status === 'authenticated' && auth.token !== null,
);
