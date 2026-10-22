import axios from 'axios';

const rawBaseURL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BASE_URL ||
  (import.meta.env.DEV ? '/api' : 'https://backend-sarwesh-fin.vercel.app');

const getCleanBaseURL = (url) => {
  if (!url) return '/api';
  const trimmed = url.trim().replace(/\/+$/, '');
  if (trimmed === '/api') return '/api';
  if (!trimmed.endsWith('/api') && !trimmed.includes('/api/')) {
    return `${trimmed}/api`;
  }
  return trimmed;
};

const baseURL = getCleanBaseURL(rawBaseURL);

const client = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    let message = 'An unexpected error occurred';
    const data = error.response?.data;

    if (data) {
      if (typeof data === 'string') {
        message = data;
      } else if (data.detail && typeof data.detail === 'string') {
        message = data.detail;
      } else if (data.message && typeof data.message === 'string') {
        message = data.message;
      } else if (typeof data === 'object') {
        const errorList = [];
        for (const [field, errors] of Object.entries(data)) {
          const text = Array.isArray(errors) ? errors.join(' ') : String(errors);
          if (field === 'non_field_errors' || field === 'detail') {
            errorList.push(text);
          } else {
            const formattedField = field.charAt(0).toUpperCase() + field.slice(1);
            errorList.push(`${formattedField}: ${text}`);
          }
        }
        if (errorList.length > 0) {
          message = errorList.join(' | ');
        }
      }
    } else if (error.message) {
      message = error.message;
    }

    return Promise.reject(new Error(message));
  }
);

export default client;

