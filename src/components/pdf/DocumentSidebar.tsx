import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  selectActiveDocumentId,
  selectAllDocuments,
} from '../../features/documents/documentsSelectors';
import {
  removeDocument,
  setActiveDocument,
} from '../../features/documents/documentsSlice';
import { PDFUploader } from './PDFUploader';
import { deleteFile } from '../../lib/fileStorage';
import type { DocumentRecord } from '../../types';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({
  status,
  isCorrupted,
}: {
  status: DocumentRecord['status'];
  isCorrupted: boolean;
}) {
  if (status === 'error' && isCorrupted) {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-orange-900/40 text-orange-300 flex items-center gap-1">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        Corrupted
      </span>
    );
  }

  const config = {
    uploading:  { label: 'Uploading',  cls: 'bg-blue-900/40 text-blue-300' },
    processing: { label: 'Processing', cls: 'bg-yellow-900/40 text-yellow-300' },
    ready:      { label: 'Ready',      cls: 'bg-green-900/40 text-green-300' },
    error:      { label: 'Error',      cls: 'bg-red-900/40 text-red-300' },
    restoring:  { label: 'Restoring…', cls: 'bg-purple-900/40 text-purple-300' },
  } as const;

  const { label, cls } = config[status];
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>
      {label}
    </span>
  );
}

export function DocumentSidebar() {
  const dispatch = useAppDispatch();
  const documents = useAppSelector(selectAllDocuments);
  const activeId = useAppSelector(selectActiveDocumentId);

  function handleRemove(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    // Delete the binary from IndexedDB before removing the record from Redux
    // so the file doesn't linger in storage after the user removes it from the UI.
    void deleteFile(id);
    dispatch(removeDocument(id));
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 shrink-0">
        <h2 className="text-sm font-semibold text-gray-200">Documents</h2>
        <p className="text-xs text-gray-500 mt-0.5">{documents.length} file{documents.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Upload area */}
      <div className="px-3 py-3 border-b border-gray-800 shrink-0">
        <PDFUploader />
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto">
        {documents.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-gray-500">No documents uploaded yet</p>
          </div>
        ) : (
          <ul className="py-2">
            {documents.map((doc) => (
              <li key={doc.id}>
                <button
                  onClick={() => dispatch(setActiveDocument(doc.id))}
                  className={`
                    w-full text-left px-3 py-2.5 flex items-start gap-3 transition group
                    ${activeId === doc.id
                      ? 'bg-indigo-900/30 border-r-2 border-indigo-500'
                      : 'hover:bg-gray-800/60'
                    }
                  `}
                >
                  {/* PDF icon */}
                  <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center mt-0.5
                    ${activeId === doc.id ? 'bg-indigo-700' : 'bg-gray-800'}`}>
                    {doc.status === 'restoring' ? (
                      <svg className="w-4 h-4 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd"
                          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate font-medium">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={doc.status} isCorrupted={doc.isCorrupted} />
                      <span className="text-xs text-gray-500">{formatSize(doc.size)}</span>
                      {doc.pageCount > 0 && (
                        <span className="text-xs text-gray-500">{doc.pageCount}{doc?.pageCount > 1 ? ' pages' : ' page'}</span>
                      )}
                    </div>
                    {doc.error && (
                      <p className="text-xs text-red-400 mt-1 truncate">{doc.error}</p>
                    )}
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={(e) => handleRemove(e, doc.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition p-1 rounded
                      hover:bg-gray-700 text-gray-500 hover:text-gray-300"
                    title="Remove document"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
