import React from 'react';

export type StatusType = 
  | 'running' 
  | 'operational' 
  | 'breakdown' 
  | 'under_maintenance' 
  | 'awaiting_parts' 
  | 'critical' 
  | 'high' 
  | 'medium' 
  | 'low' 
  | 'new' 
  | 'pending_review' 
  | 'in_progress' 
  | 'submitted_verification' 
  | 'verified_closed' 
  | 'rework_required' 
  | 'on_hold'
  | 'reopened'
  | 'completed'
  | 'pass' 
  | 'flagged' 
  | 'fail'
  | string;

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, size = 'sm' }) => {
  const norm = (status || '').toLowerCase().trim();

  let colorClasses = 'bg-zinc-100 text-zinc-700 border-zinc-200';
  let dotColor = 'bg-zinc-400';

  // Green statuses
  if (['running', 'operational', 'verified_closed', 'completed', 'pass', 'approved'].includes(norm)) {
    colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-300';
    dotColor = 'bg-emerald-500';
  } 
  // Red statuses
  else if (['breakdown', 'critical', 'fail', 'rejected'].includes(norm)) {
    colorClasses = 'bg-red-50 text-red-800 border-red-300';
    dotColor = 'bg-red-500 animate-pulse';
  } 
  // Amber / Warning statuses
  else if (['under_maintenance', 'awaiting_parts', 'high', 'flagged', 'waiting_for_parts', 'rework_required', 'on_hold', 'waiting_for_approval'].includes(norm)) {
    colorClasses = 'bg-amber-50 text-amber-900 border-amber-300';
    dotColor = 'bg-amber-500';
  } 
  // Purple / Verification statuses
  else if (['submitted_verification', 'verification_pending'].includes(norm)) {
    colorClasses = 'bg-purple-50 text-purple-900 border-purple-300';
    dotColor = 'bg-purple-500';
  }
  // Orange / Reopened statuses
  else if (['reopened'].includes(norm)) {
    colorClasses = 'bg-orange-50 text-orange-900 border-orange-300';
    dotColor = 'bg-orange-500';
  }
  // Blue / Info statuses
  else if (['new', 'pending_review', 'assigned', 'accepted', 'scheduled', 'under_diagnosis', 'in_progress', 'medium'].includes(norm)) {
    colorClasses = 'bg-blue-50 text-blue-800 border-blue-300';
    dotColor = 'bg-blue-500';
  } 
  // Gray / Low statuses
  else if (['low', 'closed', 'cancelled'].includes(norm)) {
    colorClasses = 'bg-zinc-100 text-zinc-600 border-zinc-300';
    dotColor = 'bg-zinc-400';
  }

  const displayText = label || norm.replace(/_/g, ' ').toUpperCase();
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-md border ${colorClasses} ${sizeClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
      <span>{displayText}</span>
    </span>
  );
};
