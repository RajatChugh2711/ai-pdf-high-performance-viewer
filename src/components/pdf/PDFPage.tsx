import { memo, useEffect, useRef } from 'react';
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import type { RenderParameters } from 'pdfjs-dist/types/src/display/api';

interface PDFPageProps {
  pdfDocument: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  onHeightMeasured?: (height: number) => void;
}

export const PDFPage = memo(function PDFPage({
  pdfDocument,
  pageNumber,
  scale,
  onHeightMeasured,
}: PDFPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const pageRef = useRef<PDFPageProxy | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Cancel any in-flight render
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        renderTaskRef.current = null;
      }

      // Release previous page
      if (pageRef.current) {
        pageRef.current.cleanup();
        pageRef.current = null;
      }

      try {
        const page = await pdfDocument.getPage(pageNumber);
        if (cancelled) {
          page.cleanup();
          return;
        }

        pageRef.current = page;

        const viewport = page.getViewport({ scale });
        const pixelRatio = window.devicePixelRatio || 1;

        canvas.width = viewport.width * pixelRatio;
        canvas.height = viewport.height * pixelRatio;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        onHeightMeasured?.(viewport.height + 16); // 16 = margin

        const ctx = canvas.getContext('2d');
        if (!ctx || cancelled) return;

        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        const renderContext: RenderParameters = {
          canvasContext: ctx as unknown as RenderParameters['canvasContext'],
          canvas,
          viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        renderTaskRef.current = null;
      } catch (err) {
        // RenderingCancelledException is expected on fast scrolling
        const msg = err instanceof Error ? err.message : '';
        if (!msg.includes('Rendering cancelled') && !cancelled) {
          console.error(`Failed to render page ${pageNumber}:`, err);
        }
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        renderTaskRef.current = null;
      }
      if (pageRef.current) {
        pageRef.current.cleanup();
        pageRef.current = null;
      }
    };
  }, [pdfDocument, pageNumber, scale, onHeightMeasured]);

  return (
    <div className="flex justify-center py-2">
      <div className="relative shadow-lg rounded overflow-hidden bg-white">
        <canvas ref={canvasRef} />
        {/* Page number label */}
        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
          {pageNumber}
        </div>
      </div>
    </div>
  );
});
