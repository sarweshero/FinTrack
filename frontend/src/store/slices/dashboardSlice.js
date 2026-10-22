import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { dashboardAPI } from '../../api/dashboardAPI';

export const fetchDashboardData = createAsyncThunk(
  'dashboard/fetchDashboardData',
  async (days = 30, { rejectWithValue }) => {
    try {
      const [summary, trends, categories, whoOwes] = await Promise.all([
        dashboardAPI.getSummary(),
        dashboardAPI.getTrends(days),
        dashboardAPI.getCategories(),
        dashboardAPI.getWhoOwes(),
      ]);
      return { summary, trends, categories, whoOwes };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const fetchTrendsOnly = createAsyncThunk(
  'dashboard/fetchTrendsOnly',
  async (days = 30, { rejectWithValue }) => {
    try {
      return await dashboardAPI.getTrends(days);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: {
    summary: {
      total_income: 0,
      total_expense: 0,
      cash_balance: 0,
      net_balance: 0,
      total_amount: 0,
      total_saved: 0,
      total_target_savings: 0,
      total_amount_given: 0,
      remainder_to_receive: 0,
      total_amount_borrowed: 0,
      remainder_to_pay: 0,
      net_peer_remainder: 0,
    },
    trends: {
      period_days: 30,
      start_date: '',
      end_date: '',
      total_spend: 0,
      total_income: 0,
      total_given: 0,
      series: [],
    },
    categories: {
      expenses: { total: 0, breakdown: [] },
      incomes: { total: 0, breakdown: [] },
    },
    whoOwes: {
      total_receivable: 0,
      debtor_count: 0,
      overdue_count: 0,
      who_owes_list: [],
    },
    selectedTrendDays: 30,
    status: 'idle',
    error: null,
  },
  reducers: {
    setSelectedTrendDays: (state, action) => {
      state.selectedTrendDays = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardData.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchDashboardData.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.summary = action.payload.summary;
        state.trends = action.payload.trends;
        state.categories = action.payload.categories;
        state.whoOwes = action.payload.whoOwes;
      })
      .addCase(fetchDashboardData.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(fetchTrendsOnly.fulfilled, (state, action) => {
        state.trends = action.payload;
      });
  },
});

export const { setSelectedTrendDays } = dashboardSlice.actions;
export default dashboardSlice.reducer;

