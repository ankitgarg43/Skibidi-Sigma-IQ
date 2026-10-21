export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type ThemeName = 'sigma' | 'pro';
export type QuizMode = 'iq' | 'paste' | 'duel' | 'drill';

export interface Question {
  id: number;
  text: string;
  options: string[];
  correctIndex: number;
  category: string;
  difficulty: number; // 1-5
  explanation: string;
  source?: string; // source sentence (paste mode) or bank chapter
}

export interface UserAnswer {
  questionId: number;
  selectedOptionIndex: number; // -1 = no answer (timer ran out)
  timeTakenSeconds: number;
}

export type QuizFormat = 'practice' | 'countdown' | 'sprint';

export interface QuizConfig {
  format: QuizFormat;
  totalMinutes?: number; // countdown: total time for the whole quiz (180 = 3-hour exam)
  perQuestionSeconds?: number; // sprint: seconds per question, auto-advances
}

export interface CategoryScore {
  category: string;
  score: number; // 0-100
  fullMark: number;
  correct: number;
  total: number;
  avgSeconds: number;
}

export interface QuizResult {
  scorePercent: number;
  correctCount: number;
  totalQuestions: number;
  totalSeconds: number;
  categoryBreakdown: CategoryScore[];
  weakestCategory: string | null;
  coachNote: string;
}

export interface AttemptRecord {
  at: number; // epoch ms
  mode: QuizMode;
  title: string;
  scorePercent: number;
  correct: number;
  total: number;
  weakestCategory: string | null;
  categories: { category: string; score: number }[];
  pool?: Question[]; // snapshot of the set, so weak-spot drills can reuse it later
}

export interface Profile {
  id: string;
  name: string;
  pinHash?: string; // convenience lock only (hash of a PIN), NOT real security
  createdAt: number;
}

export interface SavedSession {
  savedAt: number;
  mode: QuizMode;
  title: string;
  questions: Question[];
  userAnswers: UserAnswer[];
  currentIndex: number;
  config: QuizConfig;
  duelMeta: { creatorName: string; creatorScorePercent: number; creatorCategories: { category: string; score: number }[] } | null;
  countdownRemainingMs: number | null;
}

export interface DuelPayload {
  v: 1;
  title: string;
  mode: QuizMode;
  creatorName: string;
  creatorScorePercent: number;
  creatorCategories: { category: string; score: number }[];
  questions: Question[];
}

export type AppState =
  | 'intro'
  | 'generating'
  | 'quiz'
  | 'analyzing'
  | 'result'
  | 'error';
