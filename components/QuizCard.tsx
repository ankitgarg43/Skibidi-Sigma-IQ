import React from 'react';
import { Question } from '../types';

interface QuizCardProps {
  question: Question;
  selectedOption: number | null;
  onSelectOption: (index: number) => void;
  pro?: boolean;
}

export const QuizCard: React.FC<QuizCardProps> = ({ question, selectedOption, onSelectOption, pro = false }) => {
  if (pro) {
    return (
      <div className="w-full max-w-3xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <span className="text-xs font-semibold tracking-wide text-teal-800 uppercase bg-teal-50 border border-teal-200 rounded-full px-3 py-1">
              {question.category}
            </span>
            <span className="text-xs text-slate-500" aria-label={`Difficulty ${question.difficulty} of 5`}>
              {'●'.repeat(question.difficulty)}{'○'.repeat(5 - question.difficulty)}
            </span>
          </div>
          <h3 className="text-xl md:text-2xl font-semibold text-slate-900 mb-8 leading-snug">{question.text}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3" role="radiogroup" aria-label="Answer options">
            {question.options.map((option, index) => (
              <button
                key={index}
                role="radio"
                aria-checked={selectedOption === index}
                onClick={() => onSelectOption(index)}
                className={`p-4 text-left rounded-xl border-2 transition-all ${selectedOption === index ? 'bg-teal-50 border-teal-600 text-slate-900' : 'bg-white border-slate-200 text-slate-700 hover:border-teal-500'}`}
              >
                <span className="flex items-center">
                  <span className={`flex items-center justify-center w-8 h-8 mr-3 text-sm font-bold rounded-full border ${selectedOption === index ? 'bg-teal-700 border-teal-700 text-white' : 'border-slate-300 text-slate-500'}`}>
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="text-base">{option}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="bg-black/40 backdrop-blur-xl border-2 border-slate-800 rounded-none p-6 md:p-8 shadow-[0_0_30px_rgba(132,204,22,0.1)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-lime-400/20 to-transparent pointer-events-none"></div>
        <div className="flex items-center justify-between mb-8">
          <span className="text-xs font-bold tracking-widest text-fuchsia-400 uppercase border border-fuchsia-500/30 px-3 py-1 bg-fuchsia-500/10">
            {question.category}
          </span>
          <div className="flex space-x-1" aria-label={`Difficulty ${question.difficulty} of 5`}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`w-2 h-2 transform rotate-45 ${i < question.difficulty ? 'bg-lime-400 shadow-[0_0_5px_#84cc16]' : 'bg-slate-800'}`} />
            ))}
          </div>
        </div>
        <h3 className="text-xl md:text-3xl font-bold text-white mb-8 leading-tight">{question.text}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="radiogroup" aria-label="Answer options">
          {question.options.map((option, index) => (
            <button
              key={index}
              role="radio"
              aria-checked={selectedOption === index}
              onClick={() => onSelectOption(index)}
              className={`relative p-5 text-left transition-all duration-200 border-2 group overflow-hidden ${selectedOption === index ? 'bg-fuchsia-900/40 border-fuchsia-500 text-white shadow-[0_0_15px_rgba(217,70,239,0.3)]' : 'bg-slate-900/50 border-slate-700 text-slate-300 hover:border-lime-400 hover:text-white'}`}
            >
              <div className="flex items-center relative z-10">
                <div className={`flex items-center justify-center w-8 h-8 mr-4 text-sm font-black transition-colors border ${selectedOption === index ? 'bg-fuchsia-500 border-fuchsia-500 text-black' : 'bg-transparent border-slate-600 text-slate-500 group-hover:border-lime-400 group-hover:text-lime-400'}`}>
                  {String.fromCharCode(65 + index)}
                </div>
                <span className="text-base font-medium">{option}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
