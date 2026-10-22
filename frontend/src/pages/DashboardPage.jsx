import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  HandCoins,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import PageTransition from '../components/layout/PageTransition';
import StatCard from '../components/ui/StatCard';
import GlassCard from '../components/ui/GlassCard';
import SpendTrendChart from '../components/charts/SpendTrendChart';
import CategoryDonutChart from '../components/charts/CategoryDonutChart';
import SkeletonCard from '../components/ui/SkeletonCard';
import Badge from '../components/ui/Badge';
import AnimatedCounter from '../components/ui/AnimatedCounter';

import {
  fetchDashboardData,
  fetchTrendsOnly,
  setSelectedTrendDays,
} from '../store/slices/dashboardSlice';
import { fetchCategories } from '../store/slices/categorySlice';
import { openModal } from '../store/slices/uiSlice';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' },
  },
};

export const DashboardPage = () => {
  const dispatch = useDispatch();
  const { summary, trends, categories, whoOwes, selectedTrendDays, status } = useSelector(
    (state) => state.dashboard
  );

  useEffect(() => {
    dispatch(fetchDashboardData(selectedTrendDays));
    dispatch(fetchCategories());
  }, [dispatch, selectedTrendDays]);

  const handleTrendPeriodChange = (days) => {
    dispatch(setSelectedTrendDays(days));
    dispatch(fetchTrendsOnly(days));
  };

  const openAddTransaction = (defaultType = 'DEBIT') => {
    dispatch(openModal({ name: 'TRANSACTION', defaultType }));
  };

  const openAddSavings = () => {
    dispatch(openModal({ name: 'SAVINGS_GOAL' }));
  };

  const openAddDebt = () => {
    dispatch(openModal({ name: 'PEER_DEBT', defaultType: 'GIVEN' }));
  };

  const openSettle = (debt) => {
    dispatch(openModal({ name: 'SETTLE_DEBT', data: debt }));
  };

  if (status === 'loading' && (!trends.series || trends.series.length === 0)) {
    return (
      <PageTransition className="space-y-4">
        <SkeletonCard height="h-28" count={3} />
        <SkeletonCard height="h-64" count={1} />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-5"
      >
        {/* Quick Action Shortcuts */}
        <motion.div variants={itemVariants} className="grid grid-cols-4 gap-2 sm:gap-3">
          <button
            onClick={() => openAddTransaction('DEBIT')}
            className="flex flex-col items-center justify-center p-3 rounded-2xl glass-panel glass-panel-hover border border-rose-500/20 group text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 dark:text-rose-400 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
              <ArrowDownLeft size={18} />
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Expense</span>
          </button>

          <button
            onClick={() => openAddTransaction('CREDIT')}
            className="flex flex-col items-center justify-center p-3 rounded-2xl glass-panel glass-panel-hover border border-emerald-500/20 group text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
              <ArrowUpRight size={18} />
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Income</span>
          </button>

          <button
            onClick={openAddSavings}
            className="flex flex-col items-center justify-center p-3 rounded-2xl glass-panel glass-panel-hover border border-indigo-500/20 group text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
              <PiggyBank size={18} />
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Goal</span>
          </button>

          <button
            onClick={openAddDebt}
            className="flex flex-col items-center justify-center p-3 rounded-2xl glass-panel glass-panel-hover border border-amber-500/20 group text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
              <HandCoins size={18} />
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Lend/Debt</span>
          </button>
        </motion.div>

        {/* Total Net Balance Hero Card with Breakdown */}
        <motion.div variants={itemVariants}>
          <GlassCard glow className="p-4 sm:p-5 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <Wallet size={14} /> Total Net Amount
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <AnimatedCounter
                    value={summary.net_balance}
                    prefix="$"
                    className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                      summary.net_balance >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {summary.net_balance >= 0 ? 'Net Positive' : 'Deficit'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Reflects cash in hand, plus dues people owe you, minus borrowed funds.
                </p>
              </div>

              {/* Breakdown Pills: Cash + To Receive - Borrowed */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 min-w-[90px]">
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Cash In-Hand</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    ${(summary.cash_balance ?? (summary.total_income - summary.total_expense)).toFixed(2)}
                  </span>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-1.5 min-w-[90px]">
                  <span className="text-emerald-600 dark:text-emerald-400/80 block text-[10px] uppercase font-semibold">Need to Pay Me</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    +${summary.remainder_to_receive.toFixed(2)}
                  </span>
                </div>
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-1.5 min-w-[90px]">
                  <span className="text-rose-600 dark:text-rose-400/80 block text-[10px] uppercase font-semibold">Money Borrowed</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    -${summary.remainder_to_pay.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Top Metric Cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            title="Total Income"
            amount={summary.total_income}
            icon={TrendingUp}
            color="emerald"
            subtitle="Earned so far"
          />
          <StatCard
            title="Total Spent"
            amount={summary.total_expense}
            icon={TrendingDown}
            color="rose"
            subtitle="Expenses recorded"
          />
          <StatCard
            title="Net Peer Debt"
            amount={Math.abs(summary.net_peer_remainder)}
            icon={HandCoins}
            color={summary.net_peer_remainder >= 0 ? 'emerald' : 'rose'}
            subtitle={summary.net_peer_remainder >= 0 ? 'Net to receive' : 'Net to repay'}
          />
          <StatCard
            title="Saved in Goals"
            amount={summary.total_saved}
            icon={PiggyBank}
            color="purple"
            subtitle={`Target: $${summary.total_target_savings.toFixed(0)}`}
          />
        </motion.div>

        {/* Spend & Income Trend Chart */}
        <motion.div variants={itemVariants}>
          <GlassCard className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <span>Cashflow & Spend Trends</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Spend vs Income vs Amount Given to Peers
                </p>
              </div>

              {/* Timeframe Pills */}
              <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/5 text-xs">
                <button
                  onClick={() => handleTrendPeriodChange(7)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    selectedTrendDays === 7
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  7D
                </button>
                <button
                  onClick={() => handleTrendPeriodChange(30)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    selectedTrendDays === 30
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  30D
                </button>
              </div>
            </div>

            <SpendTrendChart series={trends.series} height={220} />

            {/* Quick stats footer */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-white/5 text-center text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">Period Spend</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">${trends.total_spend.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">Period Income</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">${trends.total_income.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">Period Given</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">${trends.total_given.toFixed(2)}</span>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Two Column Section: Who Owes Me & Category Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Who Owes Me Section */}
          <motion.div variants={itemVariants}>
            <GlassCard className="p-4 md:p-5 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>Who Needs to Give Me Money</span>
                      {whoOwes.overdue_count > 0 && (
                        <span className="text-[10px] bg-rose-500/20 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded-full font-semibold border border-rose-500/30">
                          {whoOwes.overdue_count} Overdue
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Total Pending: <AnimatedCounter value={whoOwes.total_receivable} prefix="$" className="font-bold text-amber-600 dark:text-amber-400" />
                    </p>
                  </div>
                  <Link
                    to="/reminders"
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold flex items-center gap-0.5"
                  >
                    <span>View All</span>
                    <ChevronRight size={14} />
                  </Link>
                </div>

                {whoOwes.who_owes_list && whoOwes.who_owes_list.length > 0 ? (
                  <div className="space-y-2 mt-3">
                    {whoOwes.who_owes_list.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white">{item.person_name}</span>
                            {item.is_overdue && (
                              <Badge variant="overdue" size="xs">
                                Overdue
                              </Badge>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {item.due_date ? `Due: ${item.due_date}` : 'No deadline'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                            ${item.remainder_due.toFixed(2)}
                          </span>
                          <button
                            onClick={() => openSettle({ id: item.id, person_name: item.person_name, remaining_amount: item.remainder_due, debt_type: 'GIVEN' })}
                            className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 text-[11px] font-semibold transition-colors"
                          >
                            Settle
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No active pending debts owed to you right now.
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/5 flex items-center justify-between text-xs">
                <Link to="/debts" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1">
                  <span>Manage Peer Ledger</span>
                  <ChevronRight size={14} />
                </Link>
                <button
                  onClick={openAddDebt}
                  className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300"
                >
                  + Lend Money
                </button>
              </div>
            </GlassCard>
          </motion.div>

          {/* Expense Category Breakdown */}
          <motion.div variants={itemVariants}>
            <GlassCard className="p-4 md:p-5 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Expense Distribution</h3>
                  <Link
                    to="/categories"
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold flex items-center gap-0.5"
                  >
                    <span>Categories</span>
                    <ChevronRight size={14} />
                  </Link>
                </div>

                <CategoryDonutChart
                  data={categories.expenses.breakdown}
                  total={categories.expenses.total}
                  height={170}
                />

                <div className="space-y-1.5 mt-2">
                  {categories.expenses.breakdown.slice(0, 3).map((cat) => (
                    <div
                      key={cat.category_id || cat.category_name}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50 dark:bg-white/5"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-slate-800 dark:text-slate-200 truncate">{cat.category_name}</span>
                      </div>
                      <div className="flex items-center gap-2 font-medium">
                        <span className="text-slate-500 dark:text-slate-400">{cat.percentage}%</span>
                        <span className="text-slate-900 dark:text-white">${cat.amount.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Top Outflows</span>
                <Link to="/debit" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold">
                  View All Expenses →
                </Link>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </motion.div>
    </PageTransition>
  );
};

export default DashboardPage;

