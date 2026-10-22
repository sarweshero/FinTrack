import client from './client';

export const transactionAPI = {
  list: (params) => client.get('/transactions/', { params }),
  get: (id) => client.get(`/transactions/${id}/`),
  create: (data) => client.post('/transactions/', data),
  update: (id, data) => client.patch(`/transactions/${id}/`, data),
  delete: (id) => client.delete(`/transactions/${id}/`),

  // Specialized debit/credit endpoints
  listDebits: (params) => client.get('/debit/', { params }),
  createDebit: (data) => client.post('/debit/', data),
  listCredits: (params) => client.get('/credit/', { params }),
  createCredit: (data) => client.post('/credit/', data),
};

