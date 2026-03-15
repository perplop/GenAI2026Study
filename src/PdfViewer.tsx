import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-expect-error - Vite resolves worker URL from node_modules
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from './lib/utils';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
}

interface PdfViewerProps {
  /** URL to fetch the PDF from (e.g. /api/files/filename.pdf) */
  pdfUrl: string;
  /** 1-based start page to initially show */
  startPage?: number;
  /** 1-based end page for the section range */
  endPage?: number;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ pdfUrl, startPage = 1, endPage }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(startPage);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const effectiveEnd = endPage ?? totalPages;

  // Load PDF document
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    pdfjsLib.getDocument(pdfUrl).promise
      .then(doc => {
        if (cancelled) return;
        setPdf(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(Math.min(startPage, doc.numPages));
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('PDF load error:', err);
        setError('Could not load PDF. Make sure the file was uploaded.');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [pdfUrl]);

  // Reset page when section changes
  useEffect(() => {
    if (pdf) setCurrentPage(Math.min(startPage, totalPages));
  }, [startPage, pdf]);

  // Render current page
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;

    pdf.getPage(currentPage).then(page => {
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      const dpr = window.devicePixelRatio ?? 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      ctx.scale(dpr, dpr);

      page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise
        .catch(err => console.error('Page render error:', err));
    });

    return () => { cancelled = true; };
  }, [pdf, currentPage, scale]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-surface-container-low rounded-xl">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 bg-surface-container-low rounded-xl text-on-surface-variant text-sm italic">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-container-high/50 border-b border-outline-variant/10">
        <div className="flex items-center gap-2">
          <button
            disabled={currentPage <= startPage}
            onClick={() => setCurrentPage(p => Math.max(startPage, p - 1))}
            className="p-1.5 rounded-lg hover:bg-surface-container-highest transition-colors disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="font-label text-xs text-on-surface-variant">
            Page {currentPage} of {totalPages}
            {endPage && <span className="text-on-surface-variant/60"> (section: {startPage}–{effectiveEnd})</span>}
          </span>
          <button
            disabled={currentPage >= effectiveEnd}
            onClick={() => setCurrentPage(p => Math.min(effectiveEnd, p + 1))}
            className="p-1.5 rounded-lg hover:bg-surface-container-highest transition-colors disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
            className="p-1.5 rounded-lg hover:bg-surface-container-highest transition-colors"
          >
            <ZoomOut size={14} />
          </button>
          <span className="font-label text-xs text-on-surface-variant w-10 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
            className="p-1.5 rounded-lg hover:bg-surface-container-highest transition-colors"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>
      {/* Canvas */}
      <div className="overflow-auto max-h-[70vh] flex justify-center p-4 bg-surface-container-highest/30">
        <canvas ref={canvasRef} className="shadow-lg" />
      </div>
    </div>
  );
};

export default PdfViewer;
