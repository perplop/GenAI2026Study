import type { ParsedPage } from './pdfParser';
import type { AnalyzedSection } from '../types';

const WORDS_PER_MINUTE = 200;
const FORMULA_CHARS = /[=∑∫∑√∞±≈≠≤≥×÷∑∏√∂∆πΣ]/g;

/** Detect section boundaries: "Chapter N", "N.M Title", or ALL-CAPS lines. */
function findSectionStarts(pages: ParsedPage[]): { pageNum: number; title: string }[] {
  const starts: { pageNum: number; title: string }[] = [];
  const chapterRegex = /^\s*Chapter\s+\d+[.:]?\s*(.*)$/im;
  const sectionNumRegex = /^\s*(\d{1,2}\.\d{1,2}(?:\.\d{1,2})?)[.:]?\s*(.*)$/m;
  const allCapsRegex = /^\s*([A-Z][A-Z0-9\s]{2,40})\s*$/m;

  for (const page of pages) {
    const lines = page.text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let title = '';
      const chMatch = line.match(chapterRegex);
      const secMatch = line.match(sectionNumRegex);
      const capsMatch = line.match(allCapsRegex);
      if (chMatch) {
        title = (chMatch[1] || `Chapter ${page.pageNum}`).trim().slice(0, 80);
      } else if (secMatch) {
        title = (secMatch[2] || secMatch[1]).trim().slice(0, 80);
      } else if (capsMatch && line.length >= 4 && line.length <= 60) {
        title = capsMatch[1].trim().slice(0, 80);
      }
      if (title) {
        starts.push({ pageNum: page.pageNum, title });
      }
    }
  }

  // Dedupe by page: keep first title per page
  const byPage = new Map<number, string>();
  for (const s of starts) {
    if (!byPage.has(s.pageNum)) byPage.set(s.pageNum, s.title);
  }
  return Array.from(byPage.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([pageNum, title]) => ({ pageNum, title }));
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function conceptDensity(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const capitalized = words.filter((w) => w.length > 1 && w[0] === w[0].toUpperCase() && w.slice(1) === w.slice(1).toLowerCase());
  return Math.min(1, capitalized.length / words.length);
}

function formulaDensity(text: string): number {
  const matches = text.match(FORMULA_CHARS);
  const count = matches ? matches.length : 0;
  return Math.min(1, count / Math.max(1, text.length / 50));
}

function inferSectionType(
  conceptD: number,
  formulaD: number,
  wordCount: number
): 'intro' | 'conceptual' | 'example' | 'advanced' {
  if (wordCount < 150 && conceptD < 0.05) return 'intro';
  if (formulaD > 0.15) return 'advanced';
  if (formulaD > 0.05 || conceptD > 0.12) return 'example';
  return 'conceptual';
}

/**
 * Split parsed PDF pages into sections using chapter/section headings and ALL-CAPS lines.
 * Each section is scored for workload (reading time, concept density, formula density).
 */
export function splitIntoSections(
  pages: ParsedPage[],
  totalPages: number,
  fileName: string
): AnalyzedSection[] {
  if (pages.length === 0) {
    const fallback: AnalyzedSection = {
      title: fileName.replace(/\.pdf$/i, ''),
      chapterTitle: 'Full document',
      startPage: 1,
      endPage: 1,
      wordCount: 0,
      estimatedReadingMinutes: 0,
      conceptDensity: 0,
      formulaDensity: 0,
      sectionType: 'intro',
      workloadScore: 0,
    };
    return [fallback];
  }

  const starts = findSectionStarts(pages);
  const sections: AnalyzedSection[] = [];

  if (starts.length === 0) {
    // No headings: one section per N pages
    const PAGES_PER_SECTION = 4;
    for (let start = 1; start <= totalPages; start += PAGES_PER_SECTION) {
      const end = Math.min(start + PAGES_PER_SECTION - 1, totalPages);
      const text = pages
        .filter((p) => p.pageNum >= start && p.pageNum <= end)
        .map((p) => p.text)
        .join('\n');
      const wc = wordCount(text);
      const estMin = Math.max(1, Math.round(wc / WORDS_PER_MINUTE));
      const cD = conceptDensity(text);
      const fD = formulaDensity(text);
      const sectionType = inferSectionType(cD, fD, wc);
      const workloadScore = Math.round(estMin * (1 + cD + fD));
      sections.push({
        title: `Pages ${start}–${end}`,
        chapterTitle: fileName.replace(/\.pdf$/i, ''),
        startPage: start,
        endPage: end,
        wordCount: wc,
        estimatedReadingMinutes: estMin,
        conceptDensity: cD,
        formulaDensity: fD,
        sectionType,
        workloadScore,
        textExcerpt: text.slice(0, 2000),
      });
    }
    return sections;
  }

  for (let i = 0; i < starts.length; i++) {
    const startPage = starts[i].pageNum;
    const endPage = i < starts.length - 1 ? starts[i + 1].pageNum - 1 : totalPages;
    if (endPage < startPage) continue;
    const text = pages
      .filter((p) => p.pageNum >= startPage && p.pageNum <= endPage)
      .map((p) => p.text)
      .join('\n');
    const wc = wordCount(text);
    const estMin = Math.max(1, Math.round(wc / WORDS_PER_MINUTE));
    const cD = conceptDensity(text);
    const fD = formulaDensity(text);
    const sectionType = inferSectionType(cD, fD, wc);
    const workloadScore = Math.round(estMin * (1 + cD + fD));
    sections.push({
      title: starts[i].title,
      chapterTitle: fileName.replace(/\.pdf$/i, ''),
      startPage,
      endPage,
      wordCount: wc,
      estimatedReadingMinutes: estMin,
      conceptDensity: cD,
      formulaDensity: fD,
      sectionType,
      workloadScore,
      textExcerpt: text.slice(0, 2000),
    });
  }

  return sections;
}
