"use client";

import { useState, useEffect } from "react";
import { CHANNELS, getChannelMeta } from "@/lib/channels";
import { ChannelResultsPanel } from "@/components/ChannelResultsPanel";
import type { ChannelId, ChannelResult } from "@/types/monitor";

interface ChannelTabsProps {
  channels: ChannelResult[];
  selectedIds: ChannelId[];
}

export function ChannelTabs({ channels, selectedIds }: ChannelTabsProps) {
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

  const active =
    visible.find((c) => c.channel === activeId) ?? visible[0];

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
      <div className="border-b border-stone-100 overflow-x-auto">
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
                  isActive
                    ? "text-kkumbi-600"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                {meta.shortLabel}
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                    isActive
                      ? "bg-kkumbi-100 text-kkumbi-700"
                      : "bg-stone-100 text-stone-500"
                  }`}
                >
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
