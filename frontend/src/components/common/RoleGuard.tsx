import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth, UserRole, getRoleHomeRoute } from '../../context/AuthContext';
import { ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react';

interface RoleGuardProps {
  allowedRoles?: UserRole[];
  children: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-zinc-900">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-jcb-yellow text-black font-black text-2xl px-5 py-2 rounded-lg shadow-md tracking-widest border-2 border-black">
            JCB
          </div>
          <div className="flex items-center gap-2 text-zinc-600 text-xs font-bold uppercase tracking-wider">
            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            <span>Verifying Session & Permissions...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const validRoles: UserRole[] = ['admin', 'manager', 'technician', 'operator', 'store_manager'];
  const isUnknownRole = !validRoles.includes(user.role);

  if (isUnknownRole || (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role))) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border-2 border-red-200 rounded-2xl p-8 text-center shadow-lg space-y-4">
          <div className="w-14 h-14 bg-red-100 text-red-700 rounded-2xl flex items-center justify-center mx-auto border border-red-200">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-zinc-950 uppercase tracking-tight">Access Restricted</h2>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Your role (<strong className="uppercase text-black">{user.role || 'UNKNOWN'}</strong>) does not have operational permissions to access this screen.
          </p>
          <div className="pt-2">
            <Link
              to={getRoleHomeRoute(user.role)}
              className="inline-flex items-center gap-2 bg-jcb-yellow hover:bg-amber-400 text-black text-xs font-black px-5 py-2.5 rounded-xl uppercase tracking-wider transition shadow-sm border border-amber-500"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to My Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
