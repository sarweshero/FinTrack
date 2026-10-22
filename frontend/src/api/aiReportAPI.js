import client from './client';

export const aiReportAPI = {
  getReport: (refresh = false) => client.get('/ai-report/', { params: { refresh } }),
  generateReport: () => client.post('/ai-report/'),
};

