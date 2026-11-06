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
  X
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
    // Machines Master
    { 
      name: 'Machines', 
      path: '/machines', 
      icon: Cpu, 
      roles: ['admin', 'manager', 'technician', 'operator'] 
    },
    // Work Orders Master (Phase 3)
    { 
      name: 'Work Orders', 
      path: '/work-orders', 
      icon: Wrench, 
      roles: ['admin', 'manager', 'technician'] 
    },
    // Preventive Maintenance
    { 
      name: 'Preventive Maintenance', 
      path: '/pm', 
      icon: Calendar, 
      roles: ['admin', 'manager', 'technician'] 
    },
    // Breakdowns / Triage
    { 
      name: 'Breakdowns', 
      path: '/triage', 
      icon: AlertTriangle, 
      roles: ['manager', 'admin'] 
    },
    // Pre-Shift Inspection (Phase 2)
    {
      name: 'Pre-Shift Inspection',
      path: '/inspections/run',
      icon: ClipboardCheck,
      roles: ['operator', 'manager', 'admin']
    },
    // Spare Parts Inventory
    { 
      name: 'Inventory', 
      path: '/inventory', 
      icon: Package, 
      roles: ['admin', 'manager', 'technician'] 
    },
    // Purchase Requisition
    { 
      name: 'Purchase Requisition', 
      path: '/procurement', 
      icon: ShoppingCart, 
      roles: ['admin', 'manager'] 
    },
    // Gate Passes (RDC)
    { 
      name: 'RDC Gate Passes', 
      path: '/rdc', 
      icon: FileText, 
      roles: ['admin', 'manager'] 
    },
    // Reports & Analytics
    { 
      name: 'Reports & Analytics', 
      path: '/downtime', 
      icon: Clock, 
      roles: ['admin', 'manager'] 
    },
    // Personnel & Techs
    { 
      name: 'Personnel Management', 
      path: '/users', 
      icon: Users, 
      roles: ['admin'] 
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
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-jcb-black text-white flex flex-col justify-between shrink-0 border-r border-zinc-800 transition-transform duration-200 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
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
                  {user?.plantName || 'Ballabgarh Works'}
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
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-175px)]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onMobileClose}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs uppercase tracking-wider font-black transition-all ${
                    isActive
                      ? 'bg-jcb-yellow text-black shadow-md'
                      : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-black' : 'text-zinc-400'}`} />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Profile Card & Sign Out */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate">
              <p className="text-xs font-black truncate text-white">{user?.fullName || 'User'}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-jcb-yellow shrink-0"></span>
                <p className="text-[10px] text-zinc-400 uppercase font-black tracking-wider truncate">
                  {user?.role || 'OPERATOR'} {user?.employeeCode ? `• ${user.employeeCode}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 rounded-lg transition shrink-0"
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
