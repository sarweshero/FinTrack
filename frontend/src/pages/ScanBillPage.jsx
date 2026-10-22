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
} from 'lucide-react';

import PageTransition from '../components/layout/PageTransition';
import GlassCard from '../components/ui/GlassCard';
import { billAPI } from '../api/billAPI';
import { transactionAPI } from '../api/transactionAPI';
import { addToast } from '../store/slices/uiSlice';
import { fetchCategories } from '../store/slices/categorySlice';
import { fetchDashboardData } from '../store/slices/dashboardSlice';

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

// ── Laser scan animation ──────────────────────────────────────────────────────
function LaserBeam() {
  return (
    <motion.div
      className="absolute inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_12px_rgba(99,102,241,0.9)] z-20 pointer-events-none"
      initial={{ top: '5%', opacity: 0 }}
      animate={{ top: ['5%', '95%', '5%'], opacity: [0, 1, 1, 0] }}
      transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.3 }}
    />
  );
}

// ── Confidence badge ──────────────────────────────────────────────────────────
function ConfidenceBadge({ confidence }) {
  const map = {
    high: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    medium: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    low: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
  };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${map[confidence] ?? map.low}`}>
      {confidence} confidence
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ScanBillPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const categories = useSelector((s) => s.categories.items ?? []);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const dropRef = useRef(null);

  // ── State machine: idle | scanning | review | saved | error ──────────────
  const [phase, setPhase] = useState('idle');
  const [preview, setPreview] = useState(null);   // base64 for <img>
  const [imageFile, setImageFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lineItemsOpen, setLineItemsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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
      setErrorMsg('');

      try {
        // Ensure categories are loaded for the review dropdown
        if (categories.length === 0) await dispatch(fetchCategories());

        const result = await billAPI.scan(file);

        // Populate review form with Gemini results
        setForm({
          type: result.type ?? 'DEBIT',
          title: result.title ?? '',
          amount: result.amount != null ? String(result.amount) : '',
          date: result.date ?? new Date().toISOString().slice(0, 10),
          category: result.category_id != null ? String(result.category_id) : '',
          payment_method: result.payment_method ?? 'OTHER',
          description: '',
        });
        setLineItems(result.line_items ?? []);
        setPhase('review');
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

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);

  // ── Save confirmed transaction ────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim()) { dispatch(addToast({ message: 'Title is required.', type: 'error' })); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { dispatch(addToast({ message: 'Enter a valid amount.', type: 'error' })); return; }

    setSaving(true);
    try {
      await transactionAPI.create({
        type: form.type,
        title: form.title.trim(),
        amount: parseFloat(form.amount),
        date: form.date,
        category: form.category ? parseInt(form.category) : null,
        payment_method: form.payment_method,
        description: form.description.trim(),
      });

      setPhase('saved');
      dispatch(addToast({ message: 'Transaction saved from bill scan!', type: 'success' }));
      dispatch(fetchDashboardData());
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
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <ScanLine size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Scan Bill</h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Upload a receipt — AI extracts the details</p>
          </div>
          {/* Quota note */}
          <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
            <Zap size={10} />
            10 scans/hr
          </div>
        </div>

        {/* ── IDLE — Upload Zone ── */}
        <AnimatePresence mode="wait">
          {phase === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {/* Drop Zone */}
              <div
                ref={dropRef}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                className={`relative rounded-3xl border-2 border-dashed transition-all p-8 text-center cursor-pointer
                  ${isDragging
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
                      Drop your bill image here
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      JPG, PNG, WebP, HEIC — max 10 MB
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      Compressed client-side before upload to save Gemini quota
                    </p>
                  </div>
                </div>
              </div>

              {/* Camera / File buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-semibold transition-all shadow-md"
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

              {/* Tips */}
              <div className="text-[11px] text-slate-500 dark:text-slate-400 text-center space-y-0.5 pb-2">
                <p>✅ Works with: grocery receipts, restaurant bills, utility invoices, salary slips</p>
              </div>

              {/* Hidden inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept={ACCEPT}
                capture="environment"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
              />
            </motion.div>
          )}

          {/* ── SCANNING ── */}
          {phase === 'scanning' && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <GlassCard className="overflow-hidden p-0">
                {/* Image preview with laser */}
                <div className="relative overflow-hidden rounded-t-2xl bg-slate-900/10 dark:bg-black/30 max-h-60">
                  {preview && (
                    <img
                      src={preview}
                      alt="Bill preview"
                      className="w-full h-60 object-cover opacity-70"
                    />
                  )}
                  {/* Dark scan overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/20" />
                  <LaserBeam />
                  {/* Corner brackets */}
                  {[['top-2 left-2', 'border-t-2 border-l-2'], ['top-2 right-2', 'border-t-2 border-r-2'],
                    ['bottom-2 left-2', 'border-b-2 border-l-2'], ['bottom-2 right-2', 'border-b-2 border-r-2']
                  ].map(([pos, borders], i) => (
                    <div key={i} className={`absolute ${pos} w-5 h-5 border-indigo-400 ${borders} rounded-sm`} />
                  ))}
                </div>

                <div className="p-4 text-center space-y-1">
                  <motion.p
                    className="text-sm font-semibold text-slate-800 dark:text-slate-100"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    Analyzing with Gemini Vision…
                  </motion.p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Compressed image sent — extracting amount, date, merchant &amp; category
                  </p>
                </div>
              </GlassCard>
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
              <GlassCard className="border border-rose-500/25 p-5 text-center space-y-3">
                <AlertCircle size={32} className="mx-auto text-rose-500" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Scan Failed</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{errorMsg}</p>
                <button
                  onClick={reset}
                  className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-semibold transition-all border border-rose-500/20"
                >
                  <RefreshCcw size={14} /> Try Again
                </button>
              </GlassCard>
            </motion.div>
          )}

          {/* ── REVIEW ── */}
          {phase === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {/* Mini preview + reset */}
              <div className="flex items-center gap-3">
                {preview && (
                  <img
                    src={preview}
                    alt="Scanned bill"
                    className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-white/10"
                  />
                )}
                <div className="flex-1">
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={13} /> Scan complete — review &amp; edit below
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Correct any fields before saving
                  </p>
                </div>
                <button
                  onClick={reset}
                  className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 transition-all"
                  title="Scan another bill"
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
                    placeholder="e.g. Walmart, Starbucks, Electric Bill"
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
                  <label className={labelCls}>Category <span className="normal-case font-normal text-slate-400">(optional)</span></label>
                  <select
                    value={form.category}
                    onChange={(e) => setField('category', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— No category —</option>
                    {categories
                      .filter((c) =>
                        c.type === 'BOTH' ||
                        (form.type === 'DEBIT' ? c.type === 'EXPENSE' : c.type === 'INCOME')
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
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
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className={labelCls}>Notes <span className="normal-case font-normal text-slate-400">(optional)</span></label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setField('description', e.target.value)}
                    placeholder="Add any extra details…"
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

              {/* Save / Cancel */}
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
                    <><Save size={15} /> Save to Ledger</>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── SAVED ── */}
          {phase === 'saved' && (
            <motion.div
              key="saved"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <GlassCard className="border border-emerald-500/25 p-8 text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                  className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto"
                >
                  <CheckCircle2 size={34} className="text-emerald-500" />
                </motion.div>
                <div>
                  <p className="text-base font-bold text-slate-900 dark:text-white">Saved to Ledger!</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Your transaction has been recorded from the bill scan.
                  </p>
                </div>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={reset}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-panel border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                  >
                    <Camera size={14} /> Scan Another
                  </button>
                  <button
                    onClick={() => navigate('/transactions')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all"
                  >
                    View Ledger
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}

