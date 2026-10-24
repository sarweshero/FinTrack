import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { transactionAPI } from '../../api/transactionAPI';

export const fetchTransactions = createAsyncThunk(
  'transactions/fetchTransactions',
  async (params = {}, { rejectWithValue }) => {
    try {
      const data = await transactionAPI.list(params);
      if (Array.isArray(data)) {
        return { results: data, nextToken: null, next: null };
      }
      return {
        results: data.results || [],
        nextToken: data.next_token || null,
        next: data.next || null,
      };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const fetchMoreTransactions = createAsyncThunk(
  'transactions/fetchMoreTransactions',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const { nextToken, loadingMore } = getState().transactions;
      if (!nextToken || loadingMore) {
        return { results: [], nextToken: null, next: null };
      }
      const queryParams = { ...params, token: nextToken };
      const data = await transactionAPI.list(queryParams);
      if (Array.isArray(data)) {
        return { results: data, nextToken: null, next: null };
      }
      return {
        results: data.results || [],
        nextToken: data.next_token || null,
        next: data.next || null,
      };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const createTransaction = createAsyncThunk(
  'transactions/createTransaction',
  async (data, { rejectWithValue }) => {
    try {
      if (data.type === 'DEBIT') {
        return await transactionAPI.createDebit(data);
      } else if (data.type === 'CREDIT') {
        return await transactionAPI.createCredit(data);
      }
      return await transactionAPI.create(data);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const updateTransaction = createAsyncThunk(
  'transactions/updateTransaction',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      return await transactionAPI.update(id, data);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const deleteTransaction = createAsyncThunk(
  'transactions/deleteTransaction',
  async (id, { rejectWithValue }) => {
    try {
      await transactionAPI.delete(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const transactionSlice = createSlice({
  name: 'transactions',
  initialState: {
    items: [],
    status: 'idle',
    loadingMore: false,
    nextToken: null,
    hasMore: false,
    error: null,
    filters: {
      type: '',
      category: '',
      payment_method: '',
      start_date: '',
      end_date: '',
      search: '',
    },
  },
  reducers: {
    setTransactionFilter: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetTransactionFilters: (state) => {
      state.filters = {
        type: '',
        category: '',
        payment_method: '',
        start_date: '',
        end_date: '',
        search: '',
      };
    },
  },
  extraReducers: (builder) => {
    builder
      // Initial fetch
      .addCase(fetchTransactions.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload.results;
        state.nextToken = action.payload.nextToken;
        state.hasMore = Boolean(action.payload.next);
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })

      // Infinite scroll fetchMore
      .addCase(fetchMoreTransactions.pending, (state) => {
        state.loadingMore = true;
      })
      .addCase(fetchMoreTransactions.fulfilled, (state, action) => {
        state.loadingMore = false;
        const existingIds = new Set(state.items.map((t) => t.id));
        const freshItems = action.payload.results.filter((t) => !existingIds.has(t.id));
        state.items.push(...freshItems);
        state.nextToken = action.payload.nextToken;
        state.hasMore = Boolean(action.payload.next);
      })
      .addCase(fetchMoreTransactions.rejected, (state) => {
        state.loadingMore = false;
      })

      // Mutations
      .addCase(createTransaction.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      .addCase(updateTransaction.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(deleteTransaction.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item.id !== action.payload);
      });
  },
});

export const { setTransactionFilter, resetTransactionFilters } = transactionSlice.actions;
export default transactionSlice.reducer;
