import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDownLeft, Trash2, Edit2, TrendingDown, ReceiptText } from 'lucide-react';

import PageTransition from '../components/layout/PageTransition';
import GlassCard from '../components/ui/GlassCard';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import SkeletonCard from '../components/ui/SkeletonCard';
import FAB from '../components/ui/FAB';
import BillDataAccordion from '../components/transactions/BillDataAccordion';

import { fetchTransactions, deleteTransaction } from '../store/slices/transactionSlice';
import { fetchCategories } from '../store/slices/categorySlice';
import { fetchDashboardData } from '../store/slices/dashboardSlice';
import { openModal, addToast } from '../store/slices/uiSlice';

export const DebitPage = () => {
  const dispatch = useDispatch();
  const { items, status } = useSelector((state) => state.transactions);
  const totalExpense = useSelector((state) => state.dashboard.summary.total_expense);

  useEffect(() => {
    dispatch(fetchTransactions({ type: 'DEBIT' }));
    dispatch(fetchCategories());
    dispatch(fetchDashboardData(30));
  }, [dispatch]);

  const debits = items.filter((tx) => tx.type === 'DEBIT');

  const handleDelete = async (id, title) => {
    if (window.confirm(`Delete expense "${title}"?`)) {
      try {
        await dispatch(deleteTransaction(id)).unwrap();
        dispatch(addToast({ message: 'Expense deleted', type: 'info' }));
        dispatch(fetchDashboardData(30));
      } catch (err) {
        dispatch(addToast({ message: err || 'Delete failed', type: 'error' }));
      }
    }
  };

  const openAdd = () => {
    dispatch(openModal({ name: 'TRANSACTION', defaultType: 'DEBIT' }));
  };

  return (
    <PageTransition className="space-y-4">
      {/* Overview Stat Card */}
      <StatCard
        title="Total Outflow"
        amount={totalExpense}
        icon={TrendingDown}
        color="rose"
        subtitle={`${debits.length} recorded expense(s)`}
      />

      <div className="flex items-center justify-between pt-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Recent Expenses</h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">{debits.length} entries</span>
      </div>

      {status === 'loading' && debits.length === 0 ? (
        <SkeletonCard count={4} height="h-20" />
      ) : debits.length === 0 ? (
        <EmptyState
          title="No expenses logged yet"
          description="Track your daily expenses to see where your money goes."
          actionLabel="Log Expense"
          onAction={openAdd}
        />
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
          }}
          className="space-y-2.5"
        >
          <AnimatePresence>
            {debits.map((tx) => (
              <motion.div
                key={tx.id}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 },
                }}
                exit={{ opacity: 0, x: -30 }}
                layout
              >
                <GlassCard
                  onClick={() => dispatch(openModal({ name: 'TRANSACTION_DETAIL', data: tx }))}
                  className="p-3.5 group border border-slate-200/70 dark:border-white/5 hover:border-indigo-500/40 hover:shadow-md dark:hover:bg-white/[0.03] transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
                        <ArrowDownLeft size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {tx.title}
                          </h4>
                          {tx.bill_data && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
                              <ReceiptText size={11} /> Scanned Bill
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {tx.category_details?.name || 'General'} • {tx.date}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-base font-bold text-rose-600 dark:text-rose-400">
                        -₹{Number(tx.amount).toFixed(2)}
                      </span>
                      <div className="flex items-center gap-1 opacity-70 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dispatch(openModal({ name: 'TRANSACTION', data: tx }));
                          }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(tx.id, tx.title);
                          }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-500/10"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Scanned bill breakdown */}
                  {tx.bill_data && (
                    <BillDataAccordion tx={tx} billData={tx.bill_data} defaultOpen={false} />
                  )}
                </GlassCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <FAB label="Add Expense" onClick={openAdd} />
    </PageTransition>
  );
};

export default DebitPage;

