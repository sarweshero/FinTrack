import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BellRing,
  AlertTriangle,
  Search,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';

import PageTransition from '../components/layout/PageTransition';
import GlassCard from '../components/ui/GlassCard';
import Badge from '../components/ui/Badge';
import SkeletonCard from '../components/ui/SkeletonCard';
import FAB from '../components/ui/FAB';
import AnimatedCounter from '../components/ui/AnimatedCounter';

import {
  fetchReminders,
  setOverdueOnly,
  setSearchQuery,
} from '../store/slices/remindersSlice';
import { openModal } from '../store/slices/uiSlice';

export const RemindersPage = () => {
  const dispatch = useDispatch();
  const { data, overdueOnly, searchQuery, status } = useSelector(
    (state) => state.reminders
  );

  const [activeSection, setActiveSection] = useState('ALL'); // 'ALL' | 'GIVEN_BY_ME' | 'GIVEN_TO_ME'

  useEffect(() => {
    dispatch(
      fetchReminders({
        overdue_only: overdueOnly,
        search: searchQuery,
      })
    );
  }, [dispatch, overdueOnly, searchQuery]);

  const summary = data.summary || {};
  const givenByMe = summary.given_by_me || {};
  const givenToMe = summary.given_to_me || {};
  const netRemainder = summary.net_remainder || 0;
  const netPosition = summary.net_position || 'BALANCED';

  const openSettle = (item, type) => {
    dispatch(
      openModal({
        name: 'SETTLE_DEBT',
        data: {
          id: item.id,
          person_name: item.person_name,
          remaining_amount: item.remainder_amount,
          initial_amount: item.initial_amount,
          debt_type: type,
        },
      })
    );
  };

  const openAdd = () => {
    dispatch(openModal({ name: 'PEER_DEBT', defaultType: 'GIVEN' }));
  };

  return (
    <PageTransition className="space-y-4">
      {/* Net Remainder Banner Card */}
      <GlassCard glow className="p-4 sm:p-5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <BellRing size={18} />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Peer Reminders & Dues
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Active ledger of outstanding amounts given by you and to you
            </p>
          </div>

          {/* Net Position Indicator */}
          <div className="flex items-center gap-2 p-2 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 shrink-0">
            <span className="text-xs text-slate-600 dark:text-slate-400">Net Remainder:</span>
            <span
              className={`text-base font-bold tracking-tight ${
                netRemainder > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : netRemainder < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {netRemainder > 0 ? '+' : ''}₹{Math.abs(netRemainder).toFixed(2)}
            </span>
            <Badge
              variant={
                netPosition === 'RECEIVABLE'
                  ? 'credit'
                  : netPosition === 'PAYABLE'
                  ? 'debit'
                  : 'neutral'
              }
              size="xs"
            >
              {netPosition}
            </Badge>
          </div>
        </div>
      </GlassCard>

      {/* Two Summary Cards: Given by Me vs Given to Me */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Given by Me (Receivables) */}
        <GlassCard
          onClick={() => setActiveSection(activeSection === 'GIVEN_BY_ME' ? 'ALL' : 'GIVEN_BY_ME')}
          className={`p-4 cursor-pointer border ${
            activeSection === 'GIVEN_BY_ME'
              ? 'border-amber-500/50 bg-amber-500/10'
              : 'border-slate-200 dark:border-white/5'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <ArrowUpRight size={16} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Amount Given by Me
              </span>
            </div>
            {givenByMe.overdue_count > 0 && (
              <Badge variant="overdue" size="xs" pulse>
                {givenByMe.overdue_count} Overdue
              </Badge>
            )}
          </div>

          <div className="mt-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 block">Remainder to Collect</span>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              <AnimatedCounter value={givenByMe.remainder_to_receive} prefix="₹" />
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex justify-between">
              <span>Total Given: ₹{Number(givenByMe.total_amount_given || 0).toFixed(2)}</span>
              <span>Recovered: ₹{Number(givenByMe.total_received_back || 0).toFixed(2)}</span>
            </div>
          </div>
        </GlassCard>

        {/* Given to Me (Payables) */}
        <GlassCard
          onClick={() => setActiveSection(activeSection === 'GIVEN_TO_ME' ? 'ALL' : 'GIVEN_TO_ME')}
          className={`p-4 cursor-pointer border ${
            activeSection === 'GIVEN_TO_ME'
              ? 'border-indigo-500/50 bg-indigo-500/10'
              : 'border-slate-200 dark:border-white/5'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                <ArrowDownLeft size={16} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Amount Given to Me
              </span>
            </div>
            {givenToMe.overdue_count > 0 && (
              <Badge variant="overdue" size="xs" pulse>
                {givenToMe.overdue_count} Overdue
              </Badge>
            )}
          </div>

          <div className="mt-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 block">Remainder to Return</span>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              <AnimatedCounter value={givenToMe.remainder_to_pay} prefix="₹" />
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex justify-between">
              <span>Total Borrowed: ₹{Number(givenToMe.total_amount_taken || 0).toFixed(2)}</span>
              <span>Repaid: ₹{Number(givenToMe.total_repaid || 0).toFixed(2)}</span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Search person or notes..."
            value={searchQuery}
            onChange={(e) => dispatch(setSearchQuery(e.target.value))}
            className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-2 pl-10 pr-4 text-slate-900 dark:text-white text-xs sm:text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <button
          onClick={() => dispatch(setOverdueOnly(!overdueOnly))}
          className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-semibold border transition-all ${
            overdueOnly
              ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/40 shadow-lg shadow-rose-500/20'
              : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <AlertTriangle size={14} />
          <span>{overdueOnly ? 'Showing Overdue Only' : 'Filter Overdue'}</span>
        </button>
      </div>

      {/* Reminders List Section */}
      {status === 'loading' && (!data.amount_given_by_me || data.amount_given_by_me.length === 0) ? (
        <SkeletonCard count={4} height="h-24" />
      ) : (
        <div className="space-y-6">
          {/* Section 1: Amount Given by Me */}
          {(activeSection === 'ALL' || activeSection === 'GIVEN_BY_ME') && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <span>To Collect (Given by Me)</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px]">
                    {data.amount_given_by_me?.length || 0}
                  </span>
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Total: ${Number(givenByMe.remainder_to_receive || 0).toFixed(2)}
                </span>
              </div>

              {data.amount_given_by_me?.length === 0 ? (
                <div className="p-4 rounded-2xl glass-panel text-center text-xs text-slate-500">
                  No pending reminders to collect.
                </div>
              ) : (
                <div className="space-y-2.5">
                  <AnimatePresence>
                    {data.amount_given_by_me.map((item) => (
                      <motion.div
                        key={`given-${item.id}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                      >
                        <GlassCard className="p-4 flex items-center justify-between gap-3 group">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 dark:text-white">
                                {item.person_name}
                              </span>
                              {item.is_overdue && (
                                <Badge variant="overdue" size="xs" pulse>
                                  Overdue
                                </Badge>
                              )}
                              {item.status === 'PARTIALLY_SETTLED' && (
                                <Badge variant="partially_settled" size="xs">
                                  Partially Settled
                                </Badge>
                              )}
                            </div>

                            <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                              <span>Initial: ₹{item.initial_amount.toFixed(2)}</span>
                              <span className="text-slate-400 dark:text-slate-500"> • </span>
                              <span>Recovered: ₹{item.settled_amount.toFixed(2)}</span>
                            </div>

                            {item.due_date && (
                              <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                <Clock size={12} />
                                <span>Due: {item.due_date}</span>
                                {item.days_until_due !== null && (
                                  <span
                                    className={
                                      item.days_until_due < 0
                                        ? 'text-rose-500 dark:text-rose-400 font-semibold'
                                        : 'text-amber-600 dark:text-amber-400'
                                    }
                                  >
                                    ({item.days_until_due < 0
                                      ? `${Math.abs(item.days_until_due)} days overdue`
                                      : `${item.days_until_due} days left`})
                                  </span>
                                )}
                              </div>
                            )}

                            {item.notes && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-1">
                                "{item.notes}"
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <div className="text-right">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase">
                                Due to Collect
                              </span>
                              <span className="text-base font-bold text-amber-600 dark:text-amber-400">
                                ₹{item.remainder_amount.toFixed(2)}
                              </span>
                            </div>
                            <button
                              onClick={() => openSettle(item, 'GIVEN')}
                              className="px-3 py-1.5 rounded-xl gradient-emerald-btn text-white text-xs font-semibold shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all"
                            >
                              Settle
                            </button>
                          </div>
                        </GlassCard>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}

          {/* Section 2: Amount Given to Me */}
          {(activeSection === 'ALL' || activeSection === 'GIVEN_TO_ME') && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <span>To Return (Given to Me)</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[10px]">
                    {data.amount_given_to_me?.length || 0}
                  </span>
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Total: ₹{Number(givenToMe.remainder_to_pay || 0).toFixed(2)}
                </span>
              </div>

              {data.amount_given_to_me?.length === 0 ? (
                <div className="p-4 rounded-2xl glass-panel text-center text-xs text-slate-500">
                  No pending debts you owe to others.
                </div>
              ) : (
                <div className="space-y-2.5">
                  <AnimatePresence>
                    {data.amount_given_to_me.map((item) => (
                      <motion.div
                        key={`taken-${item.id}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                      >
                        <GlassCard className="p-4 flex items-center justify-between gap-3 group">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 dark:text-white">
                                {item.person_name}
                              </span>
                              {item.is_overdue && (
                                <Badge variant="overdue" size="xs" pulse>
                                  Overdue
                                </Badge>
                              )}
                              {item.status === 'PARTIALLY_SETTLED' && (
                                <Badge variant="partially_settled" size="xs">
                                  Partially Settled
                                </Badge>
                              )}
                            </div>

                            <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                              <span>Initial: ₹{item.initial_amount.toFixed(2)}</span>
                              <span className="text-slate-400 dark:text-slate-500"> • </span>
                              <span>Repaid: ₹{item.settled_amount.toFixed(2)}</span>
                            </div>

                            {item.due_date && (
                              <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                <Clock size={12} />
                                <span>Due: {item.due_date}</span>
                                {item.days_until_due !== null && (
                                  <span
                                    className={
                                      item.days_until_due < 0
                                        ? 'text-rose-500 dark:text-rose-400 font-semibold'
                                        : 'text-indigo-600 dark:text-indigo-400'
                                    }
                                  >
                                    ({item.days_until_due < 0
                                      ? `${Math.abs(item.days_until_due)} days overdue`
                                      : `${item.days_until_due} days left`})
                                  </span>
                                )}
                              </div>
                            )}

                            {item.notes && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-1">
                                "{item.notes}"
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <div className="text-right">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase">
                                You Owe
                              </span>
                              <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                                ₹{item.remainder_amount.toFixed(2)}
                              </span>
                            </div>
                            <button
                              onClick={() => openSettle(item, 'BORROWED')}
                              className="px-3 py-1.5 rounded-xl gradient-emerald-btn text-white text-xs font-semibold shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all"
                            >
                              Repay
                            </button>
                          </div>
                        </GlassCard>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <FAB label="Track Loan" onClick={openAdd} />
    </PageTransition>
  );
};

export default RemindersPage;

