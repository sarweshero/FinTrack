import React from 'react';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import ToastContainer from '../ui/ToastContainer';
import TransactionModal from '../forms/TransactionModal';
import SavingsGoalModal from '../forms/SavingsGoalModal';
import DepositModal from '../forms/DepositModal';
import PeerDebtModal from '../forms/PeerDebtModal';
import SettleModal from '../forms/SettleModal';
import CategoryModal from '../forms/CategoryModal';
import PWAInstallPrompt from '../ui/PWAInstallPrompt';

export const AppShell = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 selection:bg-indigo-500/30 selection:text-indigo-600 dark:selection:text-indigo-200">
      <TopBar />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 pt-4 pb-28 md:pb-32">
        {children}
      </main>

      <BottomNav />
      <ToastContainer />
      <PWAInstallPrompt />

      {/* Global Modals */}
      <TransactionModal />
      <SavingsGoalModal />
      <DepositModal />
      <PeerDebtModal />
      <SettleModal />
      <CategoryModal />
    </div>
  );
};

export default AppShell;

