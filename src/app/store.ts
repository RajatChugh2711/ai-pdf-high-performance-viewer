import { configureStore } from '@reduxjs/toolkit';
import type { Middleware } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import documentsReducer from '../features/documents/documentsSlice';
import chatReducer from '../features/chat/chatSlice';
import uiReducer from '../features/ui/uiSlice';
import type { DocumentRecord, DocumentsState, Message } from '../types';

const CHAT_CONVERSATIONS_KEY = 'adt_chat_conversations';
const DOCUMENTS_KEY = 'adt_documents';

// Per-key debounce timers — a single shared timer would cancel a chat save
// when a documents save fired within the same 300 ms window (and vice-versa).
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function debouncedSave(key: string, value: unknown, delay = 300): void {
  const existing = saveTimers.get(key);
  if (existing !== undefined) clearTimeout(existing);

  saveTimers.set(
    key,
    setTimeout(() => {
      saveTimers.delete(key);
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Storage quota exceeded or unavailable — ignore
      }
    }, delay),
  );
}

// ─── Document persistence helpers ───────────────────────────────────────────

/**
 * Shape saved to localStorage: metadata only, no objectUrl.
 * blob: URLs are invalidated on refresh, so we strip them before saving.
 */
type PersistedDocumentsState = {
  files: Record<string, Omit<DocumentRecord, 'objectUrl'> & { objectUrl: '' }>;
  activeDocumentId: string | null;
};

function buildDocumentSnapshot(
  state: DocumentsState,
): PersistedDocumentsState {
  const files: PersistedDocumentsState['files'] = {};
  for (const [id, doc] of Object.entries(state.files)) {
    // Strip the live blob URL — it will be regenerated from IndexedDB on restore
    files[id] = { ...doc, objectUrl: '' };
  }
  return { files, activeDocumentId: state.activeDocumentId };
}

function loadPersistedDocuments(): Partial<DocumentsState> | null {
  try {
    const raw = localStorage.getItem(DOCUMENTS_KEY);
    if (!raw) return null;

    const saved = JSON.parse(raw) as PersistedDocumentsState;
    const files: Record<string, DocumentRecord> = {};

    for (const [id, doc] of Object.entries(saved.files)) {
      // Documents that were ready/processing when the tab closed need their
      // objectUrl recreated. Mark them 'restoring' so the bootstrap hook
      // knows to fetch from IndexedDB. Error documents stay as-is.
      const restorable = doc.status === 'ready'
        || doc.status === 'processing'
        || doc.status === 'uploading'
        || doc.status === 'restoring';

      files[id] = {
        ...doc,
        objectUrl: '',
        status: restorable ? 'restoring' : doc.status,
      };
    }

    return { files, activeDocumentId: saved.activeDocumentId };
  } catch {
    return null;
  }
}

// ─── Chat persistence helpers ────────────────────────────────────────────────

function loadPersistedConversations(): Record<string, Message[]> {
  try {
    const raw = localStorage.getItem(CHAT_CONVERSATIONS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, Message[]>;
  } catch {
    // Corrupted data — ignore
  }
  return {};
}

// ─── Middleware ──────────────────────────────────────────────────────────────

const localStorageMiddleware: Middleware = (storeApi) => (next) => (action) => {
  const result = next(action);
  const state = storeApi.getState() as ReturnType<typeof storeApi.getState>;

  const actionType =
    typeof action === 'object' && action !== null && 'type' in action
      ? String((action as { type: unknown }).type)
      : '';

  if (actionType.startsWith('chat/')) {
    debouncedSave(CHAT_CONVERSATIONS_KEY, state.chat.conversations);
  }

  if (actionType.startsWith('documents/')) {
    debouncedSave(DOCUMENTS_KEY, buildDocumentSnapshot(state.documents));
  }

  return result;
};

// ─── Store creation ──────────────────────────────────────────────────────────

const persistedConversations = loadPersistedConversations();
const persistedDocuments = loadPersistedDocuments();

export const store = configureStore({
  reducer: {
    auth: authReducer,
    documents: documentsReducer,
    chat: chatReducer,
    ui: uiReducer,
  },
  preloadedState: {
    chat: {
      conversations: persistedConversations,
      streamingState: { docId: null, content: '', messageId: null },
      isStreaming: false,
      errorDocId: null,
    },
    documents: {
      files: persistedDocuments?.files ?? {},
      activeDocumentId: persistedDocuments?.activeDocumentId ?? null,
    },
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredPaths: ['documents.files'],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }).concat(localStorageMiddleware as any),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
