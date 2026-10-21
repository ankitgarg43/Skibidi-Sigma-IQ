import { Question, UserAnswer, QuizResult, CategoryScore, AttemptRecord, QuizMode } from '../types';

export function computeResult(questions: Question[], answers: UserAnswer[], pro: boolean): QuizResult {
  const byCat = new Map<string, { correct: number; total: number; seconds: number }>();
  let correctCount = 0;
  let totalSeconds = 0;
  for (const q of questions) {
    const a = answers.find((x) => x.questionId === q.id);
    const entry = byCat.get(q.category) || { correct: 0, total: 0, seconds: 0 };
    entry.total += 1;
    entry.seconds += a?.timeTakenSeconds || 0;
    totalSeconds += a?.timeTakenSeconds || 0;
    if (a && a.selectedOptionIndex === q.correctIndex) {
      correctCount += 1;
      entry.correct += 1;
    }
    byCat.set(q.category, entry);
  }
  const categoryBreakdown: CategoryScore[] = [...byCat.entries()].map(([category, e]) => ({
    category,
    score: e.total ? Math.round((e.correct / e.total) * 100) : 0,
    fullMark: 100,
    correct: e.correct,
    total: e.total,
    avgSeconds: e.total ? Math.round((e.seconds / e.total) * 10) / 10 : 0,
  })).sort((a, b) => b.score - a.score);
  const weakest = categoryBreakdown.length
    ? [...categoryBreakdown].sort((a, b) => a.score - b.score || b.avgSeconds - a.avgSeconds)[0]
    : null;
  const strongest = categoryBreakdown[0];
  const scorePercent = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;

  let coachNote: string;
  if (!weakest || !strongest) {
    coachNote = pro ? 'Complete a quiz to see coaching feedback.' : 'Take a quiz first, fam.';
  } else if (weakest.category === strongest.category) {
    coachNote = pro
      ? `This set covered a single area (${weakest.category}). You scored ${weakest.score}% there — the review below shows exactly which questions to revisit.`
      : `One arena only this time: ${weakest.category} at ${weakest.score}%. Peep the review below for the ones that got away.`;
  } else if (weakest.score < 60) {
    coachNote = pro
      ? `Focus next on ${weakest.category} (${weakest.score}%, avg ${weakest.avgSeconds}s per question) — it is pulling your score down while ${strongest.category} is strong at ${strongest.score}%. Use "Drill my weak spots" for a targeted round, and read the explanations in the review before retrying.`
      : `Real talk: ${weakest.category} is cooking you (${weakest.score}%). But ${strongest.category}? ${strongest.score}% — certified W. Hit "Drill my weak spots" and read the explanations below before you run it back.`;
  } else {
    coachNote = pro
      ? `Solid, even performance. Your lowest area, ${weakest.category} (${weakest.score}%), is still respectable, and ${strongest.category} leads at ${strongest.score}%. A weak-spot drill will polish the remaining gaps.`
      : `No cap — that was balanced. Even your "weakest" area ${weakest.category} hit ${weakest.score}%, and ${strongest.category} popped off at ${strongest.score}%. Drill mode will polish the last gaps.`;
  }
  return {
    scorePercent,
    correctCount,
    totalQuestions: questions.length,
    totalSeconds: Math.round(totalSeconds),
    categoryBreakdown,
    weakestCategory: weakest && weakest.score < 100 ? weakest.category : null,
    coachNote,
  };
}

function historyKey(profileId: string): string {
  return `sigma-plus-history-${profileId}-v1`;
}

export function loadHistory(profileId: string = 'guest'): AttemptRecord[] {
  try {
    // Migrate the pre-profile (v2.0) guest history once.
    const raw = localStorage.getItem(historyKey(profileId))
      || (profileId === 'guest' ? localStorage.getItem('sigma-plus-history-v1') : null);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAttempt(profileId: string, mode: QuizMode, title: string, result: QuizResult, pool: Question[]): AttemptRecord[] {
  const record: AttemptRecord = {
    at: Date.now(),
    mode,
    title,
    scorePercent: result.scorePercent,
    correct: result.correctCount,
    total: result.totalQuestions,
    weakestCategory: result.weakestCategory,
    categories: result.categoryBreakdown.map((c) => ({ category: c.category, score: c.score })),
    pool,
  };
  const history = [record, ...loadHistory(profileId)].slice(0, 30);
  try { localStorage.setItem(historyKey(profileId), JSON.stringify(history)); } catch { /* storage full/blocked */ }
  return history;
}

// Weakest categories across all saved attempts (for the history-driven drill).
export function historicalWeakCategories(history: AttemptRecord[]): string[] {
  const totals = new Map<string, { sum: number; n: number }>();
  for (const h of history) {
    for (const c of h.categories) {
      const e = totals.get(c.category) || { sum: 0, n: 0 };
      e.sum += c.score; e.n += 1;
      totals.set(c.category, e);
    }
  }
  return [...totals.entries()]
    .map(([category, e]) => ({ category, avg: e.sum / e.n }))
    .sort((a, b) => a.avg - b.avg)
    .map((x) => x.category);
}
