import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share2, PlusSquare, X, Smartphone, CheckCircle2 } from 'lucide-react';

export const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  const [isStandalone] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  });

  const [isIOS] = useState(() => {
    if (typeof window === 'undefined') return false;
    return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  });

  useEffect(() => {
    if (isStandalone) return;

    // Check if user previously dismissed today
    const dismissedAt = localStorage.getItem('finpulse_pwa_dismissed_at');
    const hoursSinceDismiss = dismissedAt
      ? (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60)
      : 999;

    // Listen for Chrome / Android / Chromium beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);

      // Only show banner if not recently dismissed (< 12 hours)
      if (hoursSinceDismiss > 12) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // On iOS Safari, if not standalone and not recently dismissed, offer banner after 3 seconds
    let timer;
    if (isIOS && hoursSinceDismiss > 12) {
      timer = setTimeout(() => {
        setShowBanner(true);
      }, 3000);
    }

    const handleOpenInstallEvent = () => {
      if (isIOS) {
        setShowIOSModal(true);
      } else {
        setShowBanner(true);
      }
    };

    window.addEventListener('finpulse-open-install', handleOpenInstallEvent);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('finpulse-open-install', handleOpenInstallEvent);
    };
  }, [isStandalone, isIOS]);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (!deferredPrompt) {
      // Fallback if beforeinstallprompt is missing or already prompted
      alert('To install FinPulse, open your browser menu (⋮) and tap "Install app" or "Add to Home screen".');
      return;
    }

    // Trigger the native Android install prompt
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('[PWA] User accepted the FinPulse install prompt');
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('finpulse_pwa_dismissed_at', String(Date.now()));
  };

  if (isStandalone) return null;

  return (
    <>
      {/* Animated Bottom Installation Banner */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ y: 100, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 100, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-20 left-4 right-4 z-40 max-w-md mx-auto"
          >
            <div className="relative overflow-hidden rounded-3xl bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl border border-indigo-500/20 dark:border-indigo-500/30 shadow-[0_12px_40px_rgba(0,0,0,0.15),0_0_24px_rgba(99,102,241,0.15)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.7),0_0_24px_rgba(99,102,241,0.25)] p-4">
              {/* Subtle top neon line */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500" />

              <div className="flex items-start gap-3.5">
                {/* App Icon */}
                <div className="relative shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 shadow-lg shadow-indigo-500/20">
                  <img
                    src="/icons/icon-96.png"
                    alt="FinPulse App"
                    className="w-full h-full object-cover rounded-[14px]"
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white dark:border-[#0f172a] shadow">
                    <Download size={10} className="text-white" />
                  </div>
                </div>

                {/* Text Details */}
                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                      Install FinPulse App
                    </h4>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 dark:border-indigo-500/30">
                      Mobile
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                    Download to your home screen for instant full-screen access, fast offline loading & reminders.
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={handleInstallClick}
                      className="flex-1 py-2 px-3.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-semibold text-xs shadow-md shadow-indigo-500/25 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Download size={14} />
                      Install Now
                    </button>
                    <button
                      onClick={handleDismiss}
                      className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 text-xs font-medium transition-colors"
                    >
                      Later
                    </button>
                  </div>
                </div>

                {/* Dismiss Icon */}
                <button
                  onClick={handleDismiss}
                  className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg transition-colors"
                  aria-label="Close install banner"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS Safari Step-by-Step Installation Modal */}
      <AnimatePresence>
        {showIOSModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowIOSModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/15 p-6 shadow-2xl z-10 space-y-5"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Install on iPhone / iPad</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">3 simple steps to add to your Home Screen</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIOSModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Instructions steps */}
              <div className="space-y-3.5 pt-1">
                <div className="flex items-start gap-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl p-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-200">
                    Tap the <span className="font-semibold text-slate-900 dark:text-white">Share</span> button in Safari's bottom toolbar.
                    <div className="mt-1 flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
                      <Share2 size={14} /> Safari Share Icon
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl p-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-200">
                    Scroll down and tap <span className="font-semibold text-slate-900 dark:text-white">"Add to Home Screen"</span>.
                    <div className="mt-1 flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-medium">
                      <PlusSquare size={14} /> Add to Home Screen
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl p-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-200">
                    Tap <span className="font-semibold text-slate-900 dark:text-white">"Add"</span> in the top-right corner to launch FinPulse anytime!
                    <div className="mt-1 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 size={14} /> Instant Standalone Launch
                    </div>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowIOSModal(false)}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-indigo-600/30"
              >
                Got It
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PWAInstallPrompt;
