import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient, {
  getStoredToken,
  getStoredRefreshToken,
  clearStoredAuth,
} from '../api/client';

export type UserRole = 'admin' | 'manager' | 'technician' | 'operator';

export interface User {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  role: UserRole;
  plantId?: string | null;
  shopId?: string | null;
  department?: string | null;
  designation?: string | null;
  shift?: string | null;
  phone?: string | null;
  plantName?: string | null;
  shopName?: string | null;
}

export const getRoleHomeRoute = (role?: string): string => {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'manager':
      return '/dashboard';
    case 'technician':
      return '/technician/dashboard';
    case 'operator':
      return '/operator/dashboard';
    default:
      // Never silently fall back to manager or other privileged roles
      return '/login';
  }
};

export const getStoredUser = (): User | null => {
  const raw = localStorage.getItem('jcb_user') || sessionStorage.getItem('jcb_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

interface AuthContextType {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  login: (identifier: string, password: string, rememberMe?: boolean) => Promise<User>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Synchronizes user profile with backend contract (handling both camelCase and snake_case fields)
  const syncProfile = useCallback(async (currentToken?: string): Promise<User | null> => {
    try {
      const config = currentToken ? { headers: { Authorization: `Bearer ${currentToken}` } } : {};
      const res = await apiClient.get('/auth/profile', config);

      if (res.data?.success && res.data?.data) {
        const p = res.data.data;
        const mappedUser: User = {
          id: p.id,
          employeeCode: p.employeeCode || p.employee_code,
          fullName: p.fullName || p.full_name,
          email: p.email,
          role: p.role,
          department: p.department ?? null,
          designation: p.designation ?? null,
          shift: p.shift ?? null,
          phone: p.phone ?? null,
          plantId: p.plantId ?? p.plant_id ?? null,
          shopId: p.shopId ?? p.shop_id ?? null,
          plantName: p.plantName ?? p.plant_name ?? null,
          shopName: p.shopName ?? p.shop_name ?? null,
        };

        setUser(mappedUser);

        // Update persistent storage
        const isSession = !localStorage.getItem('jcb_token') && !!sessionStorage.getItem('jcb_token');
        const storage = isSession ? sessionStorage : localStorage;
        storage.setItem('jcb_user', JSON.stringify(mappedUser));

        return mappedUser;
      }
      return null;
    } catch (err: any) {
      const status = err.response?.status;
      // Inactive, demoted, unauthenticated or deleted user -> invalidate session immediately
      if (status === 401 || status === 403 || status === 404) {
        clearStoredAuth();
        setUser(null);
        setToken(null);
        setRefreshToken(null);
      }
      return null;
    }
  }, []);

  // Initialize session on application mount
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const storedToken = getStoredToken();
      const storedRefreshToken = getStoredRefreshToken();
      const storedUser = getStoredUser();

      if (!storedToken || !storedUser) {
        if (isMounted) {
          clearStoredAuth();
          setUser(null);
          setToken(null);
          setRefreshToken(null);
          setIsLoading(false);
        }
        return;
      }

      if (isMounted) {
        setToken(storedToken);
        setRefreshToken(storedRefreshToken);
        setUser(storedUser);
      }

      // Strictly validate session against live backend /auth/profile before releasing loading guard
      await syncProfile(storedToken);

      if (isMounted) {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen to token refresh events emitted by apiClient
    const handleTokenRefreshed = (e: Event) => {
      const customEvent = e as CustomEvent<{ token: string; refreshToken?: string }>;
      if (customEvent.detail?.token && isMounted) {
        setToken(customEvent.detail.token);
        if (customEvent.detail.refreshToken) {
          setRefreshToken(customEvent.detail.refreshToken);
        }
      }
    };

    const handleSessionCleared = () => {
      if (isMounted) {
        setUser(null);
        setToken(null);
        setRefreshToken(null);
      }
    };

    window.addEventListener('auth:token-refreshed', handleTokenRefreshed);
    window.addEventListener('auth:session-cleared', handleSessionCleared);

    return () => {
      isMounted = false;
      window.removeEventListener('auth:token-refreshed', handleTokenRefreshed);
      window.removeEventListener('auth:session-cleared', handleSessionCleared);
    };
  }, [syncProfile]);

  const login = async (
    identifier: string,
    password: string,
    rememberMe: boolean = true
  ): Promise<User> => {
    const res = await apiClient.post('/auth/login', { identifier, password });

    if (res.data?.success && res.data?.data) {
      const { token: jwtToken, refreshToken: jwtRefreshToken, user: userData } = res.data.data;

      // Select target storage according to Remember Me selection
      const targetStorage = rememberMe ? localStorage : sessionStorage;
      const altStorage = rememberMe ? sessionStorage : localStorage;

      altStorage.removeItem('jcb_token');
      altStorage.removeItem('jcb_refresh_token');
      altStorage.removeItem('jcb_user');

      targetStorage.setItem('jcb_token', jwtToken);
      if (jwtRefreshToken) {
        targetStorage.setItem('jcb_refresh_token', jwtRefreshToken);
      }

      let mappedUser: User = {
        id: userData.id,
        employeeCode: userData.employeeCode || userData.employee_code,
        fullName: userData.fullName || userData.full_name,
        email: userData.email,
        role: userData.role,
        department: userData.department ?? null,
        designation: userData.designation ?? null,
        shift: userData.shift ?? null,
        phone: userData.phone ?? null,
        plantId: userData.plantId ?? userData.plant_id ?? null,
        shopId: userData.shopId ?? userData.shop_id ?? null,
        plantName: null,
        shopName: null,
      };

      setToken(jwtToken);
      setRefreshToken(jwtRefreshToken || null);
      setUser(mappedUser);
      targetStorage.setItem('jcb_user', JSON.stringify(mappedUser));

      // Retrieve full plant and shop metadata from /auth/profile
      const freshUser = await syncProfile(jwtToken);
      return freshUser || mappedUser;
    }

    throw new Error(res.data?.message || 'Authentication failed.');
  };

  const logout = () => {
    clearStoredAuth();
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  const refreshProfile = async () => {
    await syncProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        refreshToken,
        isLoading,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
