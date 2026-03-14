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
