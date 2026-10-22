import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { remindersAPI } from '../../api/remindersAPI';

export const fetchReminders = createAsyncThunk(
  'reminders/fetchReminders',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await remindersAPI.getOverview(params);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const remindersSlice = createSlice({
  name: 'reminders',
  initialState: {
    data: {
      summary: {
        given_by_me: {
          total_amount_given: 0,
          total_received_back: 0,
          remainder_to_receive: 0,
          active_borrowers_count: 0,
          overdue_count: 0,
        },
        given_to_me: {
          total_amount_taken: 0,
          total_repaid: 0,
          remainder_to_pay: 0,
          active_lenders_count: 0,
          overdue_count: 0,
        },
        net_remainder: 0,
        net_position: 'BALANCED',
      },
      amount_given_by_me: [],
      amount_given_to_me: [],
    },
    overdueOnly: false,
    searchQuery: '',
    status: 'idle',
    error: null,
  },
  reducers: {
    setOverdueOnly: (state, action) => {
      state.overdueOnly = action.payload;
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReminders.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchReminders.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
      })
      .addCase(fetchReminders.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export const { setOverdueOnly, setSearchQuery } = remindersSlice.actions;
export default remindersSlice.reducer;

