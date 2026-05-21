"use client";

import { CHANNELS, ALL_CHANNEL_IDS } from "@/lib/channels";
import type { ChannelId } from "@/types/monitor";

interface ChannelSelectProps {
  selected: ChannelId[];
  onChange: (channels: ChannelId[]) => void;
  disabled?: boolean;
}

export function ChannelSelect({
  selected,
  onChange,
  disabled,
}: ChannelSelectProps) {
  const allSelected = selected.length === ALL_CHANNEL_IDS.length;

  const toggleAll = () => {
    onChange(allSelected ? [] : [...ALL_CHANNEL_IDS]);
  };

  const toggle = (id: ChannelId) => {
    if (selected.includes(id)) {
      onChange(selected.filter((c) => c !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm font-semibold text-stone-700">
          모니터링 채널
        </label>
        <button
          type="button"
          onClick={toggleAll}
          disabled={disabled}
          className="text-sm font-medium text-kkumbi-600 hover:text-kkumbi-700 disabled:opacity-40"
        >
          {allSelected ? "전체 해제" : "전체 선택"}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {CHANNELS.map((channel) => {
          const checked = selected.includes(channel.id);
          return (
            <label
              key={channel.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                checked
                  ? "border-kkumbi-400 bg-kkumbi-50 shadow-sm"
                  : "border-stone-200 bg-white hover:border-kkumbi-200"
              } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(channel.id)}
                className="mt-0.5 h-4 w-4 rounded border-kkumbi-300 text-kkumbi-600 focus:ring-kkumbi-400"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-stone-800">
                  {channel.label}
                </span>
                <span className="mt-0.5 block text-xs text-stone-500">
                  {channel.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
