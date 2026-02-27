import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';

const selectUIState = (state: RootState) => state.ui;

export const selectSidebarOpen = createSelector(
  selectUIState,
  (ui) => ui.sidebarOpen,
);

export const selectZoomLevel = createSelector(
  selectUIState,
  (ui) => ui.zoomLevel,
);

export const selectNotifications = createSelector(
  selectUIState,
  (ui) => ui.notifications,
);
