import React, { useEffect, useRef, useState } from 'react';
import { AppState, Question, UserAnswer, QuizResult, DifficultyLevel, ThemeName, QuizMode, DuelPayload, AttemptRecord, QuizConfig, Profile, SavedSession } from './types';
import { selectIqQuestions } from './data/iqBank';
import { generateFromText } from './lib/generateFromText';
import { computeResult, loadHistory, saveAttempt, historicalWeakCategories } from './lib/scoring';
import { encodeChallenge, decodeChallenge, challengeLink, challengeFromLocation } from './lib/challenge';
import { loadProfiles, createProfile, checkPin, getActiveProfileId, setActiveProfileId, profileDisplayName, loadSession, saveSession, clearSession, GUEST_ID } from './lib/profiles';
import { drillFromPool } from './services/quizService';
import { tryGeminiQuestions } from './services/geminiService';
import { LoadingSpinner } from './components/LoadingSpinner';
import { Button } from './components/Button';
import { QuizCard } from './components/QuizCard';
import { SkillsRadar } from './components/RadarChart';
import { downloadShareCard } from './components/ShareCard';
import { Brain, ChevronRight, Zap, Target, Flame, Play, BookOpen, ClipboardPaste, GraduationCap, Swords, Download, Link2, Crosshair, History, SunMoon, CheckCircle2, XCircle, Clock, Pause, UserRound, Timer } from 'lucide-react';

interface DuelMeta { creatorName: string; creatorScorePercent: number; creatorCategories: { category: string; score: number }[]; }

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

const App: React.FC = () => {
  const [theme, setTheme] = useState<ThemeName>(() => {
    try { return (localStorage.getItem('sigma-plus-theme') as ThemeName) || 'sigma'; } catch { return 'sigma'; }
  });
  const pro = theme === 'pro';

  // Profiles (on-device "login")
  const [profiles, setProfiles] = useState<Profile[]>(() => loadProfiles());
  const [profileId, setProfileId] = useState<string>(() => getActiveProfileId());
  const [showProfiles, setShowProfiles] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinFor, setPinFor] = useState<Profile | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const [appState, setAppState] = useState<AppState>('intro');
  const [setupTab, setSetupTab] = useState<'iq' | 'paste' | 'duel'>('paste');
  const [mode, setMode] = useState<QuizMode>('paste');
  const [quizTitle, setQuizTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [history, setHistory] = useState<AttemptRecord[]>(() => loadHistory(getActiveProfileId()));
  const [savedBanner, setSavedBanner] = useState<SavedSession | null>(() => loadSession(getActiveProfileId()));

  // Format + timers + pause
  const [config, setConfig] = useState<QuizConfig>({ format: 'practice' });
  const [paused, setPaused] = useState(false);
  const [countdownLeftMs, setCountdownLeftMs] = useState<number | null>(null);
  const [sprintLeftMs, setSprintLeftMs] = useState<number | null>(null);
  const qStartRef = useRef<number>(0);
  const qElapsedBaseRef = useRef<number>(0);
  const countdownEndsAtRef = useRef<number | null>(null);
  const countdownRemainingRef = useRef<number | null>(null);
  const sprintEndsAtRef = useRef<number | null>(null);
  const sprintRemainingRef = useRef<number | null>(null);

  // Paste setup
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [pasteCount, setPasteCount] = useState(10);
  const [geminiKey, setGeminiKey] = useState('');
  const [useGemini, setUseGemini] = useState(false);

  // IQ setup
  const [iqCount, setIqCount] = useState(10);

  // Duel
  const [incomingDuel, setIncomingDuel] = useState<DuelPayload | null>(null);
  const [duelMeta, setDuelMeta] = useState<DuelMeta | null>(null);
  const [importCode, setImportCode] = useState('');
  const [myName, setMyName] = useState('');
  const [createdChallenge, setCreatedChallenge] = useState<{ link: string; code: string } | null>(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    const duel = challengeFromLocation();
    if (duel) setIncomingDuel(duel);
  }, []);

  useEffect(() => {
    try { localStorage.setItem('sigma-plus-theme', theme); } catch { /* ignore */ }
    document.documentElement.style.colorScheme = pro ? 'light' : 'dark';
  }, [theme, pro]);

  // ---------- Session persistence ----------
  const persistSession = (qs: Question[], answers: UserAnswer[], index: number, cfg: QuizConfig, m: QuizMode, title: string, meta: DuelMeta | null) => {
    saveSession(profileId, {
      savedAt: Date.now(),
      mode: m,
      title,
      questions: qs,
      userAnswers: answers,
      currentIndex: index,
      config: cfg,
      duelMeta: meta,
      countdownRemainingMs: countdownRemainingRef.current ?? (cfg.format === 'countdown' && cfg.totalMinutes ? cfg.totalMinutes * 60000 : null),
    });
  };

  // ---------- Quiz lifecycle ----------
  const beginQuiz = (qs: Question[], m: QuizMode, title: string, meta: DuelMeta | null = null, cfg: QuizConfig = config) => {
    if (!qs.length) { setError('No questions could be built for that selection. Try different settings.'); setAppState('error'); return; }
    setQuestions(qs);
    setMode(m);
    setQuizTitle(title);
    setDuelMeta(meta);
    setConfig(cfg);
    setCreatedChallenge(null);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setSelectedOption(null);
    setResult(null);
    setPaused(false);
    qElapsedBaseRef.current = 0;
    qStartRef.current = Date.now();
    if (cfg.format === 'countdown' && cfg.totalMinutes) {
      countdownRemainingRef.current = cfg.totalMinutes * 60000;
      countdownEndsAtRef.current = Date.now() + cfg.totalMinutes * 60000;
      setCountdownLeftMs(cfg.totalMinutes * 60000);
    } else { countdownEndsAtRef.current = null; countdownRemainingRef.current = null; setCountdownLeftMs(null); }
    if (cfg.format === 'sprint' && cfg.perQuestionSeconds) {
      sprintRemainingRef.current = cfg.perQuestionSeconds * 1000;
      sprintEndsAtRef.current = Date.now() + cfg.perQuestionSeconds * 1000;
      setSprintLeftMs(cfg.perQuestionSeconds * 1000);
    } else { sprintEndsAtRef.current = null; sprintRemainingRef.current = null; setSprintLeftMs(null); }
    setAppState('quiz');
    persistSession(qs, [], 0, cfg, m, title, meta);
  };

  const finishQuiz = (finalAnswers: UserAnswer[]) => {
    const res = computeResult(questions, finalAnswers, pro);
    setResult(res);
    setHistory(saveAttempt(profileId, mode, quizTitle, res, questions));
    clearSession(profileId);
    setSavedBanner(null);
    setPaused(false);
    setAppState('result');
  };

  const advance = (answers: UserAnswer[], nextIndex: number) => {
    setUserAnswers(answers);
    setSelectedOption(null);
    setCurrentQuestionIndex(nextIndex);
    qElapsedBaseRef.current = 0;
    qStartRef.current = Date.now();
    if (config.format === 'sprint' && config.perQuestionSeconds) {
      sprintRemainingRef.current = config.perQuestionSeconds * 1000;
      sprintEndsAtRef.current = Date.now() + config.perQuestionSeconds * 1000;
      setSprintLeftMs(config.perQuestionSeconds * 1000);
    }
    persistSession(questions, answers, nextIndex, config, mode, quizTitle, duelMeta);
  };

  const handleNextQuestion = () => {
    if (selectedOption === null) return;
    const elapsed = (qElapsedBaseRef.current + (Date.now() - qStartRef.current)) / 1000;
    const answer: UserAnswer = { questionId: questions[currentQuestionIndex].id, selectedOptionIndex: selectedOption, timeTakenSeconds: Math.round(elapsed * 10) / 10 };
    const newAnswers = [...userAnswers, answer];
    if (currentQuestionIndex < questions.length - 1) advance(newAnswers, currentQuestionIndex + 1);
    else { setUserAnswers(newAnswers); setAppState('analyzing'); finishQuiz(newAnswers); }
  };

  // Timer expiry handlers (called from the tick loop via ref so state is fresh)
  const onSprintTimeout = () => {
    const answer: UserAnswer = { questionId: questions[currentQuestionIndex].id, selectedOptionIndex: selectedOption ?? -1, timeTakenSeconds: config.perQuestionSeconds || 0 };
    const newAnswers = [...userAnswers, answer];
    if (currentQuestionIndex < questions.length - 1) advance(newAnswers, currentQuestionIndex + 1);
    else { setUserAnswers(newAnswers); finishQuiz(newAnswers); }
  };
  const onCountdownTimeout = () => {
    const newAnswers = [...userAnswers];
    if (selectedOption !== null && !newAnswers.some((a) => a.questionId === questions[currentQuestionIndex].id)) {
      newAnswers.push({ questionId: questions[currentQuestionIndex].id, selectedOptionIndex: selectedOption, timeTakenSeconds: 0 });
    }
    setUserAnswers(newAnswers);
    finishQuiz(newAnswers);
  };
  const tickRef = useRef<() => void>(() => {});
  tickRef.current = () => {
    if (appState !== 'quiz' || paused) return;
    const now = Date.now();
    if (countdownEndsAtRef.current !== null) {
      const left = countdownEndsAtRef.current - now;
      setCountdownLeftMs(left);
      if (left <= 0) { onCountdownTimeout(); return; }
    }
    if (sprintEndsAtRef.current !== null) {
      const left = sprintEndsAtRef.current - now;
      setSprintLeftMs(left);
      if (left <= 0) onSprintTimeout();
    }
  };
  useEffect(() => {
    if (appState !== 'quiz') return;
    const id = setInterval(() => tickRef.current(), 250);
    return () => clearInterval(id);
  }, [appState]);

  // ---------- Pause / resume ----------
  const pauseQuiz = () => {
    const now = Date.now();
    qElapsedBaseRef.current += now - qStartRef.current;
    if (countdownEndsAtRef.current !== null) { countdownRemainingRef.current = Math.max(0, countdownEndsAtRef.current - now); countdownEndsAtRef.current = null; }
    if (sprintEndsAtRef.current !== null) { sprintRemainingRef.current = Math.max(0, sprintEndsAtRef.current - now); sprintEndsAtRef.current = null; }
    setPaused(true);
    persistSession(questions, userAnswers, currentQuestionIndex, config, mode, quizTitle, duelMeta);
  };
  const resumeQuiz = () => {
    const now = Date.now();
    qStartRef.current = now;
    if (countdownRemainingRef.current !== null) { countdownEndsAtRef.current = now + countdownRemainingRef.current; setCountdownLeftMs(countdownRemainingRef.current); }
    if (sprintRemainingRef.current !== null) { sprintEndsAtRef.current = now + sprintRemainingRef.current; setSprintLeftMs(sprintRemainingRef.current); }
    setPaused(false);
  };
  const saveAndExit = () => {
    persistSession(questions, userAnswers, currentQuestionIndex, config, mode, quizTitle, duelMeta);
    setSavedBanner(loadSession(profileId));
    setPaused(false);
    setAppState('intro');
  };
  const abandonQuiz = () => {
    clearSession(profileId);
    setSavedBanner(null);
    setPaused(false);
    setAppState('intro');
  };
  const resumeSaved = () => {
    const s = savedBanner;
    if (!s) return;
    setQuestions(s.questions);
    setMode(s.mode);
    setQuizTitle(s.title);
    setDuelMeta(s.duelMeta);
    setConfig(s.config);
    setUserAnswers(s.userAnswers);
    setCurrentQuestionIndex(s.currentIndex);
    setSelectedOption(null);
    setResult(null);
    setCreatedChallenge(null);
    setPaused(false);
    qElapsedBaseRef.current = 0;
    qStartRef.current = Date.now();
    if (s.config.format === 'countdown') {
      const remaining = s.countdownRemainingMs ?? (s.config.totalMinutes ? s.config.totalMinutes * 60000 : null);
      countdownRemainingRef.current = remaining;
      countdownEndsAtRef.current = remaining !== null ? Date.now() + remaining : null;
      setCountdownLeftMs(remaining);
    } else { countdownEndsAtRef.current = null; countdownRemainingRef.current = null; setCountdownLeftMs(null); }
    if (s.config.format === 'sprint' && s.config.perQuestionSeconds) {
      // The current question restarts its sprint clock after a break.
      sprintRemainingRef.current = s.config.perQuestionSeconds * 1000;
      sprintEndsAtRef.current = Date.now() + s.config.perQuestionSeconds * 1000;
      setSprintLeftMs(s.config.perQuestionSeconds * 1000);
    } else { sprintEndsAtRef.current = null; sprintRemainingRef.current = null; setSprintLeftMs(null); }
    setAppState('quiz');
  };

  // ---------- Starters ----------
  const startIq = () => beginQuiz(selectIqQuestions(iqCount, difficulty), 'iq', pro ? 'Skills Assessment' : 'Skibidi Sigma IQ');

  const startPaste = async () => {
    setAppState('generating');
    setError(null);
    let qs: Question[] | null = null;
    if (useGemini && geminiKey.trim()) qs = await tryGeminiQuestions(geminiKey, pasteText, pasteCount, difficulty);
    if (!qs) {
      const outcome = generateFromText(pasteText, pasteCount, difficulty);
      if (outcome.error) { setError(outcome.error); setAppState('error'); return; }
      qs = outcome.questions;
    }
    beginQuiz(qs, 'paste', pasteTitle.trim() || 'My Topic Quiz');
  };

  const startDrill = (categories: string[], pool: Question[], title: string) => {
    let qs: Question[] = [];
    if (!qs.length) qs = drillFromPool(categories, pool, 10);
    beginQuiz(qs, 'drill', title, null, { format: 'practice' });
  };

  const startIncomingDuel = () => {
    if (!incomingDuel) return;
    beginQuiz(incomingDuel.questions, 'duel', incomingDuel.title, {
      creatorName: incomingDuel.creatorName,
      creatorScorePercent: incomingDuel.creatorScorePercent,
      creatorCategories: incomingDuel.creatorCategories,
    }, { format: 'practice' });
    setIncomingDuel(null);
  };

  const startImportedDuel = () => {
    const codeMatch = importCode.match(/#duel=([A-Za-z0-9\-_]+)/);
    const payload = decodeChallenge(codeMatch ? codeMatch[1] : importCode);
    if (!payload) { setError('That challenge code could not be read. Paste the full link or code exactly as you received it.'); setAppState('error'); return; }
    beginQuiz(payload.questions, 'duel', payload.title, {
      creatorName: payload.creatorName,
      creatorScorePercent: payload.creatorScorePercent,
      creatorCategories: payload.creatorCategories,
    }, { format: 'practice' });
  };

  const createChallenge = () => {
    if (!result) return;
    const payload: DuelPayload = {
      v: 1, title: quizTitle, mode,
      creatorName: myName.trim() || profileDisplayName(profileId, profiles),
      creatorScorePercent: result.scorePercent,
      creatorCategories: result.categoryBreakdown.map((c) => ({ category: c.category, score: c.score })),
      questions,
    };
    const code = encodeChallenge(payload);
    setCreatedChallenge({ link: challengeLink(code), code });
  };

  const copyText = async (label: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(''), 2500); } catch { setCopied(''); }
  };

  const switchProfile = (id: string) => {
    setActiveProfileId(id);
    setProfileId(id);
    setHistory(loadHistory(id));
    setSavedBanner(loadSession(id));
    setShowProfiles(false);
    setPinFor(null);
    setPinInput('');
    setPinError('');
    setAppState('intro');
    setPaused(false);
  };

  const verdict = (score: number) => {
    if (pro) return score >= 80 ? 'Excellent' : score >= 60 ? 'Proficient' : score >= 40 ? 'Developing' : 'Needs Focus';
    return score >= 80 ? 'GIGACHAD SIGMA' : score >= 60 ? 'W RIZZ' : score >= 40 ? 'MID RIZZ' : 'L RIZZ (NPC)';
  };

  const SETUP_TABS: { id: 'paste' | 'iq' | 'duel'; icon: typeof Brain; label: string }[] = [
    { id: 'paste', icon: ClipboardPaste, label: pro ? 'Paste a Topic' : 'Paste Anything' },
    { id: 'iq', icon: Brain, label: pro ? 'Skills / IQ' : 'Sigma IQ' },
    { id: 'duel', icon: Swords, label: pro ? 'Enter a Duel' : 'Duel Code' },
  ];

  // ---------- Views ----------
  const renderFormatBar = () => (
    <div className={`mb-6 p-4 ${pro ? 'bg-white border border-slate-200 rounded-2xl' : 'bg-black/30 border-2 border-slate-800'}`}>
      <p className={`text-sm font-bold mb-3 flex items-center gap-2 ${pro ? 'text-slate-700' : 'text-slate-200'}`}><Timer className="w-4 h-4" /> Quiz format</p>
      <div className="flex flex-wrap gap-2 mb-3" role="radiogroup" aria-label="Quiz format">
        {([['practice', 'Practice — no clock'], ['countdown', 'Countdown — total time'], ['sprint', 'Sprint — per-question clock']] as const).map(([f, label]) => (
          <button key={f} role="radio" aria-checked={config.format === f}
            onClick={() => setConfig(f === 'practice' ? { format: 'practice' } : f === 'countdown' ? { format: 'countdown', totalMinutes: config.totalMinutes || 30 } : { format: 'sprint', perQuestionSeconds: config.perQuestionSeconds || 60 })}
            className={`px-3 py-2 text-xs font-semibold border-2 ${config.format === f ? (pro ? 'bg-teal-700 text-white border-teal-700 rounded-lg' : 'bg-lime-400 text-black border-lime-400') : (pro ? 'bg-white border-slate-300 rounded-lg text-slate-600' : 'border-slate-700 text-slate-300')}`}>
            {label}
          </button>
        ))}
      </div>
      {config.format === 'countdown' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs ${pro ? 'text-slate-500' : 'text-slate-400'}`}>Total time:</span>
          {[5, 10, 20, 30, 60, 120, 180].map((mins) => (
            <button key={mins} onClick={() => setConfig({ format: 'countdown', totalMinutes: mins })} aria-pressed={config.totalMinutes === mins}
              className={`px-2 py-1 text-xs border ${config.totalMinutes === mins ? (pro ? 'bg-teal-700 text-white border-teal-700 rounded' : 'bg-cyan-400 text-black border-cyan-400') : (pro ? 'border-slate-300 rounded' : 'border-slate-600 text-slate-300')}`}>
              {mins === 180 ? '3 hours (exam)' : `${mins} min`}
            </button>
          ))}
          <span className={`text-xs ${pro ? 'text-slate-500' : 'text-slate-500'}`}>When it hits zero, the quiz scores what you've answered.</span>
        </div>
      )}
      {config.format === 'sprint' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs ${pro ? 'text-slate-500' : 'text-slate-400'}`}>Per question:</span>
          {[30, 60, 90].map((secs) => (
            <button key={secs} onClick={() => setConfig({ format: 'sprint', perQuestionSeconds: secs })} aria-pressed={config.perQuestionSeconds === secs}
              className={`px-2 py-1 text-xs border ${config.perQuestionSeconds === secs ? (pro ? 'bg-teal-700 text-white border-teal-700 rounded' : 'bg-cyan-400 text-black border-cyan-400') : (pro ? 'border-slate-300 rounded' : 'border-slate-600 text-slate-300')}`}>
              {secs}s
            </button>
          ))}
          <span className={`text-xs ${pro ? 'text-slate-500' : 'text-slate-500'}`}>Runs out = that question is locked in (or blank) and you move on.</span>
        </div>
      )}
      <p className={`text-xs mt-3 ${pro ? 'text-slate-500' : 'text-slate-500'}`}>You can pause any format — the clock freezes, and your place is saved under your profile on this device, even if you close the tab.</p>
    </div>
  );

  const renderSetup = () => (
    <div className="w-full max-w-4xl mx-auto px-4">
      <div className="text-center mb-8">
        <div className={`mb-5 inline-flex items-center justify-center p-5 rounded-full border ${pro ? 'bg-teal-50 border-teal-200' : 'bg-fuchsia-500/10 border-fuchsia-500/30 shadow-[0_0_30px_rgba(217,70,239,0.2)]'}`}>
          <Brain className={`w-14 h-14 ${pro ? 'text-teal-700' : 'text-fuchsia-400 animate-pulse'}`} />
        </div>
        <h1 className={`text-4xl md:text-6xl font-black tracking-tight mb-4 ${pro ? 'text-slate-900 normal-case' : 'italic uppercase text-white'}`}>
          {pro ? <>Test <span className="text-teal-700">Anything</span></> : <>Skibidi <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-400 to-cyan-400">Sigma IQ+</span></>}
        </h1>
        <p className={`text-lg md:text-xl max-w-2xl mx-auto ${pro ? 'text-slate-600' : 'text-slate-300 font-light'}`}>
          {pro ? 'Paste any notes and get a quiz in seconds. Practice untimed, run a countdown, or sit a full 3-hour exam — pause anytime and your session is saved under your profile.' : 'Paste ANY topic. Get cooked or get crowned. Timed, sprint, or full 3-hour exam mode — pause it, close it, come back to it. Your profile remembers.'}
        </p>
      </div>

      {savedBanner && (
        <div className={`mb-6 p-5 border-2 ${pro ? 'bg-teal-50 border-teal-500 rounded-2xl text-slate-800' : 'bg-cyan-500/10 border-cyan-400 text-cyan-50'}`} role="alert">
          <p className="font-bold flex items-center gap-2"><History className="w-5 h-5" /> Quiz in progress — {profileDisplayName(profileId, profiles)}</p>
          <p className="mt-1 text-sm">"{savedBanner.title}" — you're on question {Math.min(savedBanner.currentIndex + 1, savedBanner.questions.length)} of {savedBanner.questions.length}, saved {new Date(savedBanner.savedAt).toLocaleString()}.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button pro={pro} onClick={resumeSaved}><Play className="w-4 h-4 mr-2" /> Resume where I left off</Button>
            <Button pro={pro} variant="outline" onClick={() => { clearSession(profileId); setSavedBanner(null); }}>Discard</Button>
          </div>
        </div>
      )}

      {incomingDuel && (
        <div className={`mb-8 p-5 border-2 ${pro ? 'bg-amber-50 border-amber-400 rounded-2xl text-slate-800' : 'bg-amber-500/10 border-amber-400 text-amber-100'}`} role="alert">
          <p className="font-bold flex items-center gap-2"><Swords className="w-5 h-5" /> You've been challenged!</p>
          <p className="mt-1 text-sm">{incomingDuel.creatorName} scored {incomingDuel.creatorScorePercent}% on "{incomingDuel.title}" ({incomingDuel.questions.length} questions). Take the exact same set and beat it.</p>
          <div className="mt-3"><Button pro={pro} onClick={startIncomingDuel}><Play className="w-4 h-4 mr-2" /> Accept the duel</Button></div>
        </div>
      )}

      {renderFormatBar()}

      <div className="flex flex-wrap gap-2 justify-center mb-6" role="tablist" aria-label="Quiz mode">
        {SETUP_TABS.map(({ id, icon: Icon, label }) => (
          <button key={id} role="tab" aria-selected={setupTab === id} onClick={() => setSetupTab(id)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold border-2 transition-colors ${setupTab === id ? (pro ? 'bg-teal-700 text-white border-teal-700 rounded-lg' : 'bg-lime-400 text-black border-lime-400') : (pro ? 'bg-white text-slate-600 border-slate-300 rounded-lg hover:border-teal-600' : 'bg-transparent text-slate-300 border-slate-700 hover:border-lime-400')}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      <div className={`${pro ? 'bg-white border border-slate-200 rounded-2xl shadow-sm' : 'bg-black/30 border-2 border-slate-800'} p-6 text-left`}>
        {setupTab === 'paste' && (
          <div>
            <label className={`block text-sm font-bold mb-1 ${pro ? 'text-slate-700' : 'text-cyan-300'}`} htmlFor="paste-title">Quiz title</label>
            <input id="paste-title" value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} placeholder="e.g. Biology Ch 4 — Cell Structure" className={`w-full mb-4 px-3 py-2 border ${pro ? 'bg-white border-slate-300 rounded-lg text-slate-900' : 'bg-slate-900 border-slate-700 text-white'}`} />
            <label className={`block text-sm font-bold mb-1 ${pro ? 'text-slate-700' : 'text-cyan-300'}`} htmlFor="paste-text">Your notes / text</label>
            <textarea id="paste-text" value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={9} placeholder="Paste at least a few paragraphs. Definitions (…X is…), facts and numbers make the best questions — every question shows the source sentence as its explanation." className={`w-full px-3 py-2 border ${pro ? 'bg-white border-slate-300 rounded-lg text-slate-900' : 'bg-slate-900 border-slate-700 text-white'}`} />
            <p className={`text-xs mt-1 ${pro ? 'text-slate-500' : 'text-slate-500'}`}>{pasteText.trim().length} characters {pasteText.trim().length < 400 ? '(aim for 400+)' : '✓'}</p>
            <div className="flex flex-wrap items-center gap-4 mt-4">
              <label className={`text-sm font-bold ${pro ? 'text-slate-700' : 'text-slate-300'}`}>Questions
                <select aria-label="Number of questions" value={pasteCount} onChange={(e) => setPasteCount(Number(e.target.value))} className={`ml-2 px-2 py-1 border ${pro ? 'bg-white border-slate-300 rounded text-slate-900' : 'bg-slate-900 border-slate-700 text-white'}`}>
                  {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <span className={`text-sm font-bold ${pro ? 'text-slate-700' : 'text-slate-300'}`}>Difficulty
                <span className="ml-2 inline-flex gap-1">
                  {(['easy', 'medium', 'hard'] as DifficultyLevel[]).map((d) => (
                    <button key={d} onClick={() => setDifficulty(d)} className={`px-2 py-1 text-xs border ${difficulty === d ? (pro ? 'bg-teal-700 text-white border-teal-700 rounded' : 'bg-lime-400 text-black border-lime-400') : (pro ? 'border-slate-300 rounded' : 'border-slate-600 text-slate-300')}`}>{d}</button>
                  ))}
                </span>
              </span>
            </div>
            <details className="mt-4">
              <summary className={`text-sm cursor-pointer ${pro ? 'text-teal-800' : 'text-cyan-400'}`}>Optional: use my own Gemini key for AI-written questions</summary>
              <div className="mt-2">
                <input aria-label="Gemini API key (session only)" type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="Paste your Gemini API key — kept in this tab only, never saved" className={`w-full px-3 py-2 border ${pro ? 'bg-white border-slate-300 rounded-lg text-slate-900' : 'bg-slate-900 border-slate-700 text-white'}`} />
                <label className={`flex items-center gap-2 mt-2 text-sm ${pro ? 'text-slate-600' : 'text-slate-400'}`}>
                  <input type="checkbox" checked={useGemini} onChange={(e) => setUseGemini(e.target.checked)} /> Try Gemini first (falls back to the free local generator if anything fails)
                </label>
              </div>
            </details>
            <div className="mt-6"><Button pro={pro} size="lg" onClick={startPaste}><Play className="w-5 h-5 mr-2" /> Build my quiz</Button></div>
          </div>
        )}


        {setupTab === 'iq' && (
          <div className="text-center">
            <p className={`text-sm mb-5 ${pro ? 'text-slate-600' : 'text-slate-300'}`}>The original test, rebuilt offline: 24 hand-checked questions across logic, numerical, verbal and spatial reasoning — no API key, instant start. For entertainment; this is not a clinical IQ measure.</p>
            <div className="flex flex-wrap justify-center items-center gap-4 mb-6">
              <span className={`text-sm font-bold ${pro ? 'text-slate-700' : 'text-slate-300'}`}>Difficulty
                <span className="ml-2 inline-flex gap-1">
                  {(['easy', 'medium', 'hard'] as DifficultyLevel[]).map((d) => (
                    <button key={d} onClick={() => setDifficulty(d)} className={`px-3 py-1 text-xs border ${difficulty === d ? (pro ? 'bg-teal-700 text-white border-teal-700 rounded' : 'bg-lime-400 text-black border-lime-400') : (pro ? 'border-slate-300 rounded' : 'border-slate-600 text-slate-300')}`}>{d}</button>
                  ))}
                </span>
              </span>
              <label className={`text-sm font-bold ${pro ? 'text-slate-700' : 'text-slate-300'}`}>Questions
                <select aria-label="Number of IQ questions" value={iqCount} onChange={(e) => setIqCount(Number(e.target.value))} className={`ml-2 px-2 py-1 border ${pro ? 'bg-white border-slate-300 rounded text-slate-900' : 'bg-slate-900 border-slate-700 text-white'}`}>
                  {[10, 20].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>
            <Button pro={pro} size="lg" onClick={startIq}><Play className="w-5 h-5 mr-2" /> {pro ? 'Start assessment' : 'Check my rizz'}</Button>
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 text-sm ${pro ? 'text-slate-600' : 'text-slate-300'}`}>
              <div className={`p-4 border ${pro ? 'border-slate-200 rounded-xl' : 'border-slate-800'}`}><Target className="w-6 h-6 mx-auto mb-2 text-lime-500" />Logic, numbers, words, space — scored by category</div>
              <div className={`p-4 border ${pro ? 'border-slate-200 rounded-xl' : 'border-slate-800'}`}><Brain className="w-6 h-6 mx-auto mb-2 text-fuchsia-500" />Every answer explained at the end</div>
              <div className={`p-4 border ${pro ? 'border-slate-200 rounded-xl' : 'border-slate-800'}`}><Flame className="w-6 h-6 mx-auto mb-2 text-cyan-500" />Then duel a friend on the same set</div>
            </div>
          </div>
        )}

        {setupTab === 'duel' && (
          <div>
            <label className={`block text-sm font-bold mb-1 ${pro ? 'text-slate-700' : 'text-cyan-300'}`} htmlFor="duel-code">Challenge link or code</label>
            <textarea id="duel-code" value={importCode} onChange={(e) => setImportCode(e.target.value)} rows={4} placeholder="Paste a duel link or code a friend sent you…" className={`w-full px-3 py-2 border ${pro ? 'bg-white border-slate-300 rounded-lg text-slate-900' : 'bg-slate-900 border-slate-700 text-white'}`} />
            <div className="mt-4"><Button pro={pro} size="lg" onClick={startImportedDuel} disabled={!importCode.trim()}><Swords className="w-5 h-5 mr-2" /> Start the duel</Button></div>
            <p className={`text-xs mt-3 ${pro ? 'text-slate-500' : 'text-slate-500'}`}>To create a duel: finish any quiz, then use "Challenge a friend" on the results screen.</p>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className={`mt-8 p-6 text-left ${pro ? 'bg-white border border-slate-200 rounded-2xl' : 'bg-black/30 border-2 border-slate-800'}`}>
          <h2 className={`font-bold flex items-center gap-2 mb-3 ${pro ? 'text-slate-800' : 'text-white'}`}><History className="w-5 h-5" /> {profileDisplayName(profileId, profiles)}'s history (saved on this device)</h2>
          <ul className={`text-sm space-y-2 ${pro ? 'text-slate-600' : 'text-slate-300'}`}>
            {history.slice(0, 5).map((h, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>{h.title} <span className="opacity-60">— {new Date(h.at).toLocaleDateString()}</span></span>
                <strong className={h.scorePercent >= 60 ? (pro ? 'text-teal-700' : 'text-lime-400') : 'text-red-400'}>{h.scorePercent}% ({h.correct}/{h.total})</strong>
              </li>
            ))}
          </ul>
          {historicalWeakCategories(history).length > 0 && (
            <p className={`text-xs mt-3 ${pro ? 'text-slate-500' : 'text-slate-400'}`}>
              Weakest across your history: {historicalWeakCategories(history).slice(0, 3).join(' • ')}
              {' '}<button className={`underline font-semibold ${pro ? 'text-teal-800' : 'text-cyan-300'}`} onClick={() => {
                const weak = historicalWeakCategories(history).slice(0, 3);
                const pool: Question[] = [...new Map<string, Question>(history.flatMap((h) => h.pool || []).map((q) => [q.text, q] as [string, Question])).values()];
                startDrill(weak, pool, 'Weak-spot drill — from your history');
              }}>Drill these</button>
            </p>
          )}
        </div>
      )}
    </div>
  );

  const renderQuiz = () => (
    <div className="w-full max-w-5xl mx-auto px-4 flex flex-col justify-between pb-8 relative">
      <div className="mb-8">
        <div className="flex justify-between items-end mb-2 gap-3 flex-wrap">
          <h2 className={`text-lg font-bold uppercase tracking-widest ${pro ? 'text-slate-500' : 'text-slate-400'}`}>
            {quizTitle} — {pro ? 'Question' : 'Level'} {currentQuestionIndex + 1} <span className="opacity-60">/ {questions.length}</span>
          </h2>
          <div className="flex items-center gap-3">
            {config.format === 'countdown' && countdownLeftMs !== null && (
              <span className={`text-sm font-mono font-bold inline-flex items-center gap-1 ${countdownLeftMs < 60000 ? 'text-red-500' : pro ? 'text-teal-800' : 'text-cyan-300'}`} aria-label="Time remaining">
                <Clock className="w-4 h-4" /> {fmtClock(countdownLeftMs)}
              </span>
            )}
            {config.format === 'sprint' && sprintLeftMs !== null && (
              <span className={`text-sm font-mono font-bold inline-flex items-center gap-1 ${sprintLeftMs < 10000 ? 'text-red-500' : pro ? 'text-teal-800' : 'text-cyan-300'}`} aria-label="Time left for this question">
                <Timer className="w-4 h-4" /> {Math.max(0, Math.ceil(sprintLeftMs / 1000))}s
              </span>
            )}
            <span className={`text-sm font-mono font-bold ${pro ? 'text-teal-700' : 'text-lime-400'}`}>{Math.round((currentQuestionIndex / questions.length) * 100)}%</span>
            <button onClick={pauseQuiz} aria-label="Pause quiz"
              className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-bold border ${pro ? 'bg-white border-slate-300 rounded-lg text-slate-700' : 'border-slate-600 text-slate-200 hover:border-lime-400'}`}>
              <Pause className="w-4 h-4" /> Pause
            </button>
          </div>
        </div>
        <div className={`w-full h-3 ${pro ? 'bg-slate-200 rounded-full' : 'bg-slate-900 border border-slate-800 skew-x-[-10deg]'}`}>
          <div className={`h-full transition-all duration-300 ${pro ? 'bg-teal-600 rounded-full' : 'bg-gradient-to-r from-lime-400 to-cyan-400'}`} style={{ width: `${(currentQuestionIndex / questions.length) * 100}%` }} />
        </div>
      </div>
      <div className="flex-grow flex items-center justify-center relative z-10">
        <QuizCard question={questions[currentQuestionIndex]} selectedOption={selectedOption} onSelectOption={setSelectedOption} pro={pro} />
      </div>
      <div className="mt-10 flex justify-end">
        <Button pro={pro} onClick={handleNextQuestion} disabled={selectedOption === null} size="lg" className="w-full md:w-auto">
          {currentQuestionIndex === questions.length - 1 ? (pro ? 'See my results' : 'Calculate rizz') : (pro ? 'Next question' : 'Next level')}
          <ChevronRight className="w-6 h-6 ml-2" />
        </Button>
      </div>
      {paused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Quiz paused">
          <div className={`w-full max-w-md p-8 text-center ${pro ? 'bg-white rounded-2xl text-slate-800' : 'bg-slate-950 border-2 border-lime-400 text-white'}`}>
            <Pause className={`w-12 h-12 mx-auto mb-3 ${pro ? 'text-teal-700' : 'text-lime-400'}`} />
            <h3 className="text-2xl font-black mb-2">{pro ? 'Paused' : 'PAUSED'}</h3>
            <p className={`text-sm mb-1 ${pro ? 'text-slate-600' : 'text-slate-300'}`}>The clock is frozen and the question is hidden. Your place is saved under {profileDisplayName(profileId, profiles)}'s profile on this device.</p>
            <p className={`text-xs mb-6 ${pro ? 'text-slate-400' : 'text-slate-500'}`}>Progress so far: question {currentQuestionIndex + 1} of {questions.length}{countdownRemainingRef.current !== null ? ` • ${fmtClock(countdownRemainingRef.current)} left on the clock` : ''}</p>
            <div className="flex flex-col gap-2">
              <Button pro={pro} size="lg" onClick={resumeQuiz}><Play className="w-5 h-5 mr-2" /> Resume</Button>
              <Button pro={pro} variant="secondary" onClick={saveAndExit}>Save & exit — finish later</Button>
              <Button pro={pro} variant="outline" onClick={abandonQuiz}>Abandon this quiz</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderResult = () => {
    if (!result) return null;
    const radarData = result.categoryBreakdown.map((c) => {
      const opp = duelMeta?.creatorCategories.find((x) => x.category === c.category);
      return { category: c.category, score: c.score, fullMark: 100, ...(opp ? { opponent: opp.score } : {}) };
    });
    const duelWon = duelMeta ? result.scorePercent > duelMeta.creatorScorePercent : null;
    return (
      <div className="w-full max-w-5xl mx-auto px-4">
        <div className="text-center mb-10">
          <Zap className={`w-14 h-14 mx-auto mb-3 ${pro ? 'text-teal-700' : 'text-yellow-400 animate-pulse'}`} />
          <h2 className={`text-4xl font-black uppercase tracking-tight mb-1 ${pro ? 'text-slate-900 normal-case' : 'italic text-white'}`}>{pro ? 'Your results' : 'The verdict is in'}</h2>
          <p className={`uppercase tracking-widest text-sm ${pro ? 'text-slate-500' : 'text-slate-400'}`}>{quizTitle}</p>
        </div>

        {duelMeta && (
          <div className={`mb-8 p-5 border-2 text-center ${pro ? 'bg-amber-50 border-amber-400 rounded-2xl text-slate-800' : 'bg-amber-500/10 border-amber-400 text-amber-100'}`} role="alert">
            <p className="font-black text-xl flex items-center justify-center gap-2"><Swords className="w-6 h-6" />
              {result.scorePercent === duelMeta.creatorScorePercent ? (pro ? `Dead heat with ${duelMeta.creatorName} at ${result.scorePercent}%!` : `DEAD HEAT with ${duelMeta.creatorName} — ${result.scorePercent}% each. Run it back!`)
                : duelWon ? (pro ? `You beat ${duelMeta.creatorName}: ${result.scorePercent}% vs ${duelMeta.creatorScorePercent}%` : `YOU COOKED ${duelMeta.creatorName.toUpperCase()}: ${result.scorePercent}% vs ${duelMeta.creatorScorePercent}%`)
                : (pro ? `${duelMeta.creatorName} still leads: ${duelMeta.creatorScorePercent}% vs your ${result.scorePercent}%` : `${duelMeta.creatorName} got you this time: ${duelMeta.creatorScorePercent}% vs your ${result.scorePercent}%. Rematch?`)}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className={`lg:col-span-1 p-8 flex flex-col items-center justify-center text-center relative overflow-hidden ${pro ? 'bg-white border border-slate-200 rounded-2xl' : 'bg-black/40 border-2 border-slate-800'}`}>
            <p className={`text-xs font-bold uppercase tracking-[0.2em] mb-3 ${pro ? 'text-teal-800' : 'text-lime-400'}`}>Your score</p>
            <div className={`text-8xl font-black tracking-tighter mb-2 ${pro ? 'text-slate-900' : 'text-white'}`}>{result.scorePercent}%</div>
            <div className={`text-2xl font-black uppercase tracking-widest mb-5 ${result.scorePercent >= 60 ? (pro ? 'text-teal-700' : 'text-lime-400') : 'text-red-500'}`}>{verdict(result.scorePercent)}</div>
            <p className={`text-sm flex items-center gap-4 ${pro ? 'text-slate-500' : 'text-slate-400'}`}>
              <span>{result.correctCount}/{result.totalQuestions} correct</span>
              <span className="inline-flex items-center gap-1"><Clock className="w-4 h-4" /> {Math.floor(result.totalSeconds / 60)}m {result.totalSeconds % 60}s</span>
            </p>
          </div>
          <div className={`lg:col-span-2 p-6 relative overflow-hidden ${pro ? 'bg-white border border-slate-200 rounded-2xl' : 'bg-black/40 border-2 border-slate-800'}`}>
            <h3 className={`text-lg font-bold uppercase tracking-wider mb-4 flex items-center ${pro ? 'text-slate-800' : 'text-white'}`}><Brain className="w-5 h-5 mr-2 text-fuchsia-500" /> {pro ? 'Mastery by area' : 'Brainrot breakdown'}</h3>
            {radarData.length >= 3 ? <SkillsRadar data={radarData} pro={pro} opponentName={duelMeta?.creatorName} /> : (
              <ul className="space-y-3">
                {result.categoryBreakdown.map((c) => (
                  <li key={c.category}>
                    <div className={`flex justify-between text-sm ${pro ? 'text-slate-700' : 'text-slate-200'}`}><span>{c.category}</span><strong>{c.score}% ({c.correct}/{c.total})</strong></div>
                    <div className={`h-3 mt-1 ${pro ? 'bg-slate-200 rounded-full' : 'bg-slate-800'}`}><div className={`h-full ${c.score >= 60 ? (pro ? 'bg-teal-600 rounded-full' : 'bg-lime-400') : 'bg-red-500'}`} style={{ width: `${c.score}%` }} /></div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className={`p-6 mb-6 ${pro ? 'bg-teal-50 border border-teal-200 rounded-2xl text-slate-700' : 'bg-gradient-to-br from-slate-900 to-black border-2 border-cyan-500/30 text-slate-200'}`}>
          <h3 className={`font-bold mb-1 flex items-center gap-2 ${pro ? 'text-teal-900' : 'text-cyan-200'}`}><Crosshair className="w-5 h-5" /> {pro ? 'Coach note' : 'AI analysis (no cap)'}</h3>
          <p>{result.coachNote}</p>
        </div>

        <div className="flex flex-wrap gap-3 justify-center mb-4">
          {result.weakestCategory && (
            <Button pro={pro} onClick={() => startDrill(result.categoryBreakdown.filter((c) => c.score < 100).map((c) => c.category), questions, `Weak-spot drill — ${result.weakestCategory}`)}>
              <Crosshair className="w-5 h-5 mr-2" /> Drill my weak spots
            </Button>
          )}
          <Button pro={pro} variant="secondary" onClick={() => downloadShareCard({ title: quizTitle, subtitle: `${mode.toUpperCase()} • ${questions.length} questions`, name: myName.trim() || profileDisplayName(profileId, profiles), result, pro })}>
            <Download className="w-5 h-5 mr-2" /> Share card (PNG)
          </Button>
          <Button pro={pro} variant="outline" onClick={() => setAppState('intro')}>
            <BookOpen className="w-5 h-5 mr-2" /> New quiz
          </Button>
        </div>

        <div className={`p-6 mb-8 ${pro ? 'bg-white border border-slate-200 rounded-2xl' : 'bg-black/30 border-2 border-slate-800'}`}>
          <h3 className={`font-bold mb-2 flex items-center gap-2 ${pro ? 'text-slate-800' : 'text-white'}`}><Swords className="w-5 h-5" /> {pro ? 'Challenge a friend — same questions' : 'Duel a friend — same questions, no excuses'}</h3>
          <div className="flex flex-wrap gap-2 items-center">
            <input aria-label="Your name for the challenge" value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="Your name" className={`px-3 py-2 border ${pro ? 'bg-white border-slate-300 rounded-lg text-slate-900' : 'bg-slate-900 border-slate-700 text-white'}`} />
            <Button pro={pro} onClick={createChallenge}><Link2 className="w-4 h-4 mr-2" /> Create duel link</Button>
          </div>
          {createdChallenge && (
            <div className="mt-3">
              <label className={`block text-xs font-bold mb-1 ${pro ? 'text-slate-600' : 'text-slate-400'}`} htmlFor="challenge-link">Send this link — your friend takes the identical set, then you compare scores</label>
              <textarea id="challenge-link" readOnly rows={3} value={createdChallenge.link} className={`w-full px-3 py-2 text-xs border ${pro ? 'bg-slate-50 border-slate-300 rounded-lg text-slate-700' : 'bg-slate-900 border-slate-700 text-slate-300'}`} />
              <div className="flex gap-2 mt-2">
                <Button pro={pro} size="sm" onClick={() => copyText('link', createdChallenge.link)}>{copied === 'link' ? 'Copied!' : 'Copy link'}</Button>
                <Button pro={pro} size="sm" variant="outline" onClick={() => copyText('code', createdChallenge.code)}>{copied === 'code' ? 'Copied!' : 'Copy code only'}</Button>
              </div>
            </div>
          )}
        </div>

        <div className="mb-10">
          <h3 className={`text-xl font-bold mb-4 ${pro ? 'text-slate-800' : 'text-white'}`}>{pro ? 'Review — every question explained' : 'The receipts — every question explained'}</h3>
          <div className="space-y-4">
            {questions.map((q, i) => {
              const a = userAnswers.find((x) => x.questionId === q.id);
              const correct = a?.selectedOptionIndex === q.correctIndex;
              const yourAnswer = !a ? 'Not answered' : a.selectedOptionIndex < 0 ? 'No answer (time ran out)' : q.options[a.selectedOptionIndex];
              return (
                <article key={q.id} className={`p-5 text-left ${pro ? 'bg-white border border-slate-200 rounded-2xl' : 'bg-black/30 border-2 border-slate-800'}`}>
                  <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${pro ? 'text-teal-800' : 'text-fuchsia-400'}`}>{q.category} • Q{i + 1}{a ? ` • ${a.timeTakenSeconds}s` : ''}</p>
                  <p className={`font-semibold mb-3 ${pro ? 'text-slate-900' : 'text-white'}`}>{q.text}</p>
                  <p className={`text-sm flex items-start gap-2 ${correct ? (pro ? 'text-teal-800' : 'text-lime-300') : 'text-red-400'}`}>
                    {correct ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                    <span>Your answer: <strong>{yourAnswer}</strong>{!correct && <> • Correct: <strong>{q.options[q.correctIndex]}</strong></>}</span>
                  </p>
                  <p className={`text-sm mt-2 ${pro ? 'text-slate-600' : 'text-slate-300'}`}><strong>Why:</strong> {q.explanation}</p>
                  {q.source && mode === 'paste' && <p className={`text-xs mt-1 ${pro ? 'text-slate-400' : 'text-slate-500'}`}>Source: {q.source}</p>}
                </article>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderProfiles = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Profiles">
      <div className={`w-full max-w-md p-6 max-h-[90vh] overflow-y-auto ${pro ? 'bg-white rounded-2xl text-slate-800' : 'bg-slate-950 border-2 border-slate-700 text-white'}`}>
        <h3 className="text-xl font-black mb-1 flex items-center gap-2"><UserRound className="w-5 h-5" /> Who's playing?</h3>
        <p className={`text-xs mb-4 ${pro ? 'text-slate-500' : 'text-slate-400'}`}>Profiles live on this device (GitHub Pages has no server for real accounts). Each profile keeps its own history and saved quizzes here. A PIN just keeps profiles separate on a shared device — it isn't bank-grade security.</p>
        <div className="space-y-2 mb-4">
          <button onClick={() => switchProfile(GUEST_ID)} className={`w-full text-left p-3 border ${profileId === GUEST_ID ? (pro ? 'border-teal-600 bg-teal-50 rounded-xl' : 'border-lime-400 bg-lime-400/10') : (pro ? 'border-slate-200 rounded-xl' : 'border-slate-700')}`}>
            <strong>Guest</strong> <span className={`text-xs ${pro ? 'text-slate-500' : 'text-slate-400'}`}>— no setup, history still saved on this device</span>
          </button>
          {profiles.map((p) => (
            <div key={p.id} className={`p-3 border ${profileId === p.id ? (pro ? 'border-teal-600 bg-teal-50 rounded-xl' : 'border-lime-400 bg-lime-400/10') : (pro ? 'border-slate-200 rounded-xl' : 'border-slate-700')}`}>
              <button className="w-full text-left" onClick={() => {
                if (p.pinHash && profileId !== p.id) { setPinFor(p); setPinInput(''); setPinError(''); }
                else switchProfile(p.id);
              }}>
                <strong>{p.name}</strong> {p.pinHash && <span className={`text-xs ${pro ? 'text-slate-500' : 'text-slate-400'}`}>• PIN protected</span>}
              </button>
              {pinFor?.id === p.id && (
                <div className="mt-2 flex gap-2 items-center">
                  <input aria-label={`PIN for ${p.name}`} type="password" inputMode="numeric" value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="PIN" className={`px-3 py-2 border w-28 ${pro ? 'bg-white border-slate-300 rounded-lg text-slate-900' : 'bg-slate-900 border-slate-700 text-white'}`} />
                  <Button pro={pro} size="sm" onClick={() => { if (checkPin(p, pinInput)) switchProfile(p.id); else setPinError('Wrong PIN'); }}>Unlock</Button>
                  {pinError && <span className="text-xs text-red-400">{pinError}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className={`border-t pt-4 ${pro ? 'border-slate-200' : 'border-slate-800'}`}>
          <p className={`text-sm font-bold mb-2 ${pro ? 'text-slate-700' : 'text-slate-200'}`}>New profile</p>
          <div className="flex flex-col gap-2">
            <input aria-label="New profile name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name (e.g. Ankit)" className={`px-3 py-2 border ${pro ? 'bg-white border-slate-300 rounded-lg text-slate-900' : 'bg-slate-900 border-slate-700 text-white'}`} />
            <input aria-label="Optional PIN" type="password" inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="PIN (optional)" className={`px-3 py-2 border ${pro ? 'bg-white border-slate-300 rounded-lg text-slate-900' : 'bg-slate-900 border-slate-700 text-white'}`} />
            <Button pro={pro} disabled={!newName.trim()} onClick={() => {
              const p = createProfile(newName, newPin || undefined);
              setProfiles(loadProfiles());
              setNewName(''); setNewPin('');
              switchProfile(p.id);
            }}>Create & switch</Button>
          </div>
        </div>
        <div className="mt-4"><Button pro={pro} variant="outline" onClick={() => setShowProfiles(false)}>Close</Button></div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen flex flex-col py-8 relative overflow-hidden ${pro ? 'bg-slate-50 text-slate-900' : 'bg-[#050505] text-white selection:bg-lime-400 selection:text-black'}`}>
      {!pro && (
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0" aria-hidden="true">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-fuchsia-900/20 rounded-full blur-[120px] mix-blend-screen animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-lime-900/20 rounded-full blur-[120px] mix-blend-screen animate-pulse delay-1000"></div>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"></div>
        </div>
      )}
      <header className="w-full max-w-5xl mx-auto px-4 flex justify-between items-center relative z-10 mb-6 gap-2 flex-wrap">
        <span className={`text-sm font-black uppercase tracking-widest ${pro ? 'text-slate-700' : 'text-slate-300'}`}>{pro ? 'Test Anything' : 'Sigma IQ+'}</span>
        <div className="flex gap-2">
          <button onClick={() => setShowProfiles(true)} aria-label="Switch profile"
            className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-2 border ${pro ? 'bg-white border-slate-300 rounded-lg text-slate-700' : 'border-slate-700 text-slate-300 hover:border-cyan-400'}`}>
            <UserRound className="w-4 h-4" /> {profileDisplayName(profileId, profiles)}
          </button>
          <button onClick={() => setTheme(pro ? 'sigma' : 'pro')} aria-label="Toggle theme"
            className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-2 border ${pro ? 'bg-white border-slate-300 rounded-lg text-slate-700' : 'border-slate-700 text-slate-300 hover:border-lime-400'}`}>
            <SunMoon className="w-4 h-4" /> {pro ? 'Sigma theme' : 'Pro theme'}
          </button>
        </div>
      </header>
      <main className="w-full relative z-10 flex-grow flex flex-col justify-center">
        {appState === 'intro' && renderSetup()}
        {appState === 'generating' && <LoadingSpinner message={pro ? 'Building your quiz…' : 'Cooking up some questions...'} />}
        {appState === 'quiz' && renderQuiz()}
        {appState === 'analyzing' && <LoadingSpinner message={pro ? 'Scoring…' : 'Consulting the Skibidi elders...'} />}
        {appState === 'result' && renderResult()}
        {appState === 'error' && (
          <div className={`text-center p-8 max-w-md mx-auto ${pro ? 'bg-red-50 border border-red-300 rounded-2xl text-red-800' : 'bg-red-900/20 border-2 border-red-500 text-red-200'}`}>
            <h3 className="font-bold mb-2 uppercase tracking-widest">{pro ? 'Something needs fixing' : 'Major L'}</h3>
            <p className="mb-6 text-sm">{error}</p>
            <Button pro={pro} onClick={() => setAppState('intro')} variant="outline">Back</Button>
          </div>
        )}
      </main>
      {showProfiles && renderProfiles()}
      <footer className={`w-full text-center py-6 text-xs relative z-10 ${pro ? 'text-slate-400' : 'text-slate-600 font-mono uppercase tracking-widest'}`}>
        <p>{pro ? 'Practice tool. Practice questions are original, not official exam questions. IQ mode is for entertainment. Profiles and sessions are stored on this device only.' : 'Sigma IQ+ is for entertainment & practice. Questions are original practice, not the real exam, fam. Profiles live on this device only.'}</p>
      </footer>
    </div>
  );
};

export default App;
