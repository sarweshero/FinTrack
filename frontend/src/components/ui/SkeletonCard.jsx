import React from 'react';

/**
 * SkeletonCard — Content loader and ghost element placeholder.
 *
 * Supports variants:
 * - 'transaction' / 'list': Ghost icon + two text rows + right-side badge/amount.
 * - 'stat': Ghost stat card with icon, title placeholder, and number placeholder.
 * - 'plain': Clean customizable shimmer block (default when custom height is given without variant).
 */
export const SkeletonCard = ({
  height,
  count = 1,
  variant = 'auto',
  className = '',
}) => {
  // If height is provided and no specific variant is requested, default to realistic ghost item or plain block
  const isTransactionLike = variant === 'transaction' || (variant === 'auto' && height === 'h-20');
  const isStatLike = variant === 'stat' || (variant === 'auto' && height === 'h-28');

  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => {
        if (isTransactionLike) {
          return (
            <div
              key={i}
              className="w-full h-20 rounded-2xl glass-panel p-3.5 flex items-center justify-between border border-slate-200/60 dark:border-white/5 overflow-hidden relative"
            >
              {/* Left: Ghost Icon + Text */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl animate-shimmer border border-slate-200/50 dark:border-white/5 shrink-0" />
                <div className="space-y-2">
                  <div className="h-4 w-32 sm:w-44 rounded-md animate-shimmer" />
                  <div className="h-3 w-20 sm:w-28 rounded-md animate-shimmer opacity-70" />
                </div>
              </div>
              {/* Right: Ghost Amount Badge */}
              <div className="flex flex-col items-end space-y-1.5">
                <div className="h-4 w-16 sm:w-20 rounded-md animate-shimmer" />
                <div className="h-3 w-12 rounded-md animate-shimmer opacity-60" />
              </div>
            </div>
          );
        }

        if (isStatLike) {
          return (
            <div
              key={i}
              className="w-full h-28 rounded-2xl glass-panel p-4 flex flex-col justify-between border border-slate-200/60 dark:border-white/5 overflow-hidden relative"
            >
              <div className="flex justify-between items-center">
                <div className="h-3.5 w-24 rounded-md animate-shimmer" />
                <div className="w-8 h-8 rounded-lg animate-shimmer" />
              </div>
              <div className="space-y-1.5">
                <div className="h-6 w-32 rounded-lg animate-shimmer" />
                <div className="h-2.5 w-16 rounded-md animate-shimmer opacity-70" />
              </div>
            </div>
          );
        }

        return (
          <div
            key={i}
            className={`w-full ${height || 'h-24'} rounded-2xl glass-panel animate-shimmer border border-slate-200/60 dark:border-white/5 overflow-hidden`}
          />
        );
      })}
    </div>
  );
};

export default SkeletonCard;
