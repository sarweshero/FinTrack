import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { aiReportAPI } from '../../api/aiReportAPI';

export const fetchAIReport = createAsyncThunk(
  'aiReport/fetchAIReport',
  async (refresh = false, { rejectWithValue }) => {
    try {
      return await aiReportAPI.getReport(refresh);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const generateFreshAIReport = createAsyncThunk(
  'aiReport/generateFreshAIReport',
  async (_, { rejectWithValue }) => {
    try {
      return await aiReportAPI.generateReport();
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const aiReportSlice = createSlice({
  name: 'aiReport',
  initialState: {
    report: null, // { source, generated_at, content_json, content_markdown }
    status: 'idle',
    isGenerating: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAIReport.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchAIReport.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.report = action.payload;
      })
      .addCase(fetchAIReport.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(generateFreshAIReport.pending, (state) => {
        state.isGenerating = true;
      })
      .addCase(generateFreshAIReport.fulfilled, (state, action) => {
        state.isGenerating = false;
        state.report = action.payload;
      })
      .addCase(generateFreshAIReport.rejected, (state, action) => {
        state.isGenerating = false;
        state.error = action.payload;
      });
  },
});

export default aiReportSlice.reducer;

