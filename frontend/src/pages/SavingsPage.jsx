import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { PiggyBank, Plus, Calendar, Trash2, Edit2 } from 'lucide-react';

import PageTransition from '../components/layout/PageTransition';
import GlassCard from '../components/ui/GlassCard';
import ProgressRing from '../components/ui/ProgressRing';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import SkeletonCard from '../components/ui/SkeletonCard';
import FAB from '../components/ui/FAB';

import {
  fetchSavingsGoals,
  deleteSavingsGoal,
} from '../store/slices/savingsSlice';
import { openModal, addToast } from '../store/slices/uiSlice';
import { fetchDashboardData } from '../store/slices/dashboardSlice';

export const SavingsPage = () => {
  const dispatch = useDispatch();
  const { items, status } = useSelector((state) => state.savings);
  const summary = useSelector((state) => state.dashboard.summary);

  useEffect(() => {
    dispatch(fetchSavingsGoals());
    dispatch(fetchDashboardData(30));
  }, [dispatch]);

  const handleDelete = async (id, title) => {
    if (window.confirm(`Delete savings goal "${title}"?`)) {
      try {
        await dispatch(deleteSavingsGoal(id)).unwrap();
        dispatch(addToast({ message: 'Savings goal deleted', type: 'info' }));
        dispatch(fetchDashboardData(30));
      } catch (err) {
        dispatch(addToast({ message: err || 'Delete failed', type: 'error' }));
      }
    }
  };

  const openDeposit = (goal) => {
    dispatch(openModal({ name: 'DEPOSIT', data: goal }));
  };

  const openAdd = () => {
    dispatch(openModal({ name: 'SAVINGS_GOAL' }));
  };

  const overallProgress =
    summary.total_target_savings > 0
      ? Math.round((summary.total_saved / summary.total_target_savings) * 100)
      : 0;

  return (
    <PageTransition className="space-y-4">
      {/* Top Summary Card with Big Progress Ring */}
      <GlassCard glow className="p-5 flex items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Total Savings Progress
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            ₹{summary.total_saved.toFixed(2)}{' '}
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
              / ₹{summary.total_target_savings.toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {items.filter((g) => !g.is_completed).length} active goal(s) in progress
          </p>
        </div>

        <div className="shrink-0">
          <ProgressRing progress={overallProgress} size={80} strokeWidth={8} color="#8b5cf6">
            <div className="text-center">
              <span className="text-sm font-bold text-slate-900 dark:text-white">{overallProgress}%</span>
            </div>
          </ProgressRing>
        </div>
      </GlassCard>

      <div className="flex items-center justify-between pt-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Your Savings Pots</h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">{items.length} Goal(s)</span>
      </div>

      {status === 'loading' && items.length === 0 ? (
        <SkeletonCard count={3} height="h-32" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="No savings goals yet"
          description="Create savings targets for emergency funds, gadgets, or dream holidays."
          actionLabel="Create Savings Goal"
          onAction={openAdd}
        />
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
          }}
          className="space-y-3"
        >
          <AnimatePresence>
            {items.map((goal) => {
              const current = Number(goal.current_amount || 0);
              const target = Number(goal.target_amount || 1);
              const progress = goal.progress_percentage || 0;
              const isDone = goal.is_completed || progress >= 100;

              return (
                <motion.div
                  key={goal.id}
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  layout
                >
                  <GlassCard className="p-4 sm:p-5 group">
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: Progress Ring + Details */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="shrink-0">
                          <ProgressRing
                            progress={progress}
                            size={56}
                            strokeWidth={5}
                            color={isDone ? '#10b981' : '#6366f1'}
                          >
                            <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                              {Math.round(progress)}%
                            </span>
                          </ProgressRing>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {goal.title}
                            </h4>
                            {isDone && (
                              <Badge variant="settled" size="xs">
                                Completed
                              </Badge>
                            )}
                          </div>

                          <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                            <span className="font-bold text-slate-900 dark:text-white">₹{current.toFixed(2)}</span>
                            <span className="text-slate-500 dark:text-slate-400"> of ₹{target.toFixed(2)}</span>
                          </div>

                          {goal.target_date && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              <Calendar size={12} />
                              <span>Target: {goal.target_date}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <button
                          onClick={() => openDeposit(goal)}
                          className="px-3 py-1.5 rounded-xl gradient-emerald-btn text-white text-xs font-semibold shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all flex items-center gap-1"
                        >
                          <Plus size={14} />
                          <span>Deposit</span>
                        </button>

                        <div className="flex items-center gap-1 opacity-70 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() =>
                              dispatch(openModal({ name: 'SAVINGS_GOAL', data: goal }))
                            }
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(goal.id, goal.title)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-500/10"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      <FAB label="New Goal" onClick={openAdd} />
    </PageTransition>
  );
};

export default SavingsPage;
