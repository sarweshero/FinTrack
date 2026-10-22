import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Modal from '../ui/Modal';
import { closeModal, addToast } from '../../store/slices/uiSlice';
import { createDebt, updateDebt, fetchDebts } from '../../store/slices/debtSlice';
import { fetchReminders } from '../../store/slices/remindersSlice';
import { fetchDashboardData } from '../../store/slices/dashboardSlice';

const PeerDebtForm = ({ initialData, defaultType, onClose }) => {
  const dispatch = useDispatch();
  const [debtType, setDebtType] = useState(initialData?.debt_type || defaultType || 'GIVEN');
  const [personName, setPersonName] = useState(initialData?.person_name || '');
  const [phoneOrContact, setPhoneOrContact] = useState(initialData?.phone_or_contact || '');
  const [initialAmount, setInitialAmount] = useState(initialData?.initial_amount ? String(initialData.initial_amount) : '');
  const [dueDate, setDueDate] = useState(initialData?.due_date || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!personName.trim() || !initialAmount || Number(initialAmount) <= 0) {
      dispatch(addToast({ message: 'Please enter person name and positive amount', type: 'error' }));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        debt_type: debtType,
        person_name: personName.trim(),
        phone_or_contact: phoneOrContact.trim(),
        initial_amount: Number(initialAmount).toFixed(2),
        due_date: dueDate || null,
        notes: notes.trim(),
      };

      if (initialData?.id) {
        await dispatch(updateDebt({ id: initialData.id, data: payload })).unwrap();
        dispatch(addToast({ message: 'Debt record updated!', type: 'success' }));
      } else {
        await dispatch(createDebt(payload)).unwrap();
        dispatch(
          addToast({
            message: `${debtType === 'GIVEN' ? 'Money Given' : 'Money Borrowed'} recorded!`,
            type: 'success',
          })
        );
      }

      dispatch(fetchDebts());
      dispatch(fetchReminders());
      dispatch(fetchDashboardData(30));
      onClose();
    } catch (err) {
      dispatch(addToast({ message: err || 'Failed to save record', type: 'error' }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Toggle between Given and Borrowed */}
      <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5">
        <button
          type="button"
          onClick={() => setDebtType('GIVEN')}
          className={`py-2 text-xs font-semibold rounded-xl transition-all ${
            debtType === 'GIVEN'
              ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          I Gave Money (Owed to Me)
        </button>
        <button
          type="button"
          onClick={() => setDebtType('BORROWED')}
          className={`py-2 text-xs font-semibold rounded-xl transition-all ${
            debtType === 'BORROWED'
              ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          I Borrowed Money (I Owe)
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Person Name</label>
        <input
          type="text"
          required
          placeholder="e.g. John Doe, Alex, Landlord"
          value={personName}
          onChange={(e) => setPersonName(e.target.value)}
          className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 px-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Amount ($)</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400 dark:text-slate-500">$</span>
          <input
            type="number"
            step="0.01"
            required
            placeholder="0.00"
            value={initialAmount}
            onChange={(e) => setInitialAmount(e.target.value)}
            className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-3 pl-9 pr-4 text-slate-900 dark:text-white text-xl font-bold focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Contact / Phone (Optional)</label>
          <input
            type="text"
            placeholder="+1-555-0199"
            value={phoneOrContact}
            onChange={(e) => setPhoneOrContact(e.target.value)}
            className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 px-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Due Date (Optional)</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full bg-slate-100 dark:bg-[#161c2d] border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 px-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Notes / Purpose (Optional)</label>
        <textarea
          rows="2"
          placeholder="e.g. Dinner split, Concert advance, Car fix"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 px-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      <div className="pt-2 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className={`flex-1 py-3 px-4 rounded-2xl text-white font-semibold text-sm shadow-lg transition-all ${
            debtType === 'GIVEN'
              ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
              : 'gradient-primary-btn shadow-indigo-500/25'
          }`}
        >
          {submitting ? 'Saving...' : initialData?.id ? 'Update' : 'Save Record'}
        </button>
      </div>
    </form>
  );
};

export const PeerDebtModal = () => {
  const dispatch = useDispatch();
  const { activeModal } = useSelector((state) => state.ui);
  const isOpen = activeModal?.name === 'PEER_DEBT';

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => dispatch(closeModal())}
      title={
        activeModal?.data?.id
          ? 'Edit Debt / Loan'
          : activeModal?.defaultType === 'GIVEN'
          ? 'Track Money Given (They owe me)'
          : 'Track Money Borrowed (I owe them)'
      }
    >
      {isOpen && (
        <PeerDebtForm
          key={activeModal?.data?.id ? `edit-${activeModal.data.id}` : `new-${activeModal?.defaultType || 'GIVEN'}`}
          initialData={activeModal?.data}
          defaultType={activeModal?.defaultType}
          onClose={() => dispatch(closeModal())}
        />
      )}
    </Modal>
  );
};

export default PeerDebtModal;

