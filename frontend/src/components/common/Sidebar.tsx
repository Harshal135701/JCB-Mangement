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
  const { user } = useAuth();
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
      badgeColor: 'bg-red-500 text-white'
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

      {/* Sidebar Aside: Full-height JCB Excavator Background properly adjusted from very top to bottom */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 h-screen text-white flex flex-col justify-between shrink-0 border-r border-zinc-800 transition-transform duration-200 ease-in-out select-none shadow-2xl overflow-hidden relative ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{
          backgroundImage: `url('/jcb-excavator-adjusted.jpg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center bottom',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Subtle dark overlay so menu text and icons remain clearly readable */}
        <div className="absolute inset-0 bg-[#070A12]/30 pointer-events-none z-0" />

        {/* =========================================================================
            BRAND HEADER & NAVIGATION ITEMS (Displayed above full-height background)
            ========================================================================= */}
        <div className="relative z-10 flex flex-col flex-1 min-h-0">
          {/* Brand Header */}
          <div className="px-4 py-4 flex items-center justify-between border-b border-white/10 bg-black/25 backdrop-blur-xs shrink-0">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="bg-jcb-yellow text-black font-black text-xl px-2.5 py-0.5 rounded shadow-md tracking-widest flex items-center justify-center border border-jcb-yellowDark group-hover:scale-105 transition-transform">
                JCB
              </div>
              <div className="min-w-0">
                <h1 className="font-black text-xs tracking-wider text-white">SMART CMMS</h1>
                <p className="text-[10px] text-zinc-300 font-semibold truncate max-w-[130px]">
                  {user?.plantName || 'Plant 1: Ballabgarh'}
                </p>
              </div>
            </Link>

            {/* Mobile Close Button */}
            <button
              onClick={onMobileClose}
              className="lg:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links: Increased vertical spacing between items with comfortable padding */}
          <nav className="p-3 space-y-2 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path + item.name}
                  to={item.path}
                  onClick={onMobileClose}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all relative shrink-0 group ${
                    isActive
                      ? 'bg-jcb-yellow text-zinc-950 font-black shadow-md'
                      : 'text-zinc-200 hover:bg-white/15 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-zinc-950 font-bold' : 'text-zinc-300 group-hover:text-white'}`} />
                  <span className="truncate flex-1 tracking-tight">{item.name}</span>

                  {/* Badge if present (Red badge matching reference) */}
                  {item.badge && !isActive && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 bg-red-500 text-white">
                      {item.badge}
                    </span>
                  )}

                  {/* Active Right Chevron */}
                  {isActive && (
                    <ChevronRight className="w-4 h-4 text-zinc-950 shrink-0 ml-auto" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Subtle Bottom Slogan: Building a Smarter Tomorrow */}
          <div className="px-4 pb-3 pt-1 shrink-0 pointer-events-none select-none">
            <span className="text-[11px] font-black uppercase tracking-tight text-white block drop-shadow-md">
              Building a <span className="text-jcb-yellow">Smarter Tomorrow</span>
            </span>
            <div className="w-8 h-0.5 bg-jcb-yellow mt-1 rounded-full shadow-sm" />
          </div>
        </div>

      </aside>
    </>
  );
};
