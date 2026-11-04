import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  Cpu, 
  Package, 
  ShoppingCart, 
  FileText, 
  Calendar, 
  BarChart3, 
  ShieldCheck, 
  LogOut,
  Clock,
  Users
} from 'lucide-react';

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navLinks = [
    { name: 'Live Shopfloor', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Breakdown Triage', path: '/triage', icon: AlertTriangle },
    { name: '1,000+ Machines', path: '/machines', icon: Cpu },
    { name: '160k Spare Parts', path: '/inventory', icon: Package },
    { name: 'Purchase Queue (PR)', path: '/procurement', icon: ShoppingCart },
    { name: 'RDC Gate Passes', path: '/rdc', icon: FileText },
    { name: 'Preventive Maint (PM)', path: '/pm', icon: Calendar },
    { name: 'Downtime & Pareto', path: '/downtime', icon: Clock },
    { name: 'Audit History', path: '/audit', icon: ShieldCheck },
    ...(user?.role === 'admin' ? [{ name: 'Personnel & Techs', path: '/users', icon: Users }] : []),
  ];

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      {/* Sidebar - Deep JCB Black */}
      <aside className="w-64 bg-jcb-black text-white flex flex-col justify-between shrink-0 border-r border-zinc-800">
        <div>
          {/* JCB Iconic Header Badge */}
          <Link to="/" className="p-5 flex items-center gap-3.5 border-b border-zinc-800 bg-zinc-950 block hover:bg-black transition">
            <div className="bg-jcb-yellow text-black font-black text-2xl px-3 py-1 rounded shadow-md tracking-widest flex items-center justify-center border border-jcb-yellowDark">
              JCB
            </div>
            <div>
              <h1 className="font-black text-sm tracking-wider text-white">SMART CMMS</h1>
              <p className="text-[11px] text-zinc-400 font-semibold">Ballabgarh Works</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-170px)]">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs uppercase tracking-wider font-black transition-all ${
                    isActive
                      ? 'bg-jcb-yellow text-black shadow-md'
                      : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-black' : 'text-zinc-400'}`} />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Card */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950">
          <div className="flex items-center justify-between">
            <div className="truncate">
              <p className="text-xs font-black truncate text-white">{user?.fullName || 'Manager'}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-jcb-yellow"></span>
                <p className="text-[10px] text-zinc-400 uppercase font-black tracking-wider">
                  {user?.role?.toUpperCase() || 'MANAGER'}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 rounded-lg transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Top Header - Pure White */}
        <header className="bg-white border-b-2 border-zinc-200 h-16 px-6 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black px-3 py-1 bg-amber-50 text-amber-950 border border-amber-300 rounded-lg uppercase tracking-wider shadow-sm">
              Plant 1: Ballabgarh Works
            </span>
            <span className="text-xs text-zinc-500 font-bold hidden sm:inline">
              Shift A: 06:00 - 14:30 IST
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-black text-zinc-800">Telemetry & Supabase Live</span>
            </div>
          </div>
        </header>

        {/* Content Body - Pure White */}
        <main className="flex-1 overflow-y-auto p-6 bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
