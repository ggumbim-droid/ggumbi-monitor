"use client";
import type { Insights } from "@/types/monitor";

interface IntegratedInsights {
  competitorSummary: string;
  benchmarkPoints: string[];
  kkumbiStrategy: string;
  actionPlan: string[];
  channelStrategy: string[];
}

interface InsightsPanelProps {
  insights: Insights;
  integrated?: IntegratedInsights;
}

export function InsightsPanel({ insights, integrated }: InsightsPanelProps) {
  if (integrated) {
    return (
      <section className="rounded-2xl border-2 border-kkumbi-500 bg-gradient-to-br from-kkumbi-50 to-white p-6 shadow-lg">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-stone-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-kkumbi-500 text-sm text-white">AI</span>
          전 채널 통합 전략 액션 플랜
        </h2>

        <div className="space-y-5">
          <div className="rounded-xl bg-stone-50 p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">경쟁사 종합 분석</h3>
            <p className="text-sm text-stone-700 leading-relaxed">{integrated.competitorSummary}</p>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-600">벤치마킹 포인트</h3>
            <ul className="space-y-1.5">
              {integrated.benchmarkPoints.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-stone-700">
                  <span className="text-blue-500 font-bold">→</span>{item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border-l-4 border-kkumbi-500 bg-white px-4 py-3 shadow-inner">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-kkumbi-600">꿈비 핵심 전략 방향</h3>
            <p className="text-sm font-medium text-stone-800 leading-relaxed">{integrated.kkumbiStrategy}</p>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-kkumbi-600">실행 액션 플랜</h3>
            <div className="space-y-2">
              {integrated.actionPlan.map((action, i) => (
                <div key={i} className="rounded-xl bg-kkumbi-50 border border-kkumbi-100 px-4 py-3 text-sm text-stone-800 font-medium">
                  {action}
                </div>
              ))}
            </div>
          </div>

          {integrated.channelStrategy?.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">채널별 전략 방향</h3>
              <ul className="space-y-1.5">
                {integrated.channelStrategy.map((item, i) => (
                  <li key={i} className="text-sm text-stone-600 flex gap-2">
                    <span className="text-kkumbi-400">•</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-kkumbi-200 bg-gradient-to-br from-white to-kkumbi-50 p-6 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-stone-800">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-400 text-sm text-white">AI</span>
        경쟁사 활동 관찰 리포트
      </h2>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">소비자 주요 관심사</h3>
          <ul className="space-y-1.5">
            {insights.consumerInterests.length > 0 ? (
              insights.consumerInterests.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-stone-700 before:content-['•']">{item}</li>
              ))
            ) : (
              <li className="text-sm text-stone-400">분석 데이터 없음</li>
            )}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">긍정 키워드 Top 3</h3>
          <ol className="space-y-1">
            {[0, 1, 2].map((i) => (
              <li key={i} className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {insights.positiveKeywords[i] ?? "—"}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-600">부정 키워드 Top 3</h3>
          <ol className="space-y-1">
            {[0, 1, 2].map((i) => (
              <li key={i} className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {insights.negativeKeywords[i] ?? "—"}
              </li>
            ))}
          </ol>
        </div>
        {insights.channelHighlights && insights.channelHighlights.length > 0 && (
          <div className="md:col-span-2">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">채널별 경쟁사 활동</h3>
            <ul className="space-y-1.5">
              {insights.channelHighlights.map((item, i) => (
                <li key={i} className="text-sm text-stone-600">{item}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="md:col-span-2">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">경쟁사 관찰 요약</h3>
          <p className="rounded-xl border-l-4 border-stone-300 bg-white px-4 py-3 text-sm leading-relaxed text-stone-700 shadow-inner">
            {insights.immediateAction}
          </p>
        </div>
      </div>
    </section>
  );
}
