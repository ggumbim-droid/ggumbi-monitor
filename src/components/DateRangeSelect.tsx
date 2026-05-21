"use client";

import {
  formatMonitorPeriodLabel,
  getLastWeekRange,
  getRangeForPreset,
} from "@/lib/date-range";
import type { DateRangePreset, MonitorDateRange } from "@/types/monitor";

interface DateRangeSelectProps {
  value: MonitorDateRange;
  onChange: (range: MonitorDateRange) => void;
  disabled?: boolean;
}

const PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: "last_week", label: "지난주" },
  { id: "recent_2_weeks", label: "최근 2주" },
  { id: "this_month", label: "이번달" },
  { id: "custom", label: "직접 입력" },
];

export function DateRangeSelect({
  value,
  onChange,
  disabled,
}: DateRangeSelectProps) {
  const activePreset = value.preset ?? "last_week";

  const applyPreset = (preset: DateRangePreset) => {
    if (preset === "custom") {
      onChange({ ...value, preset: "custom" });
      return;
    }
    onChange(getRangeForPreset(preset));
  };

  const handleStartChange = (startDate: string) => {
    onChange({ startDate, endDate: value.endDate, preset: "custom" });
  };

  const handleEndChange = (endDate: string) => {
    onChange({ startDate: value.startDate, endDate, preset: "custom" });
  };

  const periodPreview = formatMonitorPeriodLabel(
    value.startDate,
    value.endDate
  );

  return (
    <div className="space-y-3">
      <label className="text-sm font-semibold text-stone-700">
        모니터링 기간
      </label>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            onClick={() => applyPreset(preset.id)}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              activePreset === preset.id
                ? "border-kkumbi-500 bg-kkumbi-500 text-white shadow-md"
                : "border-kkumbi-200 bg-white text-stone-600 hover:border-kkumbi-300"
            } disabled:opacity-40`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor="monitor-start-date"
            className="text-xs font-medium text-stone-500"
          >
            시작일
          </label>
          <input
            id="monitor-start-date"
            type="date"
            value={value.startDate}
            disabled={disabled}
            onChange={(e) => handleStartChange(e.target.value)}
            className="w-full rounded-xl border border-kkumbi-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-kkumbi-400 focus:ring-2 focus:ring-kkumbi-200 disabled:bg-stone-50"
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="monitor-end-date"
            className="text-xs font-medium text-stone-500"
          >
            종료일
          </label>
          <input
            id="monitor-end-date"
            type="date"
            value={value.endDate}
            disabled={disabled}
            onChange={(e) => handleEndChange(e.target.value)}
            className="w-full rounded-xl border border-kkumbi-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-kkumbi-400 focus:ring-2 focus:ring-kkumbi-200 disabled:bg-stone-50"
          />
        </div>
      </div>

      <p className="rounded-lg bg-kkumbi-50 px-3 py-2 text-xs text-kkumbi-800">
        선택 기간: <span className="font-semibold">{periodPreview}</span>
        {activePreset === "last_week" && (
          <span className="ml-1 text-kkumbi-600">(지난주 월~일)</span>
        )}
      </p>
    </div>
  );
}

/** 기본값: 지난주 월~일 */
export function getDefaultDateRange(): MonitorDateRange {
  return getLastWeekRange();
}
