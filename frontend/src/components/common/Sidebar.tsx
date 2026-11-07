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
  ChevronRight,
  Settings,
  Bell
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
    // Work Orders Master (Phase 3)
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
    // Pre-Shift Safety Inspections (Phase 2)
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

      {/* Sidebar Aside */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#111318] text-white flex flex-col justify-between shrink-0 border-r border-zinc-800 transition-transform duration-200 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full justify-between overflow-hidden">
          <div>
            {/* Brand Header */}
            <div className="p-4 flex items-center justify-between border-b border-zinc-800 bg-zinc-950">
              <Link to="/" className="flex items-center gap-3">
                <div className="bg-jcb-yellow text-black font-black text-xl px-2.5 py-1 rounded shadow-md tracking-widest flex items-center justify-center border border-jcb-yellowDark">
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

            {/* Role Navigation Links */}
            <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-275px)] scrollbar-thin">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path + item.name}
                    to={item.path}
                    onClick={onMobileClose}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all relative ${
                      isActive
                        ? 'bg-jcb-yellow text-black font-black shadow-sm'
                        : 'text-zinc-300 hover:bg-zinc-900/90 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-black' : 'text-zinc-400'}`} />
                    <span className="truncate flex-1">{item.name}</span>

                    {/* Badge if present */}
                    {item.badge && !isActive && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${item.badgeColor || 'bg-red-500 text-white'}`}>
                        {item.badge}
                      </span>
                    )}

                    {/* Active Right Chevron (Matching Image 2) */}
                    {isActive && (
                      <ChevronRight className="w-3.5 h-3.5 text-black shrink-0 ml-auto" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* =========================================================================
              BOTTOM EXCAVATOR IMAGE BANNER (Exact UI from Image 2 for all 4 modules)
              ========================================================================= */}
          <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/80">
            <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 group shadow-md">
              <img
                src="/hero-excavator-sunset.jpg"
                alt="JCB Equipment"
                className="w-full h-22 object-cover object-center brightness-90 group-hover:scale-105 transition-transform duration-500"
              />
              {/* Dark subtle gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />

              {/* Yellow Corner Triangle Accent (as in Image 2) */}
              <div 
                className="absolute bottom-0 right-0 w-8 h-8 bg-jcb-yellow pointer-events-none"
                style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
              />

              {/* Motto text */}
              <div className="absolute bottom-2 left-2.5 right-6 z-10 pointer-events-none">
                <span className="text-[11px] font-black tracking-tight text-white uppercase block leading-tight drop-shadow-sm">
                  Building a <br />
                  <span className="text-jcb-yellow">Smarter Tomorrow</span>
                </span>
              </div>
            </div>

            {/* User Profile Card & Sign Out */}
            <div className="mt-3 pt-2 flex items-center justify-between gap-2">
              <div className="truncate">
                <p className="text-xs font-black truncate text-white">{user?.fullName || 'User'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-jcb-yellow shrink-0" />
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider truncate">
                    {user?.role || 'OPERATOR'} {user?.employeeCode ? `• ${user.employeeCode}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={logout}
                className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 rounded-lg transition shrink-0"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </aside>
    </>
  );
};
