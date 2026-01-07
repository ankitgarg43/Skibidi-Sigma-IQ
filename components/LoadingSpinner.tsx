import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-8 p-12">
      <div className="relative w-24 h-24">
        <div className="absolute top-0 left-0 w-full h-full border-8 border-slate-800 rounded-none transform rotate-45"></div>
        <div className="absolute top-0 left-0 w-full h-full border-8 border-lime-400 border-t-transparent border-l-transparent rounded-none animate-spin transform rotate-45"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-fuchsia-500 blur-md animate-pulse"></div>
      </div>
      <p className="text-xl font-bold uppercase tracking-widest text-cyan-400 animate-pulse text-center max-w-md">
        {message || "Loading..."}
      </p>
    </div>
  );
};