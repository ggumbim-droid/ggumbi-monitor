"use client";
import { useState, useEffect } from "react";
import { CHANNELS, getChannelMeta } from "@/lib/channels";
import { ChannelResultsPanel } from "@/components/ChannelResultsPanel";
import type { ChannelId, ChannelResult, SortOrder } from "@/types/monitor";

interface ChannelTabsProps {
  channels: ChannelResult[];
  selectedIds: ChannelId[];
  sortOrder: SortOrder;
  onSortChange: (sort: SortOrder) => void;
  reSearching?: boolean;
}

export function ChannelTabs({ channels, selectedIds, sortOrder, onSortChange, reSearching }: ChannelTabsProps) {
  const visible = selectedIds
    .map((id) => channels.find((c) => c.channel === id))
    .filter((c): c is ChannelResult => Boolean(c));
  const [activeId, setActiveId] = useState<ChannelId>(
    visible[0]?.channel ?? selectedIds[0]
  );
  useEffect(() => {
    if (!visible.some((c) => c.channel === activeId)) {
      setActiveId(visible[0]?.channel ?? selectedIds[0]);
    }
  }, [visible, activeId, selectedIds]);
  const active = visible.find((c) => c.channel === activeId) ?? visible[0];

  if (visible.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-stone-400">
        표시할 채널 결과가 없습니다.
      </p>
    );
  }

  const countFor = (c: ChannelResult) => {
    if (c.channel === "smartstore_reviews" && c.reviewData) return 1;
    return c.publicItems.length + c.loginRequired.length;
  };

  return (
    <section className="rounded-2xl border border-stone-200 bg-white shadow-sm">
      {/* 정렬 버튼 */}
      <div className="flex items-center gap-2 px-5 pt-4">
        <span className="text-xs font-semibold text-stone-500">정렬</span>
        {([{ id: "latest", label: "최신순" }, { id: "relevance", label: "관련도순" }] as { id: SortOrder; label: string }[]).map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={reSearching}
            onClick={() => onSortChange(opt.id)}
            className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
              sortOrder === opt.id
                ? "border-kkumbi-500 bg-kkumbi-500 text-white"
                : "border-stone-200 bg-white text-stone-500 hover:border-kkumbi-300"
            } disabled:opacity-50`}
          >
            {reSearching && sortOrder === opt.id ? "검색 중…" : opt.label}
          </button>
        ))}
      </div>

      {/* 채널 탭 */}
      <div className="border-b border-stone-100 overflow-x-auto mt-2">
        <div className="flex min-w-max px-2 pt-2">
          {visible.map((ch) => {
            const meta = getChannelMeta(ch.channel);
            const isActive = ch.channel === (active?.channel ?? activeId);
            return (
              <button
                key={ch.channel}
                type="button"
                onClick={() => setActiveId(ch.channel)}
                className={`relative shrink-0 px-4 py-3 text-sm font-medium transition ${
                  isActive ? "text-kkumbi-600" : "text-stone-500 hover:text-stone-700"
                }`}
              >
                {meta.shortLabel}
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                  isActive ? "bg-kkumbi-100 text-kkumbi-700" : "bg-stone-100 text-stone-500"
                }`}>
                  {countFor(ch)}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-kkumbi-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {active && (
        <div className="p-5 sm:p-6">
          <p className="mb-4 text-xs text-stone-500">
            {CHANNELS.find((c) => c.id === active.channel)?.description}
          </p>
          <ChannelResultsPanel channelResult={active} />
        </div>
      )}
    </section>
  );
}
