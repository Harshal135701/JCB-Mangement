import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  Cpu, 
  Package, 
  BarChart3, 
  LogOut, 
  ShieldCheck 
} from 'lucide-react';

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navLinks = [
    { name: 'Live Shopfloor', path: '/', icon: LayoutDashboard },
    { name: 'Triage & Allocation', path: '/triage', icon: AlertTriangle },
    { name: 'Machine Master', path: '/machines', icon: Cpu },
    { name: '160k Spare Parts', path: '/inventory', icon: Package },
    { name: 'Analytics & KPIs', path: '/analytics', icon: BarChart3 },
  ];

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-jcb-charcoal text-white flex flex-col justify-between shrink-0">
        <div>
          {/* JCB Brand Title */}
          <div className="p-5 flex items-center gap-3 border-b border-slate-800">
            <div className="bg-jcb-yellow text-black font-black text-xl px-2.5 py-1 rounded tracking-wider shadow">
              JCB
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide">SMART CMMS</h1>
              <p className="text-xs text-slate-400">Ballabgarh Works</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-jcb-yellow text-black font-bold shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-black' : 'text-slate-400'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <div className="truncate">
              <p className="text-sm font-semibold truncate text-slate-200">{user?.fullName || 'Manager'}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-jcb-yellow" />
                <p className="text-xs text-slate-400 capitalize">{user?.role?.replace('_', ' ') || 'Manager'}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 h-14 px-6 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
              Plant 1: Ballabgarh Heavy Excavators
            </span>
            <span className="text-xs text-slate-500">
              Shift A: 06:00 - 14:30
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-medium text-slate-600">PostgreSQL Cloud Connected</span>
            </div>
          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

