import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Modal from '../ui/Modal';
import { closeModal, addToast } from '../../store/slices/uiSlice';
import { settleDebt, fetchDebts } from '../../store/slices/debtSlice';
import { fetchReminders } from '../../store/slices/remindersSlice';
import { fetchDashboardData } from '../../store/slices/dashboardSlice';

export const SettleModal = () => {
  const dispatch = useDispatch();
  const { activeModal } = useSelector((state) => state.ui);

  const isOpen = activeModal?.name === 'SETTLE_DEBT';
  const debt = activeModal?.data || null;

  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setAmount('');
    setNotes('');
    dispatch(closeModal());
  };

  const handleFullPay = () => {
    if (debt?.remaining_amount) {
      setAmount(String(debt.remaining_amount));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0 || !debt?.id) {
      dispatch(addToast({ message: 'Please enter a valid payment amount', type: 'error' }));
      return;
    }

    setSubmitting(true);
    try {
      await dispatch(
        settleDebt({
          id: debt.id,
          amount: Number(amount).toFixed(2),
          notes: notes.trim(),
        })
      ).unwrap();

      dispatch(
        addToast({
          message: `Recorded payment of ₹${amount} for ${debt.person_name}!`,
          type: 'success',
        })
      );

      dispatch(fetchDebts());
      dispatch(fetchReminders());
      dispatch(fetchDashboardData(30));
      handleClose();
    } catch (err) {
      dispatch(addToast({ message: err || 'Settlement failed', type: 'error' }));
    } finally {
      setSubmitting(false);
    }
  };

  const isGiven = debt?.debt_type === 'GIVEN';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isGiven ? `Record Money Received from ${debt?.person_name}` : `Record Payment Returned to ${debt?.person_name}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
          <span>Total: ₹{Number(debt?.initial_amount || 0).toFixed(2)}</span>
          <span className="font-semibold text-amber-600 dark:text-amber-400">
            Remaining: ₹{Number(debt?.remaining_amount || 0).toFixed(2)}
          </span>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Payment Amount (₹)</label>
            <button
              type="button"
              onClick={handleFullPay}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold"
            >
              Pay Full (₹{Number(debt?.remaining_amount || 0).toFixed(2)})
            </button>
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400 dark:text-slate-500">₹</span>
            <input
              type="number"
              step="0.01"
              required
              autoFocus
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-3 pl-9 pr-4 text-slate-900 dark:text-white text-xl font-bold focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Note (Optional)</label>
          <input
            type="text"
            placeholder="e.g. Cash payment, GooglePay, Part 1"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 px-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="pt-2 flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-3 px-4 rounded-2xl text-white font-semibold text-sm gradient-emerald-btn shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all"
          >
            {submitting ? 'Recording...' : 'Confirm Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default SettleModal;

