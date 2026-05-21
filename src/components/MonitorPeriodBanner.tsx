"use client";

import { formatMonitorPeriodLabel } from "@/lib/date-range";
import type { MonitorDateRange } from "@/types/monitor";

interface MonitorPeriodBannerProps {
  period: MonitorDateRange;
}

export function MonitorPeriodBanner({ period }: MonitorPeriodBannerProps) {
  const label = formatMonitorPeriodLabel(period.startDate, period.endDate);

  return (
    <div className="rounded-xl border border-kkumbi-200 bg-gradient-to-r from-kkumbi-50 to-white px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-kkumbi-600">
        모니터링 기간
      </p>
      <p className="mt-1 text-base font-bold text-stone-800 sm:text-lg">
        {label}
      </p>
    </div>
  );
}
