import axios from 'axios';

// Dynamic API Endpoint Resolution:
// 1. Explicit VITE_API_URL from .env if defined
// 2. Local Vite Development -> '/api/v1' (automatically proxied to http://localhost:5000)
// 3. Production Deployment -> 'https://jcb-pi.vercel.app/api/v1' or same-origin '/api/v1'
const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? '/api/v1' : 'https://jcb-pi.vercel.app/api/v1');

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT Token from localStorage
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('jcb_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for token expiry & automatic session refresh
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('jcb_token');
      localStorage.removeItem('jcb_refresh_token');
      localStorage.removeItem('jcb_user');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
