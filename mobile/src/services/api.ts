import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG, STORAGE_KEYS } from '../config/constants';

// Safety polyfill for Hermes JS engine:
// Certain JS engines (like Hermes on Android) have Request without a prototype object,
// which causes "TypeError: right operand of 'in' is not an object".
if (typeof Request !== 'undefined' && (!Request.prototype || typeof Request.prototype !== 'object')) {
  try {
    (Request as any).prototype = {};
  } catch (e) {
    // Ignore if non-configurable
  }
}

interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  params?: Record<string, any>;
}

/**
 * High-reliability Native Fetch Client for React Native / Hermes
 * Replaces Axios to eliminate "right operand of 'in' is not an object" crashes on Android.
 */
class ApiClient {
  baseURL: string;
  timeout: number;
  interceptors = {
    request: { use: () => 0, eject: () => {} },
    response: { use: () => 0, eject: () => {} },
  };

  constructor(baseURL: string, timeout = 15000) {
    this.baseURL = baseURL;
    this.timeout = timeout;
  }

  private async request(
    endpoint: string,
    options: RequestInit & { timeout?: number; params?: Record<string, any> } = {}
  ) {
    let cleanBase = this.baseURL.replace(/\/+$/, '');
    if (cleanBase.endsWith('/api') && !cleanBase.endsWith('/api/v1')) {
      cleanBase = `${cleanBase}/v1`;
    }
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    let url = endpoint.startsWith('http') ? endpoint : `${cleanBase}${cleanEndpoint}`;

    if (options.params) {
      const queryParams = new URLSearchParams();
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      }
      const qs = queryParams.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }

    // Attach Bearer token from AsyncStorage
    let token: string | null = null;
    try {
      token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    } catch (e) {
      console.warn('[Storage Error] Failed to read auth token:', e);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };

    const controller = new AbortController();
    const timeoutDuration = options.timeout || this.timeout;
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 401 Session Expiry
      if (response.status === 401) {
        try {
          console.warn('[Auth Expired] Clearing session...');
          await AsyncStorage.multiRemove([STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.USER_PROFILE]);
        } catch (ignored) {}
      }

      let data: any;
      const text = await response.text();
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { message: text };
      }

      if (!response.ok) {
        const message =
          (data && typeof data === 'object' && data.message) ||
          `Request failed with status ${response.status}`;
        throw new Error(message);
      }

      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Network timeout. Please check your internet connection.');
      }
      if (err.message && err.message.includes('Network request failed')) {
        throw new Error('Network connection failed. Please check your internet connection.');
      }
      throw err;
    }
  }

  async get(endpoint: string, options?: RequestOptions) {
    return this.request(endpoint, { method: 'GET', ...options });
  }

  async post(endpoint: string, body?: any, options?: RequestOptions) {
    return this.request(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });
  }

  async put(endpoint: string, body?: any, options?: RequestOptions) {
    return this.request(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });
  }

  async delete(endpoint: string, options?: RequestOptions) {
    return this.request(endpoint, { method: 'DELETE', ...options });
  }

  async patch(endpoint: string, body?: any, options?: RequestOptions) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });
  }
}

export const apiClient = new ApiClient(CONFIG.API_BASE_URL);
export default apiClient;
