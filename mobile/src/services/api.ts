import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG, STORAGE_KEYS } from '../config/constants';

export const apiClient = axios.create({
  baseURL: CONFIG.API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request Interceptor: Attach JWT Token from AsyncStorage
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn('[Axios Request Interceptor Error]:', e);
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle 401 Token Expiry & Standardize Errors
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError<any>) => {
    if (error.response?.status === 401) {
      console.warn('[Auth Expired] Clearing session...');
      await AsyncStorage.multiRemove([STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.USER_PROFILE]);
    }

    const message = error.response?.data?.message || error.message || 'Network request failed';
    return Promise.reject(new Error(message));
  }
);

export default apiClient;
