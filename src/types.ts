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
export interface LibraryItem {
  id: string;
  name: string;
  size: number;
  path: string;
  uploadedAt: string;
}
