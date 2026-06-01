"use client";

import { getChannelMeta } from "@/lib/channels";
import { LinkedTitle } from "@/components/LinkedTitle";
import { ReviewTrendChart } from "@/components/ReviewTrendChart";
import { InstagramAccountsPanel } from "@/components/InstagramAccountsPanel";
import type { ChannelResult } from "@/types/monitor";

interface ChannelResultsPanelProps {
  channelResult: ChannelResult;
}

export function ChannelResultsPanel({ channelResult }: ChannelResultsPanelProps) {
  const meta = getChannelMeta(channelResult.channel);

  if (channelResult.channel === "smartstore_reviews" && channelResult.reviewData) {
    const r = channelResult.reviewData;
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-stone-800">
            {r.brandName ? `${r.brandName} · ` : ""}
            {r.productName}
          </h3>
          <p className="mt-1 text-sm text-stone-500">
            스마트스토어 리뷰 수 추이 · 이번 주 vs 지난 주
          </p>
        </div>
        <ReviewTrendChart data={r} />
        {channelResult.loginRequired.length > 0 && (
          <LoginSection items={channelResult.loginRequired} />
        )}
      </div>
    );
  }

  if (channelResult.channel === "instagram") {
    return <InstagramAccountsPanel />;
  }

  return (
    <div className="space-y-6">
      <PublicSection
        title={`${meta.shortLabel} 공개 콘텐츠`}
        items={channelResult.publicItems}
        emptyMessage="수집된 공개 콘텐츠가 없습니다."
      />
      <LoginSection items={channelResult.loginRequired} />
    </div>
  );
}

function PublicSection({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: ChannelResult["publicItems"];
  emptyMessage: string;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-stone-800">{title}</h2>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
          {items.length}건
        </span>
      </header>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-400">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2 max-h-[900px] overflow-y-auto pr-1">
          {items.map((item, i) => (
            <li
              key={`${item.link}-${i}`}
              className="flex gap-3 rounded-xl border border-stone-100 bg-white p-4 transition hover:border-kkumbi-300 hover:shadow-sm"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[10px] font-bold text-stone-500">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-[11px] font-semibold text-kkumbi-600 bg-kkumbi-50 px-2 py-0.5 rounded-full">
                    {item.source}
                  </span>
                  {item.tag && (
                    <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                      {item.tag}
                    </span>
                  )}
                  {item.publishedAt && (
                    <span className="text-[11px] text-stone-400">
                      {item.publishedAt}
                    </span>
                  )}
                </div>
                <LinkedTitle
                  title={item.title}
                  link={item.link}
                  className="block text-sm font-semibold text-stone-800 leading-snug"
                  linkClassName="hover:text-kkumbi-600 hover:underline"
                />
                {item.preview && (
                  <p className="mt-1 text-xs text-stone-500 line-clamp-2 leading-relaxed">
                    {item.preview}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LoginSection({ items }: { items: ChannelResult["loginRequired"] }) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-amber-900">
          로그인·직접 확인 필요
        </h2>
        <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
          {items.length}건
        </span>
      </header>
      <p className="mb-3 text-xs text-amber-800/80">
        로그인·회원 전용·비공개 등 자동 수집이 불가한 항목입니다.
      </p>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-amber-700/60">
          로그인 필요 항목이 없습니다.
        </p>
      ) : (
        <ul className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
          {items.map((item, i) => (
            <li key={`login-${i}`} className="rounded-xl border border-amber-200 bg-white p-4">
              <p className="text-xs font-medium text-amber-700">{item.source}</p>
              <LinkedTitle
                title={item.title}
                link={item.link}
                className="mt-1 font-semibold text-stone-800"
                linkClassName="cursor-pointer text-stone-800 hover:text-amber-700 hover:underline"
              />
              {item.reason && (
                <p className="mt-1 text-sm text-stone-500">{item.reason}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
