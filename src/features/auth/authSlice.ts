import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { AuthState, LoginCredentials, User } from '../../types';
import { mockLogin, mockRefreshToken } from '../../lib/mockBackend';
import {
  clearTokens,
  extractUserFromToken,
  storeTokens,
} from '../../lib/tokenManager';

const initialState: AuthState = {
  token: null,
  refreshToken: null,
  user: null,
  status: 'idle',
  sessionChecked: false,
  error: null,
};

export const loginThunk = createAsyncThunk(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const result = await mockLogin(credentials);
      storeTokens(result.token, result.refreshToken);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      return rejectWithValue(msg);
    }
  },
);

export const refreshTokenThunk = createAsyncThunk(
  'auth/refreshToken',
  async (refreshToken: string, { rejectWithValue }) => {
    try {
      const result = await mockRefreshToken(refreshToken);
      storeTokens(result.token, result.refreshToken);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Token refresh failed';
      return rejectWithValue(msg);
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setTokens(
      state,
      action: PayloadAction<{ token: string; refreshToken: string; user?: User }>,
    ) {
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      if (action.payload.user) {
        state.user = action.payload.user;
      } else {
        state.user = extractUserFromToken(action.payload.token);
      }
      state.status = 'authenticated';
    },
    logout(state) {
      state.token = null;
      state.refreshToken = null;
      state.user = null;
      state.status = 'unauthenticated';
      state.error = null;
      clearTokens();
    },
    setSessionChecked(state, action: PayloadAction<boolean>) {
      state.sessionChecked = action.payload;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.user = action.payload.user;
        state.status = 'authenticated';
        state.sessionChecked = true;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.status = 'unauthenticated';
        state.error = (action.payload as string) ?? 'Login failed';
        state.sessionChecked = true;
      })
      .addCase(refreshTokenThunk.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.user = extractUserFromToken(action.payload.token);
        state.status = 'authenticated';
      })
      .addCase(refreshTokenThunk.rejected, (state) => {
        state.token = null;
        state.refreshToken = null;
        state.user = null;
        state.status = 'unauthenticated';
        clearTokens();
      });
  },
});

export const { setTokens, logout, setSessionChecked, clearError } =
  authSlice.actions;
export default authSlice.reducer;
