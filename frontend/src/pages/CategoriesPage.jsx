import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { Tags, Plus, Trash2, Edit2 } from 'lucide-react';

import PageTransition from '../components/layout/PageTransition';
import GlassCard from '../components/ui/GlassCard';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import SkeletonCard from '../components/ui/SkeletonCard';
import FAB from '../components/ui/FAB';

import { fetchCategories, deleteCategory } from '../store/slices/categorySlice';
import { openModal, addToast } from '../store/slices/uiSlice';

export const CategoriesPage = () => {
  const dispatch = useDispatch();
  const { items, status } = useSelector((state) => state.categories);

  const [filterType, setFilterType] = useState('ALL');

  useEffect(() => {
    const params = {};
    if (filterType !== 'ALL') params.type = filterType;
    dispatch(fetchCategories(params));
  }, [dispatch, filterType]);

  const handleDelete = async (id, name, isDefault) => {
    if (isDefault) {
      dispatch(addToast({ message: 'Default categories cannot be deleted', type: 'error' }));
      return;
    }
    if (window.confirm(`Delete category "${name}"?`)) {
      try {
        await dispatch(deleteCategory(id)).unwrap();
        dispatch(addToast({ message: 'Category deleted', type: 'info' }));
      } catch (err) {
        dispatch(addToast({ message: err || 'Delete failed', type: 'error' }));
      }
    }
  };

  const openAdd = () => {
    dispatch(openModal({ name: 'CATEGORY' }));
  };

  return (
    <PageTransition className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Categories</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Classify your expenses and income sources</p>
        </div>

        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl gradient-primary-btn text-white text-xs font-semibold shadow-md shadow-indigo-500/20"
        >
          <Plus size={14} />
          <span>New Category</span>
        </button>
      </div>

      <div className="flex p-1 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5 text-xs font-semibold">
        <button
          onClick={() => setFilterType('ALL')}
          className={`flex-1 py-1.5 rounded-xl transition-all ${
            filterType === 'ALL'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilterType('EXPENSE')}
          className={`flex-1 py-1.5 rounded-xl transition-all ${
            filterType === 'EXPENSE'
              ? 'bg-rose-600 text-white shadow-md'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Expense
        </button>
        <button
          onClick={() => setFilterType('INCOME')}
          className={`flex-1 py-1.5 rounded-xl transition-all ${
            filterType === 'INCOME'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Income
        </button>
      </div>

      {status === 'loading' && items.length === 0 ? (
        <SkeletonCard count={4} height="h-20" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No categories found"
          description="Create categories to organize your financial transactions."
          actionLabel="Create Category"
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
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <AnimatePresence>
            {items.map((cat) => (
              <motion.div
                key={cat.id}
                variants={{
                  hidden: { opacity: 0, scale: 0.95 },
                  visible: { opacity: 1, scale: 1 },
                }}
                exit={{ opacity: 0, scale: 0.9 }}
                layout
              >
                <GlassCard className="p-3.5 sm:p-4 flex items-center justify-between gap-3 group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md"
                      style={{ backgroundColor: `${cat.color}25`, borderColor: `${cat.color}50`, borderWidth: 1 }}
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{cat.name}</h4>
                        {cat.is_default && (
                          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <Badge
                          variant={
                            cat.type === 'EXPENSE'
                              ? 'debit'
                              : cat.type === 'INCOME'
                              ? 'credit'
                              : 'neutral'
                          }
                          size="xs"
                        >
                          {cat.type}
                        </Badge>
                        <span>•</span>
                        <span>{cat.transaction_count || 0} transaction(s)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-70 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => dispatch(openModal({ name: 'CATEGORY', data: cat }))}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                    >
                      <Edit2 size={13} />
                    </button>
                    {!cat.is_default && (
                      <button
                        onClick={() => handleDelete(cat.id, cat.name, cat.is_default)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-500/10"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <FAB label="Category" onClick={openAdd} />
    </PageTransition>
  );
};

export default CategoriesPage;

