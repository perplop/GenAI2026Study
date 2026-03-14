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

export interface LibraryItem {
  id: string;
  name: string;
  size: number;
  path: string;
  uploadedAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'unknown';
  progress: number;
}

export interface TextbookStructure {
  chapters: Chapter[];
}

export interface Chapter {
  id: string;
  title: string;
  sections: Section[];
}

export interface Section {
  id: string;
  title: string;
  subsections: Subsection[];
}

export interface Subsection {
  id: string;
  title: string;
  topics: Topic[];
}

export interface Topic {
  id: string;
  title: string;
  content: string;
  educationalComponents?: EducationalComponent[];
}

export interface EducationalComponent {
  type: 'definition' | 'theorem' | 'proof' | 'example' | 'exercise' | 'key concept' | 'summary';
  content: string;
}
