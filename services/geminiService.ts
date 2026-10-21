import { Question, DifficultyLevel } from '../types';

// OPTIONAL Gemini enhancement for Paste mode.
// Security fix vs the original repo: no API key is ever baked into the build.
// The user may paste their own Gemini key in Settings; it is held only in
// component state for the session (never stored, never sent anywhere except
// Google's API by the official client), and any failure quietly falls back to
// the built-in local generator.

export async function tryGeminiQuestions(
  apiKey: string,
  sourceText: string,
  count: number,
  difficulty: DifficultyLevel
): Promise<Question[] | null> {
  if (!apiKey.trim()) return null;
  try {
    const { GoogleGenAI, Type } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const trimmed = sourceText.slice(0, 12000);
    const prompt = `Create exactly ${count} multiple-choice questions (4 options each, exactly one correct) ONLY from the facts in the text below. Difficulty: ${difficulty}. Vary the topics covered. For each question give a one-sentence explanation that quotes or paraphrases the supporting fact. Label each question's category with the sub-topic it tests.\n\nTEXT:\n${trimmed}`;
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctIndex: { type: Type.INTEGER },
              category: { type: Type.STRING },
              difficulty: { type: Type.INTEGER },
              explanation: { type: Type.STRING },
            },
            required: ['text', 'options', 'correctIndex', 'category', 'difficulty', 'explanation'],
          },
        },
        temperature: 0.7,
      },
    });
    if (!response.text) return null;
    const parsed = JSON.parse(response.text);
    if (!Array.isArray(parsed) || parsed.length < 4) return null;
    return parsed.slice(0, count).map((q: Question, i: number) => ({
      id: i,
      text: String(q.text),
      options: (q.options as string[]).slice(0, 4).map(String),
      correctIndex: Math.min(3, Math.max(0, Number(q.correctIndex) || 0)),
      category: String(q.category || 'General'),
      difficulty: Math.min(5, Math.max(1, Number(q.difficulty) || 3)),
      explanation: String(q.explanation || ''),
    }));
  } catch {
    return null; // local generator takes over
  }
}
