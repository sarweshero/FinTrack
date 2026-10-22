import { createSlice } from '@reduxjs/toolkit';

let nextToastId = 1;

export const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('finpulse_theme');
  if (saved === 'light' || saved === 'dark') return saved;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
};

export const applyThemeToDocument = (theme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
    root.setAttribute('data-theme', 'dark');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
  }
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', theme === 'dark' ? '#060813' : '#f8fafc');
  }
  try {
    localStorage.setItem('finpulse_theme', theme);
  } catch {
    // Ignore storage errors in restricted contexts
  }
};

const initialTheme = getInitialTheme();
applyThemeToDocument(initialTheme);

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    theme: initialTheme, // 'light' | 'dark'
    activeModal: null, // { name: 'TRANSACTION', data: {...} }
    toasts: [], // [ { id, message, type: 'success' | 'error' | 'info' } ]
    activeTab: 'dashboard',
  },
  reducers: {
    toggleTheme: (state) => {
      const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
      state.theme = nextTheme;
      applyThemeToDocument(nextTheme);
    },
    setTheme: (state, action) => {
      const newTheme = action.payload === 'light' ? 'light' : 'dark';
      state.theme = newTheme;
      applyThemeToDocument(newTheme);
    },
    openModal: (state, action) => {
      state.activeModal = action.payload;
    },
    closeModal: (state) => {
      state.activeModal = null;
    },
    addToast: (state, action) => {
      const { message, type = 'success', duration = 3500 } = action.payload;
      state.toasts.push({
        id: nextToastId++,
        message,
        type,
        duration,
      });
    },
    removeToast: (state, action) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
  },
});

export const {
  toggleTheme,
  setTheme,
  openModal,
  closeModal,
  addToast,
  removeToast,
  setActiveTab,
} = uiSlice.actions;
export default uiSlice.reducer;

