import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Notification, UIState } from '../../types';
import { v4 as uuidv4 } from 'uuid';

const initialState: UIState = {
  sidebarOpen: true,
  zoomLevel: 1.0,
  notifications: [],
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
    setZoomLevel(state, action: PayloadAction<number>) {
      state.zoomLevel = Math.max(0.5, Math.min(3.0, action.payload));
    },
    zoomIn(state) {
      state.zoomLevel = Math.min(3.0, Number((state.zoomLevel + 0.1).toFixed(1)));
    },
    zoomOut(state) {
      state.zoomLevel = Math.max(0.5, Number((state.zoomLevel - 0.1).toFixed(1)));
    },
    resetZoom(state) {
      state.zoomLevel = 1.0;
    },
    addNotification(
      state,
      action: PayloadAction<Omit<Notification, 'id'>>,
    ) {
      state.notifications.push({
        id: uuidv4(),
        ...action.payload,
      });
    },
    removeNotification(state, action: PayloadAction<string>) {
      state.notifications = state.notifications.filter(
        (n) => n.id !== action.payload,
      );
    },
    clearNotifications(state) {
      state.notifications = [];
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  setZoomLevel,
  zoomIn,
  zoomOut,
  resetZoom,
  addNotification,
  removeNotification,
  clearNotifications,
} = uiSlice.actions;

export default uiSlice.reducer;
