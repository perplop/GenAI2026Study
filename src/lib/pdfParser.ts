import * as pdfjsLib from 'pdfjs-dist';
// @ts-expect-error - Vite resolves worker URL from node_modules
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
}

export interface TextbookChunk {
  text: string;
  chapterTitle: string;
  startPage: number;
  endPage: number;
  imageDataUrls: string[];
}

export interface ParsedTextbook {
  chunks: TextbookChunk[];
  fileName: string;
}

const CHUNK_PAGES = 8; // pages per chunk
const IMAGE_SCALE = 1.5;

async function pageToDataUrl(page: pdfjsLib.PDFPage): Promise<string> {
  const viewport = page.getViewport({ scale: IMAGE_SCALE });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const dpr = window.devicePixelRatio ?? 1;
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  ctx.scale(dpr, dpr);
  await page.render({
    canvasContext: ctx as unknown as CanvasRenderingContext2D,
    viewport,
  }).promise;
  return canvas.toDataURL('image/jpeg', 0.85);
}

export async function parseTextbook(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<ParsedTextbook> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  onProgress?.(0, numPages);

  const pageTexts: string[] = [];
  const pageImages: string[] = [];

  for (let n = 1; n <= numPages; n++) {
    const page = await pdf.getPage(n);
    const [textContent, dataUrl] = await Promise.all([
      page.getTextContent().then((c) =>
        c.items.map((item) => ('str' in item ? item.str : '')).join(' ')
      ),
      pageToDataUrl(page),
    ]);
    pageTexts.push(textContent);
    pageImages.push(dataUrl);
    onProgress?.(n, numPages);
  }

  const chunks: TextbookChunk[] = [];
  for (let start = 1; start <= numPages; start += CHUNK_PAGES) {
    const end = Math.min(start + CHUNK_PAGES - 1, numPages);
    const text = pageTexts.slice(start - 1, end).join('\n\n');
    const imageDataUrls = pageImages.slice(start - 1, end);
    chunks.push({
      text,
      chapterTitle: `Pages ${start}–${end}`,
      startPage: start,
      endPage: end,
      imageDataUrls,
    });
  }

  return {
    chunks,
    fileName: file.name,
  };
}
