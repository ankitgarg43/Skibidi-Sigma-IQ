import { Question, DifficultyLevel } from '../types';

// Local, offline quiz generator: turns pasted notes/text into MCQs with no API
// key. It extracts (a) definitions ("X is/are/refers to ..."), (b) key terms for
// cloze (fill-in-the-blank) questions, (c) number facts, and (d) "which statement
// matches the text" questions where distractors are source sentences with a key
// term swapped. Every question carries its source sentence as the explanation.

const STOP = new Set(
  ('the,a,an,of,to,in,is,are,was,were,be,been,being,that,this,these,those,it,its,as,at,by,for,with,from,or,and,but,not,no,yes,can,could,will,would,should,may,might,must,have,has,had,do,does,did,when,where,which,who,whom,what,how,why,than,then,so,such,into,over,under,between,about,after,before,during,each,other,more,most,many,much,also,only,one,two,first,used,use,using,make,makes,made,like,well,new,per,via,etc,eg,ie,chapter,section,page,figure,table,note,notes,example,examples,following,given,shown,through,within,across,along,among,toward,towards,against,without,because,however,roughly,single,really,every,while,often,around,something,anything,everything').split(',')
);

function splitSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const parts = cleaned.match(/[^.!?]+[.!?]+["')\]]*|\S[^.!?]*$/g) || [];
  return parts.map((s) => s.trim()).filter((s) => s.length >= 40 && s.length <= 320 && /[a-zA-Z]/.test(s));
}

function words(s: string): string[] {
  return (s.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []).filter((w) => !STOP.has(w));
}

function keyTerms(sentence: string): string[] {
  // Capitalised multi-word phrases first, then long content words.
  const caps = sentence.match(/\b(?:[A-Z][a-z]+(?:\s+(?:of|the|and)\s+|\s+)){1,3}[A-Z][a-z]+\b/g) || [];
  const longs = words(sentence).filter((w) => w.length >= 7);
  const scored = [...new Set([...caps.map((c) => c.trim()), ...longs])].sort((a, b) => b.length - a.length);
  return scored.slice(0, 4);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeQ(text: string, options: string[], correct: string, category: string, difficulty: number, source: string): Question | null {
  const opts = [...new Set(options.map((o) => o.trim()).filter(Boolean))];
  if (opts.length < 3 || !opts.includes(correct)) return null;
  const finalOpts = shuffle(opts.slice(0, 4));
  return {
    id: 0,
    text,
    options: finalOpts,
    correctIndex: finalOpts.indexOf(correct),
    category,
    difficulty,
    explanation: `From your text: "${source}"`,
    source,
  };
}

export interface GenerateOutcome {
  questions: Question[];
  error?: string;
}

export function generateFromText(rawText: string, count: number, difficulty: DifficultyLevel): GenerateOutcome {
  const text = (rawText || '').trim();
  if (text.length < 400) {
    return { questions: [], error: 'Paste a bit more text — at least about 400 characters of notes (a few solid paragraphs) so there are enough facts to build questions from.' };
  }
  const sentences = splitSentences(text);
  if (sentences.length < 5) {
    return { questions: [], error: 'I could not find enough complete sentences in that text. Paste plain notes or textbook text (full sentences work best).' };
  }
  const allTerms = [...new Set(sentences.flatMap((s) => keyTerms(s)))];
  const numbers = [...new Set(text.match(/\$?[\d][\d,]*(?:\.\d+)?%?/g) || [])];
  const questions: Question[] = [];

  // 1) Definitions: "Term is/are/means/refers to <definition>"
  const defRe = /^(.{3,60}?)\s+(?:is|are|means|refers to|is defined as|is known as)\s+(.{15,160})$/i;
  for (const s of shuffle(sentences)) {
    const m = s.replace(/[.!?]$/, '').match(defRe);
    if (!m) continue;
    const term = m[1].trim().replace(/^(the|a|an)\s+/i, '');
    if (STOP.has(term.toLowerCase()) || term.split(' ').length > 6) continue;
    const correct = m[2].trim();
    const distractors = shuffle(sentences.filter((x) => x !== s))
      .map((x) => { const mm = x.replace(/[.!?]$/, '').match(defRe); return mm ? mm[2].trim() : ''; })
      .filter(Boolean)
      .slice(0, 3);
    while (distractors.length < 3) {
      const alt = shuffle(allTerms.filter((t) => t.toLowerCase() !== term.toLowerCase()))[0];
      if (!alt) break;
      distractors.push(`related to ${alt} in the way described in the text`);
    }
    const q = makeQ(`According to the text, what is ${term}?`, [...distractors, correct], correct, 'Definitions', difficulty === 'hard' ? 4 : 2, s);
    if (q) questions.push(q);
    if (questions.length >= count) break;
  }

  // 2) Cloze: blank out a key term.
  if (questions.length < count) {
    for (const s of shuffle(sentences)) {
      if (questions.length >= count) break;
      const terms = keyTerms(s).filter((t) => s.toLowerCase().includes(t.toLowerCase()));
      // Skip weak cloze candidates: a lone borderline word makes a trivia-guess
      // question, not a knowledge question. Prefer capitalised terms or a
      // choice of candidates.
      if (!terms.length || (terms.length < 2 && !/^[A-Z]/.test(terms[0]) && terms[0].length < 8)) continue;
      const term = terms[0];
      const idx = s.toLowerCase().indexOf(term.toLowerCase());
      const blanked = `${s.slice(0, idx)}_____${s.slice(idx + term.length)}`;
      const distractors = shuffle(allTerms.filter((t) => t.toLowerCase() !== term.toLowerCase())).slice(0, 3);
      const correctDisplay = s.slice(idx, idx + term.length);
      const q = makeQ(`Fill in the blank: ${blanked}`, [...distractors, correctDisplay], correctDisplay, 'Key Details', difficulty === 'easy' ? 1 : 3, s);
      if (q) questions.push(q);
    }
  }

  // 3) Number facts.
  if (questions.length < count && numbers.length >= 2) {
    for (const s of shuffle(sentences)) {
      if (questions.length >= count) break;
      const found = s.match(/\$?[\d][\d,]*(?:\.\d+)?%?/);
      if (!found) continue;
      const correct = found[0];
      const others = shuffle(numbers.filter((n) => n !== correct)).slice(0, 3);
      if (others.length < 2) continue;
      const masked = s.replace(correct, '_____');
      const q = makeQ(`Which number completes this statement from the text? ${masked}`, [...others, correct], correct, 'Numbers & Facts', difficulty === 'hard' ? 4 : 2, s);
      if (q) questions.push(q);
    }
  }

  // 4) Which statement matches the text? (distractors = sentence with a term swapped)
  if (questions.length < count && difficulty !== 'easy') {
    for (const s of shuffle(sentences)) {
      if (questions.length >= count) break;
      const terms = keyTerms(s);
      if (terms.length < 1 || allTerms.length < 4) continue;
      const correct = s;
      const distractors: string[] = [];
      for (let k = 0; k < 3; k++) {
        const swapIn = shuffle(allTerms.filter((t) => !s.toLowerCase().includes(t.toLowerCase())))[0];
        if (!swapIn) break;
        const t = terms[k % terms.length];
        const pos = s.toLowerCase().indexOf(t.toLowerCase());
        if (pos < 0) continue;
        distractors.push(`${s.slice(0, pos)}${swapIn}${s.slice(pos + t.length)}`);
      }
      const q = makeQ('Which of these statements matches the text exactly in meaning?', [...distractors, correct], correct, 'Comprehension', 4, s);
      if (q) questions.push(q);
    }
  }

  if (questions.length < 4) {
    return { questions: [], error: `Only ${questions.length} usable questions could be built from that text. Try pasting denser notes — definitions, facts and numbers generate the best questions.` };
  }
  return { questions: shuffle(questions).slice(0, count).map((q, i) => ({ ...q, id: i })) };
}
