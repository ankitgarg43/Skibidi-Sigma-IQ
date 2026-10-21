import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  pro?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  pro = false,
  className = '',
  ...props
}) => {
  if (pro) {
    const base = 'uppercase tracking-wide font-semibold inline-flex items-center justify-center rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    const variants = {
      primary: 'bg-teal-700 hover:bg-teal-600 text-white shadow',
      secondary: 'bg-slate-700 hover:bg-slate-600 text-white shadow',
      outline: 'bg-white border-2 border-teal-700 text-teal-800 hover:bg-teal-50',
    };
    const sizes = { sm: 'px-4 py-2 text-xs', md: 'px-6 py-3 text-sm', lg: 'px-10 py-4 text-base' };
    return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>{children}</button>;
  }
  const baseStyles = 'uppercase tracking-wider font-bold inline-flex items-center justify-center rounded-none skew-x-[-10deg] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed transform active:translate-y-1';
  const variants = {
    primary: 'bg-lime-400 hover:bg-lime-300 text-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.4)] border-2 border-transparent',
    secondary: 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] border-2 border-transparent',
    outline: 'bg-transparent border-2 border-cyan-400 text-cyan-400 hover:bg-cyan-950/30 hover:shadow-[0px_0px_10px_rgba(34,211,238,0.5)]',
  };
  const sizes = { sm: 'px-4 py-2 text-xs', md: 'px-6 py-3 text-sm', lg: 'px-10 py-5 text-lg' };
  return (
    <button className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      <span className="skew-x-[10deg] flex items-center">{children}</span>
    </button>
  );
};
