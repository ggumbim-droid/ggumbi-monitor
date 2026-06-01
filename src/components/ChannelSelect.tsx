"use client";
import { CHANNELS } from "@/lib/channels";
import type { ChannelId } from "@/types/monitor";

const DEFAULT_CHANNEL_IDS: ChannelId[] = ["naver_cafe", "naver_blog", "naver_news", "youtube"];
const COMING_SOON_IDS: ChannelId[] = ["meta_ads", "smartstore_reviews"];

interface ChannelSelectProps {
  selected: ChannelId[];
  onChange: (channels: ChannelId[]) => void;
  disabled?: boolean;
}

export function ChannelSelect({ selected, onChange, disabled }: ChannelSelectProps) {
  const activeChannels = CHANNELS.filter((c) => !COMING_SOON_IDS.includes(c.id));
  const allSelected = activeChannels.every((c) => selected.includes(c.id));

  const toggleAll = () => {
    onChange(allSelected ? [] : activeChannels.map((c) => c.id));
  };

  const toggle = (id: ChannelId) => {
    if (COMING_SOON_IDS.includes(id)) return;
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
          const isComingSoon = COMING_SOON_IDS.includes(channel.id);
          const checked = selected.includes(channel.id);
          return (
            <label
              key={channel.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                isComingSoon
                  ? "cursor-not-allowed border-stone-100 bg-stone-50 opacity-60"
                  : checked
                  ? "border-kkumbi-400 bg-kkumbi-50 shadow-sm"
                  : "border-stone-200 bg-white hover:border-kkumbi-200"
              } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled || isComingSoon}
                onChange={() => toggle(channel.id)}
                className="mt-0.5 h-4 w-4 rounded border-kkumbi-300 text-kkumbi-600 focus:ring-kkumbi-400"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-stone-800">
                  {channel.label}
                  {isComingSoon && (
                    <span className="ml-2 rounded-full bg-stone-200 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">
                      개발 예정
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-stone-500">
                  {isComingSoon ? "추후 개발 예정" : channel.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export { DEFAULT_CHANNEL_IDS };
