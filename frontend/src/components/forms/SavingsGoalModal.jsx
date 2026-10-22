import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Modal from '../ui/Modal';
import { closeModal, addToast } from '../../store/slices/uiSlice';
import { createSavingsGoal, updateSavingsGoal, fetchSavingsGoals } from '../../store/slices/savingsSlice';
import { fetchDashboardData } from '../../store/slices/dashboardSlice';

const SavingsGoalForm = ({ initialData, onClose }) => {
  const dispatch = useDispatch();
  const [title, setTitle] = useState(initialData?.title || '');
  const [targetAmount, setTargetAmount] = useState(initialData?.target_amount ? String(initialData.target_amount) : '');
  const [targetDate, setTargetDate] = useState(initialData?.target_date || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !targetAmount || Number(targetAmount) <= 0) {
      dispatch(addToast({ message: 'Please provide goal title and positive target amount', type: 'error' }));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        target_amount: Number(targetAmount).toFixed(2),
        target_date: targetDate || null,
      };

      if (initialData?.id) {
        await dispatch(updateSavingsGoal({ id: initialData.id, data: payload })).unwrap();
        dispatch(addToast({ message: 'Goal updated successfully!', type: 'success' }));
      } else {
        await dispatch(createSavingsGoal(payload)).unwrap();
        dispatch(addToast({ message: 'New savings goal created!', type: 'success' }));
      }

      dispatch(fetchSavingsGoals());
      dispatch(fetchDashboardData(30));
      onClose();
    } catch (err) {
      dispatch(addToast({ message: err || 'Failed to save savings goal', type: 'error' }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Goal Name</label>
        <input
          type="text"
          required
          placeholder="e.g. Emergency Fund, New Laptop, Vacation"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 px-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-transparent transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Target Amount (₹)</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">₹</span>
          <input
            type="number"
            step="0.01"
            required
            placeholder="1000.00"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-3 pl-9 pr-4 text-slate-900 dark:text-white text-xl font-bold focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-transparent transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Target Date (Optional)</label>
        <input
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="w-full bg-slate-50 dark:bg-[#161c2d] border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 px-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#161c2d] transition-colors"
        />
      </div>

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
          className="flex-1 py-3 px-4 rounded-2xl text-white font-semibold text-sm gradient-primary-btn shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all"
        >
          {submitting ? 'Saving...' : initialData?.id ? 'Update Goal' : 'Create Goal'}
        </button>
      </div>
    </form>
  );
};

export const SavingsGoalModal = () => {
  const dispatch = useDispatch();
  const { activeModal } = useSelector((state) => state.ui);
  const isOpen = activeModal?.name === 'SAVINGS_GOAL';

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => dispatch(closeModal())}
      title={activeModal?.data?.id ? 'Edit Savings Goal' : 'Create Savings Goal'}
    >
      {isOpen && (
        <SavingsGoalForm
          key={activeModal?.data?.id ? `edit-${activeModal.data.id}` : 'new'}
          initialData={activeModal?.data}
          onClose={() => dispatch(closeModal())}
        />
      )}
    </Modal>
  );
};

export default SavingsGoalModal;

