import client from './client';

export const categoryAPI = {
  list: (params) => client.get('/categories/', { params }),
  get: (id) => client.get(`/categories/${id}/`),
  create: (data) => client.post('/categories/', data),
  update: (id, data) => client.patch(`/categories/${id}/`, data),
  delete: (id) => client.delete(`/categories/${id}/`),
  suggest: (data) => client.post('/categories/suggest/', data),
};

export default categoryAPI;

