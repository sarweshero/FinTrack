import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Tags, Download, Sun, Moon, ScanLine } from 'lucide-react';
import AnimatedCounter from '../ui/AnimatedCounter';
import { toggleTheme } from '../../store/slices/uiSlice';

export const TopBar = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const summary = useSelector((state) => state.dashboard.summary);
  const theme = useSelector((state) => state.ui.theme);
  const [isStandalone] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  });

  const getPageInfo = () => {
    switch (location.pathname) {
      case '/':
        return { title: 'FinPulse', subtitle: 'Financial Dashboard' };
      case '/transactions':
        return { title: 'Transactions', subtitle: 'Unified Ledger' };
      case '/debit':
        return { title: 'Expenses', subtitle: 'Debit Records' };
      case '/credit':
        return { title: 'Income', subtitle: 'Credit Records' };
      case '/savings':
        return { title: 'Savings Goals', subtitle: 'Pots & Progress' };
      case '/debts':
        return { title: 'Peer Debts', subtitle: 'Given & Borrowed' };
      case '/reminders':
        return { title: 'Reminders', subtitle: 'Two-Way Ledger' };
      case '/categories':
        return { title: 'Categories', subtitle: 'Manage Tags' };
      case '/ai-report':
        return { title: 'AI Advisor', subtitle: 'Gemini Health Insights' };
      case '/scan-bill':
        return { title: 'Scan Bill', subtitle: 'AI Receipt & Bill Scanner' };
      default:
        return { title: 'FinPulse', subtitle: 'Personal Finance' };
    }
  };

  const { title, subtitle } = getPageInfo();

  return (
    <header className="sticky top-0 z-30 w-full glass-panel border-b border-slate-200/80 dark:border-white/5 bg-white/80 dark:bg-[#07090e]/80 backdrop-blur-xl px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>{title}</span>
            {location.pathname === '/' && (
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-500/20">
                PRO
              </span>
            )}
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-0.5">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Total:</span>
            <AnimatedCounter
              value={summary.net_balance}
              prefix="₹"
              className={summary.net_balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}
            />
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={() => dispatch(toggleTheme())}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/10 transition-all shadow-sm"
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle Theme"
          >
            <motion.div
              key={theme}
              initial={{ rotate: -90, opacity: 0, scale: 0.8 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {theme === 'dark' ? (
                <Sun size={16} className="text-amber-400" />
              ) : (
                <Moon size={16} className="text-indigo-600" />
              )}
            </motion.div>
          </button>

          {/* Install / Download PWA Button */}
          {!isStandalone && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('finpulse-open-install'))}
              className="relative w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-white hover:bg-indigo-100 dark:hover:bg-indigo-500/25 transition-all shadow-sm group"
              title="Download & Install FinPulse Web App"
              aria-label="Install App"
            >
              <Download size={15} className="group-hover:translate-y-0.5 transition-transform" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
              </span>
            </button>
          )}

          <Link
            to="/scan-bill"
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/80 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-white hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all shadow-sm"
            title="Scan Bill & Receipts"
          >
            <ScanLine size={16} />
          </Link>

          <Link
            to="/categories"
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/10 transition-colors"
            title="Manage Categories"
          >
            <Tags size={16} />
          </Link>

          <Link
            to="/ai-report"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl gradient-primary-btn text-white text-xs font-semibold shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/35 transition-all"
          >
            <Sparkles size={14} className="text-amber-300 animate-pulse" />
            <span>AI Report</span>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default TopBar;

