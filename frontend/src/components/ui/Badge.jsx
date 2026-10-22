import React from 'react';

export const Badge = ({ children, variant = 'neutral', size = 'sm', pulse = false }) => {
  const variantStyles = {
    debit: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30',
    credit: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30',
    given: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30',
    borrowed: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30',
    pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30',
    partially_settled: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30',
    settled: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30',
    overdue: 'bg-rose-600/20 text-rose-700 dark:text-rose-300 border border-rose-500/50',
    neutral: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50',
    purple: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30',
  };

  const sizeStyles = {
    xs: 'px-2 py-0.5 text-[10px]',
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };

  const style = variantStyles[variant.toLowerCase()] || variantStyles.neutral;
  const sz = sizeStyles[size] || sizeStyles.sm;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full ${sz} ${style} ${
        pulse ? 'animate-pulse' : ''
      }`}
    >
      {pulse && (
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping inline-block" />
      )}
      {children}
    </span>
  );
};

export default Badge;

