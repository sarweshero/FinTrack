import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { removeToast } from '../../store/slices/uiSlice';

const ToastItem = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration || 3500);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const icons = {
    success: <CheckCircle2 className="text-emerald-400 shrink-0" size={18} />,
    error: <AlertCircle className="text-rose-400 shrink-0" size={18} />,
    info: <Info className="text-indigo-400 shrink-0" size={18} />,
  };

  const borders = {
    success: 'border-emerald-200 dark:border-emerald-500/30 bg-white/95 dark:bg-[#0d1c16]/90 text-emerald-950 dark:text-emerald-50 shadow-emerald-500/10',
    error: 'border-rose-200 dark:border-rose-500/30 bg-white/95 dark:bg-[#1c0d12]/90 text-rose-950 dark:text-rose-50 shadow-rose-500/10',
    info: 'border-indigo-200 dark:border-indigo-500/30 bg-white/95 dark:bg-[#0f1429]/90 text-indigo-950 dark:text-indigo-50 shadow-indigo-500/10',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, y: 10 }}
      layout
      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl text-sm max-w-sm w-full pointer-events-auto ${
        borders[toast.type] || borders.info
      }`}
    >
      <div className="flex items-center gap-2.5">
        {icons[toast.type] || icons.info}
        <span className="font-medium">{toast.message}</span>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-0.5"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
};

export const ToastContainer = () => {
  const dispatch = useDispatch();
  const toasts = useSelector((state) => state.ui.toasts);

  const handleDismiss = (id) => {
    dispatch(removeToast(id));
  };

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4 sm:px-0">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={handleDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;

