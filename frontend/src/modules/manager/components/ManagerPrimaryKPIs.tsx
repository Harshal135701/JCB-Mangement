import React from 'react';
import {
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Clock,
  ShieldCheck,
} from 'lucide-react';

interface ManagerPrimaryKPIsProps {
  totalMachines: number;
  runningMachines: number;
  idleMachines: number;
  breakdownMachines: number;
  maintenanceMachines: number;
  activeWorkOrders: number;
  openWorkOrders: number;
  inProgressWorkOrders: number;
  overdueWorkOrders: number;
  completedWorkOrders: number;
  machineAvailabilityPercent: number;
}

export const ManagerPrimaryKPIs: React.FC<ManagerPrimaryKPIsProps> = ({
  totalMachines,
  runningMachines,
  idleMachines,
  breakdownMachines,
  maintenanceMachines,
  activeWorkOrders,
  openWorkOrders,
  inProgressWorkOrders,
  overdueWorkOrders,
  completedWorkOrders,
  machineAvailabilityPercent,
}) => {
  const machinesDown = breakdownMachines + maintenanceMachines;

  const kpis = [
    {
      id: 'kpi-total-machines',
      title: 'Total Machines',
      value: totalMachines,
      subtitle: `${idleMachines} idle • ${runningMachines} in production`,
      badge: 'Plant Fleet',
      badgeColor: 'bg-slate-100 text-zinc-700 border-slate-200',
      icon: Cpu,
      iconBg: 'bg-amber-100 text-amber-800 border-amber-200',
      borderHover: 'hover:border-amber-400',
    },
    {
      id: 'kpi-operational-machines',
      title: 'Operational Machines',
      value: runningMachines,
      subtitle: `${machineAvailabilityPercent}% fleet uptime availability`,
      badge: 'Running',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      borderHover: 'hover:border-emerald-400',
    },
    {
      id: 'kpi-machines-down',
      title: 'Machines Down',
      value: machinesDown,
      subtitle: `${breakdownMachines} breakdown • ${maintenanceMachines} under repair`,
      badge: machinesDown > 0 ? `${machinesDown} Offline` : 'Optimal',
      badgeColor:
        machinesDown > 0
          ? 'bg-rose-50 text-rose-700 border-rose-200 font-extrabold'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: AlertTriangle,
      iconBg:
        machinesDown > 0
          ? 'bg-rose-100 text-rose-800 border-rose-200'
          : 'bg-emerald-100 text-emerald-800 border-emerald-200',
      borderHover: machinesDown > 0 ? 'hover:border-rose-400' : 'hover:border-emerald-400',
    },
    {
      id: 'kpi-active-work-orders',
      title: 'Active Work Orders',
      value: activeWorkOrders,
      subtitle: `${openWorkOrders} open • ${inProgressWorkOrders} in progress`,
      badge: 'In Execution',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: Wrench,
      iconBg: 'bg-blue-100 text-blue-800 border-blue-200',
      borderHover: 'hover:border-blue-400',
    },
    {
      id: 'kpi-overdue-work-orders',
      title: 'Overdue Work Orders',
      value: overdueWorkOrders,
      subtitle:
        overdueWorkOrders > 0
          ? 'Exceeded resolution SLA deadline'
          : 'All work orders within SLA targets',
      badge: overdueWorkOrders > 0 ? `${overdueWorkOrders} Breached` : 'On Schedule',
      badgeColor:
        overdueWorkOrders > 0
          ? 'bg-rose-50 text-rose-700 border-rose-200 font-extrabold'
          : 'bg-slate-100 text-zinc-700 border-slate-200',
      icon: Clock,
      iconBg:
        overdueWorkOrders > 0
          ? 'bg-rose-100 text-rose-800 border-rose-200'
          : 'bg-slate-100 text-zinc-700 border-slate-200',
      borderHover: overdueWorkOrders > 0 ? 'hover:border-rose-400' : 'hover:border-slate-300',
    },
    {
      id: 'kpi-resolved-work-orders',
      title: 'Resolved Work Orders',
      value: completedWorkOrders,
      subtitle: 'Verified & closed successfully',
      badge: 'Fulfilled',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: ShieldCheck,
      iconBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      borderHover: 'hover:border-emerald-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4">
      {kpis.map((kpi) => {
        const IconComponent = kpi.icon;
        return (
          <div
            key={kpi.id}
            className={`bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-4.5 shadow-xs transition-all duration-150 flex flex-col justify-between ${kpi.borderHover}`}
          >
            {/* Top row: Icon + Badge */}
            <div className="flex items-center justify-between mb-3">
              <div
                className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${kpi.iconBg}`}
              >
                <IconComponent className="w-4.5 h-4.5" />
              </div>
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${kpi.badgeColor}`}
              >
                {kpi.badge}
              </span>
            </div>

            {/* Middle: Value + Title */}
            <div>
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950 font-mono">
                {kpi.value.toLocaleString()}
              </div>
              <div className="text-[11px] font-black uppercase tracking-wider text-zinc-600 mt-1">
                {kpi.title}
              </div>
            </div>

            {/* Bottom: Subtle Subtitle */}
            <div className="pt-2.5 mt-2.5 border-t border-slate-100 text-2xs font-medium text-zinc-500 truncate">
              {kpi.subtitle}
            </div>
          </div>
        );
      })}
    </div>
  );
};
