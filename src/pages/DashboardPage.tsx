import { lazy, Suspense } from 'react';
import { useAppSelector } from '../app/hooks';
import { selectActiveDocument } from '../features/documents/documentsSelectors';
import { selectSidebarOpen } from '../features/ui/uiSelectors';
import { DocumentSidebar } from '../components/pdf/DocumentSidebar';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';

const PDFViewer = lazy(() =>
  import('../components/pdf/PDFViewer').then((m) => ({ default: m.PDFViewer })),
);

const ChatPanel = lazy(() =>
  import('../components/chat/ChatPanel').then((m) => ({ default: m.ChatPanel })),
);

function SuspenseFallback({ label }: { label: string }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <svg className="animate-spin h-7 w-7 text-indigo-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-gray-500 text-xs">Loading {label}...</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">No document selected</h2>
        <p className="text-gray-400 text-sm">
          Upload a PDF from the sidebar to start chatting with your document.
        </p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const activeDocument = useAppSelector(selectActiveDocument);
  const sidebarOpen = useAppSelector(selectSidebarOpen);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-72 flex-shrink-0 overflow-hidden">
          <DocumentSidebar />
        </div>
      )}

      {/* Main area */}
      {activeDocument ? (
        <div className="flex-1 flex overflow-hidden min-w-0">
          {/* PDF Viewer */}
          <div className="flex-1 overflow-hidden min-w-0 border-r border-gray-800">
            <ErrorBoundary label="PDFViewer">
              <Suspense fallback={<SuspenseFallback label="PDF viewer" />}>
                <PDFViewer
                  objectUrl={activeDocument.objectUrl}
                  pageCount={activeDocument.pageCount || 1}
                />
              </Suspense>
            </ErrorBoundary>
          </div>

          {/* Chat Panel */}
          <div className="w-96 flex-shrink-0 flex flex-col overflow-hidden">
            <ErrorBoundary label="ChatPanel">
              <Suspense fallback={<SuspenseFallback label="chat" />}>
                <ChatPanel document={activeDocument} />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
