import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Modal from '../ui/Modal';
import { closeModal, addToast } from '../../store/slices/uiSlice';
import { createTransaction, updateTransaction, fetchTransactions } from '../../store/slices/transactionSlice';
import { fetchDashboardData } from '../../store/slices/dashboardSlice';

const TransactionForm = ({ initialData, defaultType, onClose }) => {
  const dispatch = useDispatch();
  const categories = useSelector((state) => state.categories.items);

  const [type, setType] = useState(initialData?.type || defaultType || 'DEBIT');
  const [title, setTitle] = useState(initialData?.title || '');
  const [amount, setAmount] = useState(initialData?.amount ? String(initialData.amount) : '');
  const [category, setCategory] = useState(initialData?.category || initialData?.category_details?.id || '');
  const [paymentMethod, setPaymentMethod] = useState(initialData?.payment_method || 'UPI');
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState(initialData?.description || '');
  const [submitting, setSubmitting] = useState(false);

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

  const filteredCategories = categories.filter(
    (c) => c.type === type || c.type === 'BOTH'
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Amount ($)</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">$</span>
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
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-slate-50 dark:bg-[#161c2d] border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 px-3 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#161c2d] transition-colors"
          >
            <option value="">Select Category</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
