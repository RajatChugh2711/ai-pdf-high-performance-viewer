import { useCallback, useEffect, useRef } from 'react';
import { useAppDispatch } from '../app/hooks';
import {
  setDocumentError,
  setDocumentProcessing,
  updateDocumentMetadata,
} from '../features/documents/documentsSlice';
import type { WorkerParseError, WorkerParseSuccess } from '../types';

type WorkerResult = WorkerParseSuccess | WorkerParseError;

function isError(result: WorkerResult): result is WorkerParseError {
  return 'error' in result;
}

export function usePDFWorker() {
  const dispatch = useAppDispatch();
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/pdfParser.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (event: MessageEvent<WorkerResult>) => {
      const result = event.data;
      if (isError(result)) {
        dispatch(
          setDocumentError({
            id: result.id,
            error: result.error,
            isCorrupted: result.isCorrupted,
          }),
        );
      } else {
        dispatch(
          updateDocumentMetadata({ id: result.id, metadata: result.metadata }),
        );
      }
    };

    worker.onerror = (err) => {
      console.error('PDF Worker error:', err);
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [dispatch]);

  const parseFile = useCallback(
    async (id: string, file: File) => {
      const worker = workerRef.current;
      if (!worker) return;

      dispatch(setDocumentProcessing(id));

      const arrayBuffer = await file.arrayBuffer();
      worker.postMessage({ id, arrayBuffer }, [arrayBuffer]);
    },
    [dispatch],
  );

  return { parseFile };
}
