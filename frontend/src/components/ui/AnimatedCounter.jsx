import { useEffect, useState, useRef } from 'react';

export const AnimatedCounter = ({
  value = 0,
  duration = 1.0,
  prefix = '$',
  decimals = 2,
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const currentRef = useRef(0);

  useEffect(() => {
    const target = Number(value) || 0;
    const start = currentRef.current;
    const diff = target - start;

    if (diff === 0) return;

    const startTime = performance.now();
    const durationMs = duration * 1000;

    let animationFrameId;

    const updateCount = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease-out cubic formula
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * easeOut;

      currentRef.current = current;
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateCount);
      } else {
        currentRef.current = target;
        setDisplayValue(target);
      }
    };

    animationFrameId = requestAnimationFrame(updateCount);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [value, duration]);

  const formatted = displayValue.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={`font-semibold tracking-tight ${className}`}>
      {prefix}
      {formatted}
    </span>
  );
};

export default AnimatedCounter;
