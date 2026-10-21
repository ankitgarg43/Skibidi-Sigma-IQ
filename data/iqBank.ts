import { Question } from '../types';

// Original offline IQ-style bank (24 questions, 6 per category), each with an
// explanation. Works with no API key. Correctness checked by hand at build time.
type Raw = [string, string, string[], number, number, string]; // category, text, options, correct, difficulty, explanation

const RAW: Raw[] = [
  // Logical Reasoning
  ['Logical Reasoning', 'What comes next in this sequence? 2, 6, 12, 20, 30, ?', ['36', '40', '42', '44'], 2, 3, 'The gaps grow by 2 each time: +4, +6, +8, +10, so the next gap is +12. 30 + 12 = 42.'],
  ['Logical Reasoning', 'All blorps are snargs. All snargs are wibbles. Which statement MUST be true?', ['All wibbles are blorps', 'All blorps are wibbles', 'Some blorps are not wibbles', 'No blorp is a wibble'], 1, 2, 'If every blorp is a snarg, and every snarg is a wibble, then every blorp is also a wibble. The reverse does not have to hold.'],
  ['Logical Reasoning', 'Which number is the odd one out?', ['121', '144', '169', '190', '196'], 3, 2, '121, 144, 169 and 196 are perfect squares (11², 12², 13², 14²). 190 is not a square.'],
  ['Logical Reasoning', 'If today is Wednesday, what day will it be in exactly 100 days?', ['Thursday', 'Friday', 'Saturday', 'Tuesday'], 1, 3, '100 days is 14 full weeks plus 2 days (100 mod 7 = 2). Wednesday + 2 days = Friday.'],
  ['Logical Reasoning', 'A is taller than B. C is shorter than B. D is taller than A. Who is the shortest?', ['A', 'B', 'C', 'D'], 2, 1, 'C is shorter than B, and B is shorter than both A and D, so C is the shortest of the four.'],
  ['Logical Reasoning', 'In a code, letter values are A=1, B=2, C=3, and so on, and a word scores the sum of its letters. If DOG scores 26 (4+15+7), what does CAT score?', ['22', '24', '26', '28'], 1, 4, 'C=3, A=1, T=20. 3 + 1 + 20 = 24.'],
  // Numerical Intelligence
  ['Numerical Intelligence', 'What is 15% of 240?', ['30', '36', '42', '48'], 1, 1, '10% of 240 is 24 and 5% is 12, so 15% = 24 + 12 = 36.'],
  ['Numerical Intelligence', 'A train travels at a steady 60 km/h for 2.5 hours. How far does it go?', ['120 km', '135 km', '150 km', '180 km'], 2, 1, 'Distance = speed × time = 60 × 2.5 = 150 km.'],
  ['Numerical Intelligence', 'If 4 machines make 4 parts in 4 minutes, how long do 100 machines take to make 100 parts?', ['100 minutes', '25 minutes', '4 minutes', '1 minute'], 2, 3, 'Each machine makes 1 part in 4 minutes. With 100 machines working in parallel, 100 parts are still done in 4 minutes.'],
  ['Numerical Intelligence', 'A jacket priced at $80 is raised by 20%, then reduced by 20%. What is the final price?', ['$80.00', '$76.80', '$83.20', '$72.00'], 1, 4, '$80 × 1.20 = $96, then $96 × 0.80 = $76.80. The decrease applies to the higher price, so you end below $80.'],
  ['Numerical Intelligence', 'What is the average of 10, 20, 30, 40 and 50?', ['25', '28', '30', '35'], 2, 1, 'The numbers are evenly spaced, so the average is the middle value: 30. (Sum 150 ÷ 5 = 30.)'],
  ['Numerical Intelligence', 'How much simple interest does $1,000 earn at 5% per year over 3 years?', ['$50', '$100', '$150', '$157.63'], 2, 2, 'Simple interest = 1,000 × 0.05 × 3 = $150.'],
  // Verbal Intelligence
  ['Verbal Intelligence', 'Book is to Pages as Wall is to ?', ['Paint', 'Bricks', 'House', 'Window'], 1, 2, 'A book is built from pages, just as a wall is built from bricks.'],
  ['Verbal Intelligence', 'Which word is closest in meaning to "candid"?', ['Secretive', 'Frank', 'Careful', 'Rude'], 1, 1, 'Candid means honest and direct — frank.'],
  ['Verbal Intelligence', 'Which word is the opposite of "scarce"?', ['Rare', 'Abundant', 'Costly', 'Fragile'], 1, 1, 'Scarce means in short supply; abundant means plentiful — the opposite.'],
  ['Verbal Intelligence', 'Doctor is to Hospital as Teacher is to ?', ['Student', 'Classroom lesson', 'School', 'Book'], 2, 2, 'A doctor works in a hospital; a teacher works in a school.'],
  ['Verbal Intelligence', 'Which item does not belong with the others?', ['Apple', 'Banana', 'Carrot', 'Grape'], 2, 1, 'Apple, banana and grape are fruits. A carrot is a vegetable.'],
  ['Verbal Intelligence', '"Ephemeral" means something that is:', ['Extremely large', 'Short-lived', 'Ancient', 'Dangerous'], 1, 3, 'Ephemeral describes something that lasts for a very short time.'],
  // Spatial Reasoning
  ['Spatial Reasoning', 'A sequence of shapes repeats: circle, square, triangle, circle, square, … What comes next?', ['Circle', 'Square', 'Triangle', 'Pentagon'], 2, 1, 'The pattern repeats every three shapes, so after circle, square comes triangle.'],
  ['Spatial Reasoning', 'An arrow points North. It turns 90° clockwise twice, then 90° counter-clockwise once. Which way does it point now?', ['North', 'East', 'South', 'West'], 1, 3, 'North → East → South with the clockwise turns, then one counter-clockwise turn brings it back to East.'],
  ['Spatial Reasoning', 'On a standard die, opposite faces always add to 7. Which number is opposite 1?', ['2', '3', '6', '5'], 2, 2, 'Opposite faces sum to 7, so the face opposite 1 is 6.'],
  ['Spatial Reasoning', 'Which of these capital letters looks exactly the same in a mirror?', ['B', 'H', 'P', 'R'], 1, 2, 'H has vertical symmetry, so its mirror image is identical. B, P and R flip into different shapes.'],
  ['Spatial Reasoning', 'You stand at (0, 0). You move right 3, up 2, left 1, down 1. Where are you?', ['(3, 2)', '(2, 1)', '(1, 2)', '(2, 3)'], 1, 3, 'x: 0 + 3 − 1 = 2. y: 0 + 2 − 1 = 1. You end at (2, 1).'],
  ['Spatial Reasoning', 'Shapes are listed in order of increasing sides: triangle (3), square (4), pentagon (5), hexagon (6). What is next?', ['Hexagon', 'Heptagon', 'Octagon', 'Pentagon'], 1, 2, 'The next shape has 7 sides: a heptagon.'],
];

export const IQ_BANK: Question[] = RAW.map((r, i) => ({
  id: i,
  category: r[0],
  text: r[1],
  options: r[2],
  correctIndex: r[3],
  difficulty: r[4],
  explanation: r[5],
}));

export function selectIqQuestions(count: number, difficulty: 'easy' | 'medium' | 'hard'): Question[] {
  const inBand = (q: Question) =>
    difficulty === 'easy' ? q.difficulty <= 2 : difficulty === 'hard' ? q.difficulty >= 3 : q.difficulty >= 2 && q.difficulty <= 4;
  const shuffled = [...IQ_BANK].sort(() => Math.random() - 0.5);
  const picked: Question[] = [];
  // Round-robin across categories for balance, band first, then any.
  const cats = [...new Set(IQ_BANK.map((q) => q.category))];
  for (const pool of [shuffled.filter(inBand), shuffled]) {
    for (const cat of cats) {
      for (const q of pool.filter((x) => x.category === cat)) {
        if (picked.length >= count) break;
        if (!picked.includes(q)) picked.push(q);
      }
    }
    if (picked.length >= count) break;
  }
  return picked.slice(0, count).map((q, i) => ({ ...q, id: i }));
}
