import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  Users,
  BellRing,
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/transactions', label: 'Ledger', icon: ArrowLeftRight },
  { path: '/savings', label: 'Savings', icon: PiggyBank },
  { path: '/debts', label: 'Debts', icon: Users },
  { path: '/reminders', label: 'Reminders', icon: BellRing },
];

export const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-[#07090e]/90 backdrop-blur-2xl border-t border-slate-200/80 dark:border-white/5 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] px-3 shadow-lg dark:shadow-none">
      <div className="max-w-md mx-auto flex items-center justify-around relative">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all ${
                  isActive ? 'text-indigo-600 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="activeTabPill"
                      className="absolute inset-0 bg-indigo-50/80 dark:bg-white/10 rounded-2xl border border-indigo-200/70 dark:border-white/10 shadow-[0_0_15px_rgba(99,102,241,0.2)] dark:shadow-[0_0_15px_rgba(139,92,246,0.3)]"
                      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    />
                  )}
                  <motion.div
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    className="relative z-10 flex flex-col items-center"
                  >
                    <Icon
                      size={20}
                      className={isActive ? 'text-indigo-600 dark:text-indigo-400 stroke-[2.2]' : 'stroke-[1.8]'}
                    />
                    <span
                      className={`text-[10px] mt-1 font-medium tracking-tight ${
                        isActive ? 'text-indigo-600 dark:text-white font-semibold' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {item.label}
                    </span>
                  </motion.div>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;

