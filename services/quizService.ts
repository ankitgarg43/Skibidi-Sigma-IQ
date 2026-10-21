import { Question } from '../types';

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Return a copy of the question with its options re-shuffled (correct answer
// tracked), so re-asking a question in a drill doesn't teach position memory.
export function shuffleOptions(q: Question): Question {
  const order = shuffle(q.options.map((_, i) => i));
  return {
    ...q,
    options: order.map((i) => q.options[i]),
    correctIndex: order.indexOf(q.correctIndex),
  };
}

// Generic weak-spot drill: re-ask questions from the weakest categories of a
// known pool (the last set, or the pool saved with a history record), with
// options re-shuffled. Falls back to the whole pool if a category is thin.
export function drillFromPool(categories: string[], pool: Question[], count: number): Question[] {
  if (!pool.length) return [];
  const inCats = pool.filter((q) => categories.includes(q.category));
  const source = inCats.length >= 3 ? inCats : pool;
  return shuffle(source).slice(0, count).map((q, i) => ({ ...shuffleOptions(q), id: i }));
}
