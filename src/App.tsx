import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './app/store';
import { useAppDispatch } from './app/hooks';
import { bootstrapSession } from './lib/sessionManager';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { retrieveFile } from './lib/fileStorage';
import {
  fileMap,
  updateObjectUrl,
  markDocumentUnavailable,
} from './features/documents/documentsSlice';

function AppBootstrap() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    void bootstrapSession(dispatch);
  }, [dispatch]);

  // On mount, re-hydrate any documents that were in 'restoring' state (loaded
  // from localStorage) by fetching their raw File binary from IndexedDB and
  // recreating a fresh blob URL for this session.
  useEffect(() => {
    const restoringDocs = Object.values(store.getState().documents.files).filter(
      (doc) => doc.status === 'restoring',
    );

    for (const doc of restoringDocs) {
      void (async () => {
        try {
          const file = await retrieveFile(doc.id);
          if (file) {
            const objectUrl = URL.createObjectURL(file);
            fileMap.set(doc.id, file);
            dispatch(updateObjectUrl({ id: doc.id, objectUrl }));
          } else {
            // File not found in IndexedDB (storage cleared externally)
            dispatch(markDocumentUnavailable(doc.id));
          }
        } catch {
          // IndexedDB read failed — mark unavailable so the user knows to re-upload
          dispatch(markDocumentUnavailable(doc.id));
        }
      })();
    }
  }, []); // intentionally runs once on mount — reads snapshot from preloaded store state

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AppShell>
                <DashboardPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <Provider store={store}>
      <AppBootstrap />
    </Provider>
  );
}

export default App;
