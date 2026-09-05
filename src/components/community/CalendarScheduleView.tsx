import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CalendarScheduleViewProps {
  schedules: any[];
  calYear: number;
  calMonth: number;
  selectedDateStr: string | null;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onSelectDate: (dateStr: string | null) => void;
}

export function CalendarScheduleView({
  schedules,
  calYear,
  calMonth,
  selectedDateStr,
  onPrevMonth,
  onNextMonth,
  onToday,
  onSelectDate,
}: CalendarScheduleViewProps) {
  // Map schedules
  const parsedSchedules = schedules.map((item) => {
    let details = { date: '', time: '', category: '정규 강의', color: 'purple', description: '' };
    try {
      if (item.content?.startsWith('{')) {
        details = JSON.parse(item.content);
      } else {
        details.description = item.content;
      }
    } catch (e) {}
    return {
      id: item.id,
      title: item.title,
      active: item.active,
      ...details,
    };
  });

  const todayStr = (() => {
    const todayObj = new Date();
    return `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
  })();

  const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
  const totalDays = new Date(calYear, calMonth + 1, 0).getDate();
  const prevTotalDays = new Date(calYear, calMonth, 0).getDate();

  const calendarCells = [];

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevTotalDays - i;
    const tempMonth = calMonth === 0 ? 11 : calMonth - 1;
    const tempYear = calMonth === 0 ? calYear - 1 : calYear;
    const dateString = `${tempYear}-${String(tempMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    calendarCells.push({ day: dayNum, month: tempMonth, year: tempYear, isCurrentMonth: false, dateString });
  }

  for (let i = 1; i <= totalDays; i++) {
    const dateString = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    calendarCells.push({ day: i, month: calMonth, year: calYear, isCurrentMonth: true, dateString });
  }

  const extraCells = calendarCells.length % 7 === 0 ? 0 : 7 - (calendarCells.length % 7);
  for (let i = 1; i <= extraCells; i++) {
    const tempMonth = calMonth === 11 ? 0 : calMonth + 1;
    const tempYear = calMonth === 11 ? calYear + 1 : calYear;
    const dateString = `${tempYear}-${String(tempMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    calendarCells.push({ day: i, month: tempMonth, year: tempYear, isCurrentMonth: false, dateString });
  }

  const visibleSchedules = parsedSchedules.filter((item) => {
    if (selectedDateStr) {
      return item.date === selectedDateStr;
    }
    const viewedPrefix = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
    return item.date?.startsWith(viewedPrefix);
  });

  visibleSchedules.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  const badgeColorMap: Record<string, string> = {
    purple: 'bg-purple-100 text-purple-700',
    rose: 'bg-rose-100 text-rose-700',
    blue: 'bg-blue-100 text-blue-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 space-y-4 shadow-xs text-left">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-purple-600" />
            강의 및 학사 일정
          </h2>
        </div>
        <Button
          onClick={onToday}
          variant="outline"
          size="sm"
          className="h-7.5 px-2.5 text-xs font-bold border-slate-200"
        >
          오늘
        </Button>
      </div>

      {/* Month Navigator */}
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrevMonth}
          className="h-7 w-7 rounded-lg text-slate-600"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-sm font-black text-slate-800">
          {calYear}년 {calMonth + 1}월
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNextMonth}
          className="h-7 w-7 rounded-lg text-slate-600"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-slate-500 py-1 bg-slate-50/70 rounded-lg">
        <div className="text-rose-500">일</div>
        <div>월</div>
        <div>화</div>
        <div>수</div>
        <div>목</div>
        <div>금</div>
        <div className="text-blue-500">토</div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((cell, idx) => {
          const cellSchedules = parsedSchedules.filter((s) => s.date === cell.dateString);
          const isSelected = selectedDateStr === cell.dateString;
          const isToday = todayStr === cell.dateString;
          const isSunday = idx % 7 === 0;
          const isSaturday = idx % 7 === 6;

          return (
            <div
              key={idx}
              onClick={() => {
                onSelectDate(selectedDateStr === cell.dateString ? null : cell.dateString);
              }}
              className={cn(
                "min-h-[58px] p-1 border rounded-lg transition-all cursor-pointer select-none flex flex-col justify-between text-left",
                cell.isCurrentMonth ? "bg-white border-slate-150" : "bg-slate-50/40 border-slate-100 opacity-40",
                isSelected ? "ring-2 ring-purple-600 bg-purple-50/30" : "hover:bg-slate-50"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-[10px] font-black rounded-full w-4.5 h-4.5 flex items-center justify-center",
                    isToday ? "bg-purple-600 text-white" : isSunday ? "text-rose-500" : isSaturday ? "text-blue-500" : "text-slate-700"
                  )}
                >
                  {cell.day}
                </span>
                {cellSchedules.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                )}
              </div>
              <div className="space-y-0.5 overflow-hidden">
                {cellSchedules.slice(0, 1).map((s) => (
                  <div
                    key={s.id}
                    className="text-[8.5px] font-black truncate bg-purple-50 text-purple-700 px-1 rounded leading-tight"
                  >
                    {s.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Schedule Detail Cards */}
      <div className="pt-2 space-y-2">
        <h3 className="text-xs font-black text-slate-700">
          {selectedDateStr ? `📅 ${selectedDateStr} 일정` : `📅 ${calMonth + 1}월 전체 일정`}
        </h3>
        {visibleSchedules.length === 0 ? (
          <div className="p-6 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400 font-bold">
            예정된 일정이 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {visibleSchedules.map((item) => (
              <div
                key={item.id}
                className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 flex flex-col gap-1.5 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge className={cn("border-none px-2 py-0 text-[9px] font-black", badgeColorMap[item.color || 'purple'] || badgeColorMap.purple)}>
                    {item.category || '정규 강의'}
                  </Badge>
                  <span className="text-[10px] text-slate-400 font-mono font-bold">
                    {item.date} {item.time}
                  </span>
                </div>
                <h4 className="text-xs font-black text-slate-800 line-clamp-1">{item.title}</h4>
                {item.description && (
                  <p className="text-[11px] text-slate-500 leading-normal line-clamp-2">{item.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
