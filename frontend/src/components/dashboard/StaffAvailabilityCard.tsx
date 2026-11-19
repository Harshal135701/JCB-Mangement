import React, { useState } from 'react';
import { Users, UserCheck, Shield, Wrench, ArrowRight, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface StaffMember {
  id: string;
  fullName: string;
  employeeCode: string;
  email: string;
  role: 'technician' | 'operator' | 'manager' | 'admin' | 'store_manager' | string;
  isActive: boolean;
  department?: string | null;
  designation?: string | null;
  shift?: string | null;
  plantName?: string | null;
  shopName?: string | null;
}

interface StaffAvailabilityCardProps {
  users?: StaffMember[];
  loading?: boolean;
  emptyMessage?: string;
}

export const StaffAvailabilityCard: React.FC<StaffAvailabilityCardProps> = ({
  users = [],
  loading = false,
  emptyMessage = 'No personnel registered for this facility scope',
}) => {
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'TECHNICIAN' | 'OPERATOR'>('ALL');

  // Filter technicians and operators
  const operationalStaff = users.filter((u) =>
    ['technician', 'operator', 'manager'].includes(u.role?.toLowerCase())
  );

  const technicianCount = users.filter((u) => u.role?.toLowerCase() === 'technician').length;
  const operatorCount = users.filter((u) => u.role?.toLowerCase() === 'operator').length;
  const activeCount = users.filter((u) => u.isActive).length;

  const filteredStaff = operationalStaff.filter((u) => {
    if (roleFilter === 'TECHNICIAN') return u.role?.toLowerCase() === 'technician';
    if (roleFilter === 'OPERATOR') return u.role?.toLowerCase() === 'operator';
    return true;
  });

  const getRoleBadge = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'technician':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          label: 'Technician',
          icon: Wrench,
        };
      case 'operator':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          label: 'Operator',
          icon: Users,
        };
      case 'manager':
        return {
          bg: 'bg-blue-50 text-blue-800 border-blue-200',
          label: 'Manager',
          icon: Shield,
        };
      default:
        return {
          bg: 'bg-slate-100 text-zinc-700 border-slate-200',
          label: role,
          icon: Users,
        };
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-zinc-900 tracking-tight flex items-center gap-2">
                <span>Staff Availability</span>
              </h3>
            </div>
          </div>

          <Link
            to="/users"
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700 transition shrink-0"
          >
            <span>Directory</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Compact Summary Strip & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3 pt-1 border-t border-slate-100">
          {/* Quick Metrics */}
          <div className="flex items-center gap-3 text-xs text-zinc-600">
            <span>
              Total: <strong className="font-mono text-zinc-950 font-bold">{operationalStaff.length}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span>
              Technicians: <strong className="font-mono text-emerald-700 font-bold">{technicianCount}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span>
              Operators: <strong className="font-mono text-amber-700 font-bold">{operatorCount}</strong>
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 self-start sm:self-auto">
            {(
              [
                { key: 'ALL', label: `All (${operationalStaff.length})` },
                { key: 'TECHNICIAN', label: `Tech (${technicianCount})` },
                { key: 'OPERATOR', label: `Ops (${operatorCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setRoleFilter(tab.key)}
                className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  roleFilter === tab.key
                    ? 'bg-zinc-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-zinc-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Staff List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 text-zinc-400">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs text-zinc-500 font-medium">Checking staff roster...</span>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <span className="text-xs text-zinc-500">{emptyMessage}</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {filteredStaff.map((staff) => {
              const roleMeta = getRoleBadge(staff.role);
              const initials = staff.fullName
                ? staff.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
                : 'JB';

              return (
                <div
                  key={staff.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/40 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative">
                      <div className="w-7 h-7 rounded-full bg-zinc-800 text-white font-mono text-[11px] font-bold flex items-center justify-center">
                        {initials}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white ${
                          staff.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                        title={staff.isActive ? 'Active on duty' : 'Inactive'}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-zinc-950 truncate">
                          {staff.fullName}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400">
                          {staff.employeeCode}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-500 truncate block">
                        {staff.department || staff.designation || staff.shift || 'General Shift'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border shrink-0 ${roleMeta.bg}`}
                  >
                    {roleMeta.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-zinc-500">
        <span>Ready for Dispatch</span>
        <span className="font-semibold text-zinc-900 font-mono">
          {activeCount} Available
        </span>
      </div>
    </div>
  );
};
