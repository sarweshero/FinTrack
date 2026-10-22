import client from './client';

export const debtAPI = {
  list: (params) => client.get('/debts/', { params }),
  get: (id) => client.get(`/debts/${id}/`),
  create: (data) => client.post('/debts/', data),
  update: (id, data) => client.patch(`/debts/${id}/`, data),
  delete: (id) => client.delete(`/debts/${id}/`),
  settle: (id, data) => client.post(`/debts/${id}/settle/`, data),
  whoOwesMe: () => client.get('/debts/who_owes_me/'),
};

