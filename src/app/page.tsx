"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { KeywordInput } from "@/components/KeywordInput";
import { ChannelSelect } from "@/components/ChannelSelect";
import {
  DateRangeSelect,
  getDefaultDateRange,
} from "@/components/DateRangeSelect";
import { MonitorPeriodBanner } from "@/components/MonitorPeriodBanner";
import { SortSelect } from "@/components/SortSelect";
import { isValidDateRange } from "@/lib/date-range";
import { ChannelTabs } from "@/components/ChannelTabs";
import { LoginRequiredSection } from "@/components/LoginRequiredSection";
import { InsightsPanel } from "@/components/InsightsPanel";
import { buildNotionReport } from "@/lib/report";
import { ALL_CHANNEL_IDS } from "@/lib/channels";
import type {
  ChannelId,
  MonitorDateRange,
  MonitorResult,
  SortOrder,
} from "@/types/monitor";

export default function HomePage() {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] =
    useState<ChannelId[]>(ALL_CHANNEL_IDS);
  const [dateRange, setDateRange] = useState<MonitorDateRange>(
    getDefaultDateRange
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>("latest");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MonitorResult | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const allLoginItems = useMemo(
    () => result?.channels.flatMap((c) => c.loginRequired) ?? [],
    [result]
  );

  const handleMonitor = useCallback(async () => {
    const trimmed = keywords.map((k) => k.trim()).filter(Boolean);
    if (trimmed.length === 0) {
      setError("최소 1개의 키워드를 입력해 주세요.");
      return;
    }
    if (selectedChannels.length === 0) {
      setError("최소 1개의 채널을 선택해 주세요.");
      return;
    }
    if (!isValidDateRange(dateRange.startDate, dateRange.endDate)) {
      setError("시작일은 종료일보다 이후일 수 없습니다.");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setCopied(false);

    try {
      const res = await fetch("/api/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: trimmed,
          sortOrder,
          channels: selectedChannels,
          period: dateRange,
        }),
        signal: controller.signal,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "모니터링 요청에 실패했습니다.");
      }

      setResult(data as MonitorResult);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      setResult(null);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setLoading(false);
    }
  }, [keywords, sortOrder, selectedChannels, dateRange]);

  const handleStopMonitor = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setError(null);
    setResult(null);
    setCopied(false);
  }, []);

  const handleCopyReport = useCallback(async () => {
    if (!result) return;
    const report = buildNotionReport(result);
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [result]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-kkumbi-50 via-white to-kkumbi-50/30">
      <header className="border-b border-kkumbi-100 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-kkumbi-500">
                꿈비 그룹
              </p>
              <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">
                전 채널 통합 경쟁사 모니터링
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm text-stone-500">
                카페 · 블로그 · 뉴스 · 유튜브 · 인스타 · Meta 광고 · 스토어 · 리뷰
              </p>
              <Link
                href="/trend"
                className="rounded-xl bg-kkumbi-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-kkumbi-600"
              >
                트렌드 대시보드
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <section className="rounded-2xl border border-kkumbi-100 bg-white p-6 shadow-lg shadow-kkumbi-100/40">
          <div className="space-y-6">
            <KeywordInput
              keywords={keywords}
              onChange={setKeywords}
              disabled={loading}
            />
            <DateRangeSelect
              value={dateRange}
              onChange={setDateRange}
              disabled={loading}
            />
            <ChannelSelect
              selected={selectedChannels}
              onChange={setSelectedChannels}
              disabled={loading}
            />
            <SortSelect
              value={sortOrder}
              onChange={setSortOrder}
              disabled={loading}
            />

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleMonitor}
                disabled={loading}
                className="flex-1 rounded-xl bg-kkumbi-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-kkumbi-300/50 transition hover:bg-kkumbi-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner />
                    채널별 검색 중… ({selectedChannels.length}개)
                  </span>
                ) : (
                  "통합 모니터링 시작"
                )}
              </button>
              {loading && (
                <button
                  type="button"
                  onClick={handleStopMonitor}
                  className="rounded-xl border border-stone-300 bg-white px-6 py-3.5 text-sm font-bold text-stone-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 sm:shrink-0"
                >
                  모니터링 중지
                </button>
              )}
            </div>

            {error && (
              <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </p>
            )}
          </div>
        </section>

        {result && (
          <>
            <MonitorPeriodBanner period={result.period} />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-stone-500">
                수집 완료 ·{" "}
                {new Date(result.searchedAt).toLocaleString("ko-KR")} ·{" "}
                {result.selectedChannels.length}개 채널
              </p>
              <button
                type="button"
                onClick={handleCopyReport}
                className="rounded-xl border border-kkumbi-300 bg-white px-5 py-2.5 text-sm font-semibold text-kkumbi-700 shadow-sm transition hover:bg-kkumbi-50"
              >
                {copied ? "복사 완료!" : "노션용 리포트 복사"}
              </button>
            </div>

            <ChannelTabs
              channels={result.channels}
              selectedIds={result.selectedChannels}
            />

            <LoginRequiredSection items={allLoginItems} />

            <InsightsPanel insights={result.insights} />
          </>
        )}
      </main>

      <footer className="border-t border-stone-100 py-6 text-center text-xs text-stone-400">
        꿈비 그룹 · 전 채널 경쟁사 신제품·프로모션·소비자 반응 모니터링
      </footer>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
