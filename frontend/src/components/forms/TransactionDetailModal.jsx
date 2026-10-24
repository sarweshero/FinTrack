import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Tag,
  CreditCard,
  Edit2,
  Trash2,
  FileText,
  ReceiptText,
  Sparkles,
  Store,
  Hash,
} from 'lucide-react';

import Modal from '../ui/Modal';
import { closeModal, openModal, addToast } from '../../store/slices/uiSlice';
import { deleteTransaction, fetchTransactions } from '../../store/slices/transactionSlice';
import { fetchDashboardData } from '../../store/slices/dashboardSlice';

export const TransactionDetailModal = () => {
  const dispatch = useDispatch();
  const activeModal = useSelector((state) => state.ui.activeModal);
  const isOpen = activeModal?.name === 'TRANSACTION_DETAIL';
  const tx = activeModal?.data;

  if (!isOpen || !tx) return null;

  const isDebit = tx.type === 'DEBIT';
  const catName = tx.category_details?.name || 'General';
  const catColor = tx.category_details?.color || '#64748b';
  const billData = tx.bill_data;
  const lineItems = billData?.line_items || [];

  const handleEdit = () => {
    dispatch(openModal({ name: 'TRANSACTION', data: tx }));
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete "${tx.title}"?`)) {
      try {
        await dispatch(deleteTransaction(tx.id)).unwrap();
        dispatch(addToast({ message: 'Transaction deleted successfully', type: 'info' }));
        dispatch(fetchDashboardData(30));
        dispatch(fetchTransactions());
        dispatch(closeModal());
      } catch (err) {
        dispatch(addToast({ message: err || 'Delete failed', type: 'error' }));
      }
    }
  };

  const formatFullDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => dispatch(closeModal())}
      title="Transaction Details"
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        {/* Hero Card */}
        <div
          className={`relative p-5 rounded-3xl overflow-hidden border ${
            isDebit
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {/* Ambient Glow */}
          <div
            className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-40 ${
              isDebit ? 'bg-rose-500' : 'bg-emerald-500'
            }`}
          />

          <div className="flex items-center justify-between mb-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                isDebit
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-300'
                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
              }`}
            >
              {isDebit ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
              {isDebit ? 'Expense (Debit)' : 'Income (Credit)'}
            </span>

            {billData && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-300">
                <ReceiptText size={12} />
                Scanned Bill
              </span>
            )}
          </div>

          <h2 className="text-3xl font-black tracking-tight mt-1">
            {isDebit ? '-' : '+'}₹
            {Number(tx.amount || 0).toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </h2>

          <p className="text-base font-bold text-slate-900 dark:text-white mt-1">
            {tx.title}
          </p>
        </div>

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Date */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
              <Calendar size={12} /> Date
            </span>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {formatFullDate(tx.date)}
            </p>
          </div>

          {/* Category */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
              <Tag size={12} /> Category
            </span>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                style={{ backgroundColor: catColor }}
              />
              <span className="truncate">{catName}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
              <CreditCard size={12} /> Payment Method
            </span>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase">
              {(tx.payment_method || 'OTHER').replace('_', ' ')}
            </p>
          </div>

          {/* Transaction ID */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
              <Hash size={12} /> Transaction ID
            </span>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-mono">
              #{tx.id}
            </p>
          </div>
        </div>

        {/* Description / Notes if present */}
        {tx.description && (
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 space-y-1">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <FileText size={12} /> Notes &amp; Description
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {tx.description}
            </p>
          </div>
        )}

        {/* Scanned Bill Itemized Breakdown */}
        {billData && (
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-black/30 border border-dashed border-indigo-500/30 dark:border-indigo-500/20 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-dashed border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                  <ReceiptText size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Extracted Bill Breakdown
                  </h4>
                  {billData.merchant && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Store size={11} /> {billData.merchant}
                    </p>
                  )}
                </div>
              </div>

              {billData.confidence && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                  {billData.confidence} Confidence
                </span>
              )}
            </div>

            {/* Line Items */}
            {lineItems.length > 0 ? (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 pb-1">
                  <span>Item Details</span>
                  <span className="text-right">Price</span>
                </div>

                {lineItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1.5 px-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                        {item.name || `Item ${idx + 1}`}
                      </span>
                      {item.qty > 1 && (
                        <span className="text-[10px] text-slate-400">
                          Qty: {item.qty}
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 shrink-0">
                      ₹{Number(item.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                Bill processed with overall total (no separate line items).
              </p>
            )}

            <div className="pt-2 flex items-center justify-between text-[11px] font-bold border-t border-dashed border-slate-200 dark:border-white/10">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Sparkles size={12} className="text-indigo-400" /> Auto-parsed by AI
              </span>
              <span className="text-slate-900 dark:text-white">
                Total: ₹{Number(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleDelete}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-semibold transition-all border border-rose-500/20"
          >
            <Trash2 size={15} /> Delete
          </button>
          <button
            type="button"
            onClick={handleEdit}
            className="flex-[2] flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs sm:text-sm font-semibold transition-all shadow-md shadow-indigo-500/20"
          >
            <Edit2 size={15} /> Edit Transaction
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default TransactionDetailModal;

