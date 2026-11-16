import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// API Base URL: Uses VITE_API_URL if configured, otherwise falls back to '/api/v1'
// In local development, Vite proxies '/api' to 'http://localhost:5000'
export const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getStoredToken = (): string | null => {
  return localStorage.getItem('jcb_token') || sessionStorage.getItem('jcb_token');
};

export const getStoredRefreshToken = (): string | null => {
  return (
    localStorage.getItem('jcb_refresh_token') || sessionStorage.getItem('jcb_refresh_token')
  );
};

export const setStoredTokens = (token: string, refreshToken?: string) => {
  const isSession = !localStorage.getItem('jcb_token') && !!sessionStorage.getItem('jcb_token');
  const storage = isSession ? sessionStorage : localStorage;

  storage.setItem('jcb_token', token);
  if (refreshToken) {
    storage.setItem('jcb_refresh_token', refreshToken);
  }

  // Notify AuthContext and other listeners about the refreshed token
  window.dispatchEvent(
    new CustomEvent('auth:token-refreshed', {
      detail: { token, refreshToken },
    })
  );
};

export const clearStoredAuth = () => {
  localStorage.removeItem('jcb_token');
  localStorage.removeItem('jcb_refresh_token');
  localStorage.removeItem('jcb_user');
  sessionStorage.removeItem('jcb_token');
  sessionStorage.removeItem('jcb_refresh_token');
  sessionStorage.removeItem('jcb_user');

  window.dispatchEvent(new CustomEvent('auth:session-cleared'));
};

// Queue mechanism to prevent duplicate concurrent refresh requests
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor: Attach current valid token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Token expiry detection, refresh coordination & request retry
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const requestUrl = originalRequest.url || '';
    const isAuthRoute =
      requestUrl.includes('/auth/login') || requestUrl.includes('/auth/refresh-token');

    // Handle 401 Unauthorized for authenticated endpoints
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      const currentRefreshToken = getStoredRefreshToken();

      if (!currentRefreshToken) {
        clearStoredAuth();
        if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      // If another refresh request is already underway, wait for it
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Use standard axios to avoid circular interceptor execution
        const refreshResponse = await axios.post(
          `${API_URL}/auth/refresh-token`,
          { refreshToken: currentRefreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        );

        const responseData = refreshResponse.data?.data;
        const newToken: string | undefined = responseData?.token;
        const newRefreshToken: string | undefined = responseData?.refreshToken;

        if (!newToken) {
          throw new Error('Refresh token exchange did not return a valid access token.');
        }

        setStoredTokens(newToken, newRefreshToken);
        processQueue(null, newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        clearStoredAuth();

        if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
          window.location.href = '/login';
        }

        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
