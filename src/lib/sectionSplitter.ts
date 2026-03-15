/**
 * Rule-based textbook section splitter.
 *
 * WHY THIS FILE EXISTS:
 *   pdfjs-dist joins all text items on a page with spaces, so the extracted
 *   text has NO real newlines. The previous implementation split on \r?\n,
 *   which produced one giant blob per page and made every regex unreliable.
 *   This version splits on whitespace clusters (2+ spaces) to recover
 *   line-like segments from the space-joined PDF text.
 *
 * PIPELINE:
 *   detectBoundaries → buildSections → mergeSections → splitLongSections
 *     → enforceMaxDivisions → extractConceptTitle → analyzeSection
 *
 * SPLITTING SIGNALS (priority order per page):
 *   1. Chapter headings  — "Chapter 3" / "Chapter 3: Title"
 *   2. Numbered headings — "1.2 Title" / "3.4.1 Subtitle"
 *   3. ALL-CAPS headers  — short line (≤10 words) in all-caps
 *   4. Fallback          — 25-page blocks when no headings found
 *
 * MERGE / SPLIT THRESHOLDS:
 *   - MIN_WORDS = 600  (~3 pages). Sections below this are merged forward.
 *     This prevents 1-page micro-sections.
 *   - MAX_WORDS = 4000 (~16 pages). Sections above this are split once at
 *     the page midpoint.
 *
 * CONCEPT TITLES (applied after all structural decisions):
 *   "Chapter 3: DNA Structure" → "DNA Structure"
 *   "1.2 Cell Membrane Transport" → "Cell Membrane Transport"
 *   Bare "Chapter 3" → scan section text for first sub-heading
 *   Split second half → take sub-heading from its own text (no "(Part 2)")
 *
 * GROUPING CAP:
 *   Each top-level chapter unit is capped at MAX_DIVISIONS_PER_UNIT (5)
 *   sections. When a group exceeds 5, the two adjacent sections with the
 *   smallest combined word count are merged repeatedly until ≤ 5.
 *
 * SECTION TYPE (keyword-based on title, not density statistics):
 *   intro / conceptual / example / advanced
 *   Using title keywords is more reliable than density thresholds, which
 *   misfire on biology/science text where capitalized terms (DNA, ATP, RNA)
 *   inflate conceptDensity and trigger false 'example' labels.
 *
 * WORKLOAD SCORE (internal, not shown in UI):
 *   score = readMins × typeMultiplier × (1 + conceptDensity×0.5 + formulaDensity×1.0)
 *   typeMultiplier: intro=0.8  conceptual=1.0  example=1.3  advanced=1.6
 */

import type { ParsedPage } from './pdfParser';
import type { AnalyzedSection } from '../types';

// ── Thresholds ───────────────────────────────────────────────────────────────
const MIN_WORDS              = 600;   // ~3 pages — sections below are merged
const MAX_WORDS              = 4000;  // ~16 pages — sections above are split
const WORDS_PER_MINUTE       = 200;
const MAX_DIVISIONS_PER_UNIT = 5;    // max study sections per top-level chapter

// ── Heading patterns ─────────────────────────────────────────────────────────
const RE_CHAPTER  = /^(chapter\s+(?:\d+|[ivxlcdmIVXLCDM]+)(?:\s*[:\-–.]\s*.{0,80})?)/i;
const RE_NUMBERED = /^(\d{1,2}(?:\.\d{1,2}){0,2}\.?)\s+([A-Z][^.!?\n]{2,80})/;
const RE_ALLCAPS  = /^([A-Z][A-Z\s\d,;:\-–—]{4,69})$/;

// A bare chapter heading with no concept subtitle — e.g. "Chapter 3"
const RE_CHAPTER_BARE = /^chapter\s+(?:\d+|[ivxlcdmIVXLCDM]+)\s*$/i;

// ── Section type keywords (applied to title text) ────────────────────────────
// Using title keywords rather than density statistics avoids false positives
// in science text where capitalized terms inflate conceptDensity.
const RE_INTRO    = /intro|overview|background|preface|abstract|foreword|summary|review|outline|objective|purpose/i;
const RE_EXAMPLE  = /example|exercise|problem|solution|case\s+study|worked|practice|application|\blab\b|illustration/i;
const RE_ADVANCED = /advanced|derivation|proof|theorem|lemma|appendix|algorithm|technical|analysis|formal|notation/i;

// ── Internal types ────────────────────────────────────────────────────────────
interface Boundary {
  pageNum: number;
  title: string;
  level: 'chapter' | 'section' | 'subsection';
}

interface SectionWithText {
  title: string;
  chapterTitle: string;
  startPage: number;
  endPage: number;
  wordCount: number;
  text: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function wc(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function pagesText(pages: ParsedPage[], start: number, end: number): string {
  return pages
    .filter(p => p.pageNum >= start && p.pageNum <= end)
    .map(p => p.text)
    .join(' ');
}

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ── Concept title extraction ──────────────────────────────────────────────────
/**
 * Scan the first ~1200 chars of section text for a recognizable sub-heading.
 * Skips the first segment (likely the chapter heading itself).
 * Returns a concept title string, or null if nothing useful is found.
 */
function findFirstConceptInText(text: string): string | null {
  const segments = text.slice(0, 1200).split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
  for (const seg of segments.slice(1, 14)) {
    if (!seg || seg.length > 120 || seg.length < 4) continue;
    const numMatch = seg.match(/^(\d{1,2}(?:\.\d{1,2}){0,2}\.?)\s+([A-Z][^.!?]{2,80})/);
    if (numMatch) return numMatch[2].trim();
    const acMatch = seg.match(/^([A-Z][A-Z\s\d,;:\-–—]{4,69})$/);
    if (acMatch && seg.split(/\s+/).length <= 8) return toTitleCase(acMatch[1].trim());
  }
  return null;
}

/**
 * Given a raw boundary title and its section text, return the best concept label.
 *
 *   "Chapter 3: DNA Structure and Function" → "DNA Structure and Function"
 *   Bare "Chapter 3" → scan text for first sub-heading
 *   "1.2 Cell Membrane Transport" → "Cell Membrane Transport"
 *   ALL-CAPS converted title → already title-cased, return as-is
 */
function extractConceptTitle(rawTitle: string, text: string): string {
  // Chapter with subtitle after colon/dash/dot
  const chapterWithSub = rawTitle.match(/^chapter\s+(?:\d+|[ivxlcdmIVXLCDM]+)\s*[:\-–.]\s*(.+)/i);
  if (chapterWithSub) return toTitleCase(chapterWithSub[1].trim());

  // Bare "Chapter N" — scan text for first concept sub-heading
  if (RE_CHAPTER_BARE.test(rawTitle)) {
    const fromText = findFirstConceptInText(text);
    if (fromText) return fromText;
    return toTitleCase(rawTitle); // last resort
  }

  // "1.2 Concept Name" → strip numbering
  const numberedMatch = rawTitle.match(/^\d{1,2}(?:\.\d{1,2}){0,2}\.?\s+(.+)/);
  if (numberedMatch) return numberedMatch[1].trim();

  // Already a concept title (ALL-CAPS converted to title case, etc.)
  return rawTitle;
}

// ── Heading detection ─────────────────────────────────────────────────────────
/**
 * PDF text extraction joins all items with spaces — newlines do not exist.
 * We recover line-like segments by splitting on whitespace clusters (2+ spaces).
 */
function getSegments(text: string): string[] {
  return text.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
}

function detectBoundaries(pages: ParsedPage[]): Boundary[] {
  const boundaries: Boundary[] = [];

  for (const page of pages) {
    const text = page.text.trim();
    if (!text || text.length < 5) continue;

    const segments  = getSegments(text);
    const leadSegs  = segments.slice(0, 8); // headings appear early in the page
    let   found     = false;

    for (const seg of leadSegs) {
      if (!seg || seg.length > 200) continue;

      // Priority 1 — Chapter
      const chMatch = seg.match(RE_CHAPTER);
      if (chMatch) {
        addBoundary(boundaries, { pageNum: page.pageNum, title: chMatch[1].trim(), level: 'chapter' });
        found = true;
        break;
      }

      // Priority 2 — Numbered section / subsection
      const numMatch = seg.match(RE_NUMBERED);
      if (numMatch) {
        const num   = numMatch[1].replace(/\.$/, '');
        const name  = numMatch[2].trim();
        const dots  = (num.match(/\./g) || []).length;
        const level: Boundary['level'] = dots === 0 ? 'section' : 'subsection';
        addBoundary(boundaries, { pageNum: page.pageNum, title: `${num} ${name}`, level });
        found = true;
        break;
      }

      // Priority 3 — ALL-CAPS (≤10 words)
      const acMatch = seg.match(RE_ALLCAPS);
      if (acMatch && seg.split(/\s+/).length <= 10) {
        addBoundary(boundaries, {
          pageNum: page.pageNum,
          title:   toTitleCase(acMatch[1].trim()),
          level:   'section',
        });
        found = true;
        break;
      }
    }

    // Fallback: numbered heading anywhere deeper in the page text
    if (!found) {
      const fullMatch = text.match(RE_NUMBERED);
      if (fullMatch) {
        const num  = fullMatch[1].replace(/\.$/, '');
        const name = fullMatch[2].trim();
        const dots = (num.match(/\./g) || []).length;
        addBoundary(boundaries, {
          pageNum: page.pageNum,
          title:   `${num} ${name}`,
          level:   dots === 0 ? 'section' : 'subsection',
        });
      }
    }
  }

  return boundaries;
}

/**
 * Suppress duplicate boundaries closer than 3 pages apart.
 * This prevents TOC entries (which echo chapter titles) from creating a
 * phantom section right before the real chapter start.
 */
function addBoundary(arr: Boundary[], b: Boundary) {
  const last = arr[arr.length - 1];
  if (!last || b.pageNum - last.pageNum >= 3) {
    arr.push(b);
  }
}

// ── Section building ──────────────────────────────────────────────────────────
function buildSections(
  pages: ParsedPage[],
  boundaries: Boundary[],
  totalPages: number,
  fileName: string,
): SectionWithText[] {
  if (boundaries.length === 0) {
    // Fallback: 25-page blocks (large enough to be meaningful study units)
    const BLOCK = 25;
    const result: SectionWithText[] = [];
    for (let start = 1; start <= totalPages; start += BLOCK) {
      const end  = Math.min(start + BLOCK - 1, totalPages);
      const text = pagesText(pages, start, end);
      result.push({ title: `Pages ${start}–${end}`, chapterTitle: fileName, startPage: start, endPage: end, wordCount: wc(text), text });
    }
    return result;
  }

  const sections: SectionWithText[] = [];
  let currentChapter = fileName;

  // Pages before the first boundary (front matter, TOC, etc.)
  if (boundaries[0].pageNum > 1) {
    const text = pagesText(pages, 1, boundaries[0].pageNum - 1);
    if (wc(text) > 30) {
      sections.push({ title: 'Front Matter', chapterTitle: fileName, startPage: 1, endPage: boundaries[0].pageNum - 1, wordCount: wc(text), text });
    }
  }

  boundaries.forEach((b, i) => {
    if (b.level === 'chapter') currentChapter = b.title;
    const start = b.pageNum;
    const end   = i + 1 < boundaries.length ? boundaries[i + 1].pageNum - 1 : totalPages;
    const text  = pagesText(pages, start, end);
    sections.push({ title: b.title, chapterTitle: currentChapter, startPage: start, endPage: end, wordCount: wc(text), text });
  });

  return sections;
}

// ── Merge short sections ──────────────────────────────────────────────────────
/**
 * Walk forward; if the current tail section is below MIN_WORDS, absorb the
 * next section into it. The title of the tiny tail is kept unless it has
 * fewer than 100 words, in which case the next section's title wins.
 * This prevents 1-page stubs from surviving as independent sections.
 */
function mergeSections(sections: SectionWithText[]): SectionWithText[] {
  if (sections.length === 0) return [];
  const result: SectionWithText[] = [{ ...sections[0] }];

  for (let i = 1; i < sections.length; i++) {
    const last = result[result.length - 1];
    if (last.wordCount < MIN_WORDS) {
      result[result.length - 1] = {
        ...last,
        title:     last.wordCount < 100 ? sections[i].title : last.title,
        endPage:   sections[i].endPage,
        wordCount: last.wordCount + sections[i].wordCount,
        text:      last.text + ' ' + sections[i].text,
      };
    } else {
      result.push({ ...sections[i] });
    }
  }
  return result;
}

// ── Split oversized sections ──────────────────────────────────────────────────
/**
 * For sections exceeding MAX_WORDS, split at the page midpoint.
 * The second half uses the first concept sub-heading found in its own text
 * as its title — avoiding generic "(Part 2)" labels.
 */
function splitLongSections(sections: SectionWithText[], pages: ParsedPage[]): SectionWithText[] {
  const result: SectionWithText[] = [];
  for (const sec of sections) {
    if (sec.wordCount <= MAX_WORDS) { result.push(sec); continue; }
    const mid    = sec.startPage + Math.floor((sec.endPage - sec.startPage) / 2);
    const text1  = pagesText(pages, sec.startPage, mid);
    const text2  = pagesText(pages, mid + 1, sec.endPage);
    // Find a sub-concept in the second half's text instead of "(Part 2)"
    const part2Title = findFirstConceptInText(text2) ?? sec.title;
    result.push({ ...sec, endPage: mid, wordCount: wc(text1), text: text1 });
    if (wc(text2) > 100) {
      result.push({ ...sec, title: part2Title, startPage: mid + 1, wordCount: wc(text2), text: text2 });
    }
  }
  return result;
}

// ── Enforce max divisions per top-level unit ──────────────────────────────────
/**
 * Group sections by their chapterTitle. For any group exceeding
 * MAX_DIVISIONS_PER_UNIT, repeatedly merge the pair of adjacent sections
 * with the smallest combined word count until the group fits.
 * The merged section keeps whichever title is longer (more descriptive).
 */
function enforceMaxDivisions(sections: SectionWithText[]): SectionWithText[] {
  const order: string[] = [];
  const groups = new Map<string, SectionWithText[]>();
  for (const sec of sections) {
    if (!groups.has(sec.chapterTitle)) { groups.set(sec.chapterTitle, []); order.push(sec.chapterTitle); }
    groups.get(sec.chapterTitle)!.push(sec);
  }

  const result: SectionWithText[] = [];
  for (const key of order) {
    let g = [...groups.get(key)!];
    while (g.length > MAX_DIVISIONS_PER_UNIT) {
      // Find the adjacent pair with smallest combined word count
      let minIdx = 0, minCombined = Infinity;
      for (let i = 0; i < g.length - 1; i++) {
        const combined = g[i].wordCount + g[i + 1].wordCount;
        if (combined < minCombined) { minCombined = combined; minIdx = i; }
      }
      const a = g[minIdx], b = g[minIdx + 1];
      const merged: SectionWithText = {
        ...a,
        endPage:   b.endPage,
        wordCount: a.wordCount + b.wordCount,
        text:      a.text + ' ' + b.text,
        title:     a.title.length >= b.title.length ? a.title : b.title,
      };
      g = [...g.slice(0, minIdx), merged, ...g.slice(minIdx + 2)];
    }
    result.push(...g);
  }
  return result;
}

// ── Section type classification ───────────────────────────────────────────────
/**
 * Classify by keywords in the section title.
 *
 * Why title keywords instead of density statistics:
 *   Density-based classification fires falsely on science/biology text.
 *   Any chapter with "DNA", "RNA", "ATP" has very high conceptDensity
 *   (all caps words), which pushes every section into 'example' even when
 *   the content is pure theory. Title keywords are far more reliable.
 */
function classifyType(title: string): AnalyzedSection['sectionType'] {
  if (RE_INTRO.test(title))    return 'intro';
  if (RE_EXAMPLE.test(title))  return 'example';
  if (RE_ADVANCED.test(title)) return 'advanced';
  return 'conceptual';
}

// ── Density helpers (used only for workload scoring, not type labeling) ───────
function computeConceptDensity(text: string): number {
  const words = text.trim().split(/\s+/);
  let count = 0;
  for (let i = 1; i < words.length; i++) {
    if (
      /^[A-Z][a-z]/.test(words[i]) &&
      !/[.!?]$/.test(words[i - 1]) &&
      words[i].length > 2
    ) count++;
  }
  return Math.min((count / Math.max(words.length, 1)) * 4, 1);
}

const RE_FORMULA_CHARS = /[\d=+\-×÷*/^()[\]{}%∫∑∏√±≤≥≠∈⊂⊃∧∨¬→↔]/g;
function computeFormulaDensity(text: string): number {
  if (!text) return 0;
  const matches = text.match(RE_FORMULA_CHARS) || [];
  return Math.min(matches.length / (text.length * 0.15), 1);
}

// ── Workload scoring ──────────────────────────────────────────────────────────
const TYPE_MULT: Record<AnalyzedSection['sectionType'], number> = {
  intro:      0.8,
  conceptual: 1.0,
  example:    1.3,
  advanced:   1.6,
};

function analyzeSection(sec: SectionWithText): AnalyzedSection {
  const readMins = Math.max(sec.wordCount / WORDS_PER_MINUTE, 0.5);
  const cd       = computeConceptDensity(sec.text);
  const fd       = computeFormulaDensity(sec.text);
  const type     = classifyType(sec.title);
  const workload = readMins * TYPE_MULT[type] * (1 + cd * 0.5 + fd * 1.0);

  const { text: _text, ...rawWithoutText } = sec;
  void _text;

  return {
    ...rawWithoutText,
    estimatedReadingMinutes: Math.round(readMins * 10) / 10,
    conceptDensity:          Math.round(cd    * 100) / 100,
    formulaDensity:          Math.round(fd    * 100) / 100,
    sectionType:             type,
    workloadScore:           Math.round(workload * 10) / 10,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────
export function splitIntoSections(
  pages: ParsedPage[],
  totalPages: number,
  fileName: string,
): AnalyzedSection[] {
  const boundaries = detectBoundaries(pages);
  const raw        = buildSections(pages, boundaries, totalPages, fileName);
  const merged     = mergeSections(raw);
  const split      = splitLongSections(merged, pages);
  const capped     = enforceMaxDivisions(split);

  // Apply concept titles after all structural decisions are finalised
  const titled = capped.map(sec => ({
    ...sec,
    title: extractConceptTitle(sec.title, sec.text),
  }));

  return titled.map(analyzeSection);
}
