import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../api/client';

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
    case 'technician':
      return '/technician/dashboard';
    case 'operator':
      return '/operator/dashboard';
    case 'manager':
    default:
      return '/dashboard';
  }
};

interface AuthContextType {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<User>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = async () => {
    try {
      const res = await apiClient.get('/auth/profile');
      if (res.data?.success && res.data?.data) {
        const profile = res.data.data;
        setUser((prev) => {
          const updated = {
            ...(prev || {}),
            ...profile,
          };
          localStorage.setItem('jcb_user', JSON.stringify(updated));
          return updated;
        });
      }
    } catch {
      // Profile fetch failed (offline/network); retain stored state
    }
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('jcb_token');
    const storedRefreshToken = localStorage.getItem('jcb_refresh_token');
    const storedUser = localStorage.getItem('jcb_user');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setRefreshToken(storedRefreshToken);
        setUser(JSON.parse(storedUser));
        fetchProfile();
      } catch {
        localStorage.removeItem('jcb_token');
        localStorage.removeItem('jcb_refresh_token');
        localStorage.removeItem('jcb_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (identifier: string, password: string): Promise<User> => {
    const res = await apiClient.post('/auth/login', { identifier, password });
    if (res.data.success) {
      const { token: jwtToken, refreshToken: jwtRefreshToken, user: userData } = res.data.data;
      setToken(jwtToken);
      setRefreshToken(jwtRefreshToken);
      setUser(userData);

      localStorage.setItem('jcb_token', jwtToken);
      if (jwtRefreshToken) {
        localStorage.setItem('jcb_refresh_token', jwtRefreshToken);
      }
      localStorage.setItem('jcb_user', JSON.stringify(userData));

      try {
        const profileRes = await apiClient.get('/auth/profile', {
          headers: { Authorization: `Bearer ${jwtToken}` },
        });
        if (profileRes.data?.success && profileRes.data?.data) {
          const fullUser = { ...userData, ...profileRes.data.data };
          setUser(fullUser);
          localStorage.setItem('jcb_user', JSON.stringify(fullUser));
          return fullUser;
        }
      } catch {
        // Fall back to original user data
      }

      return userData;
    }
    throw new Error(res.data.message || 'Login failed.');
  };

  const logout = () => {
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    localStorage.removeItem('jcb_token');
    localStorage.removeItem('jcb_refresh_token');
    localStorage.removeItem('jcb_user');
    window.location.href = '/login';
  };

  const refreshProfile = async () => {
    await fetchProfile();
  };

  return (
    <AuthContext.Provider value={{ user, token, refreshToken, isLoading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);


