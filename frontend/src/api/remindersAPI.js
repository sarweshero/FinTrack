import client from './client';

export const remindersAPI = {
  getOverview: (params) => client.get('/reminders/', { params }),
};

