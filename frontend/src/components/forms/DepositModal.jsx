import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Modal from '../ui/Modal';
import { closeModal, addToast } from '../../store/slices/uiSlice';
import { depositSavings, fetchSavingsGoals } from '../../store/slices/savingsSlice';
import { fetchDashboardData } from '../../store/slices/dashboardSlice';

export const DepositModal = () => {
  const dispatch = useDispatch();
  const { activeModal } = useSelector((state) => state.ui);

  const isOpen = activeModal?.name === 'DEPOSIT';
  const goal = activeModal?.data || null;

  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setAmount('');
    setNotes('');
    dispatch(closeModal());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0 || !goal?.id) {
      dispatch(addToast({ message: 'Please enter a valid deposit amount', type: 'error' }));
      return;
    }

    setSubmitting(true);
    try {
      await dispatch(
        depositSavings({
          id: goal.id,
          amount: Number(amount).toFixed(2),
          notes: notes.trim(),
        })
      ).unwrap();

      dispatch(addToast({ message: `Deposited ₹${amount} to ${goal.title}!`, type: 'success' }));
      dispatch(fetchSavingsGoals());
      dispatch(fetchDashboardData(30));
      handleClose();
    } catch (err) {
      dispatch(addToast({ message: err || 'Deposit failed', type: 'error' }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Add Funds to "${goal?.title || 'Goal'}"`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
          <span>Target: ₹{Number(goal?.target_amount || 0).toFixed(2)}</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            Current: ₹{Number(goal?.current_amount || 0).toFixed(2)} ({goal?.progress_percentage || 0}%)
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Deposit Amount (₹)</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">₹</span>
            <input
              type="number"
              step="0.01"
              required
              autoFocus
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-3 pl-9 pr-4 text-slate-900 dark:text-white text-xl font-bold focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-transparent transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Note (Optional)</label>
          <input
            type="text"
            placeholder="e.g. Weekly savings, Salary bonus"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 px-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-transparent transition-colors"
          />
        </div>

        <div className="pt-2 flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300 border border-slate-200 dark:border-white/10 font-semibold text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-3 px-4 rounded-2xl text-white font-semibold text-sm gradient-emerald-btn shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all"
          >
            {submitting ? 'Depositing...' : 'Confirm Deposit'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default DepositModal;

