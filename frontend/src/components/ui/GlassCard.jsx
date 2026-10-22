import React from 'react';
import { motion } from 'framer-motion';

export const GlassCard = ({
  children,
  className = '',
  onClick,
  hover = true,
  glow = false,
  ...props
}) => {
  return (
    <motion.div
      onClick={onClick}
      whileHover={hover ? { y: -2, transition: { duration: 0.2 } } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      className={`relative rounded-2xl glass-panel p-4 md:p-5 transition-colors overflow-hidden ${
        glow ? 'shadow-[0_0_25px_-5px_rgba(139,92,246,0.25)]' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default GlassCard;

