import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type {
  DocumentMetadata,
  DocumentsState,
} from "../../types/document.types";

import {
  getDocumentsApi,
  renameDocumentApi,
  uploadDocumentApi,
  deleteDocumentApi,
} from "@/api/document.api";

import { v4 as uuid } from "uuid";
import type { AppDispatch } from "@/app/store";
import { deleteFile, storeFile } from "@/lib/fileStorage";

// Store raw File objects outside Redux (not serializable)
export const fileMap = new Map<string, File>();

const initialState: DocumentsState = {
  files: {},
  activeDocumentId: null,
};


// ======================
// Upload Document
// ======================

export const uploadDocument =
  (file: File) => async (dispatch: AppDispatch) => {
    const id = uuid();
    const objectUrl = URL.createObjectURL(file);

    fileMap.set(id, file);
    void storeFile(id, file);

    dispatch(
      addDocument({
        id,
        name: file.name,
        size: file.size,
        objectUrl,
      })
    );

    try {
      dispatch(setDocumentProcessing(id));

      const response: any = await uploadDocumentApi(file);
      const newId = response.document._id;

      // Update fileMap
      fileMap.set(newId, file);
      fileMap.delete(id);

      // Update IndexedDB
      void storeFile(newId, file);
      void deleteFile(id);

      // Update Redux State with new ID from backend
      dispatch(replaceDocumentId({ oldId: id, newId }));

      dispatch(
        updateDocumentMetadata({
          id: newId,
          metadata: {
            pageCount: response.document.pageCount,
          },
        })
      );
    } catch (error: any) {
      dispatch(
        setDocumentError({
          id,
          error: error || "Upload failed",
        })
      );
    }
  };


// ======================
// Fetch Documents
// ======================

export const fetchDocuments =
  () => async (dispatch: AppDispatch) => {
    try {
      const res: any = await getDocumentsApi();

      res.documents.forEach((doc: any) => {
        dispatch(
          addDocument({
            id: doc._id,
            name: doc.name,
            size: doc.size,
            objectUrl: doc.objectUrl,
          })
        );

        dispatch(
          updateDocumentMetadata({
            id: doc._id,
            metadata: {
              pageCount: doc.pageCount || 0,
            },
          })
        );
      });
    } catch (error) {
      console.error("Failed to fetch documents", error);
    }
  };


// ======================
// Rename Document
// ======================

export const updateDocumentName =
  (id: string, name: string) =>
  async (dispatch: AppDispatch) => {
    try {
      await renameDocumentApi(id, name);

      dispatch(
        renameDocument({
          id,
          name,
        })
      );
    } catch (error) {
      console.error("Rename failed", error);
    }
  };


// ======================
// Delete Document
// ======================

export const deleteDocument =
  (id: string) => async (dispatch: AppDispatch) => {
    try {
      await deleteDocumentApi(id);
      void deleteFile(id);
      dispatch(removeDocument(id));
    } catch (error) {
      console.error("Delete failed", error);
    }
  };


// ======================
// Slice
// ======================

const documentsSlice = createSlice({
  name: "documents",
  initialState,
  reducers: {
    addDocument(
      state,
      action: PayloadAction<{
        id: string;
        name: string;
        size: number;
        objectUrl: string;
      }>
    ) {
      const { id, name, size, objectUrl } = action.payload;

      if (!state.files[id]) {
        state.files[id] = {
          id,
          name,
          size,
          pageCount: 0,
          objectUrl,
          status: "uploading",
          metadata: null,
          error: null,
          isCorrupted: false,
          uploadedAt: Date.now(),
        };
      }

      state.activeDocumentId = id;
    },

    setDocumentProcessing(state, action: PayloadAction<string>) {
      const doc = state.files[action.payload];
      if (doc) {
        doc.status = "processing";
      }
    },

    updateDocumentMetadata(
      state,
      action: PayloadAction<{ id: string; metadata: DocumentMetadata }>
    ) {
      const doc = state.files[action.payload.id];
      if (doc) {
        doc.metadata = action.payload.metadata;
        doc.pageCount = action.payload.metadata.pageCount;
        doc.status = "ready";
      }
    },

    setDocumentError(
      state,
      action: PayloadAction<{
        id: string;
        error: string;
        isCorrupted?: boolean;
      }>
    ) {
      const doc = state.files[action.payload.id];
      if (doc) {
        doc.status = "error";
        doc.error = action.payload.error;
        doc.isCorrupted = action.payload.isCorrupted ?? false;
      }
    },

    setActiveDocument(state, action: PayloadAction<string | null>) {
      state.activeDocumentId = action.payload;
    },

    updateObjectUrl(
      state,
      action: PayloadAction<{ id: string; objectUrl: string }>
    ) {
      const doc = state.files[action.payload.id];
      if (doc) {
        doc.objectUrl = action.payload.objectUrl;
        doc.status = "ready";
      }
    },

    markDocumentUnavailable(state, action: PayloadAction<string>) {
      const doc = state.files[action.payload];
      if (doc) {
        doc.status = "error";
        doc.error = "File no longer available. Please re-upload.";
        doc.objectUrl = "";
      }
    },

    renameDocument(
      state,
      action: PayloadAction<{ id: string; name: string }>
    ) {
      const doc = state.files[action.payload.id];
      if (doc) {
        doc.name = action.payload.name;
      }
    },

    replaceDocumentId(
      state,
      action: PayloadAction<{ oldId: string; newId: string }>
    ) {
      const { oldId, newId } = action.payload;
      const doc = state.files[oldId];
      if (doc) {
        doc.id = newId;
        state.files[newId] = doc;
        delete state.files[oldId];

        if (state.activeDocumentId === oldId) {
          state.activeDocumentId = newId;
        }
      }
    },

    removeDocument(state, action: PayloadAction<string>) {
      const doc = state.files[action.payload];

      if (doc) {
        if (doc.objectUrl) {
          URL.revokeObjectURL(doc.objectUrl);
        }
        fileMap.delete(action.payload);
        delete state.files[action.payload];
      }

      if (state.activeDocumentId === action.payload) {
        const remaining = Object.keys(state.files);

        state.activeDocumentId =
          remaining.length > 0
            ? remaining[remaining.length - 1]
            : null;
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
  updateObjectUrl,
  markDocumentUnavailable,
  renameDocument,
  replaceDocumentId,
  removeDocument,
} = documentsSlice.actions;

export default documentsSlice.reducer;