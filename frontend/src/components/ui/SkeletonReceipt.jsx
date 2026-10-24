import { motion } from 'framer-motion';
import GlassCard from './GlassCard';

export default function SkeletonReceipt({ statusText = 'Analyzing bill with Gemini Vision…' }) {
  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <GlassCard className="relative overflow-hidden p-6 border border-indigo-500/20 shadow-xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl">
        {/* Animated Laser Beam */}
        <motion.div
          className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_16px_rgba(99,102,241,1)] z-20 pointer-events-none"
          initial={{ top: '0%', opacity: 0 }}
          animate={{ top: ['0%', '100%', '0%'], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 2.2, ease: 'easeInOut', repeat: Infinity }}
        />

        {/* Ambient Top Glow */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-20 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Receipt Header Ghost */}
        <div className="flex flex-col items-center text-center space-y-3 pb-5 border-b border-dashed border-slate-200 dark:border-white/10">
          {/* Ghost Merchant Logo */}
          <div className="w-12 h-12 rounded-2xl animate-shimmer border border-slate-200/50 dark:border-white/5 shadow-inner" />
          
          {/* Ghost Merchant Title */}
          <div className="h-5 w-44 rounded-xl animate-shimmer" />
          
          {/* Ghost Date & Reference */}
          <div className="flex items-center gap-2">
            <div className="h-3 w-20 rounded-md animate-shimmer" />
            <span className="text-slate-300 dark:text-slate-700 text-xs">•</span>
            <div className="h-3 w-16 rounded-md animate-shimmer" />
          </div>
        </div>

        {/* Center Amount Ghost Card */}
        <div className="py-6 flex flex-col items-center justify-center space-y-2 border-b border-dashed border-slate-200 dark:border-white/10">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Detected Amount
          </span>
          <div className="relative">
            <div className="h-12 w-48 rounded-2xl animate-shimmer flex items-center justify-center">
              <span className="text-2xl font-black text-slate-300 dark:text-slate-700 tracking-wider">
                ₹ · · · ·
              </span>
            </div>
          </div>
          {/* Ghost Badges */}
          <div className="flex gap-2 pt-1">
            <div className="h-6 w-20 rounded-full animate-shimmer" />
            <div className="h-6 w-16 rounded-full animate-shimmer" />
          </div>
        </div>

        {/* Line Items Ghost Rows */}
        <div className="py-5 space-y-3 border-b border-dashed border-slate-200 dark:border-white/10">
          <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            <span>Item Details</span>
            <span>Est. Price</span>
          </div>

          {[
            { w1: 'w-36', w2: 'w-14' },
            { w1: 'w-48', w2: 'w-16' },
            { w1: 'w-28', w2: 'w-12' },
          ].map((item, idx) => (
            <div key={idx} className="flex justify-between items-center py-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500/30 animate-pulse" />
                <div className={`h-3.5 ${item.w1} rounded-md animate-shimmer`} />
              </div>
              <div className={`h-3.5 ${item.w2} rounded-md animate-shimmer`} />
            </div>
          ))}
        </div>

        {/* Status Tracker */}
        <div className="pt-4 flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500" />
            </span>
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 animate-pulse">
              {statusText}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              Extracting items & auto-syncing to your balance…
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

