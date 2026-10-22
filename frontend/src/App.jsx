import { Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

import AppShell from './components/layout/AppShell';
import SkeletonCard from './components/ui/SkeletonCard';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
const DebitPage = lazy(() => import('./pages/DebitPage'));
const CreditPage = lazy(() => import('./pages/CreditPage'));
const SavingsPage = lazy(() => import('./pages/SavingsPage'));
const DebtsPage = lazy(() => import('./pages/DebtsPage'));
const RemindersPage = lazy(() => import('./pages/RemindersPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const AIReportPage = lazy(() => import('./pages/AIReportPage'));

const PageLoader = () => (
  <div className="space-y-4 py-2">
    <SkeletonCard className="h-28" />
    <SkeletonCard className="h-44" />
    <SkeletonCard className="h-32" />
  </div>
);

export function App() {
  const location = useLocation();

  return (
    <AppShell>
      <AnimatePresence mode="wait">
        <Suspense fallback={<PageLoader />}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/debit" element={<DebitPage />} />
            <Route path="/credit" element={<CreditPage />} />
            <Route path="/savings" element={<SavingsPage />} />
            <Route path="/debts" element={<DebtsPage />} />
            <Route path="/reminders" element={<RemindersPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/ai-report" element={<AIReportPage />} />
          </Routes>
        </Suspense>
      </AnimatePresence>
    </AppShell>
  );
}

export default App;
