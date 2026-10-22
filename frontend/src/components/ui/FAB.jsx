import React from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

export const FAB = ({ onClick, label = 'Add', icon: Icon = Plus }) => {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="fixed bottom-24 right-5 z-40 flex items-center gap-2 px-4 py-3 rounded-full text-white font-medium shadow-[0_10px_25px_-5px_rgba(139,92,246,0.6)] gradient-primary-btn border border-white/20 backdrop-blur-md cursor-pointer transition-shadow hover:shadow-[0_15px_30px_-5px_rgba(139,92,246,0.8)]"
    >
      <Icon size={20} className="stroke-[2.5]" />
      <span className="text-sm font-semibold pr-1">{label}</span>
    </motion.button>
  );
};

export default FAB;

