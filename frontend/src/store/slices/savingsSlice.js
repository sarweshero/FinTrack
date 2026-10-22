import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { savingsAPI } from '../../api/savingsAPI';

export const fetchSavingsGoals = createAsyncThunk(
  'savings/fetchSavingsGoals',
  async (_, { rejectWithValue }) => {
    try {
      return await savingsAPI.list();
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const createSavingsGoal = createAsyncThunk(
  'savings/createSavingsGoal',
  async (goalData, { rejectWithValue }) => {
    try {
      return await savingsAPI.create(goalData);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const updateSavingsGoal = createAsyncThunk(
  'savings/updateSavingsGoal',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      return await savingsAPI.update(id, data);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const deleteSavingsGoal = createAsyncThunk(
  'savings/deleteSavingsGoal',
  async (id, { rejectWithValue }) => {
    try {
      await savingsAPI.delete(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const depositSavings = createAsyncThunk(
  'savings/depositSavings',
  async ({ id, amount, notes, date }, { rejectWithValue }) => {
    try {
      return await savingsAPI.deposit(id, { amount, notes, date });
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const savingsSlice = createSlice({
  name: 'savings',
  initialState: {
    items: [],
    status: 'idle',
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSavingsGoals.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchSavingsGoals.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchSavingsGoals.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(createSavingsGoal.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      .addCase(updateSavingsGoal.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(deleteSavingsGoal.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item.id !== action.payload);
      })
      .addCase(depositSavings.fulfilled, (state, action) => {
        const updatedGoal = action.payload.goal;
        const index = state.items.findIndex((item) => item.id === updatedGoal.id);
        if (index !== -1) {
          state.items[index] = updatedGoal;
        }
      });
  },
});

export default savingsSlice.reducer;

