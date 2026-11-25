import axios from 'axios';

export const TOKEN_KEY = 'heatsafe_token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = '/login';
    }
    const message =
      err.response?.data?.message ||
      err.message ||
      'Request failed. Check that the HeatSafe server and MongoDB are running.';
    return Promise.reject(new Error(message));
  }
);

export const registerUser = (data) => api.post('/auth/register', data);
export const loginUser = (data) => api.post('/auth/login', data);
export const getMe = () => api.get('/auth/me');

export const healthCheck = () => api.get('/health');
export const getDashboardSummary = () => api.get('/dashboard/summary');
export const getRiskDistribution = () => api.get('/dashboard/risk-distribution');
export const getRecentActivity = () => api.get('/dashboard/recent-activity');

export const getSites = (params) => api.get('/sites', { params });
export const getSite = (id) => api.get(`/sites/${id}`);
export const createSite = (data) => api.post('/sites', data);
export const updateSite = (id, data) => api.put(`/sites/${id}`, data);
export const deleteSite = (id) => api.delete(`/sites/${id}`);

export const getAssessments = (params) => api.get('/assessments', { params });
export const getAssessment = (id) => api.get(`/assessments/${id}`);
export const createAssessment = (data) => api.post('/assessments', data);
export const updateAssessment = (id, data) => api.put(`/assessments/${id}`, data);
export const deleteAssessment = (id) => api.delete(`/assessments/${id}`);
export const getRecommendations = (assessmentId) =>
  api.get(`/assessments/${assessmentId}/recommendations`);

export const getCurrentWeather = (lat, lon) =>
  api.get('/weather/current', { params: { lat, lon } });
export const getForecastWeather = (lat, lon) =>
  api.get('/weather/forecast', { params: { lat, lon } });

export const getInterventions = (params) => api.get('/interventions', { params });
export const getActionPlans = (params) => api.get('/action-plans', { params });
export const getActionPlan = (id) => api.get(`/action-plans/${id}`);
export const createActionPlan = (data) => api.post('/action-plans', data);
export const updateActionPlan = (id, data) => api.put(`/action-plans/${id}`, data);
export const deleteActionPlan = (id) => api.delete(`/action-plans/${id}`);
export const suggestBudget = (id, budget) =>
  api.post(`/action-plans/${id}/suggest-budget`, { budget });

export default api;