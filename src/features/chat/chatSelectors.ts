import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';

const selectChatState = (state: RootState) => state.chat;

export const selectAllConversations = createSelector(
  selectChatState,
  (chat) => chat.conversations,
);

export const selectConversationByDocId = (docId: string | null) =>
  createSelector(
    selectChatState,
    (chat) => (docId ? (chat.conversations[docId] ?? []) : []),
  );

export const selectStreamingState = createSelector(
  selectChatState,
  (chat) => chat.streamingState,
);

export const selectIsStreaming = createSelector(
  selectChatState,
  (chat) => chat.isStreaming,
);

export const selectErrorDocId = createSelector(
  selectChatState,
  (chat) => chat.errorDocId,
);
