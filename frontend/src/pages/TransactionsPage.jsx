import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
  Edit2,
} from 'lucide-react';

import PageTransition from '../components/layout/PageTransition';
import GlassCard from '../components/ui/GlassCard';
import EmptyState from '../components/ui/EmptyState';
import SkeletonCard from '../components/ui/SkeletonCard';
import FAB from '../components/ui/FAB';

import {
  fetchTransactions,
  deleteTransaction,
} from '../store/slices/transactionSlice';
import { fetchCategories } from '../store/slices/categorySlice';
import { openModal, addToast } from '../store/slices/uiSlice';
import { fetchDashboardData } from '../store/slices/dashboardSlice';

export const TransactionsPage = () => {
  const dispatch = useDispatch();
  const { items, status } = useSelector((state) => state.transactions);
  const categories = useSelector((state) => state.categories.items);

  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'DEBIT' | 'CREDIT'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  useEffect(() => {
    const params = {};
    if (activeTab !== 'ALL') params.type = activeTab;
    if (selectedCategory) params.category = selectedCategory;
    if (searchTerm.trim()) params.search = searchTerm.trim();

    dispatch(fetchTransactions(params));
  }, [dispatch, activeTab, selectedCategory, searchTerm]);

  const handleDelete = async (id, title) => {
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      try {
        await dispatch(deleteTransaction(id)).unwrap();
        dispatch(addToast({ message: 'Transaction removed', type: 'info' }));
        dispatch(fetchDashboardData(30));
      } catch (err) {
        dispatch(addToast({ message: err || 'Delete failed', type: 'error' }));
      }
    }
  };

  const handleEdit = (tx) => {
    dispatch(openModal({ name: 'TRANSACTION', data: tx }));
  };

  const openAdd = () => {
    dispatch(
      openModal({
        name: 'TRANSACTION',
        defaultType: activeTab === 'CREDIT' ? 'CREDIT' : 'DEBIT',
      })
    );
  };

  return (
    <PageTransition className="space-y-4">
      {/* Search & Type Filters */}
      <div className="space-y-2.5">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Search transactions by title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 pl-10 pr-4 text-slate-900 dark:text-white text-xs sm:text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Tab & Category row */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
          {/* Tab Selector */}
          <div className="flex p-1 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5 text-xs font-semibold shrink-0">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('DEBIT')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'DEBIT'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Expenses (Debit)
            </button>
            <button
              onClick={() => setActiveTab('CREDIT')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'CREDIT'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Income (Credit)
            </button>
          </div>

          {/* Category Filter Select */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-100 dark:bg-[#121624] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 text-xs rounded-xl py-1.5 px-3 focus:outline-none focus:border-indigo-500 shrink-0"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transactions List */}
      {status === 'loading' && items.length === 0 ? (
        <SkeletonCard count={4} height="h-20" />
      ) : items.length === 0 ? (
        <EmptyState
          title="No transactions found"
          description={
            searchTerm || selectedCategory || activeTab !== 'ALL'
              ? 'Try adjusting your filters or search terms.'
              : 'Start logging your spending and income to track cashflow.'
          }
          actionLabel="Add Transaction"
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
            {items.map((tx) => {
              const isDebit = tx.type === 'DEBIT';
              const catName = tx.category_details?.name || 'General';
              const catColor = tx.category_details?.color || '#64748b';

              return (
                <motion.div
                  key={tx.id}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  exit={{ opacity: 0, x: -30 }}
                  layout
                >
                  <GlassCard className="p-3.5 sm:p-4 flex items-center justify-between gap-3 group">
                    {/* Left: Icon & Title */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                          isDebit
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}
                      >
                        {isDebit ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {tx.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <span
                              className="w-1.5 h-1.5 rounded-full inline-block"
                              style={{ backgroundColor: catColor }}
                            />
                            {catName}
                          </span>
                          <span>•</span>
                          <span>{tx.date}</span>
                          {tx.payment_method && (
                            <>
                              <span>•</span>
                              <span className="uppercase">{tx.payment_method.replace('_', ' ')}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount & Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-base font-bold tracking-tight ${
                          isDebit ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isDebit ? '-' : '+'}₹{Number(tx.amount).toFixed(2)}
                      </span>

                      {/* Hover action buttons */}
                      <div className="flex items-center gap-1 opacity-70 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(tx)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(tx.id, tx.title)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* FAB */}
      <FAB
        label={activeTab === 'CREDIT' ? 'Add Income' : 'Add Expense'}
        onClick={openAdd}
      />
    </PageTransition>
  );
};

export default TransactionsPage;
