import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface ReportCardItem {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'amber' | 'green' | 'red' | 'blue';
}

interface ReportSummaryCardsProps {
  cards: ReportCardItem[];
}

export const ReportSummaryCards: React.FC<ReportSummaryCardsProps> = ({ cards }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        let badgeClass = 'bg-zinc-100 text-zinc-700 border-zinc-200';
        let valClass = 'text-zinc-900';

        if (card.variant === 'amber') {
          badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
          valClass = 'text-amber-800';
        } else if (card.variant === 'green') {
          badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
          valClass = 'text-emerald-800';
        } else if (card.variant === 'red') {
          badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
          valClass = 'text-rose-800';
        } else if (card.variant === 'blue') {
          badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
          valClass = 'text-blue-800';
        }

        return (
          <div
            key={idx}
            className={`p-3.5 rounded-xl border transition-shadow duration-150 shadow-xs bg-white ${badgeClass}`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500 truncate">
                {card.label}
              </span>
              {Icon && <Icon className="w-4 h-4 text-zinc-400 shrink-0" />}
            </div>
            <div className={`text-2xl font-black tracking-tight ${valClass}`}>
              {card.value}
            </div>
            {card.subtext && (
              <p className="text-[11px] text-zinc-500 mt-1 truncate">
                {card.subtext}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
