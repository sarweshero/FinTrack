import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { transactionAPI } from '../../api/transactionAPI';

export const fetchTransactions = createAsyncThunk(
  'transactions/fetchTransactions',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await transactionAPI.list(params);
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
      .addCase(fetchTransactions.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
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

