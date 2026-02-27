import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { DocumentMetadata, DocumentsState } from '../../types';

// Store raw File objects outside Redux (not serializable)
export const fileMap = new Map<string, File>();

const initialState: DocumentsState = {
  files: {},
  activeDocumentId: null,
};

const documentsSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {
    addDocument(
      state,
      action: PayloadAction<{
        id: string;
        name: string;
        size: number;
        objectUrl: string;
      }>,
    ) {
      const { id, name, size, objectUrl } = action.payload;
      state.files[id] = {
        id,
        name,
        size,
        pageCount: 0,
        objectUrl,
        status: 'uploading',
        metadata: null,
        error: null,
        isCorrupted: false,
        uploadedAt: Date.now(),
      };
      state.activeDocumentId = id;
    },
    setDocumentProcessing(state, action: PayloadAction<string>) {
      const doc = state.files[action.payload];
      if (doc) {
        doc.status = 'processing';
      }
    },
    updateDocumentMetadata(
      state,
      action: PayloadAction<{ id: string; metadata: DocumentMetadata }>,
    ) {
      const doc = state.files[action.payload.id];
      if (doc) {
        doc.metadata = action.payload.metadata;
        doc.pageCount = action.payload.metadata.pageCount;
        doc.status = 'ready';
      }
    },
    setDocumentError(
      state,
      action: PayloadAction<{ id: string; error: string; isCorrupted?: boolean }>,
    ) {
      const doc = state.files[action.payload.id];
      if (doc) {
        doc.status = 'error';
        doc.error = action.payload.error;
        doc.isCorrupted = action.payload.isCorrupted ?? false;
      }
    },
    setActiveDocument(state, action: PayloadAction<string | null>) {
      state.activeDocumentId = action.payload;
    },
    removeDocument(state, action: PayloadAction<string>) {
      const doc = state.files[action.payload];
      if (doc) {
        URL.revokeObjectURL(doc.objectUrl);
        fileMap.delete(action.payload);
        delete state.files[action.payload];
      }
      if (state.activeDocumentId === action.payload) {
        const remaining = Object.keys(state.files);
        state.activeDocumentId = remaining.length > 0 ? (remaining[remaining.length - 1] ?? null) : null;
      }
    },
  },
});

export const {
  addDocument,
  setDocumentProcessing,
  updateDocumentMetadata,
  setDocumentError,
  setActiveDocument,
  removeDocument,
} = documentsSlice.actions;

export default documentsSlice.reducer;
