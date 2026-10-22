import client from './client';

export const savingsAPI = {
  list: () => client.get('/savings/'),
  get: (id) => client.get(`/savings/${id}/`),
  create: (data) => client.post('/savings/', data),
  update: (id, data) => client.patch(`/savings/${id}/`, data),
  delete: (id) => client.delete(`/savings/${id}/`),
  deposit: (id, data) => client.post(`/savings/${id}/deposit/`, data),
};

