import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  selectAuthError,
  selectAuthStatus,
  selectIsAuthenticated,
  selectSessionChecked,
  selectUser,
} from '../features/auth/authSelectors';
import { clearError, loginThunk, logout } from '../features/auth/authSlice';
import type { LoginCredentials } from '../types';

export function useAuth() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const status = useAppSelector(selectAuthStatus);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const sessionChecked = useAppSelector(selectSessionChecked);
  const error = useAppSelector(selectAuthError);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      await dispatch(loginThunk(credentials));
    },
    [dispatch],
  );

  const handleLogout = useCallback(() => {
    dispatch(logout());
  }, [dispatch]);

  const dismissError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  return {
    user,
    status,
    isAuthenticated,
    sessionChecked,
    error,
    login,
    logout: handleLogout,
    dismissError,
  };
}
