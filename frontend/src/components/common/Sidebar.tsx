import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Activity,
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
  Boxes,
  X,
  ChevronRight,
  BarChart3,
  Network
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

  const userRole = (user?.role || 'manager') as UserRole;

  // Role-tailored navigation items matching plain English factory worker standards
  const roleNavItems: Record<UserRole, NavItem[]> = {
    admin: [
      { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard, roles: ['admin'] },
      // { name: 'Live Shop Floor', path: '/dashboard', icon: Activity, roles: ['admin'] },
      // { name: 'Factory Structure', path: '/organization/hierarchy', icon: Network, roles: ['admin'] },
      { name: 'Staff Personnel', path: '/users', icon: Users, roles: ['admin'] },
      { name: 'Daily Safety Checks', path: '/inspections', icon: ClipboardCheck, roles: ['admin'] },
      { name: 'Machines & Equipment', path: '/machines', icon: Cpu, roles: ['admin'] },
      { name: 'Repair Jobs', path: '/work-orders', icon: Wrench, roles: ['admin'] },
      { name: 'Spare Parts Catalog', path: '/inventory', icon: Package, roles: ['admin'] },
      { name: 'Buying & Orders', path: '/procurement', icon: ShoppingCart, roles: ['admin'] },
      { name: 'Regular Maintenance', path: '/pm', icon: Calendar, roles: ['admin'] },
      { name: 'Machine Stopped Time', path: '/downtime', icon: Clock, roles: ['admin'] },
      { name: 'Gate Passes', path: '/rdc', icon: FileText, roles: ['admin'] },
      { name: 'Audit Trail', path: '/audit', icon: ShieldCheck, roles: ['admin'] },
      { name: 'Reports', path: '/reports', icon: BarChart3, roles: ['admin'] },
    ],
    manager: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['manager'] },
      // { name: 'Factory Structure', path: '/organization/hierarchy', icon: Network, roles: ['manager'] },
      { name: 'Technician Management', path: '/users', icon: Users, roles: ['manager'] },
      { name: 'Daily Safety Checks', path: '/inspections', icon: ClipboardCheck, roles: ['manager'] },
      { name: 'Fault Reports', path: '/triage', icon: AlertTriangle, roles: ['manager'] },
      { name: 'Repair Jobs', path: '/work-orders', icon: Wrench, roles: ['manager'] },
      { name: 'Machines & Lines', path: '/machines', icon: Cpu, roles: ['manager'] },
      { name: 'Buying Approvals', path: '/procurement', icon: ShoppingCart, roles: ['manager'] },
      { name: 'Regular Maintenance', path: '/pm', icon: Calendar, roles: ['manager'] },
      { name: 'Machine Stopped Time', path: '/downtime', icon: Clock, roles: ['manager'] },
      { name: 'Gate Passes', path: '/rdc', icon: FileText, roles: ['manager'] },
      { name: 'Audit Trail', path: '/audit', icon: ShieldCheck, roles: ['manager'] },
      { name: 'Reports', path: '/reports', icon: BarChart3, roles: ['manager'] },
    ],
    technician: [
      { name: 'Dashboard', path: '/technician/dashboard', icon: LayoutDashboard, roles: ['technician'] },
      { name: 'Daily Safety Checks', path: '/inspections', icon: ClipboardCheck, roles: ['technician'] },
      { name: 'Repair Jobs', path: '/work-orders', icon: Wrench, roles: ['technician'] },
      { name: 'Machine Details', path: '/machines', icon: Cpu, roles: ['technician'] },
      { name: 'Spare Parts', path: '/inventory', icon: Package, roles: ['technician'] },
      { name: 'Regular Maintenance', path: '/pm', icon: Calendar, roles: ['technician'] },
      { name: 'Gate Passes', path: '/rdc', icon: FileText, roles: ['technician'] },
      { name: 'Reports', path: '/reports', icon: BarChart3, roles: ['technician'] },
    ],
    operator: [
      { name: 'Dashboard', path: '/operator/dashboard', icon: HardHat, roles: ['operator'] },
      { name: 'Daily Safety Check', path: '/inspections/run', icon: ClipboardCheck, roles: ['operator'] },
      { name: 'Machine Details', path: '/machines', icon: Cpu, roles: ['operator'] },
      { name: 'Reports', path: '/reports', icon: BarChart3, roles: ['operator'] },
    ],
    store_manager: [
      { name: 'Dashboard', path: '/store/dashboard', icon: Boxes, roles: ['store_manager'] },
      { name: 'Spare Parts Stock', path: '/inventory', icon: Package, roles: ['store_manager'] },
      { name: 'Buying & Receiving', path: '/procurement', icon: ShoppingCart, roles: ['store_manager'] },
      { name: 'Delivery Passes', path: '/rdc', icon: FileText, roles: ['store_manager'] },
      { name: 'Part Requests from Jobs', path: '/work-orders', icon: Wrench, roles: ['store_manager'] },
      { name: 'Stock Audit Log', path: '/audit', icon: ShieldCheck, roles: ['store_manager'] },
      { name: 'Reports', path: '/reports', icon: BarChart3, roles: ['store_manager'] },
    ],
  };

  const navItems = roleNavItems[userRole] || roleNavItems.manager;

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
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 lg:w-[268px] h-screen text-white flex flex-col justify-between shrink-0 border-r border-zinc-800 transition-transform duration-200 ease-in-out select-none shadow-2xl overflow-hidden relative ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
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
                <h1 className="font-black text-sm tracking-wider text-white">SMART CMMS</h1>
                <p className="text-xs text-zinc-300 font-semibold truncate max-w-[150px]">
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
              // Cleanly normalize trailing slashes
              const currentPath = location.pathname.length > 1 && location.pathname.endsWith('/')
                ? location.pathname.slice(0, -1)
                : location.pathname;
              const itemPath = item.path.length > 1 && item.path.endsWith('/')
                ? item.path.slice(0, -1)
                : item.path;

              // Active when route matches exactly OR when on any nested child route (e.g. /work-orders/:id)
              const isActive =
                currentPath === itemPath ||
                (itemPath !== '/' && currentPath.startsWith(`${itemPath}/`)) ||
                (itemPath === '/inspections/run' && (currentPath === '/inspections' || currentPath.startsWith('/inspections/')));

              return (
                <Link
                  key={item.path + item.name}
                  to={item.path}
                  onClick={onMobileClose}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all relative shrink-0 group ${isActive
                    ? 'bg-jcb-yellow text-zinc-950 font-black shadow-md'
                    : 'text-zinc-200 hover:bg-white/15 hover:text-white'
                    }`}
                >
                  <Icon className={`w-[18px] h-[18px] shrink-0 transition-colors ${isActive ? 'text-zinc-950 font-bold' : 'text-zinc-300 group-hover:text-white'}`} />
                  <span className="truncate flex-1 tracking-tight">{item.name}</span>

                  {/* Badge if present (Red badge matching reference) */}
                  {item.badge && !isActive && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-bold shrink-0 bg-red-500 text-white">
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
            <span className="text-xs font-black uppercase tracking-tight text-white block drop-shadow-md">
              Building a <span className="text-jcb-yellow">Smarter Tomorrow</span>
            </span>
            <div className="w-8 h-0.5 bg-jcb-yellow mt-1 rounded-full shadow-sm" />
          </div>
        </div>

      </aside>
    </>
  );
};
