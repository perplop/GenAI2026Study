export interface Course {
  id: string;
  title: string;
  chapter: string;
  progress: number;
  totalModules: number;
  completedModules: number;
  color: string;
  icon: string;
}

export interface Activity {
  id: string;
  type: 'quiz' | 'highlight' | 'flashcard';
  title: string;
  description: string;
  timestamp: string;
}

export interface Module {
  id: string;
  title: string;
  status: 'completed' | 'processing' | 'locked';
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

// --- Textbook parsing & Gemini analysis types ---

export interface TextbookSection {
  title: string;
  summary: string;
  keyTerms: string[];
  estimatedMinutes: number;
}

export interface StudyDay {
  day: number;
  topic: string;
  activities: string[];
}

export interface GeminiChunkResult {
  chapterTitle: string;
  sections: TextbookSection[];
  studyPlan: StudyDay[];
}

export interface TextbookAnalysis {
  bookTitle: string;
  chunkResults: GeminiChunkResult[];
}

// ── Rule-based study plan types ────────────────────────────────────────────

/** One section produced by the rule-based splitter (no text, text is stripped after analysis). */
export interface RawSection {
  title: string;
  chapterTitle: string;
  startPage: number;
  endPage: number;
  wordCount: number;
}

/** Section enriched with all analysis scores used for scheduling. */
export interface AnalyzedSection extends RawSection {
  estimatedReadingMinutes: number;
  /** Fraction of mid-sentence capitalized terms — proxy for concept density (0–1). */
  conceptDensity: number;
  /** Fraction of formula-like chars — proxy for math/symbol density (0–1). */
  formulaDensity: number;
  sectionType: 'intro' | 'conceptual' | 'example' | 'advanced';
  /** Composite effort-minutes used for scheduling. */
  workloadScore: number;
}

/** One day in the generated study plan. */
export interface PlanDay {
  day: number;
  sections: AnalyzedSection[];
  totalWorkloadScore: number;
  estimatedHours: number;
  /** Short learning goal — rule-derived or AI-enriched. */
  mainConceptFocus: string;
  difficulty: 'light' | 'moderate' | 'heavy';
}

/** A saved plan persisted in localStorage. */
export interface SavedStudyPlan {
  id: string;
  bookTitle: string;
  createdAt: string;
  numDays: number;
  totalSections: number;
  days: PlanDay[];
}
