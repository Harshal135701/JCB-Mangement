import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  AlertTriangle,
  Cpu,
  Layers,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { PMCalendarItem, PMCalendarMap, PMScheduleStatus } from '../types';

interface PMCalendarViewProps {
  calendarData: PMCalendarMap;
  selectedMonth: string; // YYYY-MM
  onMonthChange: (month: string) => void;
  onSelectPMItem: (item: PMCalendarItem) => void;
  loading?: boolean;
}

export const PMCalendarView: React.FC<PMCalendarViewProps> = ({
  calendarData,
  selectedMonth,
  onMonthChange,
  onSelectPMItem,
  loading = false,
}) => {
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ date: string; items: PMCalendarItem[] } | null>(null);

  // Parse current year & month
  const [yearNum, monthNum] = useMemo(() => {
    if (!selectedMonth || !/^\d{4}-\d{2}$/.test(selectedMonth)) {
      const now = new Date();
      return [now.getFullYear(), now.getMonth() + 1];
    }
    const [y, m] = selectedMonth.split('-').map(Number);
    return [y, m];
  }, [selectedMonth]);

  // Current month label
  const monthLabel = useMemo(() => {
    const d = new Date(yearNum, monthNum - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [yearNum, monthNum]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    let nextY = yearNum;
    let nextM = monthNum - 1;
    if (nextM < 1) {
      nextM = 12;
      nextY -= 1;
    }
    const str = `${nextY}-${String(nextM).padStart(2, '0')}`;
    onMonthChange(str);
  };

  const handleNextMonth = () => {
    let nextY = yearNum;
    let nextM = monthNum + 1;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }
    const str = `${nextY}-${String(nextM).padStart(2, '0')}`;
    onMonthChange(str);
  };

  const handleToday = () => {
    const now = new Date();
    const str = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange(str);
  };

  // Generate matrix for Month View
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(yearNum, monthNum - 1, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const daysInPrevMonth = new Date(yearNum, monthNum - 1, 0).getDate();

    const days: Array<{
      dateString: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Padding from previous month
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      let prevM = monthNum - 1;
      let prevY = yearNum;
      if (prevM < 1) {
        prevM = 12;
        prevY -= 1;
      }
      const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({
        dateString: dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateString: dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Padding for next month
    const totalSlots = Math.ceil(days.length / 7) * 7;
    const remaining = totalSlots - days.length;
    for (let d = 1; d <= remaining; d++) {
      let nextM = monthNum + 1;
      let nextY = yearNum;
      if (nextM > 12) {
        nextM = 1;
        nextY += 1;
      }
      const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateString: dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return days;
  }, [yearNum, monthNum]);

  // Week View calculation (current week of today or first week of month)
  const weekDays = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayIndex = calendarDays.findIndex((d) => d.dateString === todayStr);
    const startIdx = todayIndex !== -1 ? Math.floor(todayIndex / 7) * 7 : 0;
    return calendarDays.slice(startIdx, startIdx + 7);
  }, [calendarDays]);

  const activeDays = viewMode === 'month' ? calendarDays : weekDays;

  // Status badge styling helper
  const getBadgeStyle = (status: PMScheduleStatus) => {
    switch (status) {
      case 'overdue':
        return 'bg-rose-100 text-rose-900 border-rose-300';
      case 'due':
        return 'bg-amber-100 text-amber-950 border-amber-300 font-black';
      case 'upcoming':
      default:
        return 'bg-blue-50 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
      {/* Top Bar / Controls */}
      <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50/80">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 text-black p-2 rounded-lg font-black flex items-center justify-center shadow-xs">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-zinc-900 tracking-tight flex items-center gap-2">
              <span>{monthLabel}</span>
              {loading && <span className="text-xs text-zinc-400 font-normal animate-pulse">(Updating...)</span>}
            </h2>
            <p className="text-xs text-zinc-500">
              Interactive preventive maintenance calendar mapped to factory assets.
            </p>
          </div>
        </div>

        {/* Navigation & Mode Switches */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <div className="bg-zinc-200/70 p-0.5 rounded-lg flex items-center text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-md transition cursor-pointer ${
                viewMode === 'month' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Month View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded-md transition cursor-pointer ${
                viewMode === 'week' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Week View
            </button>
          </div>

          {/* Month Steppers */}
          <div className="flex items-center gap-1 bg-white border border-zinc-300 rounded-lg p-0.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Previous Month"
              className="p-1.5 hover:bg-zinc-100 rounded text-zinc-600 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-bold text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 rounded transition cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              title="Next Month"
              className="p-1.5 hover:bg-zinc-100 rounded text-zinc-600 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Weekday Header Row & Calendar Grid Matrix */}
      <div className="overflow-x-auto">
        <div className="min-w-[650px]">
          <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-100/70 text-center text-[11px] font-bold text-zinc-600 py-2">
            <span>SUN</span>
            <span>MON</span>
            <span>TUE</span>
            <span>WED</span>
            <span>THU</span>
            <span>FRI</span>
            <span>SAT</span>
          </div>

          {/* Calendar Grid Matrix */}
          <div className="grid grid-cols-7 divide-x divide-y divide-zinc-200 bg-zinc-200">
            {activeDays.map((day) => {
              const events = calendarData[day.dateString] || [];
              const hasOverdue = events.some((e) => e.schedule_status === 'overdue');
              const hasDue = events.some((e) => e.schedule_status === 'due');

              return (
                <div
                  key={day.dateString}
                  className={`min-h-[105px] p-2 flex flex-col justify-between transition ${
                    day.isCurrentMonth ? 'bg-white' : 'bg-zinc-50/60 text-zinc-400'
                  } ${day.isToday ? 'ring-2 ring-amber-500 ring-inset bg-amber-50/30' : ''}`}
                >
                  {/* Day Header */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-black w-6 h-6 flex items-center justify-center rounded-full ${
                        day.isToday
                          ? 'bg-amber-500 text-black shadow-xs'
                          : day.isCurrentMonth
                          ? 'text-zinc-900'
                          : 'text-zinc-400'
                      }`}
                    >
                      {day.dayNumber}
                    </span>

                    {/* Event Count Indicator */}
                    {events.length > 0 && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                          hasOverdue
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : hasDue
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                        }`}
                      >
                        {events.length} {events.length === 1 ? 'task' : 'tasks'}
                      </span>
                    )}
                  </div>

                  {/* Events in Day */}
                  <div className="space-y-1 mt-1.5 flex-1 overflow-hidden">
                    {events.slice(0, 3).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onSelectPMItem(item);
                          setSelectedDayEvents({ date: day.dateString, items: events });
                        }}
                        className={`w-full text-left p-1 rounded border text-[10px] transition cursor-pointer truncate flex items-center gap-1 ${getBadgeStyle(
                          item.schedule_status
                        )}`}
                      >
                        <span className="font-mono font-bold shrink-0">{item.machine_code}</span>
                        <span className="truncate">{item.title}</span>
                      </button>
                    ))}

                    {events.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setSelectedDayEvents({ date: day.dateString, items: events })}
                        className="text-[10px] text-amber-700 font-bold hover:underline block text-center cursor-pointer"
                      >
                        +{events.length - 3} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Day Events Drawer / Popover if user clicks "+X more" or details */}
      {selectedDayEvents && (
        <div className="p-4 border-t border-zinc-200 bg-amber-50/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-zinc-900">
              Scheduled PM on {new Date(selectedDayEvents.date).toLocaleDateString(undefined, { dateStyle: 'full' })}:
            </span>
            <span className="text-xs bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full">
              {selectedDayEvents.items.length} Activities
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {selectedDayEvents.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectPMItem(item)}
                className="px-2.5 py-1 bg-white border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 hover:border-amber-500 transition cursor-pointer flex items-center gap-1.5"
              >
                <span className="font-mono font-bold text-amber-700">{item.machine_code}</span>
                <span className="truncate max-w-[150px]">{item.title}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedDayEvents(null)}
              className="text-xs text-zinc-500 hover:text-zinc-800 ml-2 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
