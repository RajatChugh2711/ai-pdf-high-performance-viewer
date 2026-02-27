import * as pdfjsLib from 'pdfjs-dist';
import type { WorkerParseError, WorkerParseRequest, WorkerParseSuccess } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// Patterns in pdfjs error messages that indicate structural corruption
// rather than an unreadable/missing file.
const CORRUPTION_PATTERNS = [
  /invalid pdf structure/i,
  /invalid xref/i,
  /missing pdf header/i,
  /invalid content stream/i,
  /file is damaged/i,
  /corrupt/i,
  /unexpected end/i,
  /bad bfrange/i,
  /invalid cmap/i,
  /invalid object number/i,
  /pdf document version not found/i,
  /failed to load pdf document/i,
  /invalid stream/i,
  /document is encrypted/i,
];

function classifyError(err: unknown): { message: string; isCorrupted: boolean } {
  const message = err instanceof Error ? err.message : 'Failed to parse PDF';
  const isCorrupted = CORRUPTION_PATTERNS.some((re) => re.test(message));
  return { message, isCorrupted };
}

function safeString(val: unknown): string | null {
  return typeof val === 'string' && val.trim().length > 0 ? val.trim() : null;
}

self.onmessage = async (event: MessageEvent<WorkerParseRequest>) => {
  const { id, arrayBuffer } = event.data;

  try {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdfDoc = await loadingTask.promise;

    const numPages = pdfDoc.numPages;

    // Extract metadata — tolerate partial failure
    const meta = await pdfDoc.getMetadata().catch(() => ({ info: {}, metadata: null }));
    const info = meta.info as Record<string, unknown>;

    // PDFFormatVersion is on the top-level info object
    const pdfVersion = safeString(info['PDFFormatVersion']);

    const successPayload: WorkerParseSuccess = {
      id,
      metadata: {
        title: safeString(info['Title']),
        author: safeString(info['Author']),
        subject: safeString(info['Subject']),
        keywords: safeString(info['Keywords']),
        creator: safeString(info['Creator']),
        producer: safeString(info['Producer']),
        creationDate: safeString(info['CreationDate']),
        modDate: safeString(info['ModDate']),
        pdfVersion,
        pageCount: numPages,
        fileSize: arrayBuffer.byteLength,
      },
    };

    self.postMessage(successPayload);
  } catch (err) {
    const { message, isCorrupted } = classifyError(err);
    const errorPayload: WorkerParseError = {
      id,
      error: isCorrupted
        ? `Corrupted PDF: ${message}`
        : message,
      isCorrupted,
    };
    self.postMessage(errorPayload);
  }
};
