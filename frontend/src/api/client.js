import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api';

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

