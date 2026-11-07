import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '../../context/AuthContext';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  Cpu, 
  Package, 
  ShoppingCart, 
  FileText, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  Users, 
  Wrench, 
  HardHat, 
  ClipboardCheck,
  LogOut,
  X,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  roles: UserRole[];
  badge?: number | string;
  badgeColor?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, onMobileClose }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const allNavItems: NavItem[] = [
    // Manager Dashboard
    { 
      name: 'Dashboard', 
      path: '/dashboard', 
      icon: LayoutDashboard, 
      roles: ['manager'] 
    },
    // Admin Dashboard
    { 
      name: 'Dashboard', 
      path: '/admin/dashboard', 
      icon: LayoutDashboard, 
      roles: ['admin'] 
    },
    // Technician Dashboard
    { 
      name: 'Dashboard', 
      path: '/technician/dashboard', 
      icon: LayoutDashboard, 
      roles: ['technician'] 
    },
    // Operator Dashboard
    { 
      name: 'Dashboard', 
      path: '/operator/dashboard', 
      icon: HardHat, 
      roles: ['operator'] 
    },
    // Breakdowns / Maintenance Requests
    { 
      name: 'Maintenance Requests', 
      path: '/triage', 
      icon: AlertTriangle, 
      roles: ['manager', 'admin'],
      badge: 5,
      badgeColor: 'bg-red-500 text-white'
    },
    // Work Orders Master
    { 
      name: 'Work Orders', 
      path: '/work-orders', 
      icon: Wrench, 
      roles: ['admin', 'manager', 'technician'] 
    },
    // Personnel & Technician Management
    { 
      name: 'Technician Management', 
      path: '/users', 
      icon: Users, 
      roles: ['admin', 'manager'] 
    },
    // Preventive Maintenance
    { 
      name: 'Preventive Maintenance', 
      path: '/pm', 
      icon: Calendar, 
      roles: ['admin', 'manager', 'technician'] 
    },
    // Machines Master / Machine Monitoring
    { 
      name: 'Machine Monitoring', 
      path: '/machines', 
      icon: Cpu, 
      roles: ['admin', 'manager', 'technician', 'operator'] 
    },
    // Pre-Shift Safety Inspections
    {
      name: 'Pre-Shift Inspection',
      path: '/inspections/run',
      icon: ClipboardCheck,
      roles: ['operator', 'manager', 'admin']
    },
    // Spare Parts Inventory / Requests
    { 
      name: 'Spare Parts Requests', 
      path: '/inventory', 
      icon: Package, 
      roles: ['admin', 'manager', 'technician'] 
    },
    // Purchase Requisition / Procurement
    { 
      name: 'Purchase Requisition', 
      path: '/procurement', 
      icon: ShoppingCart, 
      roles: ['admin', 'manager'],
      badge: 2,
      badgeColor: 'bg-amber-500 text-black font-bold'
    },
    // Gate Passes (RDC)
    { 
      name: 'RDC Gate Passes', 
      path: '/rdc', 
      icon: FileText, 
      roles: ['admin', 'manager'] 
    },
    // Downtime & Analytics
    { 
      name: 'Downtime Management', 
      path: '/downtime', 
      icon: Clock, 
      roles: ['admin', 'manager'] 
    },
    // Audit Trail
    { 
      name: 'Audit Trail', 
      path: '/audit', 
      icon: ShieldCheck, 
      roles: ['admin', 'manager'] 
    },
  ];

  // Filter items visible to user's role
  const userRole = (user?.role || 'manager') as UserRole;
  const navItems = allNavItems.filter((item) => item.roles.includes(userRole));

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar Aside: Compact, perfectly proportioned so ALL fields are visible without scrolling */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 h-screen bg-[#111318] text-white flex flex-col justify-between shrink-0 border-r border-zinc-800 transition-transform duration-200 ease-in-out relative select-none ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Subtle Sky Glow in Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-amber-950/20 via-zinc-950 to-black pointer-events-none z-0" />

        {/* =========================================================================
            TOP SECTION: BRAND HEADER & NAVIGATION ITEMS
            Every field is visible at once (NO scrollbar needed!)
            ========================================================================= */}
        <div className="relative z-10 flex flex-col flex-1 min-h-0">
          {/* Brand Header */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/90 shrink-0">
            <Link to="/" className="flex items-center gap-3">
              <div className="bg-jcb-yellow text-black font-black text-xl px-2.5 py-0.5 rounded shadow-md tracking-widest flex items-center justify-center border border-jcb-yellowDark">
                JCB
              </div>
              <div>
                <h1 className="font-black text-xs tracking-wider text-white">SMART CMMS</h1>
                <p className="text-[10px] text-zinc-400 font-semibold truncate max-w-[130px]">
                  {user?.plantName || 'Plant 1: Ballabgarh'}
                </p>
              </div>
            </Link>

            {/* Mobile Close Button */}
            <button
              onClick={onMobileClose}
              className="lg:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links: Compact spacing so all items fit on screen without scrolling */}
          <nav className="p-2 space-y-0.5 overflow-hidden flex-1 flex flex-col justify-start">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path + item.name}
                  to={item.path}
                  onClick={onMobileClose}
                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all relative shrink-0 ${
                    isActive
                      ? 'bg-jcb-yellow text-black font-black shadow-sm'
                      : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-black' : 'text-zinc-400'}`} />
                  <span className="truncate flex-1">{item.name}</span>

                  {/* Badge if present */}
                  {item.badge && !isActive && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${item.badgeColor || 'bg-red-500 text-white'}`}>
                      {item.badge}
                    </span>
                  )}

                  {/* Active Right Chevron */}
                  {isActive && (
                    <ChevronRight className="w-3.5 h-3.5 text-black shrink-0 ml-auto" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* =========================================================================
            BOTTOM SECTION: BRIGHT, RECOGNIZABLE JCB EXCAVATOR + USER PROFILE
            ========================================================================= */}
        <div className="relative z-10 p-2.5 border-t border-zinc-800 bg-zinc-950 shrink-0">
          {/* JCB Excavator Card: BRIGHT & 100% RECOGNIZABLE */}
          <div className="relative rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 shadow-md mb-2">
            <img
              src="/hero-excavator-sunset.jpg"
              alt="JCB Heavy Excavator"
              className="w-full h-24 object-cover object-center filter brightness-105 contrast-105 hover:scale-105 transition-transform duration-500"
            />
            {/* Subtle bottom vignette for text contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

            {/* Yellow Corner Triangle Accent */}
            <div 
              className="absolute bottom-0 right-0 w-7 h-7 bg-jcb-yellow pointer-events-none shadow-sm"
              style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
            />

            {/* Motto */}
            <div className="absolute bottom-1.5 left-2 right-4 pointer-events-none">
              <span className="text-[10px] font-black tracking-tight text-white uppercase block leading-tight drop-shadow-md">
                Building a <span className="text-jcb-yellow">Smarter Tomorrow</span>
              </span>
            </div>
          </div>

          {/* User Profile Card: PROMINENT & NEVER CUT OFF */}
          <div className="px-1 pt-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-jcb-yellow text-black font-black text-xs flex items-center justify-center shrink-0 border border-amber-500 shadow-xs">
                {user?.fullName?.charAt(0) || 'A'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black truncate text-white leading-tight">
                  {user?.fullName || 'Rajesh Admin'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider truncate">
                    {user?.role || 'ADMIN'} {user?.employeeCode ? `• ${user.employeeCode}` : '• EMP-ADM-001'}
                  </p>
                </div>
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={logout}
              className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 rounded-lg transition shrink-0 cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

      </aside>
    </>
  );
};
