import React, { useState, useRef } from 'react';
import { AppState, Question, UserAnswer, QuizResult, DifficultyLevel } from './types';
import { generateQuizQuestions, analyzeIQ } from './services/geminiService';
import { LoadingSpinner } from './components/LoadingSpinner';
import { Button } from './components/Button';
import { QuizCard } from './components/QuizCard';
import { SkillsRadar } from './components/RadarChart';
import { Brain, ChevronRight, Zap, Target, Flame, Play, SignalHigh, SignalMedium, SignalLow } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('intro');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  
  // Timing refs
  const questionStartTime = useRef<number>(0);

  const startQuiz = async () => {
    setAppState('generating');
    setError(null);
    try {
      const qs = await generateQuizQuestions(difficulty);
      setQuestions(qs);
      setCurrentQuestionIndex(0);
      setUserAnswers([]);
      setAppState('quiz');
      questionStartTime.current = Date.now();
    } catch (e) {
      console.error(e);
      setError("Failed to generate test. API Key might be cooked.");
      setAppState('error');
    }
  };

  const handleNextQuestion = () => {
    if (selectedOption === null) return;

    const timeTaken = (Date.now() - questionStartTime.current) / 1000;
    const newAnswer: UserAnswer = {
      questionId: questions[currentQuestionIndex].id,
      selectedOptionIndex: selectedOption,
      timeTakenSeconds: timeTaken
    };

    const newAnswers = [...userAnswers, newAnswer];
    setUserAnswers(newAnswers);
    setSelectedOption(null);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      questionStartTime.current = Date.now();
    } else {
      finishQuiz(newAnswers);
    }
  };

  const finishQuiz = async (answers: UserAnswer[]) => {
    setAppState('analyzing');
    try {
      const analysisResult = await analyzeIQ(questions, answers, difficulty);
      setResult(analysisResult);
      setAppState('result');
    } catch (e) {
      console.error(e);
      setError("Failed to analyze results. AI gave up.");
      setAppState('error');
    }
  };

  // Render Helpers
  const renderIntro = () => (
    <div className="max-w-3xl mx-auto text-center px-4 relative z-10">
      <div className="mb-6 inline-flex items-center justify-center p-6 bg-fuchsia-500/10 rounded-full border border-fuchsia-500/30 shadow-[0_0_30px_rgba(217,70,239,0.2)]">
        <Brain className="w-20 h-20 text-fuchsia-400 animate-pulse" />
      </div>
      <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-white mb-6 leading-none uppercase">
        Skibidi <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-400 to-cyan-400">Sigma IQ</span>
      </h1>
      <p className="text-xl md:text-2xl text-slate-300 mb-8 font-light max-w-2xl mx-auto">
        Are you actually a genius or just an NPC? <br/>
        Test your Rizz, Logic, and Sigma Grindset in this AI-generated assessment.
      </p>
      
      {/* Difficulty Selector */}
      <div className="mb-10">
        <p className="text-cyan-400 font-bold uppercase tracking-widest text-sm mb-4">Select Difficulty</p>
        <div className="flex flex-col md:flex-row justify-center items-center gap-4">
          <Button 
            variant={difficulty === 'easy' ? 'primary' : 'outline'} 
            onClick={() => setDifficulty('easy')}
            className="w-full md:w-32"
          >
            <SignalLow className="w-4 h-4 mr-2" /> Easy
          </Button>
          <Button 
            variant={difficulty === 'medium' ? 'primary' : 'outline'} 
            onClick={() => setDifficulty('medium')}
            className="w-full md:w-32"
          >
            <SignalMedium className="w-4 h-4 mr-2" /> Medium
          </Button>
          <Button 
            variant={difficulty === 'hard' ? 'primary' : 'outline'} 
            onClick={() => setDifficulty('hard')}
            className="w-full md:w-32"
          >
            <SignalHigh className="w-4 h-4 mr-2" /> Hard
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 text-slate-300">
        <div className="bg-black/30 p-6 border-2 border-slate-800 hover:border-lime-400 transition-colors group">
          <Target className="w-8 h-8 mx-auto mb-3 text-lime-400 group-hover:scale-110 transition-transform" />
          <p className="font-bold uppercase tracking-widest text-sm mb-1 text-white">Logic Lock-in</p>
          <p className="text-xs text-slate-400">Harder than Ohio math</p>
        </div>
        <div className="bg-black/30 p-6 border-2 border-slate-800 hover:border-fuchsia-400 transition-colors group">
          <Brain className="w-8 h-8 mx-auto mb-3 text-fuchsia-400 group-hover:scale-110 transition-transform" />
          <p className="font-bold uppercase tracking-widest text-sm mb-1 text-white">Big Brain Moves</p>
          <p className="text-xs text-slate-400">Multidimensional thinking</p>
        </div>
        <div className="bg-black/30 p-6 border-2 border-slate-800 hover:border-cyan-400 transition-colors group">
          <Flame className="w-8 h-8 mx-auto mb-3 text-cyan-400 group-hover:scale-110 transition-transform" />
          <p className="font-bold uppercase tracking-widest text-sm mb-1 text-white">Roasted by AI</p>
          <p className="text-xs text-slate-400">Get your Rizz analyzed</p>
        </div>
      </div>

      <Button onClick={startQuiz} size="lg" className="w-full md:w-auto shadow-[0_0_20px_rgba(132,204,22,0.4)] animate-bounce-subtle">
        <Play className="w-5 h-5 mr-3 fill-current" />
        Check My Rizz
      </Button>
    </div>
  );

  const renderQuiz = () => (
    <div className="w-full max-w-5xl mx-auto px-4 flex flex-col h-full justify-between pb-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-end mb-2">
          <h2 className="text-lg text-slate-400 font-bold uppercase tracking-widest">
            Level {currentQuestionIndex + 1} <span className="text-slate-700">/ {questions.length}</span>
          </h2>
          <div className="flex flex-col items-end">
             <div className="text-lime-400 text-sm font-mono font-bold">
               {Math.round(((currentQuestionIndex) / questions.length) * 100)}% UNLOCKED
             </div>
             <span className="text-[10px] text-slate-500 uppercase tracking-widest">{difficulty} Mode</span>
          </div>
        </div>
        <div className="w-full h-3 bg-slate-900 border border-slate-800 skew-x-[-10deg]">
          <div 
            className="h-full bg-gradient-to-r from-lime-400 to-cyan-400 shadow-[0_0_10px_rgba(163,230,53,0.5)] transition-all duration-300 ease-out"
            style={{ width: `${((currentQuestionIndex) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="flex-grow flex items-center justify-center relative z-10">
        <QuizCard 
          question={questions[currentQuestionIndex]}
          selectedOption={selectedOption}
          onSelectOption={setSelectedOption}
        />
      </div>

      {/* Footer */}
      <div className="mt-10 flex justify-end">
        <Button 
          onClick={handleNextQuestion} 
          disabled={selectedOption === null}
          size="lg"
          className="w-full md:w-auto"
        >
          {currentQuestionIndex === questions.length - 1 ? 'Calculate Rizz' : 'Next Level'}
          <ChevronRight className="w-6 h-6 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderResult = () => {
    if (!result) return null;
    return (
      <div className="w-full max-w-5xl mx-auto px-4 animate-fade-in-up">
        <div className="text-center mb-12">
          <Zap className="w-16 h-16 mx-auto text-yellow-400 mb-4 animate-pulse fill-yellow-400" />
          <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-2">
            The Verdict is In
          </h2>
          <p className="text-slate-400 uppercase tracking-widest text-sm">
             Played on <span className="text-lime-400 font-bold">{difficulty}</span> mode
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Main Score Card */}
          <div className="lg:col-span-1 bg-black/40 border-2 border-slate-800 p-8 flex flex-col items-center justify-center text-center shadow-[0_0_30px_rgba(0,0,0,0.5)] relative overflow-hidden group">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-lime-400 via-fuchsia-500 to-cyan-500" />
             <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/90 pointer-events-none"></div>
             
             <div className="relative z-10">
                <p className="text-lime-400 text-xs font-bold uppercase tracking-[0.2em] mb-4 border border-lime-400/30 px-2 py-1 inline-block">Sigma IQ Score</p>
                <div className="text-8xl font-black text-white mb-2 tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                  {result.iqScore}
                </div>
                <div className={`text-3xl font-black uppercase italic tracking-widest mb-6 ${
                  result.iqScore >= 120 ? 'text-lime-400 drop-shadow-[0_0_10px_rgba(163,230,53,0.8)]' :
                  result.iqScore >= 100 ? 'text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]' :
                  result.iqScore >= 80 ? 'text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]' :
                  'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]'
                }`}>
                  {result.iqScore >= 120 ? 'GIGACHAD SIGMA' :
                   result.iqScore >= 100 ? 'W RIZZ' :
                   result.iqScore >= 80 ? 'MID RIZZ' : 'L RIZZ (NPC)'}
                </div>
                <p className="text-cyan-400 text-sm font-mono mb-8">Top {100 - result.percentile}% Server Rank</p>
                
                <div className="w-full grid grid-cols-2 gap-4 border-t-2 border-slate-800 pt-6">
                    <div>
                      <p className="text-3xl font-bold text-white">{result.correctCount}/{result.totalQuestions}</p>
                      <p className="text-[10px] uppercase text-slate-500 font-bold">W's Taken</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-white">{Math.round((result.correctCount / result.totalQuestions) * 100)}%</p>
                      <p className="text-[10px] uppercase text-slate-500 font-bold">Accuracy</p>
                    </div>
                </div>
             </div>
          </div>

          {/* Radar Chart */}
          <div className="lg:col-span-2 bg-black/40 border-2 border-slate-800 p-6 flex flex-col relative overflow-hidden">
             <div className="absolute -right-10 -top-10 w-32 h-32 bg-fuchsia-600/20 blur-3xl rounded-full"></div>
             <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-lime-500/20 blur-3xl rounded-full"></div>
             
            <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-6 relative z-10 flex items-center">
              <Brain className="w-5 h-5 mr-2 text-fuchsia-500" />
              Brainrot Breakdown
            </h3>
            <div className="flex-grow flex items-center justify-center relative z-10">
               <SkillsRadar data={result.categoryBreakdown} />
            </div>
          </div>
        </div>

        {/* AI Analysis */}
        <div className="bg-gradient-to-br from-slate-900 to-black border-2 border-cyan-500/30 p-8 shadow-[0_0_30px_rgba(34,211,238,0.1)] relative">
          <div className="flex flex-col md:flex-row items-start gap-6">
             <div className="p-3 bg-cyan-500/10 border border-cyan-500/50 rounded-none shrink-0">
                <Brain className="w-8 h-8 text-cyan-400" />
             </div>
             <div>
               <h3 className="text-xl font-bold text-cyan-200 mb-2 uppercase tracking-wide">AI Analysis (No Cap)</h3>
               <p className="text-slate-300 leading-relaxed text-base md:text-lg font-light">
                 {result.analysis}
               </p>
             </div>
          </div>
        </div>

        <div className="mt-16 text-center pb-8">
           <Button onClick={() => setAppState('intro')} variant="secondary" size="lg">
             Go Again
           </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center py-12 relative overflow-hidden selection:bg-lime-400 selection:text-black">
      {/* Background Decor - Brainrot Aurora */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
         <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-fuchsia-900/20 rounded-full blur-[120px] mix-blend-screen animate-pulse"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-lime-900/20 rounded-full blur-[120px] mix-blend-screen animate-pulse delay-1000"></div>
         <div className="absolute top-[40%] left-[50%] transform -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] bg-cyan-900/20 rounded-full blur-[100px] mix-blend-screen opacity-50"></div>
         
         {/* Grid overlay */}
         <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"></div>
      </div>

      <main className="w-full relative z-10 flex-grow flex flex-col justify-center">
        {appState === 'intro' && renderIntro()}
        
        {appState === 'generating' && (
          <LoadingSpinner message="Cooking up some questions..." />
        )}
        
        {appState === 'quiz' && renderQuiz()}
        
        {appState === 'analyzing' && (
           <LoadingSpinner message="Consulting the Skibidi elders..." />
        )}
        
        {appState === 'result' && renderResult()}
        
        {appState === 'error' && (
           <div className="text-center p-8 bg-red-900/20 border-2 border-red-500 rounded-none max-w-md mx-auto backdrop-blur-md">
             <h3 className="text-red-400 font-bold mb-2 uppercase tracking-widest">Major L</h3>
             <p className="text-red-200 mb-6 font-mono text-sm">{error}</p>
             <Button onClick={() => setAppState('intro')} variant="outline">Respawn</Button>
           </div>
        )}
      </main>

      <footer className="w-full text-center py-6 text-slate-700 text-xs font-mono uppercase tracking-widest relative z-10">
        <p>Skibidi Sigma IQ is for entertainment purposes. Don't take it too serious, fam.</p>
      </footer>
    </div>
  );
};

export default App;
