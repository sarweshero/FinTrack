import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Modal from '../ui/Modal';
import { closeModal, addToast } from '../../store/slices/uiSlice';
import { createCategory, updateCategory, fetchCategories } from '../../store/slices/categorySlice';

const PRESET_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#64748B',
];

const CategoryForm = ({ initialData, onClose }) => {
  const dispatch = useDispatch();
  const existingCategories = useSelector((state) => state.categories.items);
  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState(initialData?.type || initialData?.defaultType || 'EXPENSE');
  const [color, setColor] = useState(initialData?.color || '#8B5CF6');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMessage('Category name is required');
      return;
    }

    const duplicate = existingCategories.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase() && c.id !== initialData?.id
    );
    if (duplicate) {
      setErrorMessage(`A category named "${trimmed}" already exists.`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: trimmed,
        type,
        color,
      };

      if (initialData?.id) {
        await dispatch(updateCategory({ id: initialData.id, data: payload })).unwrap();
        dispatch(addToast({ message: 'Category updated successfully!', type: 'success' }));
      } else {
        await dispatch(createCategory(payload)).unwrap();
        dispatch(addToast({ message: 'Category created successfully!', type: 'success' }));
      }

      dispatch(fetchCategories());
      onClose();
    } catch (err) {
      const msg = err?.message || (typeof err === 'string' ? err : 'Failed to save category');
      setErrorMessage(msg);
      dispatch(addToast({ message: msg, type: 'error' }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
          {errorMessage}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Category Name</label>
        <input
          type="text"
          required
          autoFocus
          placeholder="e.g. Subscriptions, Gaming, Healthcare"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errorMessage) setErrorMessage('');
          }}
          className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 px-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-transparent transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Category Scope</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full bg-slate-50 dark:bg-[#161c2d] border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 px-3 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-[#161c2d] transition-colors"
        >
          <option value="EXPENSE">Expense Only</option>
          <option value="INCOME">Income Only</option>
          <option value="BOTH">Both (Expense & Income)</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Theme Color</label>
        <div className="flex flex-wrap gap-2.5 pt-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full border-2 transition-transform ${
                color === c ? 'scale-125 border-slate-900 dark:border-white shadow-lg' : 'border-transparent hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
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
          className="flex-1 py-3 px-4 rounded-2xl text-white font-semibold text-sm gradient-primary-btn shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all disabled:opacity-50"
        >
          {submitting ? 'Saving...' : initialData?.id ? 'Update' : 'Create Category'}
        </button>
      </div>
    </form>
  );
};

export const CategoryModal = () => {
  const dispatch = useDispatch();
  const { activeModal } = useSelector((state) => state.ui);
  const isOpen = activeModal?.name === 'CATEGORY';

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => dispatch(closeModal())}
      title={activeModal?.data?.id ? 'Edit Category' : 'Create Category'}
    >
      {isOpen && (
        <CategoryForm
          key={activeModal?.data?.id ? `edit-${activeModal.data.id}` : 'new'}
          initialData={activeModal?.data}
          onClose={() => dispatch(closeModal())}
        />
      )}
    </Modal>
  );
};

export default CategoryModal;

