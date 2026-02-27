import { configureStore } from '@reduxjs/toolkit';
import type { Middleware } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import documentsReducer from '../features/documents/documentsSlice';
import chatReducer from '../features/chat/chatSlice';
import uiReducer from '../features/ui/uiSlice';

const CHAT_CONVERSATIONS_KEY = 'adt_chat_conversations';

// Debounce timer for localStorage writes
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(key: string, value: unknown, delay = 300): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage quota exceeded or unavailable — ignore
    }
  }, delay);
}

// Middleware: persists chat.conversations to localStorage on every dispatch
const localStorageMiddleware: Middleware = (store) => (next) => (action) => {
  const result = next(action);
  const state = store.getState() as ReturnType<typeof store.getState>;

  // Only persist after chat-related actions
  const actionType = typeof action === 'object' && action !== null && 'type' in action
    ? String((action as { type: unknown }).type)
    : '';

  if (actionType.startsWith('chat/')) {
    debouncedSave(CHAT_CONVERSATIONS_KEY, state.chat.conversations);
  }

  return result;
};

// Load persisted conversations from localStorage
function loadPersistedConversations(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(CHAT_CONVERSATIONS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Corrupted data — ignore
  }
  return {};
}

const preloadedConversations = loadPersistedConversations();

export const store = configureStore({
  reducer: {
    auth: authReducer,
    documents: documentsReducer,
    chat: chatReducer,
    ui: uiReducer,
  },
  preloadedState: {
    chat: {
      conversations: preloadedConversations as Record<string, import('../types').Message[]>,
      streamingState: { docId: null, content: '', messageId: null },
      isStreaming: false,
      errorDocId: null,
    },
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // File objects stored outside Redux — ignore objectUrl warning
        ignoredPaths: ['documents.files'],
      },
    }).concat(localStorageMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
