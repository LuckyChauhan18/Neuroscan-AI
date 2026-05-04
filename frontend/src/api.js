import axios from 'axios';
import logger from './utils/logger';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: API_URL });

// ── Request interceptor ───────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  logger.debug(`→ ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

// ── Response interceptor ──────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => {
    logger.debug(
      `← ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`
    );
    return response;
  },
  (error) => {
    const status  = error.response?.status;
    const url     = error.config?.url;
    const method  = error.config?.method?.toUpperCase();
    const detail  = error.response?.data?.detail || error.message;
    const reqId   = error.response?.headers?.['x-request-id'];

    logger.error(
      `← ${status ?? 'NET_ERR'} ${method} ${url}: ${detail}`,
      reqId ? { requestId: reqId } : {}
    );

    // Expired / invalid token — clear session and redirect to login
    if (status === 401) {
      logger.warn('Session expired — redirecting to login');
      localStorage.removeItem('token');
      window.location.href = '/login';
    }

    // Attach a human-readable message so components don't need to parse response shapes
    error.userMessage = resolveUserMessage(status, detail);
    return Promise.reject(error);
  }
);

function resolveUserMessage(status, detail) {
  if (typeof detail === 'string' && detail.length < 200) return detail;
  switch (status) {
    case 400: return 'Invalid request. Please check your input and try again.';
    case 401: return 'Your session has expired. Please log in again.';
    case 403: return 'You do not have permission to perform this action.';
    case 404: return 'The requested resource was not found.';
    case 413: return 'The file is too large to upload.';
    case 422: return 'Validation error. Please check your input.';
    case 429: return 'Too many requests. Please wait a moment and try again.';
    case 500: return 'A server error occurred. Please try again shortly.';
    case 502:
    case 503:
    case 504: return 'The server is temporarily unavailable. Please try again.';
    default:  return 'An unexpected error occurred. Please try again.';
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const register   = (data) => api.post('/auth/register', data);
export const login      = (username, password) => {
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);
  return api.post('/auth/login', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
};
export const getProfile    = ()     => api.get('/auth/profile');
export const updateProfile = (data) => api.patch('/auth/profile', data);

// ── Upload ────────────────────────────────────────────────────────────────────
export const uploadEEG = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/upload/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const getSampleData = () => api.get('/upload/sample-data');

// ── History ───────────────────────────────────────────────────────────────────
export const getHistory          = ()   => api.get('/history/');
export const getPredictionDetail = (id) => api.get(`/history/${id}`);

// ── Reports ───────────────────────────────────────────────────────────────────
export const getReport      = (id)         => api.get(`/reports/${id}`);
export const downloadReport = (id, format) =>
  api.get(`/reports/${id}/download/${format}`, { responseType: 'blob' });

// ── Feedback ──────────────────────────────────────────────────────────────────
export const submitFeedback = (data)         => api.post('/feedback/', data);
export const getFeedback    = (predictionId) => api.get(`/feedback/${predictionId}`);

export default api;
