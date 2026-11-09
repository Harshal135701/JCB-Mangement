import React, { useState, useEffect, useRef } from 'react';
import { useAuth, getRoleHomeRoute } from '../../context/AuthContext';
import { useSocket, NotificationItem } from '../../context/SocketContext';
import { 
  Bell, 
  User as UserIcon, 
  LogOut, 
  Menu, 
  ChevronDown, 
  Check, 
  CheckCheck,
  ExternalLink,
  Shield,
  MapPin,
  Search,
  Wifi,
  WifiOff,
  AlertCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface HeaderProps {
  onMobileMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMobileMenuToggle }) => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, isConnected } = useSocket();
  const navigate = useNavigate();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

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

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.is_read) {
      await markAsRead(item.id);
    }
    setIsNotifOpen(false);

    const targetUrl = item.link_url || item.action_url;
    if (targetUrl) {
      navigate(targetUrl);
    }
  };

  const getBadgeStyle = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'critical':
      case 'alert':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'warning':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'assignment':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'approval':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);

      if (diffSecs < 60) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

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
            {user?.plantName || (user ? 'JCB Manufacturing Works' : '')}
          </span>
          {user?.shopName && (
            <span className="hidden md:inline text-amber-800 font-semibold border-l border-amber-300 pl-1.5 ml-1.5">
              {user.shopName}
            </span>
          )}
        </div>
      </div>

      {/* Center: Global Search Bar */}
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
        {/* Real-Time Socket Connection Indicator */}
        <div
          className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition"
          title={isConnected ? 'Connected to Socket.IO real-time gateway' : 'Reconnecting to real-time gateway...'}
        >
          {isConnected ? (
            <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-700 bg-amber-50 border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>CONNECTING</span>
            </span>
          )}
        </div>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="p-2 rounded-xl text-zinc-600 hover:text-black hover:bg-zinc-100 transition relative cursor-pointer"
            title="System Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-bounce">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-zinc-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              {/* Dropdown Header */}
              <div className="p-3.5 bg-zinc-900 text-white flex items-center justify-between border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-jcb-yellow" />
                  <span className="text-xs font-black tracking-wider uppercase">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition cursor-pointer"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              {/* Notification Items List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-500 font-medium">
                    <p>No notifications for your account.</p>
                    <p className="text-[11px] text-zinc-400 mt-1">Real-time alerts will appear here automatically.</p>
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleNotificationClick(item)}
                      className={`p-3 text-xs transition cursor-pointer hover:bg-slate-50 ${
                        item.is_read ? 'bg-white text-zinc-600' : 'bg-amber-50/60 text-zinc-950 font-medium'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-zinc-950 text-xs leading-tight">{item.title}</h4>
                          {item.type && (
                            <span
                              className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded border ${getBadgeStyle(
                                item.type
                              )}`}
                            >
                              {item.type}
                            </span>
                          )}
                        </div>
                        {!item.is_read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(item.id);
                            }}
                            className="text-[10px] font-bold text-amber-800 hover:text-black flex items-center gap-1 shrink-0 px-1 py-0.5 rounded hover:bg-amber-100 transition"
                            title="Mark as read"
                          >
                            <Check className="w-3 h-3" />
                            <span>Read</span>
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-zinc-600 leading-relaxed text-[11px]">{item.message}</p>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatTimestamp(item.created_at)}</span>
                        </span>
                        {(item.link_url || item.action_url) && (
                          <span className="text-amber-800 hover:underline flex items-center gap-0.5 font-bold">
                            <span>Open</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
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
            className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50 transition cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-jcb-yellow font-black text-xs flex items-center justify-center uppercase">
              {user?.fullName?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-black text-zinc-950 truncate max-w-[120px] leading-tight">
                {user?.fullName || user?.employeeCode || 'User'}
              </p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                {user?.role ? user.role.toUpperCase() : ''}
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
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 font-bold transition text-xs cursor-pointer"
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
