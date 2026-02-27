import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { List } from 'react-window';
import type { ListImperativeAPI } from 'react-window';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFPage } from './PDFPage';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { zoomIn, zoomOut, resetZoom } from '../../features/ui/uiSlice';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// Initialize pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface PDFViewerProps {
  objectUrl: string;
  pageCount: number;
}

export interface PDFViewerHandle {
  scrollToPage: (page: number) => void;
}

const DEFAULT_PAGE_HEIGHT = 842; // A4 height in points

// RowProps passed to each row via rowProps — no heightCache, not needed in render
interface RowExtraProps {
  pdfDoc: PDFDocumentProxy;
  scale: number;
  onHeightMeasured: (index: number, height: number) => void;
}

// Row renderer for react-window v2 List.
// Uses useCallback to give each page a stable onHeightMeasured reference so
// PDFPage's React.memo can bail out on rapid scrolling (no new function identity
// = no spurious canvas re-render).
function PDFRow({
  index,
  style,
  pdfDoc,
  scale,
  onHeightMeasured,
}: {
  index: number;
  style: React.CSSProperties;
  ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' };
} & RowExtraProps) {
  // useCallback: dep on [onHeightMeasured, index] — both are stable per row
  const handleHeight = useCallback(
    (h: number) => onHeightMeasured(index, h),
    [onHeightMeasured, index],
  );

  return (
    <div style={style}>
      <PDFPage
        pdfDocument={pdfDoc}
        pageNumber={index + 1}
        scale={scale}
        onHeightMeasured={handleHeight}
      />
    </div>
  );
}

export const PDFViewer = forwardRef<PDFViewerHandle, PDFViewerProps>(
  function PDFViewer({ objectUrl, pageCount }, ref) {
    const dispatch = useAppDispatch();
    const zoomLevel = useAppSelector((s) => s.ui.zoomLevel);
    const listRef = useRef<ListImperativeAPI | null>(null);

    const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [jumpInput, setJumpInput] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isCorruptedFile, setIsCorruptedFile] = useState(false);

    const heightCacheRef = useRef<Map<number, number>>(new Map());
    const jumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pageUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevZoomRef = useRef(zoomLevel);

    // Load PDF document
    useEffect(() => {
      // Empty objectUrl means the document is still being restored from IndexedDB.
      // Don't attempt to load — DashboardPage shows a placeholder for this state.
      if (!objectUrl) return;

      let cancelled = false;
      setIsLoading(true);
      setLoadError(null);
      setIsCorruptedFile(false);
      setPdfDoc(null);
      heightCacheRef.current.clear();

      const loadingTask = pdfjsLib.getDocument(objectUrl);
      loadingTask.promise
        .then((doc) => {
          if (!cancelled) {
            setPdfDoc(doc);
            setTimeout(() => {
              setIsLoading(false);
            }, 2000);
            setCurrentPage(1);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            const msg = err instanceof Error ? err.message : 'Failed to load PDF';
            // Detect structural corruption from pdfjs error messages
            const corrupted = /invalid pdf|invalid xref|corrupt|damaged|missing.*header|unexpected end/i.test(msg);
            setIsCorruptedFile(corrupted);
            setLoadError(msg);
            setIsLoading(false);
          }
        });

      return () => {
        cancelled = true;
        loadingTask.destroy().catch(() => undefined);
        if (pageUpdateTimerRef.current) clearTimeout(pageUpdateTimerRef.current);
      };
    }, [objectUrl]);

    // Prefetch next pages
    useEffect(() => {
      if (!pdfDoc) return;
      [currentPage + 1, currentPage + 2].forEach((p) => {
        if (p > 0 && p <= pdfDoc.numPages) {
          pdfDoc.getPage(p).catch(() => undefined);
        }
      });
    }, [pdfDoc, currentPage]);

    // Reset height cache when zoom changes
    useEffect(() => {
      if (prevZoomRef.current !== zoomLevel) {
        prevZoomRef.current = zoomLevel;
        heightCacheRef.current.clear();
      }
    }, [zoomLevel]);

    const getRowHeight = useCallback(
      (index: number) => {
        const cached = heightCacheRef.current.get(index);
        return cached ?? DEFAULT_PAGE_HEIGHT * zoomLevel + 16;
      },
      [zoomLevel],
    );

    const handleHeightMeasured = useCallback((index: number, height: number) => {
      heightCacheRef.current.set(index, height);
    }, []);

    const scrollToPage = useCallback(
      (page: number, smooth = true) => {
        const clamped = Math.max(1, Math.min(page, pageCount));
        // Use smooth only for short jumps (≤30 pages); large jumps use instant
        // to avoid janky multi-second scrolls across hundreds of pages.
        const distance = Math.abs(clamped - currentPage);
        const behavior = smooth && distance <= 30 ? 'smooth' : 'instant';
        listRef.current?.scrollToRow({ index: clamped - 1, align: 'start', behavior });
        setCurrentPage(clamped);
      },
      [pageCount, currentPage, listRef],
    );

    useImperativeHandle(ref, () => ({ scrollToPage }), [scrollToPage]);

    function handleJumpSubmit(e: React.FormEvent) {
      e.preventDefault();
      const num = parseInt(jumpInput, 10);
      if (!isNaN(num)) {
        scrollToPage(num);
        setJumpInput('');
      }
    }

    function handleJumpChange(val: string) {
      setJumpInput(val);
      if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
      const num = parseInt(val, 10);
      if (!isNaN(num) && num >= 1 && num <= pageCount) {
        jumpTimerRef.current = setTimeout(() => {
          scrollToPage(num);
        }, 600);
      }
    }

    if (isLoading) {
      return (
        <div className="flex-1 flex items-center h-full justify-center bg-gray-950">
          <div className="text-center">
            <svg className="animate-spin h-8 w-8 text-indigo-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-gray-400 text-sm">Loading PDF...</p>
          </div>
        </div>
      );
    }

    if (loadError) {
      return isCorruptedFile ? (
        // Distinct corrupted-file state
        <div className="flex-1 flex items-center justify-center h-full bg-gray-950">
          <div className="text-center max-w-sm px-4">
            <div className="w-14 h-14 rounded-full bg-orange-900/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <p className="text-orange-300 font-semibold text-base">Corrupted PDF File</p>
            <p className="text-gray-400 text-sm mt-1">
              This file appears to be damaged or is not a valid PDF document.
            </p>
            <p className="text-gray-600 text-xs mt-3 font-mono wrap-break-words">{loadError}</p>
          </div>
        </div>
      ) : (
        // Generic load failure (network, permission, etc.)
        <div className="flex-1 flex h-full items-center justify-center bg-gray-950">
          <div className="text-center max-w-sm px-4">
            <div className="w-12 h-12 rounded-full bg-red-900/30 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-red-300 font-medium">Failed to load PDF</p>
            <p className="text-gray-500 text-sm mt-1">{loadError}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full bg-gray-950">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 bg-gray-900 flex-shrink-0">
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => scrollToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
              title="Previous page"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => scrollToPage(currentPage + 1)}
              disabled={currentPage >= pageCount}
              className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
              title="Next page"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Page indicator + jump */}
          <form onSubmit={handleJumpSubmit} className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={pageCount}
              value={jumpInput}
              onChange={(e) => handleJumpChange(e.target.value)}
              placeholder={String(currentPage)}
              className="w-14 px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-white text-center
                focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-xs text-gray-400">/ {pageCount}</span>
          </form>

          <div className="flex-1" />

          {/* Zoom */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => dispatch(zoomOut())}
              disabled={zoomLevel <= 0.5}
              className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition"
              title="Zoom out"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
            </button>
            <button
              onClick={() => dispatch(resetZoom())}
              className="px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-gray-800 rounded transition min-w-[3rem] text-center"
              title="Reset zoom"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              onClick={() => dispatch(zoomIn())}
              disabled={zoomLevel >= 3.0}
              className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition"
              title="Zoom in"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Pages */}
        {pdfDoc && (
          <div className="flex-1 overflow-hidden">
            <List
              listRef={listRef}
              rowCount={pageCount}
              rowHeight={getRowHeight}
              overscanCount={2}
              rowComponent={PDFRow}
              rowProps={{
                pdfDoc,
                scale: zoomLevel,
                onHeightMeasured: handleHeightMeasured,
              }}
              onRowsRendered={(visibleRows) => {
                // Debounce the page indicator update: fires at most every 100 ms
                // during fast scrolling so we don't schedule React re-renders on
                // every single scroll event (~60/s).
                if (pageUpdateTimerRef.current) clearTimeout(pageUpdateTimerRef.current);
                pageUpdateTimerRef.current = setTimeout(() => {
                  setCurrentPage(visibleRows.startIndex + 1);
                }, 100);
              }}
              style={{ height: '100%' }}
              className="scrollbar-thin"
            />
          </div>
        )}
      </div>
    );
  },
);
