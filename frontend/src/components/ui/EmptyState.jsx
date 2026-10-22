import React from 'react';
import { motion } from 'framer-motion';
import { Inbox, Plus } from 'lucide-react';

export const EmptyState = ({
  icon: Icon = Inbox,
  title = 'No items found',
  description = 'Get started by creating your first entry.',
  actionLabel,
  onAction,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center p-8 text-center glass-panel rounded-3xl my-4 border border-slate-200 dark:border-white/5"
    >
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400 mb-4 shadow-inner">
        <Icon size={28} className="stroke-[1.5]" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mb-5">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white gradient-primary-btn shadow-md hover:shadow-indigo-500/25 transition-all"
        >
          <Plus size={16} />
          <span>{actionLabel}</span>
        </button>
      )}
    </motion.div>
  );
};

export default EmptyState;

