import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import apiClient from '../api/client';

export interface NotificationItem {
  id: string;
  recipient_id?: string;
  title: string;
  message: string;
  type?: string;
  notification_type?: string;
  link_url?: string;
  action_url?: string;
  entity_type?: string;
  entity_id?: string;
  plant_id?: string;
  shop_id?: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  unreadCount: number;
  notifications: NotificationItem[];
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  latestAlert: NotificationItem | null;
  clearLatestAlert: () => void;
}

const SocketContext = createContext<SocketContextType>({} as SocketContextType);

const getSocketUrl = (): string => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:5000';
  }
  return window.location.origin;
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [latestAlert, setLatestAlert] = useState<NotificationItem | null>(null);

  const socketRef = useRef<Socket | null>(null);

  // Fetch initial persisted notifications from REST API
  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const [listRes, countRes] = await Promise.all([
        apiClient.get('/notifications?limit=30'),
        apiClient.get('/notifications/unread-count').catch(() => ({ data: { unread_count: 0 } })),
      ]);

      if (listRes.data?.success && Array.isArray(listRes.data.data)) {
        setNotifications(listRes.data.data);
      }
      if (countRes.data?.success && typeof countRes.data.unread_count === 'number') {
        setUnreadCount(countRes.data.unread_count);
      } else if (listRes.data?.unread_count !== undefined) {
        setUnreadCount(listRes.data.unread_count);
      }
    } catch {
      // Graceful error suppression if backend is temporarily starting up
    }
  }, [token]);

  // Mark single notification as read
  const markAsRead = useCallback(async (id: string) => {
    if (!id || id.startsWith('notif-')) {
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_read: true } : item))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      return;
    }
    try {
      await apiClient.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_read: true } : item))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.warn('[Notifications] Failed to mark as read:', err);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      await apiClient.put('/notifications/mark-all-read');
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('[Notifications] Failed to mark all as read:', err);
    }
  }, []);

  const clearLatestAlert = useCallback(() => {
    setLatestAlert(null);
  }, []);

  // Socket.IO lifecycle tied to authenticated user session
  useEffect(() => {
    if (!token || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const socketUrl = getSocketUrl();
    const s = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = s;
    setSocket(s);

    s.on('connect', () => {
      setIsConnected(true);
      fetchNotifications();
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    s.on('connect_error', (err) => {
      console.warn('[Socket.IO] Connection error:', err.message);
      setIsConnected(false);
    });

    // Real-time notification arrival
    // Note: Backend emits both 'notification:new' and legacy 'notification'.
    // Listening strictly to 'notification:new' prevents duplicate alert dispatches.
    const handleNewNotification = (notif: NotificationItem) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notif.id)) return prev;
        return [notif, ...prev];
      });
      setLatestAlert(notif);
    };

    s.on('notification:new', handleNewNotification);

    s.on('notification:unread-count', (payload: { unread_count: number }) => {
      if (typeof payload?.unread_count === 'number') {
        setUnreadCount(payload.unread_count);
      }
    });

    s.on('notification:read', (payload: { id: string }) => {
      if (payload?.id) {
        setNotifications((prev) =>
          prev.map((item) => (item.id === payload.id ? { ...item, is_read: true } : item))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    });

    s.on('notification:all-read', () => {
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
    });

    // Initial fetch on mount
    fetchNotifications();

    return () => {
      s.off('notification:new', handleNewNotification);
      s.off('notification:unread-count');
      s.off('notification:read');
      s.off('notification:all-read');
      s.disconnect();
      socketRef.current = null;
    };
  }, [token, user?.id, fetchNotifications]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        unreadCount,
        notifications,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        latestAlert,
        clearLatestAlert,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
