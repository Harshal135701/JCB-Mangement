import React, { useState, useEffect, useRef } from 'react';
import { useAuth, getRoleHomeRoute } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { 
  Bell, 
  User as UserIcon, 
  LogOut, 
  Menu, 
  ChevronDown, 
  Check, 
  ExternalLink,
  Shield,
  MapPin,
  Search
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface HeaderProps {
  onMobileMenuToggle: () => void;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  action_url?: string;
  is_read: boolean;
  created_at: string;
}

export const Header: React.FC<HeaderProps> = ({ onMobileMenuToggle }) => {
  const { user, logout } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Fetch verified notifications from backend
  const fetchNotifications = async () => {
    try {
      const res = await apiClient.get('/notifications');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setNotifications(res.data.data);
      }
    } catch {
      // Endpoint may be quiet or fail gracefully
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await apiClient.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch {
      // Mark read failed
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <header className="bg-white border-b-2 border-slate-200 h-16 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-xs z-30">
      {/* Left: Mobile Menu Toggle & Plant Badge */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 rounded-lg text-zinc-600 hover:text-black hover:bg-zinc-100 transition"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Verified Facility Indicator */}
        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-950 border border-amber-300 rounded-lg text-xs font-black uppercase tracking-wider">
          <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="truncate max-w-[200px] sm:max-w-none">
            {user?.plantName || 'Plant 1: Ballabgarh Works'}
          </span>
          {user?.shopName && (
            <span className="hidden md:inline text-amber-800 font-semibold border-l border-amber-300 pl-1.5 ml-1.5">
              {user.shopName}
            </span>
          )}
        </div>
      </div>

      {/* Center: Global Search Bar (matching Image 4) */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search machines, work orders..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-100 hover:bg-slate-200/80 focus:bg-white border border-slate-200 focus:border-amber-500 rounded-xl text-xs font-medium text-zinc-900 placeholder-zinc-400 transition focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Right: Notifications & User Profile Menu */}
      <div className="flex items-center gap-3">
        {/* Notifications Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="p-2 rounded-xl text-zinc-600 hover:text-black hover:bg-zinc-100 transition relative"
            title="System Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-zinc-200 rounded-2xl shadow-xl z-50 overflow-hidden">
              <div className="p-3.5 bg-zinc-900 text-white flex items-center justify-between border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-jcb-yellow" />
                  <span className="text-xs font-black tracking-wider uppercase">Notifications</span>
                </div>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {unreadCount} unread
                  </span>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-zinc-100">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-500 font-medium">
                    No active notifications for your account.
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 text-xs transition ${
                        item.is_read ? 'bg-white text-zinc-600' : 'bg-amber-50/50 text-zinc-950 font-medium'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-zinc-950">{item.title}</h4>
                        {!item.is_read && (
                          <button
                            onClick={() => handleMarkAsRead(item.id)}
                            className="text-[10px] font-bold text-amber-800 hover:text-black flex items-center gap-1 shrink-0"
                            title="Mark as read"
                          >
                            <Check className="w-3 h-3" />
                            <span>Read</span>
                          </button>
                        )}
                      </div>
                      <p className="mt-0.5 text-zinc-600 leading-relaxed text-[11px]">{item.message}</p>
                      <span className="block mt-1 text-[10px] text-zinc-400">
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50 transition"
          >
            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-jcb-yellow font-black text-xs flex items-center justify-center">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-black text-zinc-950 truncate max-w-[120px] leading-tight">
                {user?.fullName || 'Manager'}
              </p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                {user?.role || 'OPERATOR'}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 hidden sm:block" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-zinc-200 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-zinc-100">
              <div className="p-4 bg-zinc-50">
                <p className="text-xs font-black text-zinc-950">{user?.fullName}</p>
                <p className="text-[11px] text-zinc-500 truncate">{user?.email}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-jcb-yellow text-black border border-amber-400">
                    {user?.role}
                  </span>
                  {user?.employeeCode && (
                    <span className="text-[10px] text-zinc-500 font-mono font-bold">
                      {user.employeeCode}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-2 space-y-1 text-xs">
                <Link
                  to={getRoleHomeRoute(user?.role)}
                  onClick={() => setIsProfileOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-zinc-700 hover:bg-zinc-100 font-bold transition"
                >
                  <Shield className="w-4 h-4 text-zinc-500" />
                  <span>My Operational Dashboard</span>
                </Link>
              </div>

              <div className="p-2">
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 font-bold transition text-xs"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out of Portal</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
