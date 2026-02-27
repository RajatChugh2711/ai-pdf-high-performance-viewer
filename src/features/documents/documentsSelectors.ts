import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';

const selectDocumentsState = (state: RootState) => state.documents;

export const selectAllDocuments = createSelector(
  selectDocumentsState,
  (docs) => Object.values(docs.files),
);

export const selectActiveDocumentId = createSelector(
  selectDocumentsState,
  (docs) => docs.activeDocumentId,
);

export const selectActiveDocument = createSelector(
  selectDocumentsState,
  (docs) =>
    docs.activeDocumentId ? (docs.files[docs.activeDocumentId] ?? null) : null,
);

export const selectDocumentById = (id: string) =>
  createSelector(selectDocumentsState, (docs) => docs.files[id] ?? null);

export const selectDocumentCount = createSelector(
  selectDocumentsState,
  (docs) => Object.keys(docs.files).length,
);
