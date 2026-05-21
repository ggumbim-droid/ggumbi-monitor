"use client";

import type { Insights } from "@/types/monitor";

interface InsightsPanelProps {
  insights: Insights;
}

export function InsightsPanel({ insights }: InsightsPanelProps) {
  return (
    <section className="rounded-2xl border border-kkumbi-200 bg-gradient-to-br from-white to-kkumbi-50 p-6 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-stone-800">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-kkumbi-500 text-sm text-white">
          AI
        </span>
        전 채널 통합 인사이트
      </h2>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-kkumbi-600">
            소비자 주요 관심사
          </h3>
          <ul className="space-y-1.5">
            {insights.consumerInterests.length > 0 ? (
              insights.consumerInterests.map((item, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-sm text-stone-700 before:content-['•']"
                >
                  {item}
                </li>
              ))
            ) : (
              <li className="text-sm text-stone-400">분석 데이터 없음</li>
            )}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">
            긍정 키워드 Top 3
          </h3>
          <ol className="space-y-1">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              >
                {insights.positiveKeywords[i] ?? "—"}
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-600">
            부정 키워드 Top 3
          </h3>
          <ol className="space-y-1">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800"
              >
                {insights.negativeKeywords[i] ?? "—"}
              </li>
            ))}
          </ol>
        </div>

        {insights.channelHighlights && insights.channelHighlights.length > 0 && (
          <div className="md:col-span-2">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
              채널별 핵심 요약
            </h3>
            <ul className="space-y-1.5">
              {insights.channelHighlights.map((item, i) => (
                <li key={i} className="text-sm text-stone-600">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="md:col-span-2">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-kkumbi-600">
            즉시 대응 액션
          </h3>
          <p className="rounded-xl border-l-4 border-kkumbi-500 bg-white px-4 py-3 text-sm font-medium leading-relaxed text-stone-800 shadow-inner">
            {insights.immediateAction}
          </p>
        </div>
      </div>
    </section>
  );
}
