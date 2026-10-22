import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { debtAPI } from '../../api/debtAPI';

export const fetchDebts = createAsyncThunk(
  'debts/fetchDebts',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await debtAPI.list(params);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const createDebt = createAsyncThunk(
  'debts/createDebt',
  async (debtData, { rejectWithValue }) => {
    try {
      return await debtAPI.create(debtData);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const updateDebt = createAsyncThunk(
  'debts/updateDebt',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      return await debtAPI.update(id, data);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const deleteDebt = createAsyncThunk(
  'debts/deleteDebt',
  async (id, { rejectWithValue }) => {
    try {
      await debtAPI.delete(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const settleDebt = createAsyncThunk(
  'debts/settleDebt',
  async ({ id, amount, notes, settled_at }, { rejectWithValue }) => {
    try {
      return await debtAPI.settle(id, { amount, notes, settled_at });
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const debtSlice = createSlice({
  name: 'debts',
  initialState: {
    items: [],
    status: 'idle',
    error: null,
    filter: 'ALL', // 'ALL' | 'GIVEN' | 'BORROWED'
  },
  reducers: {
    setDebtTypeFilter: (state, action) => {
      state.filter = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDebts.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchDebts.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchDebts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(createDebt.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      .addCase(updateDebt.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(deleteDebt.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item.id !== action.payload);
      })
      .addCase(settleDebt.fulfilled, (state, action) => {
        const updatedDebt = action.payload.debt;
        const index = state.items.findIndex((item) => item.id === updatedDebt.id);
        if (index !== -1) {
          state.items[index] = updatedDebt;
        }
      });
  },
});

export const { setDebtTypeFilter } = debtSlice.actions;
export default debtSlice.reducer;

