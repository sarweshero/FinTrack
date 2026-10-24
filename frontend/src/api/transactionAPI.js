import client from './client';

export const transactionAPI = {
  list: (params) => client.get('/transactions/', { params }),
  get: (id) => client.get(`/transactions/${id}/`),
  create: (data) => client.post('/transactions/', data),
  update: (id, data) => client.patch(`/transactions/${id}/`, data),
  delete: (id) => client.delete(`/transactions/${id}/`),

  // Upload bill to an existing transaction to extract spending products
  uploadBill: (id, imageBlobOrFile) => {
    const formData = new FormData();
    formData.append('image', imageBlobOrFile, 'bill.jpg');
    return client.post(`/transactions/${id}/upload-bill/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 35000,
    });
  },

  // Split a transaction into individual product transactions
  split: (id, items) => client.post(`/transactions/${id}/split/`, { items }),

  // Directly create multiple product transactions from a split bill
  splitBill: (data) => client.post('/transactions/split-bill/', data),

  // Specialized debit/credit endpoints
  listDebits: (params) => client.get('/debit/', { params }),
  createDebit: (data) => client.post('/debit/', data),
  listCredits: (params) => client.get('/credit/', { params }),
  createCredit: (data) => client.post('/credit/', data),
};

export default transactionAPI;
