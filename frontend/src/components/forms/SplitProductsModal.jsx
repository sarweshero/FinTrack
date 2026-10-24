import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Scissors,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Split,
  Tag,
} from 'lucide-react';

import Modal from '../ui/Modal';
import { closeModal, addToast } from '../../store/slices/uiSlice';
import { fetchTransactions } from '../../store/slices/transactionSlice';
import { fetchDashboardData } from '../../store/slices/dashboardSlice';
import { transactionAPI } from '../../api/transactionAPI';

export const SplitProductsModal = () => {
  const dispatch = useDispatch();
  const activeModal = useSelector((state) => state.ui.activeModal);
  const categories = useSelector((state) => state.categories.items);

  const isOpen = activeModal?.name === 'SPLIT_TRANSACTION';
  const tx = activeModal?.data?.transaction;
  const initialLineItems = activeModal?.data?.lineItems || tx?.bill_data?.line_items || [];

  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Initialize split product rows whenever modal opens with a transaction
  useEffect(() => {
    if (!isOpen || !tx) return;

    if (initialLineItems && initialLineItems.length > 0) {
      setItems(
        initialLineItems.map((item, idx) => ({
          id: idx + 1,
          title: item.name || `Product ${idx + 1}`,
          amount: String(item.price || ''),
          category_id: tx.category || tx.category_details?.id || '',
          notes: item.qty > 1 ? `Qty: ${item.qty}` : '',
        }))
      );
    } else {
      // Default to 2 equal halves if no line items are attached
      const half = (Number(tx.amount || 0) / 2).toFixed(2);
      setItems([
        {
          id: 1,
          title: `${tx.title} (Part 1)`,
          amount: String(half),
          category_id: tx.category || tx.category_details?.id || '',
          notes: '',
        },
        {
          id: 2,
          title: `${tx.title} (Part 2)`,
          amount: String((Number(tx.amount || 0) - Number(half)).toFixed(2)),
          category_id: tx.category || tx.category_details?.id || '',
          notes: '',
        },
      ]);
    }
    setError('');
  }, [isOpen, tx]);

  if (!isOpen || !tx) return null;

  const targetTotal = Number(tx.amount || 0);
  const currentSum = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const diff = Math.round((targetTotal - currentSum) * 100) / 100;
  const isMatch = Math.abs(diff) < 0.05;

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleAddItem = () => {
    const remaining = diff > 0 ? diff.toFixed(2) : '0.00';
    setItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        title: '',
        amount: remaining,
        category_id: tx.category || tx.category_details?.id || '',
        notes: '',
      },
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) {
      setError('You need at least 1 product item.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirmSplit = async () => {
    setError('');
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.title.trim()) {
        setError(`Item #${i + 1} requires a product title.`);
        return;
      }
      const amt = parseFloat(item.amount);
      if (isNaN(amt) || amt <= 0) {
        setError(`Item #${i + 1} requires a valid positive amount in ₹.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payloadItems = items.map((item) => ({
        title: item.title.trim(),
        amount: parseFloat(item.amount),
        category_id: item.category_id ? parseInt(item.category_id) : null,
        notes: item.notes?.trim() || '',
      }));

      await transactionAPI.split(tx.id, payloadItems);

      dispatch(addToast({
        message: `Successfully split "${tx.title}" into ${items.length} product transactions!`,
        type: 'success',
      }));

      dispatch(fetchDashboardData(30));
      dispatch(fetchTransactions());
      dispatch(closeModal());
    } catch (err) {
      setError(err.message || 'Failed to split transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => dispatch(closeModal())}
      title="Split Spending Products"
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {/* Header Summary Banner */}
        <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Split size={16} className="text-indigo-500 shrink-0" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">
                {tx.title}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Splitting into individual product transactions
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400">Target Total</span>
            <p className="text-sm font-black text-slate-900 dark:text-white">
              ₹{targetTotal.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Error notice */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Product Rows List */}
        <div className="space-y-3 max-h-[48vh] overflow-y-auto pr-1">
          {items.map((item, index) => (
            <div
              key={item.id || index}
              className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 space-y-2 relative group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Product #{index + 1}
                </span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                    title="Remove item"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* Title */}
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => handleItemChange(index, 'title', e.target.value)}
                    placeholder="Product name (e.g. Milk, Rice)"
                    className="w-full rounded-xl px-3 py-2 text-xs bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Amount */}
                <div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.amount}
                      onChange={(e) => handleItemChange(index, 'amount', e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-xl pl-6 pr-3 py-2 text-xs bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Category picker & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div>
                  <select
                    value={item.category_id}
                    onChange={(e) => handleItemChange(index, 'category_id', e.target.value)}
                    className="w-full rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">— Select Category —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <input
                    type="text"
                    value={item.notes}
                    onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                    placeholder="Optional item notes / qty…"
                    className="w-full rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add Row Button */}
        <button
          type="button"
          onClick={handleAddItem}
          className="w-full py-2 rounded-xl border border-dashed border-indigo-400/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/5 transition-colors text-xs font-semibold flex items-center justify-center gap-1.5"
        >
          <Plus size={14} /> Add Another Product
        </button>

        {/* Calculation / Reconciliation Bar */}
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">
              Sum of Products
            </span>
            <span className="font-bold text-slate-900 dark:text-white text-sm">
              ₹{currentSum.toFixed(2)}
            </span>
          </div>

          <div className="text-right">
            {isMatch ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                <CheckCircle2 size={14} /> Sum matches total
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold text-xs">
                <AlertCircle size={14} /> {diff > 0 ? `₹${diff.toFixed(2)} remaining` : `₹${Math.abs(diff).toFixed(2)} over`}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => dispatch(closeModal())}
            className="flex-1 py-3 rounded-2xl glass-panel border border-slate-200 dark:border-white/10 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmSplit}
            disabled={submitting}
            className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold transition-all shadow-md shadow-indigo-500/20"
          >
            {submitting ? (
              'Splitting…'
            ) : (
              <>
                <Scissors size={15} /> Confirm Split into {items.length} Products
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default SplitProductsModal;

