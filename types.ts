export enum QuestionCategory {
  LOGICAL = 'Logical Reasoning',
  NUMERICAL = 'Numerical Intelligence',
  VERBAL = 'Verbal Intelligence',
  SPATIAL = 'Spatial Reasoning'
}

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface Question {
  id: number;
  text: string;
  options: string[];
  correctIndex: number;
  category: QuestionCategory;
  difficulty: number; // 1-5
}

export interface UserAnswer {
  questionId: number;
  selectedOptionIndex: number;
  timeTakenSeconds: number;
}

export interface QuizResult {
  iqScore: number;
  percentile: number;
  correctCount: number;
  totalQuestions: number;
  categoryBreakdown: {
    category: string;
    score: number; // 0-100
    fullMark: number;
  }[];
  analysis: string;
}

export type AppState = 'intro' | 'generating' | 'quiz' | 'analyzing' | 'result' | 'error';
