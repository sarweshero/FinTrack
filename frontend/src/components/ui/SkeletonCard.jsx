import React from 'react';

export const SkeletonCard = ({ height = 'h-24', count = 1 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`w-full ${height} rounded-2xl glass-panel animate-shimmer border border-white/5`}
        />
      ))}
    </div>
  );
};

export default SkeletonCard;

