import { useCallback, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppDispatch } from '../../app/hooks';
import { addDocument, fileMap } from '../../features/documents/documentsSlice';
import { usePDFWorker } from '../../hooks/usePDFWorker';
import { addNotification } from '../../features/ui/uiSlice';
import { storeFile } from '../../lib/fileStorage';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_TYPE = 'application/pdf';

interface PDFUploaderProps {
  onUploaded?: () => void;
}

export function PDFUploader({ onUploaded }: PDFUploaderProps) {
  const dispatch = useAppDispatch();
  const { parseFile } = usePDFWorker();
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function validateFile(file: File): string | null {
    if (file.type !== ACCEPTED_TYPE) {
      return `"${file.name}" is not a PDF file.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `"${file.name}" exceeds the 50MB limit.`;
    }
    return null;
  }

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      let hasError = false;

      for (const file of fileArray) {
        const error = validateFile(file);
        if (error) {
          dispatch(addNotification({ type: 'error', message: error, duration: 5000 }));
          hasError = true;
          continue;
        }

        const id = uuidv4();
        const objectUrl = URL.createObjectURL(file);

        // Store raw File in module map (for current session) and in IndexedDB
        // (for restoration after page refresh).
        fileMap.set(id, file);
        void storeFile(id, file);

        dispatch(addDocument({ id, name: file.name, size: file.size, objectUrl }));
        void parseFile(id, file);
      }

      if (!hasError && fileArray.length > 0) {
        onUploaded?.();
      }
    },
    [dispatch, parseFile, onUploaded],
  );

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
      className={`
        relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
        ${isDragging
          ? 'border-indigo-400 bg-indigo-900/20'
          : 'border-gray-700 hover:border-gray-500 hover:bg-gray-800/50'
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        onChange={handleInputChange}
        className="hidden"
      />

      <div className="flex flex-col items-center gap-3">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDragging ? 'bg-indigo-600' : 'bg-gray-800'}`}>
          <svg
            className={`w-6 h-6 ${isDragging ? 'text-white' : 'text-gray-400'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-200">
            {isDragging ? 'Drop your PDFs here' : 'Upload PDF documents'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Drag & drop or click to browse · Max 50MB per file
          </p>
        </div>
      </div>
    </div>
  );
}
