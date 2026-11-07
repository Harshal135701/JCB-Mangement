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

      {/* Sidebar Aside */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 h-screen bg-[#111318] text-white flex flex-col justify-between shrink-0 border-r border-zinc-800 transition-transform duration-200 ease-in-out relative overflow-hidden select-none ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* =========================================================================
            BACKGROUND IMAGE LAYER (Sky at Top/Upside, JCB Excavator at Bottom/Down)
            Elongated to cover the entire sidebar background
            ========================================================================= */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <img
            src="/hero-excavator-sunset.jpg"
            alt="JCB Equipment Background"
            className="w-full h-full object-cover object-bottom filter brightness-[0.75] contrast-[1.15]"
          />
          {/* Dark gradient for the sky area so nav items and brand are razor-sharp */}
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950/85 to-transparent" />
          {/* Subtle bottom shadow gradient to anchor the user profile */}
          <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-zinc-950 via-zinc-950/90 to-transparent" />
          
          {/* Yellow corner triangle accent at lower right */}
          <div 
            className="absolute bottom-16 right-0 w-8 h-8 bg-jcb-yellow pointer-events-none opacity-80"
            style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
          />
        </div>

        {/* =========================================================================
            TOP SECTION: BRAND HEADER & NAVIGATION ITEMS
            (Positioned on the upper sky/dark gradient background)
            ========================================================================= */}
        <div className="relative z-10 flex flex-col min-h-0 flex-1">
          {/* Brand Header */}
          <div className="p-4 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xs shrink-0">
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

          {/* Role Navigation Links (Sleek scrollbar, stops above JCB machine) */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-none hover:scrollbar-thin">
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
                      : 'text-zinc-200 hover:bg-zinc-900/80 hover:text-white'
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
            MIDDLE-BOTTOM AREA: UNOBSTRUCTED JCB EXCAVATOR MACHINE
            "dont add anything on jcb image"
            This spacer ensures the excavator in the background is clearly visible!
            ========================================================================= */}
        <div className="relative z-0 h-28 pointer-events-none" />

        {/* =========================================================================
            BOTTOM USER PROFILE FOOTER: ADMIN NAME & ROLE
            Anchored, Solid & ALWAYS 100% VISIBLE (Never cut off!)
            ========================================================================= */}
        <div className="relative z-10 p-3.5 border-t border-zinc-800/90 bg-zinc-950/95 backdrop-blur-md shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-jcb-yellow text-black font-black text-xs flex items-center justify-center shrink-0 border border-amber-500 shadow-xs">
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
