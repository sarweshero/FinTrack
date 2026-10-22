import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/uiSlice';
import categoryReducer from './slices/categorySlice';
import transactionReducer from './slices/transactionSlice';
import savingsReducer from './slices/savingsSlice';
import debtReducer from './slices/debtSlice';
import remindersReducer from './slices/remindersSlice';
import dashboardReducer from './slices/dashboardSlice';
import aiReportReducer from './slices/aiReportSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    categories: categoryReducer,
    transactions: transactionReducer,
    savings: savingsReducer,
    debts: debtReducer,
    reminders: remindersReducer,
    dashboard: dashboardReducer,
    aiReport: aiReportReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;

