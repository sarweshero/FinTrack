import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Plus, X, ReceiptText, Sparkles, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { closeModal, addToast } from '../../store/slices/uiSlice';
import { createTransaction, updateTransaction, fetchTransactions } from '../../store/slices/transactionSlice';
import { fetchCategories, createCategory } from '../../store/slices/categorySlice';
import { fetchDashboardData } from '../../store/slices/dashboardSlice';
import { categoryAPI } from '../../api/categoryAPI';

const PRESET_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#64748B',
];

const TransactionForm = ({ initialData, defaultType, onClose }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const categories = useSelector((state) => state.categories.items);

  const [type, setType] = useState(initialData?.type || defaultType || 'DEBIT');
  const [title, setTitle] = useState(initialData?.title || '');
  const [amount, setAmount] = useState(initialData?.amount ? String(initialData.amount) : '');
  const [category, setCategory] = useState(initialData?.category || initialData?.category_details?.id || '');
  const [paymentMethod, setPaymentMethod] = useState(initialData?.payment_method || 'UPI');
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState(initialData?.description || '');
  const [submitting, setSubmitting] = useState(false);

  // AI Auto-mapping State
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [userOverrodeCategory, setUserOverrodeCategory] = useState(false);

  // Inline Category Quick Add State
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#8B5CF6');
  const [creatingCat, setCreatingCat] = useState(false);
  const [catError, setCatError] = useState('');

  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  // Debounced AI Category Auto-mapping
  useEffect(() => {
    if (initialData?.id) return;
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3) {
      setAiSuggestion(null);
      return;
    }

    const timer = setTimeout(async () => {
      if (userOverrodeCategory && category) return;

      setAiSuggesting(true);
      try {
        const res = await categoryAPI.suggest({
          title: trimmedTitle,
          description: description.trim(),
          type,
        });
        if (res.data?.category_id) {
          setAiSuggestion(res.data);
          if (!category) {
            setCategory(String(res.data.category_id));
          }
        }
      } catch (err) {
        console.debug('AI auto-mapping error:', err);
      } finally {
        setAiSuggesting(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [title, description, type, category, userOverrodeCategory, initialData?.id]);

  const handleManualAutoMap = async () => {
    const query = title.trim() || description.trim();
    if (!query) {
      dispatch(addToast({ message: 'Enter a title or note first to auto-map category', type: 'info' }));
      return;
    }
    setAiSuggesting(true);
    try {
      const res = await categoryAPI.suggest({
        title: title.trim(),
        description: description.trim(),
        type,
      });
      if (res.data?.category_id) {
        setAiSuggestion(res.data);
        setCategory(String(res.data.category_id));
        setUserOverrodeCategory(false);
        dispatch(addToast({
          message: `✨ AI auto-mapped to "${res.data.category_name}"`,
          type: 'success',
        }));
      } else {
        dispatch(addToast({ message: 'AI could not find a confident category match', type: 'info' }));
      }
    } catch (err) {
      dispatch(addToast({ message: 'Failed to auto-map category', type: 'error' }));
    } finally {
      setAiSuggesting(false);
    }
  };

  const handleQuickAddCategory = async (e) => {
    if (e) e.preventDefault();
    setCatError('');
    const trimmed = newCatName.trim();
    if (!trimmed) {
      setCatError('Category name is required');
      return;
    }
    const dup = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (dup) {
      setCategory(dup.id);
      setShowAddCategory(false);
      setNewCatName('');
      dispatch(addToast({ message: `Selected existing category "${dup.name}"`, type: 'info' }));
      return;
    }

    setCreatingCat(true);
    try {
      const catScope = type === 'DEBIT' ? 'EXPENSE' : 'INCOME';
      const created = await dispatch(
        createCategory({
          name: trimmed,
          type: catScope,
          color: newCatColor,
        })
      ).unwrap();

      setCategory(created.id);
      dispatch(addToast({ message: `Category "${created.name}" created!`, type: 'success' }));
      setNewCatName('');
      setShowAddCategory(false);
      dispatch(fetchCategories());
    } catch (err) {
      const msg = err?.message || (typeof err === 'string' ? err : 'Failed to add category');
      setCatError(msg);
      dispatch(addToast({ message: msg, type: 'error' }));
    } finally {
      setCreatingCat(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !amount || Number(amount) <= 0) {
      dispatch(addToast({ message: 'Please enter a valid title and positive amount', type: 'error' }));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        type,
        title: title.trim(),
        amount: Number(amount).toFixed(2),
        category: category ? Number(category) : null,
        payment_method: paymentMethod,
        date,
        description: description.trim(),
      };

      if (initialData?.id) {
        await dispatch(updateTransaction({ id: initialData.id, data: payload })).unwrap();
        dispatch(addToast({ message: 'Transaction updated successfully!', type: 'success' }));
      } else {
        await dispatch(createTransaction(payload)).unwrap();
        dispatch(addToast({ message: `${type === 'DEBIT' ? 'Expense' : 'Income'} recorded!`, type: 'success' }));
      }

      dispatch(fetchDashboardData(30));
      dispatch(fetchTransactions());
      onClose();
    } catch (err) {
      dispatch(addToast({ message: err || 'Failed to save transaction', type: 'error' }));
    } finally {
      setSubmitting(false);
    }
  };

  const targetCategoryType = type === 'DEBIT' ? 'EXPENSE' : 'INCOME';
  const matchingCategories = categories.filter(
    (c) => c.type === targetCategoryType || c.type === 'BOTH'
  );
  const otherCategories = categories.filter(
    (c) => c.type !== targetCategoryType && c.type !== 'BOTH'
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Upload & Split Bill Banner (when adding new) */}
      {!initialData && (
        <div className="flex items-center justify-between p-2.5 rounded-2xl bg-indigo-500/10 border border-dashed border-indigo-500/25 text-xs">
          <div className="flex items-center gap-2">
            <ReceiptText size={16} className="text-indigo-500 shrink-0" />
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs">Have a receipt?</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Scan to extract &amp; split products</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              dispatch(closeModal());
              navigate('/scan-bill');
            }}
            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition-colors shadow-sm shrink-0"
          >
            Scan &amp; Split
          </button>
        </div>
      )}

      {/* Type toggle */}
      <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5">
        <button
          type="button"
          onClick={() => setType('DEBIT')}
          className={`py-2 text-xs font-semibold rounded-xl transition-all ${
            type === 'DEBIT'
              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          Debit (Expense)
        </button>
        <button
          type="button"
          onClick={() => setType('CREDIT')}
          className={`py-2 text-xs font-semibold rounded-xl transition-all ${
            type === 'CREDIT'
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          Credit (Income)
        </button>
      </div>

      {/* Amount Input */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Amount (₹)</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">₹</span>
          <input
            type="number"
            step="0.01"
            required
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-3 pl-9 pr-4 text-slate-900 dark:text-white text-xl font-bold placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-transparent transition-colors"
          />
        </div>
      </div>

      {/* Title Input */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Title / Note</label>
        <input
          type="text"
          required
          placeholder="e.g. Supermarket, Salary, Coffee"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 px-4 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-transparent transition-colors"
        />
      </div>

      {/* Category & Payment Method */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
              Category <span className="font-normal text-[11px] opacity-75">(Optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleManualAutoMap}
                disabled={aiSuggesting || (!title.trim() && !description.trim())}
                title="Auto-map category with AI"
                className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 flex items-center gap-1 transition-colors disabled:opacity-40"
              >
                {aiSuggesting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                <span>Auto-map</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddCategory(!showAddCategory);
                  setCatError('');
                }}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <Plus size={12} />
                <span>{showAddCategory ? 'Cancel' : 'New'}</span>
              </button>
            </div>
          </div>
          <select
            value={category}
            onChange={(e) => {
              if (e.target.value === '__NEW__') {
                setShowAddCategory(true);
              } else {
                setCategory(e.target.value);
                setUserOverrodeCategory(true);
              }
            }}
            className="w-full bg-slate-50 dark:bg-[#161c2d] border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 px-3 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#161c2d] transition-colors"
          >
            <option value="">No Category (Optional)</option>
            {matchingCategories.length > 0 && (
              <optgroup label={`${type === 'DEBIT' ? 'Expense' : 'Income'} Categories`}>
                {matchingCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
            {otherCategories.length > 0 && (
              <optgroup label="Other Categories">
                {otherCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </optgroup>
            )}
            <option value="__NEW__">+ Create New Category...</option>
          </select>

          {/* AI Auto-mapped indicator */}
          {aiSuggestion && String(category) === String(aiSuggestion.category_id) && (
            <div className="mt-1.5 flex items-center justify-between px-2.5 py-1 rounded-xl bg-violet-500/10 border border-violet-500/20 text-[11px] text-violet-700 dark:text-violet-300 animate-fadeIn">
              <span className="flex items-center gap-1.5 font-medium truncate">
                <Sparkles size={12} className="text-violet-500 shrink-0" />
                <span>AI Mapped: <strong className="font-semibold">{aiSuggestion.category_name}</strong></span>
                {aiSuggestion.reason && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate hidden sm:inline">
                    ({aiSuggestion.reason})
                  </span>
                )}
              </span>
              <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-700 dark:text-violet-300 shrink-0 ml-1">
                {aiSuggestion.confidence}
              </span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full bg-slate-50 dark:bg-[#161c2d] border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 px-3 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#161c2d] transition-colors"
          >
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CREDIT_CARD">Credit Card</option>
            <option value="DEBIT_CARD">Debit Card</option>
            <option value="CASH">Cash</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      {/* Inline Quick Category Creator */}
      {showAddCategory && (
        <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/20 space-y-2.5 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
              Quick Add {type === 'DEBIT' ? 'Expense' : 'Income'} Category
            </span>
            <button
              type="button"
              onClick={() => setShowAddCategory(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={14} />
            </button>
          </div>

          {catError && (
            <p className="text-[11px] text-rose-500 font-medium">{catError}</p>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              autoFocus
              placeholder="e.g. Subscriptions, Gaming, Fuel"
              value={newCatName}
              onChange={(e) => {
                setNewCatName(e.target.value);
                if (catError) setCatError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleQuickAddCategory();
                }
              }}
              className="flex-1 bg-white dark:bg-[#0f1422] border border-slate-200 dark:border-white/10 rounded-xl py-2 px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              disabled={creatingCat || !newCatName.trim()}
              onClick={handleQuickAddCategory}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-white gradient-primary-btn disabled:opacity-50 shrink-0 shadow-sm"
            >
              {creatingCat ? 'Adding...' : 'Add'}
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mr-1">Color:</span>
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewCatColor(c)}
                className={`w-5 h-5 rounded-full border transition-transform ${
                  newCatColor === c ? 'scale-125 border-indigo-600 dark:border-white' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Date Input */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Date</label>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-slate-50 dark:bg-[#161c2d] border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 px-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#161c2d] transition-colors"
        />
      </div>

      {/* Description Input */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Description (Optional)</label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Notes or details about this transaction..."
          className="w-full bg-slate-50 dark:bg-[#161c2d] border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 px-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#161c2d] transition-colors resize-none"
        />
      </div>

      {/* Submit */}
      <div className="pt-2 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300 border border-slate-200 dark:border-white/10 font-semibold text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className={`flex-1 py-3 px-4 rounded-2xl text-white font-semibold text-sm transition-all shadow-lg ${
            type === 'DEBIT'
              ? 'gradient-rose-btn shadow-rose-500/25 hover:shadow-rose-500/40'
              : 'gradient-emerald-btn shadow-emerald-500/25 hover:shadow-emerald-500/40'
          }`}
        >
          {submitting ? 'Saving...' : initialData?.id ? 'Update' : `Add ${type === 'DEBIT' ? 'Expense' : 'Income'}`}
        </button>
      </div>
    </form>
  );
};

export const TransactionModal = () => {
  const dispatch = useDispatch();
  const { activeModal } = useSelector((state) => state.ui);
  const isOpen = activeModal?.name === 'TRANSACTION';

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => dispatch(closeModal())}
      title={
        activeModal?.data?.id
          ? 'Edit Transaction'
          : activeModal?.defaultType === 'CREDIT'
          ? 'Add Income (Credit)'
          : 'Add Expense (Debit)'
      }
    >
      {isOpen && (
        <TransactionForm
          key={activeModal?.data?.id ? `edit-${activeModal.data.id}` : `new-${activeModal?.defaultType || 'DEBIT'}`}
          initialData={activeModal?.data}
          defaultType={activeModal?.defaultType}
          onClose={() => dispatch(closeModal())}
        />
      )}
    </Modal>
  );
};

export default TransactionModal;
