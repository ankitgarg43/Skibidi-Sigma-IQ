import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Question, QuestionCategory, QuizResult, UserAnswer, DifficultyLevel } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const QUESTIONS_COUNT = 10;

// Schema for generating questions
const questionSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      text: { type: Type.STRING, description: "The question text." },
      options: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "An array of 4 possible answers."
      },
      correctIndex: { type: Type.INTEGER, description: "The index (0-3) of the correct answer." },
      category: {
        type: Type.STRING,
        enum: [
          QuestionCategory.LOGICAL,
          QuestionCategory.NUMERICAL,
          QuestionCategory.VERBAL,
          QuestionCategory.SPATIAL
        ]
      },
      difficulty: { type: Type.INTEGER, description: "Difficulty level from 1 (Easy) to 5 (Genius)." }
    },
    required: ["text", "options", "correctIndex", "category", "difficulty"]
  }
};

export const generateQuizQuestions = async (difficulty: DifficultyLevel): Promise<Question[]> => {
  try {
    const model = "gemini-3-flash-preview";
    
    let difficultyInstruction = "";
    switch (difficulty) {
      case 'easy':
        difficultyInstruction = "Generate questions with difficulty 1-2 (Easy/Beginner). Focus on simple pattern recognition and basic verbal analogies.";
        break;
      case 'medium':
        difficultyInstruction = "Generate questions with difficulty 3 (Intermediate). Standard IQ test level with balanced logic puzzles.";
        break;
      case 'hard':
        difficultyInstruction = "Generate questions with difficulty 4-5 (Advanced/Genius). Complex, abstract reasoning, multi-step numerical problems, and tricky logic.";
        break;
    }

    const prompt = `Generate ${QUESTIONS_COUNT} unique, challenging, and high-quality IQ test questions. 
    Mix the categories: Logical Reasoning, Numerical Intelligence, Verbal Intelligence, and Spatial Reasoning.
    ${difficultyInstruction}
    Ensure there is strictly only one correct answer per question.
    Keep the tone professional for the questions themselves, but make them tricky.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: questionSchema,
        temperature: 0.8
      }
    });

    const rawData = response.text;
    if (!rawData) throw new Error("No data received from Gemini");
    
    const parsedData = JSON.parse(rawData);
    
    return parsedData.map((q: any, index: number) => ({
      ...q,
      id: index
    }));

  } catch (error) {
    console.error("Error generating questions:", error);
    throw error;
  }
};

export const analyzeIQ = async (questions: Question[], answers: UserAnswer[], difficulty: DifficultyLevel): Promise<QuizResult> => {
  // Calculate raw stats locally first
  let correctCount = 0;
  const categoryScores: Record<string, { correct: number; total: number }> = {};

  questions.forEach((q) => {
    if (!categoryScores[q.category]) {
      categoryScores[q.category] = { correct: 0, total: 0 };
    }
    categoryScores[q.category].total += 1;

    const answer = answers.find(a => a.questionId === q.id);
    if (answer && answer.selectedOptionIndex === q.correctIndex) {
      correctCount++;
      categoryScores[q.category].correct += 1;
    }
  });

  // Calculate IQ based on difficulty and accuracy
  const accuracy = correctCount / questions.length;
  let calculatedIQ = 0;

  switch (difficulty) {
    case 'easy':
      // Base 60, Max 120
      calculatedIQ = Math.round(60 + (accuracy * 60)); 
      break;
    case 'medium':
      // Base 75, Max 145
      calculatedIQ = Math.round(75 + (accuracy * 70)); 
      break;
    case 'hard':
      // Base 90, Max 165+
      calculatedIQ = Math.round(90 + (accuracy * 75)); 
      break;
  }
  
  // Format for Recharts
  const categoryBreakdown = Object.keys(categoryScores).map(cat => ({
    category: cat,
    score: Math.round((categoryScores[cat].correct / categoryScores[cat].total) * 100) || 0,
    fullMark: 100
  }));

  // AI Analysis of performance
  let analysisText = "Could not generate analysis.";
  try {
    const model = "gemini-3-flash-preview";
    const performanceSummary = questions.map(q => {
      const ans = answers.find(a => a.questionId === q.id);
      const isCorrect = ans?.selectedOptionIndex === q.correctIndex;
      return `Category: ${q.category}, Difficulty: ${q.difficulty}, Correct: ${isCorrect}, Time: ${ans?.timeTakenSeconds}s`;
    }).join('\n');

    const prompt = `You are a Gen Alpha slang expert. Analyze this IQ test performance.
    Difficulty Level: ${difficulty.toUpperCase()}.
    The user scored an estimated IQ of ${calculatedIQ}.
    If the score is high (above 120), call them a "Sigma", "Gigachad", say they have "W Rizz".
    If the score is average, say they are "Mid" or an "NPC".
    If the score is low, say they are "Cooked", "Fanum Taxed", or have "L Rizz".
    Keep it funny, use emojis, but actually refer to their strength in specific categories based on the data. Max 3 sentences.
    Data:
    ${performanceSummary}`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    
    if (response.text) {
      analysisText = response.text;
    }
  } catch (e) {
    console.error("Analysis generation failed", e);
    analysisText = "You definitely cooked... something. Try again!";
  }

  return {
    iqScore: calculatedIQ,
    percentile: calculatePercentile(calculatedIQ), 
    correctCount,
    totalQuestions: questions.length,
    categoryBreakdown,
    analysis: analysisText
  };
};

function calculatePercentile(iq: number): number {
  if (iq < 70) return 2;
  if (iq < 85) return 16;
  if (iq < 100) return 50;
  if (iq < 115) return 84;
  if (iq < 130) return 98;
  return 99.9;
}
