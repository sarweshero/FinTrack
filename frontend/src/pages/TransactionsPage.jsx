import { useEffect, useState, useMemo, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
  Edit2,
  Calendar,
  ReceiptText,
  Loader2,
  CheckCircle,
} from 'lucide-react';

import PageTransition from '../components/layout/PageTransition';
import GlassCard from '../components/ui/GlassCard';
import EmptyState from '../components/ui/EmptyState';
import SkeletonCard from '../components/ui/SkeletonCard';
import FAB from '../components/ui/FAB';
import BillDataAccordion from '../components/transactions/BillDataAccordion';

import {
  fetchTransactions,
  fetchMoreTransactions,
  deleteTransaction,
} from '../store/slices/transactionSlice';
import { fetchCategories } from '../store/slices/categorySlice';
import { openModal, addToast } from '../store/slices/uiSlice';
import { fetchDashboardData } from '../store/slices/dashboardSlice';

const formatDateHeader = (dateStr) => {
  if (!dateStr) return 'Past Transactions';
  try {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';

    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export const TransactionsPage = () => {
  const dispatch = useDispatch();
  const { items, status, loadingMore, hasMore } = useSelector(
    (state) => state.transactions
  );
  const categories = useSelector((state) => state.categories.items);

  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'DEBIT' | 'CREDIT'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const observerTarget = useRef(null);

  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  // Initial and filtered query load
  useEffect(() => {
    const params = {};
    if (activeTab !== 'ALL') params.type = activeTab;
    if (selectedCategory) params.category = selectedCategory;
    if (searchTerm.trim()) params.search = searchTerm.trim();

    dispatch(fetchTransactions(params));
  }, [dispatch, activeTab, selectedCategory, searchTerm]);

  // Token-based pagination infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!hasMore || loadingMore || status === 'loading') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const params = {};
          if (activeTab !== 'ALL') params.type = activeTab;
          if (selectedCategory) params.category = selectedCategory;
          if (searchTerm.trim()) params.search = searchTerm.trim();

          dispatch(fetchMoreTransactions(params));
        }
      },
      { threshold: 0.1, rootMargin: '160px' }
    );

    const currentEl = observerTarget.current;
    if (currentEl) {
      observer.observe(currentEl);
    }

    return () => {
      if (currentEl) {
        observer.unobserve(currentEl);
      }
    };
  }, [dispatch, hasMore, loadingMore, status, activeTab, selectedCategory, searchTerm]);

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

  // Client-side search matching title, description, category, and extracted bill items
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase().trim();

    return items.filter((tx) => {
      const matchTitle = (tx.title || '').toLowerCase().includes(term);
      const matchDesc = (tx.description || '').toLowerCase().includes(term);
      const matchCat = (tx.category_details?.name || '').toLowerCase().includes(term);
      const matchBillItems = (tx.bill_data?.line_items || []).some((item) =>
        (item.name || '').toLowerCase().includes(term)
      );
      const matchMerchant = (tx.bill_data?.merchant || '').toLowerCase().includes(term);

      return matchTitle || matchDesc || matchCat || matchBillItems || matchMerchant;
    });
  }, [items, searchTerm]);

  // Group transactions chronologically by date
  const groupedTransactions = useMemo(() => {
    return filteredItems.reduce((acc, tx) => {
      const key = tx.date || 'Past Transactions';
      if (!acc[key]) acc[key] = [];
      acc[key].push(tx);
      return acc;
    }, {});
  }, [filteredItems]);

  const debitCount = filteredItems.filter((t) => t.type === 'DEBIT').length;
  const creditCount = filteredItems.filter((t) => t.type === 'CREDIT').length;

  return (
    <PageTransition className="space-y-4">
      {/* Search & Filters */}
      <div className="space-y-2.5">
        {/* Search Bar */}
        <div className="relative">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            size={16}
          />
          <input
            type="text"
            placeholder="Search by title, bill items, store or notes..."
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
              All ({filteredItems.length})
            </button>
            <button
              onClick={() => setActiveTab('DEBIT')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'DEBIT'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Expenses ({debitCount})
            </button>
            <button
              onClick={() => setActiveTab('CREDIT')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'CREDIT'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Income ({creditCount})
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
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title="No transactions found"
          description={
            searchTerm || selectedCategory || activeTab !== 'ALL'
              ? 'Try adjusting your filters or search terms.'
              : 'Start logging your spending, bills, and income to track cashflow.'
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
          className="space-y-5"
        >
          <AnimatePresence>
            {Object.entries(groupedTransactions).map(([dateKey, txList]) => {
              const headerTitle = formatDateHeader(dateKey);
              const dayTotal = txList.reduce((sum, tx) => {
                const amt = Number(tx.amount) || 0;
                return tx.type === 'DEBIT' ? sum - amt : sum + amt;
              }, 0);

              return (
                <div key={dateKey} className="space-y-2.5">
                  {/* Date Group Header */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <Calendar size={13} className="text-indigo-500" />
                      <span>{headerTitle}</span>
                      <span className="text-[11px] font-normal text-slate-400">
                        ({dateKey})
                      </span>
                    </div>
                    <span
                      className={`text-[11px] font-semibold ${
                        dayTotal < 0
                          ? 'text-rose-500'
                          : dayTotal > 0
                          ? 'text-emerald-500'
                          : 'text-slate-400'
                      }`}
                    >
                      {dayTotal < 0 ? '-' : dayTotal > 0 ? '+' : ''}₹
                      {Math.abs(dayTotal).toFixed(2)}
                    </span>
                  </div>

                  {/* Transactions on this date */}
                  <div className="space-y-2.5">
                    {txList.map((tx) => {
                      const isDebit = tx.type === 'DEBIT';
                      const catName = tx.category_details?.name || 'General';
                      const catColor = tx.category_details?.color || '#64748b';
                      const hasBillData = Boolean(tx.bill_data);

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
                          <GlassCard
                            onClick={() =>
                              dispatch(
                                openModal({
                                  name: 'TRANSACTION_DETAIL',
                                  data: tx,
                                })
                              )
                            }
                            className="p-3.5 sm:p-4 group border border-slate-200/70 dark:border-white/5 hover:border-indigo-500/40 hover:shadow-md dark:hover:bg-white/[0.03] transition-all cursor-pointer"
                          >
                            {/* Main Transaction Header */}
                            <div className="flex items-center justify-between gap-3">
                              {/* Left: Icon & Title & Meta */}
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                                    isDebit
                                      ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/20'
                                      : 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20'
                                  }`}
                                >
                                  {isDebit ? (
                                    <ArrowDownLeft size={18} />
                                  ) : (
                                    <ArrowUpRight size={18} />
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                      {tx.title}
                                    </h4>
                                    {hasBillData && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
                                        <ReceiptText size={11} /> Scanned Bill
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
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
                                        <span className="uppercase">
                                          {tx.payment_method.replace('_', ' ')}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Amount & Actions */}
                              <div className="flex items-center gap-3 shrink-0">
                                <span
                                  className={`text-base font-black tracking-tight ${
                                    isDebit
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-emerald-600 dark:text-emerald-400'
                                  }`}
                                >
                                  {isDebit ? '-' : '+'}₹
                                  {Number(tx.amount).toFixed(2)}
                                </span>

                                {/* Action buttons */}
                                <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEdit(tx);
                                    }}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                    title="Edit"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(tx.id, tx.title);
                                    }}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Additional Description Notes (if not repetitive) */}
                            {tx.description && !hasBillData && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 pl-13 line-clamp-2">
                                {tx.description}
                              </p>
                            )}

                            {/* Extracted Bill Data Breakdown with Split Action */}
                            {hasBillData && (
                              <BillDataAccordion
                                tx={tx}
                                billData={tx.bill_data}
                                defaultOpen={false}
                              />
                            )}
                          </GlassCard>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </AnimatePresence>

          {/* Token-based Pagination Infinite Scroll Sentinel & Loader */}
          {loadingMore && (
            <div className="pt-2">
              <SkeletonCard count={2} height="h-20" />
            </div>
          )}

          {/* Observer Sentinel Element */}
          <div ref={observerTarget} className="h-6 w-full pointer-events-none opacity-0" />

          {!hasMore && items.length > 5 && (
            <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
              <CheckCircle size={13} className="text-emerald-500" />
              <span>All transactions loaded</span>
            </div>
          )}
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
