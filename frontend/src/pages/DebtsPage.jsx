import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, HandCoins, Calendar, Trash2, Edit2 } from 'lucide-react';

import PageTransition from '../components/layout/PageTransition';
import GlassCard from '../components/ui/GlassCard';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import SkeletonCard from '../components/ui/SkeletonCard';
import FAB from '../components/ui/FAB';

import { fetchDebts, deleteDebt } from '../store/slices/debtSlice';
import { openModal, addToast } from '../store/slices/uiSlice';
import { fetchDashboardData } from '../store/slices/dashboardSlice';

export const DebtsPage = () => {
  const dispatch = useDispatch();
  const { items, status } = useSelector((state) => state.debts);
  const summary = useSelector((state) => state.dashboard.summary);

  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'GIVEN' | 'BORROWED'

  useEffect(() => {
    const params = {};
    if (activeFilter !== 'ALL') params.type = activeFilter;
    dispatch(fetchDebts(params));
    dispatch(fetchDashboardData(30));
  }, [dispatch, activeFilter]);

  const handleDelete = async (id, name) => {
    if (window.confirm(`Delete debt record for "${name}"?`)) {
      try {
        await dispatch(deleteDebt(id)).unwrap();
        dispatch(addToast({ message: 'Debt record deleted', type: 'info' }));
        dispatch(fetchDashboardData(30));
      } catch (err) {
        dispatch(addToast({ message: err || 'Delete failed', type: 'error' }));
      }
    }
  };

  const openSettle = (debt) => {
    dispatch(openModal({ name: 'SETTLE_DEBT', data: debt }));
  };

  const openAdd = () => {
    dispatch(
      openModal({
        name: 'PEER_DEBT',
        defaultType: activeFilter === 'BORROWED' ? 'BORROWED' : 'GIVEN',
      })
    );
  };

  return (
    <PageTransition className="space-y-4">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          title="Money Given (To Collect)"
          amount={summary.remainder_to_receive}
          icon={HandCoins}
          color="amber"
          subtitle={`Total Given: ₹${summary.total_amount_given.toFixed(2)}`}
        />
        <StatCard
          title="Money Borrowed (To Pay)"
          amount={summary.remainder_to_pay}
          icon={Users}
          color="indigo"
          subtitle={`Total Borrowed: ₹${summary.total_amount_borrowed.toFixed(2)}`}
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex p-1 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5 text-xs font-semibold">
        <button
          onClick={() => setActiveFilter('ALL')}
          className={`flex-1 py-2 rounded-xl transition-all ${
            activeFilter === 'ALL'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          All Records
        </button>
        <button
          onClick={() => setActiveFilter('GIVEN')}
          className={`flex-1 py-2 rounded-xl transition-all ${
            activeFilter === 'GIVEN'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Given (They Owe Me)
        </button>
        <button
          onClick={() => setActiveFilter('BORROWED')}
          className={`flex-1 py-2 rounded-xl transition-all ${
            activeFilter === 'BORROWED'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Borrowed (I Owe)
        </button>
      </div>

      {/* List */}
      {status === 'loading' && items.length === 0 ? (
        <SkeletonCard count={3} height="h-28" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No peer debts logged"
          description="Track money you lent to friends or borrowed from family."
          actionLabel="Add Record"
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
            {items.map((debt) => {
              const isGiven = debt.debt_type === 'GIVEN';
              const isSettled = debt.status === 'SETTLED';

              return (
                <motion.div
                  key={debt.id}
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  layout
                >
                  <GlassCard className="p-4 sm:p-5 group">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">{debt.person_name}</h4>
                          <Badge variant={isGiven ? 'given' : 'borrowed'} size="xs">
                            {isGiven ? 'Given to them' : 'Borrowed by me'}
                          </Badge>
                          {debt.is_overdue && (
                            <Badge variant="overdue" size="xs" pulse>
                              Overdue
                            </Badge>
                          )}
                          {isSettled && (
                            <Badge variant="settled" size="xs">
                              Settled
                            </Badge>
                          )}
                        </div>

                        {debt.phone_or_contact && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{debt.phone_or_contact}</p>
                        )}

                        <div className="text-xs text-slate-600 dark:text-slate-300 mt-2">
                          <span>Initial: ₹{Number(debt.initial_amount).toFixed(2)}</span>
                          <span className="text-slate-400 dark:text-slate-500"> • </span>
                          <span>Settled: ₹{Number(debt.settled_amount).toFixed(2)}</span>
                        </div>

                        {debt.due_date && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            <Calendar size={12} />
                            <span>Due: {debt.due_date}</span>
                            {debt.days_until_due !== null && (
                              <span className={debt.days_until_due < 0 ? 'text-rose-500 dark:text-rose-400 font-semibold' : ''}>
                                ({debt.days_until_due < 0 ? `${Math.abs(debt.days_until_due)} days late` : `${debt.days_until_due} days left`})
                              </span>
                            )}
                          </div>
                        )}

                        {debt.notes && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 italic mt-1.5 bg-slate-100 dark:bg-white/5 p-1.5 rounded-lg">
                            "{debt.notes}"
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2.5 shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase block">Remaining</span>
                          <span
                            className={`text-lg font-bold ${
                              isGiven ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'
                            }`}
                          >
                            ₹{Number(debt.remaining_amount).toFixed(2)}
                          </span>
                        </div>

                        {!isSettled && (
                          <button
                            onClick={() => openSettle(debt)}
                            className="px-3 py-1.5 rounded-xl gradient-emerald-btn text-white text-xs font-semibold shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all"
                          >
                            Record Pay
                          </button>
                        )}

                        <div className="flex items-center gap-1 opacity-70 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() =>
                              dispatch(openModal({ name: 'PEER_DEBT', data: debt }))
                            }
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(debt.id, debt.person_name)}
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

      <FAB label="Track Loan" onClick={openAdd} />
    </PageTransition>
  );
};

export default DebtsPage;

