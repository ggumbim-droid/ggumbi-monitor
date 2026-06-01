"use client";

import { useState } from "react";
import { getChannelMeta } from "@/lib/channels";
import { LinkedTitle } from "@/components/LinkedTitle";
import { ReviewTrendChart } from "@/components/ReviewTrendChart";
import { InstagramAccountsPanel } from "@/components/InstagramAccountsPanel";
import type { ChannelResult, ChannelItem } from "@/types/monitor";

interface ChannelResultsPanelProps {
  channelResult: ChannelResult;
}

export function ChannelResultsPanel({ channelResult }: ChannelResultsPanelProps) {
  const meta = getChannelMeta(channelResult.channel);

  if (channelResult.channel === "smartstore_reviews") {
    return (
      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-8 text-center">
        <p className="text-2xl mb-3">🔧</p>
        <h3 className="text-base font-bold text-stone-700 mb-2">스마트스토어 리뷰 추이 — 추후 개발 예정</h3>
        <p className="text-sm text-stone-500">
          네이버 API 정책상 리뷰 수 자동 수집이 제한되어 현재 개발 중입니다.
        </p>
        <p className="mt-2 text-xs text-stone-400">
          대신 상단 <span className="font-semibold text-kkumbi-500">스마트스토어 / 자사몰</span> 탭에서 가격 변화 추이를 확인하세요.
        </p>
      </div>
    );
  }
  }

  if (channelResult.channel === "instagram") {
    return <InstagramAccountsPanel />;
  }

  if (channelResult.channel === "meta_ads") {
    return (
      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-8 text-center">
        <p className="text-2xl mb-3">🔧</p>
        <h3 className="text-base font-bold text-stone-700 mb-2">Meta 광고 라이브러리 — 추후 개발 예정</h3>
        <p className="text-sm text-stone-500">
          Meta Ad Library API 승인 절차 진행 중입니다.
        </p>
        <p className="mt-2 text-xs text-stone-400">
          지금은 <span className="font-semibold">facebook.com/ads/library</span> 에서 직접 확인해주세요.
        </p>
        <button
          onClick={() => window.open("https://www.facebook.com/ads/library", "_blank")}
          className="mt-4 rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-600 hover:bg-stone-100"
        >
          Meta 광고 라이브러리 바로가기
        </button>
      </div>
    );
  }
  }

  if (channelResult.channel === "smartstore") {
    return <SmartstoreSection items={channelResult.publicItems} />;
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

function SmartstoreReviewsSection({ channelResult }: { channelResult: ChannelResult }) {
  const reviewDataList = (channelResult as ChannelResult & { reviewDataList?: typeof channelResult.reviewData[] }).reviewDataList;
  const items = reviewDataList && reviewDataList.length > 0
    ? reviewDataList
    : channelResult.reviewData
    ? [channelResult.reviewData]
    : [];

  const [activeIdx, setActiveIdx] = useState(0);
  const active = items[activeIdx];

  if (!active) {
    return <p className="py-8 text-center text-sm text-stone-400">스마트스토어 리뷰 데이터를 찾을 수 없습니다.</p>;
  }

  return (
    <div className="space-y-4">
      {items.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIdx(idx)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                activeIdx === idx
                  ? "border-kkumbi-500 bg-kkumbi-500 text-white"
                  : "border-stone-200 bg-white text-stone-600 hover:border-kkumbi-300"
              }`}
            >
              {(item?.productName ?? "").slice(0, 20)}{(item?.productName ?? "").length > 20 ? "…" : ""}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-base font-bold text-stone-800">
            {active.brandName ? `${active.brandName} · ` : ""}
            {active.productName}
          </h3>
          <p className="mt-1 text-sm text-stone-500">
            스마트스토어 리뷰 수 추이 · 이번 주 vs 지난 주
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl bg-stone-50 p-3 text-center">
            <p className="text-xs text-stone-500 mb-1">현재 총 리뷰</p>
            <p className="text-lg font-bold text-stone-800">
              {active.currentTotalReviews.toLocaleString()}개
            </p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3 text-center">
            <p className="text-xs text-stone-500 mb-1">이번 주 신규</p>
            <p className={`text-lg font-bold ${active.thisWeekNewReviews > 0 ? "text-emerald-600" : "text-stone-400"}`}>
              {active.thisWeekNewReviews > 0 ? `+${active.thisWeekNewReviews.toLocaleString()}` : "-"}개
            </p>
          </div>
          <div className={`rounded-xl p-3 text-center ${active.changeRatePercent > 0 ? "bg-rose-50" : "bg-stone-50"}`}>
            <p className="text-xs text-stone-500 mb-1">전주 대비</p>
            <p className={`text-lg font-bold ${active.changeRatePercent > 0 ? "text-rose-500" : "text-stone-400"}`}>
              {active.changeRatePercent > 0
                ? `+${active.changeRatePercent}%`
                : active.currentTotalReviews > 0
                ? "첫 수집"
                : "-"}
            </p>
          </div>
        </div>

        <p className="mb-4 text-sm text-stone-600 bg-kkumbi-50 rounded-lg px-4 py-2">
          {active.interpretation}
        </p>

        <ReviewTrendChart data={active} />

        {active.storeUrl && (
          <button
            onClick={() => window.open(active.storeUrl, "_blank")}
            className="mt-4 w-full rounded-xl border border-kkumbi-200 py-2.5 text-sm font-semibold text-kkumbi-600 hover:bg-kkumbi-50"
          >
            스마트스토어 바로가기
          </button>
        )}
      </div>
    </div>
  );
}

function SmartstoreSection({ items }: { items: ChannelItem[] }) {
  const platformMap: Record<string, ChannelItem[]> = {};
  for (const item of items) {
    const platform = item.tag ?? item.source ?? "기타";
    if (!platformMap[platform]) platformMap[platform] = [];
    platformMap[platform].push(item);
  }

  const platforms = Object.keys(platformMap);
  const [activePlatform, setActivePlatform] = useState(platforms[0] ?? "");

  if (platforms.length === 0) {
    return <p className="py-8 text-center text-sm text-stone-400">수집된 스토어 콘텐츠가 없습니다.</p>;
  }

  const activeItems = platformMap[activePlatform] ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {platforms.map((platform) => (
          <button
            key={platform}
            onClick={() => setActivePlatform(platform)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              activePlatform === platform
                ? "border-kkumbi-500 bg-kkumbi-500 text-white"
                : "border-stone-200 bg-white text-stone-600 hover:border-kkumbi-300"
            }`}
          >
            {platform}
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
              activePlatform === platform ? "bg-white/30 text-white" : "bg-stone-100 text-stone-500"
            }`}>
              {platformMap[platform].length}
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-800">{activePlatform} 상품</h2>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            {activeItems.length}건
          </span>
        </header>

        <ul className="space-y-3">
          {activeItems.map((item, i) => {
            const rankMatch = item.source.match(/TOP (\d+)/);
            const rank = rankMatch ? parseInt(rankMatch[1]) : i + 1;
            const [priceText, reviewText] = (item.preview ?? "").split(" · ");

            return (
              <li
                key={`${item.link}-${i}`}
                className="flex gap-3 rounded-xl border border-stone-100 bg-stone-50 p-4 transition hover:border-kkumbi-300 hover:shadow-sm"
              >
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  rank <= 3 ? "bg-kkumbi-500 text-white" : "bg-stone-200 text-stone-600"
                }`}>
                  {rank}
                </span>

                <div className="min-w-0 flex-1">
                  <LinkedTitle
                    title={item.title}
                    link={item.link}
                    className="block text-sm font-semibold text-stone-800 leading-snug"
                    linkClassName="hover:text-kkumbi-600 hover:underline"
                  />
                  <div className="mt-2 flex flex-wrap gap-3">
                    {priceText && (
                      <span className={`text-xs font-semibold ${
                        priceText.includes("↓") ? "text-blue-600" :
                        priceText.includes("↑") ? "text-rose-500" : "text-stone-700"
                      }`}>
                        {priceText}
                      </span>
                    )}
                    {reviewText && (
                      <span className={`text-xs font-medium ${
                        reviewText.includes("+") ? "text-emerald-600" : "text-stone-500"
                      }`}>
                        {reviewText}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
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
