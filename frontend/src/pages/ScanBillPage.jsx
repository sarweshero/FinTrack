import { useState, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  Upload,
  X,
  ScanLine,
  CheckCircle2,
  AlertCircle,
  RefreshCcw,
  Save,
  ChevronDown,
  ChevronUp,
  ArrowDownLeft,
  ArrowUpRight,
  Zap,
  Edit3,
  ListOrdered,
  FileText,
} from 'lucide-react';

import PageTransition from '../components/layout/PageTransition';
import GlassCard from '../components/ui/GlassCard';
import SkeletonReceipt from '../components/ui/SkeletonReceipt';
import { billAPI } from '../api/billAPI';
import { transactionAPI } from '../api/transactionAPI';
import { addToast } from '../store/slices/uiSlice';
import { fetchCategories } from '../store/slices/categorySlice';
import { fetchDashboardData } from '../store/slices/dashboardSlice';
import { fetchTransactions } from '../store/slices/transactionSlice';

// ── Accepted image MIME types ─────────────────────────────────────────────────
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';
const MAX_MB = 10;

// ── Payment method labels ─────────────────────────────────────────────────────
const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'DEBIT_CARD', label: 'Debit Card' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'OTHER', label: 'Other' },
];

export default function ScanBillPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const categories = useSelector((s) => s.categories.items ?? []);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const dropRef = useRef(null);

  // ── State machine: idle | scanning | completed | review | error ──────────────
  const [phase, setPhase] = useState('idle');
  const [statusMessage, setStatusMessage] = useState('Uploading image…');
  const [preview, setPreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lineItemsOpen, setLineItemsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Created transaction from background auto-update
  const [createdTx, setCreatedTx] = useState(null);

  // ── Review form fields ────────────────────────────────────────────────────
  const [form, setForm] = useState({
    type: 'DEBIT',
    title: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    category: '',
    payment_method: 'OTHER',
    description: '',
  });
  const [lineItems, setLineItems] = useState([]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const loadPreview = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const validateFile = (file) => {
    if (!file) return 'No file selected.';
    if (!file.type.startsWith('image/')) return 'Only image files are accepted.';
    if (file.size > MAX_MB * 1024 * 1024) return `File too large. Max ${MAX_MB} MB.`;
    return null;
  };

  const handleFile = useCallback(
    async (file) => {
      const err = validateFile(file);
      if (err) {
        setErrorMsg(err);
        setPhase('error');
        return;
      }
      setImageFile(file);
      loadPreview(file);
      setPhase('scanning');
      setStatusMessage('Uploading and compressing image…');
      setErrorMsg('');
      setCreatedTx(null);

      try {
        if (categories.length === 0) {
          dispatch(fetchCategories());
        }

        // Step 1: Upload (returns HTTP 202 immediately in <300ms)
        const uploadRes = await billAPI.scan(file);
        const taskId = uploadRes.task_id;

        setStatusMessage('AI analyzing bill & extracting line items…');

        // Step 2: Poll background task
        const finalTask = await billAPI.pollUntilDone(taskId, {
          intervalMs: 1500,
          maxAttempts: 30,
          onProgress: (taskData, attempt) => {
            if (attempt > 2) {
              setStatusMessage('Extracting merchant, totals & updating balance…');
            }
          },
        });

        const extracted = finalTask.extracted_data || {};
        const tx = finalTask.transaction;

        // Sync Redux store so UI balance immediately reflects the new transaction
        dispatch(fetchDashboardData());
        dispatch(fetchTransactions());

        setForm({
          type: tx?.type || extracted.type || 'DEBIT',
          title: tx?.title || extracted.title || 'Scanned Bill',
          amount: tx?.amount != null ? String(tx.amount) : extracted.amount != null ? String(extracted.amount) : '',
          date: tx?.date || extracted.date || new Date().toISOString().slice(0, 10),
          category: tx?.category != null ? String(tx.category) : extracted.category_id != null ? String(extracted.category_id) : '',
          payment_method: tx?.payment_method || extracted.payment_method || 'OTHER',
          description: tx?.description || '',
        });
        setLineItems(extracted.line_items || []);

        if (tx) {
          setCreatedTx(tx);
          setPhase('completed');
          dispatch(addToast({ message: `₹${tx.amount} auto-saved to ledger! Balance updated.`, type: 'success' }));
        } else {
          // If no amount was detected, go to review so user can confirm
          setPhase('review');
        }
      } catch (e) {
        setErrorMsg(e.message || 'Scan failed. Please try again.');
        setPhase('error');
      }
    },
    [dispatch, categories.length],
  );

  // ── Drop zone events ──────────────────────────────────────────────────────
  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);

  // ── Save or update transaction ────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim()) {
      dispatch(addToast({ message: 'Title is required.', type: 'error' }));
      return;
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      dispatch(addToast({ message: 'Enter a valid amount in ₹.', type: 'error' }));
      return;
    }

    setSaving(true);
    try {
      if (createdTx?.id) {
        // Update the auto-created transaction
        await transactionAPI.update(createdTx.id, {
          type: form.type,
          title: form.title.trim(),
          amount: parseFloat(form.amount),
          date: form.date,
          category: form.category ? parseInt(form.category) : null,
          payment_method: form.payment_method,
          description: form.description.trim(),
        });
        dispatch(addToast({ message: 'Transaction updated successfully!', type: 'success' }));
      } else {
        // Create new transaction
        await transactionAPI.create({
          type: form.type,
          title: form.title.trim(),
          amount: parseFloat(form.amount),
          date: form.date,
          category: form.category ? parseInt(form.category) : null,
          payment_method: form.payment_method,
          description: form.description.trim(),
        });
        dispatch(addToast({ message: 'Transaction saved to ledger!', type: 'success' }));
      }

      dispatch(fetchDashboardData());
      dispatch(fetchTransactions());
      setPhase('completed');
    } catch (e) {
      dispatch(addToast({ message: e.message || 'Failed to save transaction.', type: 'error' }));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setPhase('idle');
    setPreview(null);
    setImageFile(null);
    setCreatedTx(null);
    setLineItems([]);
    setErrorMsg('');
    setLineItemsOpen(false);
    setForm({
      type: 'DEBIT',
      title: '',
      amount: '',
      date: new Date().toISOString().slice(0, 10),
      category: '',
      payment_method: 'OTHER',
      description: '',
    });
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const inputCls =
    'w-full rounded-xl px-3 py-2 text-sm bg-white/60 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition placeholder:text-slate-400 dark:placeholder:text-slate-500';

  const labelCls = 'text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block';

  return (
    <PageTransition>
      <div className="max-w-lg mx-auto space-y-4 py-2">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
            <ScanLine size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Smart Bill Scanner</h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Upload receipt • AI parses &amp; auto-updates your balance
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
            <Zap size={11} />
            Background Sync
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* ── IDLE — Upload Zone ── */}
          {phase === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <div
                ref={dropRef}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                className={`relative rounded-3xl border-2 border-dashed transition-all p-8 text-center cursor-pointer
                  ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_30px_rgba(99,102,241,0.25)]'
                      : 'border-slate-200 dark:border-white/10 bg-white/40 dark:bg-white/3 hover:border-indigo-400 hover:bg-indigo-500/5'
                  }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/15 flex items-center justify-center">
                    <Upload size={28} className="text-indigo-500 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                      Drop your bill or receipt here
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      JPG, PNG, WebP, HEIC — max 10 MB
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      Processes in the background • Auto-updates balance &amp; ledger
                    </p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-semibold transition-all shadow-md shadow-indigo-500/20"
                >
                  <Camera size={16} /> Take Photo
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl glass-panel glass-panel-hover border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-all"
                >
                  <Upload size={16} /> Choose File
                </button>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 text-center space-y-0.5 pb-2">
                <p>✅ Works with grocery receipts, fuel bills, restaurant tabs, invoices</p>
              </div>

              {/* Hidden inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept={ACCEPT}
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
            </motion.div>
          )}

          {/* ── SCANNING / SKELETON SCREEN & CONTENT LOADERS ── */}
          {phase === 'scanning' && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              {/* Optional Mini Preview Thumbnail */}
              {preview && (
                <div className="flex items-center gap-3 p-2.5 rounded-2xl glass-panel border border-slate-200/60 dark:border-white/5">
                  <img
                    src={preview}
                    alt="Uploaded bill"
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200/50 dark:border-white/10 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {imageFile?.name || 'Receipt Image'}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      Uploaded • Processing in background
                    </p>
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping mr-2" />
                </div>
              )}

              {/* Full Shimmer Skeleton Receipt Loader */}
              <SkeletonReceipt statusText={statusMessage} />
            </motion.div>
          )}

          {/* ── ERROR ── */}
          {phase === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <GlassCard className="border border-rose-500/25 p-6 text-center space-y-3">
                <AlertCircle size={36} className="mx-auto text-rose-500" />
                <p className="text-sm font-bold text-slate-900 dark:text-white">Scan Failed</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">{errorMsg}</p>
                <button
                  onClick={reset}
                  className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-semibold transition-all border border-rose-500/20"
                >
                  <RefreshCcw size={14} /> Try Again
                </button>
              </GlassCard>
            </motion.div>
          )}

          {/* ── COMPLETED & AUTO-SAVED ── */}
          {phase === 'completed' && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <GlassCard className="border border-emerald-500/25 p-6 text-center space-y-4 overflow-hidden relative">
                {/* Ambient Glow */}
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />

                {/* Animated checkmark */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                  className="w-14 h-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center mx-auto text-emerald-500 border border-emerald-500/20 shadow-sm"
                >
                  <CheckCircle2 size={32} />
                </motion.div>

                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Auto-Saved to Ledger!
                  </h2>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                    Your account balance has been updated automatically
                  </p>
                </div>

                {/* Parsed Details Summary Card */}
                <div className="rounded-2xl p-4 bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 text-left space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-white/5">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">
                        Merchant / Title
                      </span>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {form.title || 'Scanned Bill'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">
                        Amount
                      </span>
                      <p className={`text-lg font-black ${form.type === 'DEBIT' ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {form.type === 'DEBIT' ? '-' : '+'}₹{Number(form.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Type</span>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        {form.type === 'DEBIT' ? 'Expense' : 'Income'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Date</span>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">{form.date}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Payment</span>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">{form.payment_method}</p>
                    </div>
                  </div>

                  {/* Line items preview if present */}
                  {lineItems.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/60 dark:border-white/5">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                        <ListOrdered size={12} /> Detected Line Items ({lineItems.length})
                      </p>
                      <div className="space-y-1">
                        {lineItems.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                            <span>{item.name}</span>
                            <span>₹{Number(item.price).toFixed(2)}</span>
                          </div>
                        ))}
                        {lineItems.length > 3 && (
                          <p className="text-[10px] text-indigo-500 font-medium">
                            +{lineItems.length - 3} more items detected
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Primary & secondary actions */}
                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <button
                    onClick={() => navigate('/transactions')}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-semibold transition-all shadow-md shadow-indigo-500/20"
                  >
                    <FileText size={16} /> View in Ledger
                  </button>
                  <button
                    onClick={() => setPhase('review')}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl glass-panel glass-panel-hover border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-all"
                  >
                    <Edit3 size={15} /> Edit Details
                  </button>
                  <button
                    onClick={reset}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl glass-panel glass-panel-hover border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-all"
                  >
                    <Camera size={15} /> Scan Another
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* ── REVIEW / EDIT FORM ── */}
          {phase === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {/* Header bar */}
              <div className="flex items-center gap-3">
                {preview && (
                  <img
                    src={preview}
                    alt="Scanned bill"
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-white/10"
                  />
                )}
                <div className="flex-1">
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <Edit3 size={13} /> {createdTx ? 'Edit Transaction Details' : 'Review & Confirm Bill'}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Make any adjustments before saving
                  </p>
                </div>
                <button
                  onClick={reset}
                  className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 transition-all"
                  title="Close"
                >
                  <X size={15} />
                </button>
              </div>

              <GlassCard className="space-y-4">
                {/* Type toggle */}
                <div>
                  <span className={labelCls}>Transaction Type</span>
                  <div className="flex gap-2">
                    {[
                      { val: 'DEBIT', label: 'Expense', Icon: ArrowDownLeft, color: 'rose' },
                      { val: 'CREDIT', label: 'Income', Icon: ArrowUpRight, color: 'emerald' },
                    ].map(({ val, label, Icon, color }) => (
                      <button
                        key={val}
                        onClick={() => setField('type', val)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                          form.type === val
                            ? color === 'rose'
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-white/30 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <Icon size={15} /> {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className={labelCls}>Merchant / Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setField('title', e.target.value)}
                    placeholder="e.g. Reliance Fresh, Shell Fuel, Starbucks"
                    className={inputCls}
                  />
                </div>

                {/* Amount + Date row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Amount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setField('amount', e.target.value)}
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Date</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setField('date', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className={labelCls}>
                    Category <span className="normal-case font-normal text-slate-400">(optional)</span>
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setField('category', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— No category —</option>
                    {categories
                      .filter(
                        (c) =>
                          c.type === 'BOTH' ||
                          (form.type === 'DEBIT' ? c.type === 'EXPENSE' : c.type === 'INCOME')
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Payment method */}
                <div>
                  <label className={labelCls}>Payment Method</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) => setField('payment_method', e.target.value)}
                    className={inputCls}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className={labelCls}>
                    Notes <span className="normal-case font-normal text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setField('description', e.target.value)}
                    placeholder="Add details, bill numbers, etc…"
                    rows={2}
                    className={`${inputCls} resize-none`}
                  />
                </div>

                {/* Line items accordion */}
                {lineItems.length > 0 && (
                  <div>
                    <button
                      onClick={() => setLineItemsOpen((o) => !o)}
                      className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 py-2 border-t border-slate-100 dark:border-white/5"
                    >
                      <span>Detected line items ({lineItems.length})</span>
                      {lineItemsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <AnimatePresence>
                      {lineItemsOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-1 pt-1">
                            {lineItems.map((item, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-slate-50 dark:bg-white/5"
                              >
                                <span className="text-slate-700 dark:text-slate-200">{item.name}</span>
                                <span className="text-slate-500 dark:text-slate-400">
                                  {item.qty > 1 && `${item.qty}× `}₹{Number(item.price).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </GlassCard>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={reset}
                  className="flex-1 py-3 rounded-2xl glass-panel border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 active:scale-95 text-white text-sm font-semibold transition-all shadow-md shadow-indigo-500/20"
                >
                  {saving ? (
                    <motion.span
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      Saving…
                    </motion.span>
                  ) : (
                    <>
                      <Save size={15} /> {createdTx ? 'Update Transaction' : 'Save to Ledger'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
