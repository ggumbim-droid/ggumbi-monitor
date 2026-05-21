"use client";

import type { SortOrder } from "@/types/monitor";

interface SortSelectProps {
  value: SortOrder;
  onChange: (value: SortOrder) => void;
  disabled?: boolean;
}

export function SortSelect({ value, onChange, disabled }: SortSelectProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-stone-700">정렬 방식</label>
      <div className="flex gap-2">
        {(
          [
            { id: "latest" as const, label: "최신순" },
            { id: "relevance" as const, label: "관련도순" },
          ] as const
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
              value === option.id
                ? "border-kkumbi-500 bg-kkumbi-500 text-white shadow-md"
                : "border-kkumbi-200 bg-white text-stone-600 hover:border-kkumbi-300"
            } disabled:opacity-40`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
