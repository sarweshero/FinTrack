import client from './client';

export const dashboardAPI = {
  getSummary: () => client.get('/dashboard/summary/'),
  getTrends: (days = 30) => client.get('/dashboard/trends/', { params: { days } }),
  getCategories: () => client.get('/dashboard/categories/'),
  getWhoOwes: () => client.get('/dashboard/who-owes/'),
};

