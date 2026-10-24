import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ReceiptText,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Store,
  CreditCard,
  Scissors,
} from 'lucide-react';
import { openModal } from '../../store/slices/uiSlice';

export default function BillDataAccordion({ tx, billData, defaultOpen = false }) {
  const dispatch = useDispatch();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const activeBill = billData || tx?.bill_data;
  if (!activeBill) return null;

  const lineItems = activeBill.line_items || [];
  const confidence = activeBill.confidence || 'high';
  const merchant = activeBill.merchant;
  const paymentMethod = activeBill.payment_method;

  const confidenceColor = {
    high: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    medium: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
    low: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
  }[confidence] || 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20';

  const handleOpenSplit = (e) => {
    e.stopPropagation();
    if (tx) {
      dispatch(
        openModal({
          name: 'SPLIT_TRANSACTION',
          data: { transaction: tx, lineItems },
        })
      );
    }
  };

  return (
    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-white/5">
      {/* Header bar / Toggle */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="w-full flex items-center justify-between text-left py-1 text-xs text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group/bill"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="p-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
            <ReceiptText size={13} />
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
            Scanned Bill Data
          </span>
          {lineItems.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200/60 dark:bg-white/10 font-medium text-slate-600 dark:text-slate-400 shrink-0">
              {lineItems.length} {lineItems.length === 1 ? 'item' : 'items'}
            </span>
          )}
          <span className={`text-[9px] px-1.5 py-0.2 rounded-full border uppercase tracking-wider font-semibold shrink-0 hidden sm:inline-block ${confidenceColor}`}>
            AI {confidence}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 shrink-0 pl-2">
          <span>{isOpen ? 'Hide items' : 'View breakdown'}</span>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Expanded Receipt Breakdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-2 p-3 rounded-xl bg-slate-50/80 dark:bg-black/25 border border-dashed border-slate-200 dark:border-white/10 space-y-2.5">
              {/* Merchant & Payment metadata if available */}
              {(merchant || paymentMethod) && (
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-dashed border-slate-200/80 dark:border-white/5 text-[11px]">
                  {merchant && (
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                      <Store size={12} className="text-slate-400" />
                      <span>{merchant}</span>
                    </div>
                  )}
                  {paymentMethod && (
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <CreditCard size={12} className="text-slate-400" />
                      <span>Method: <strong className="text-slate-700 dark:text-slate-200">{paymentMethod}</strong></span>
                    </div>
                  )}
                </div>
              )}

              {/* Line items list */}
              {lineItems.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 pb-1">
                    <span>Item</span>
                    <span className="text-right">Price (₹)</span>
                  </div>

                  {lineItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white/70 dark:bg-white/5 border border-slate-200/40 dark:border-white/5"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">
                          {item.name || `Item ${idx + 1}`}
                        </span>
                        {item.qty > 1 && (
                          <span className="text-[10px] text-slate-400">
                            Qty: {item.qty}
                          </span>
                        )}
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                        ₹{Number(item.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic py-1">
                  Bill parsed successfully (no separate itemized lines detected).
                </p>
              )}

              {/* Split products button directly inside accordion */}
              {tx && lineItems.length > 0 && (
                <div className="pt-1.5">
                  <button
                    type="button"
                    onClick={handleOpenSplit}
                    className="w-full py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-indigo-500/20"
                  >
                    <Scissors size={12} /> Split into {lineItems.length} Product Transactions
                  </button>
                </div>
              )}

              {/* Extracted Footer Notice */}
              <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 dark:text-slate-500">
                <span className="flex items-center gap-1">
                  <Sparkles size={11} className="text-indigo-400" />
                  Extracted via Gemini Vision
                </span>
                {activeBill.scanned_at && (
                  <span>
                    Scanned: {new Date(activeBill.scanned_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
