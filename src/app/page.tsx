"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { KeywordInput } from "@/components/KeywordInput";
import { DateRangeSelect, getDefaultDateRange } from "@/components/DateRangeSelect";
import { MonitorPeriodBanner } from "@/components/MonitorPeriodBanner";
import { SortSelect } from "@/components/SortSelect";
import { isValidDateRange } from "@/lib/date-range";
import { ChannelTabs } from "@/components/ChannelTabs";
import { LoginRequiredSection } from "@/components/LoginRequiredSection";
import { InsightsPanel } from "@/components/InsightsPanel";
import { buildNotionReport } from "@/lib/report";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { ChannelId, MonitorDateRange, MonitorResult, SortOrder } from "@/types/monitor";

interface Brand { name: string; keywords: string[] }
interface KeywordGroup { id: string; label: string; brands: Brand[] }
interface KeywordGroups { [key: string]: { label: string; brands: Brand[] } }

const PRESET_PERIODS = [
  { label: "주간", value: "1week" },
  { label: "3개월", value: "3months" },
  { label: "1년", value: "1year" },
  { label: "3년", value: "3years" },
  { label: "직접입력", value: "custom" },
];
const BRAND_COLORS = ["#FF6B35","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7","#DDA0DD"];

// 채널 그룹 정의
const CHANNEL_GROUPS = [
  {
    id: "naver",
    label: "네이버",
    icon: "📰",
    channels: ["naver_cafe", "naver_blog", "naver_news"] as ChannelId[],
    description: "카페 · 블로그 · 뉴스",
  },
  {
    id: "social",
    label: "소셜",
    icon: "📱",
    channels: ["youtube", "instagram", "meta_ads"] as ChannelId[],
    description: "유튜브 · 인스타 · Meta 광고",
  },
  {
    id: "shopping",
    label: "쇼핑",
    icon: "🛒",
    channels: ["smartstore", "smartstore_reviews", "naver_ranking"] as ChannelId[],
    description: "스마트스토어 · 리뷰추이 · 순위추이",
  },
];

const CHANNEL_LABELS: Record<ChannelId, string> = {
  naver_cafe: "카페",
  naver_blog: "블로그",
  naver_news: "뉴스",
  youtube: "유튜브",
  instagram: "인스타",
  meta_ads: "Meta 광고",
  smartstore: "스토어",
  smartstore_reviews: "리뷰추이",
  naver_ranking: "순위추이",
};

const COMING_SOON: ChannelId[] = ["meta_ads", "smartstore_reviews"];

function getToday() { return new Date().toISOString().split("T")[0]; }
function getDateBefore(months: number) {
  const d = new Date(); d.setMonth(d.getMonth() - months);
  return d.toISOString().split("T")[0];
}

interface TooltipEntry { name: string; value: number; color: string; }
function CustomTooltip({ active, payload, label, hoveredBrand }: { active?: boolean; payload?: TooltipEntry[]; label?: string; hoveredBrand?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "12px 16px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", minWidth: "180px" }}>
      <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "8px", fontWeight: "500" }}>{label}</p>
      {payload.map((entry) => {
        const hi = hoveredBrand ? entry.name === hoveredBrand : false;
        return (
          <div key={entry.name} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "3px 0", opacity: hoveredBrand && !hi ? 0.4 : 1 }}>
            <div style={{ width: hi ? "12px" : "8px", height: hi ? "12px" : "8px", borderRadius: "50%", backgroundColor: entry.color, flexShrink: 0 }} />
            <span style={{ fontSize: hi ? "15px" : "12px", fontWeight: hi ? "700" : "400", color: hi ? "#111" : "#6b7280", flex: 1 }}>{entry.name}</span>
            <span style={{ fontSize: hi ? "15px" : "12px", fontWeight: hi ? "700" : "400", color: entry.color }}>{entry.value.toFixed(1)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"monitor" | "trend">("monitor");

  const [keywords, setKeywords] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<MonitorDateRange>(getDefaultDateRange);
  const [sortOrder, setSortOrder] = useState<SortOrder>("latest");
  const [copied, setCopied] = useState(false);
  const [reSearching, setReSearching] = useState(false);

  // 그룹별 상태
  const [groupResults, setGroupResults] = useState<Record<string, MonitorResult | null>>({
    naver: null, social: null, shopping: null,
  });
  const [groupLoading, setGroupLoading] = useState<Record<string, boolean>>({
    naver: false, social: false, shopping: false,
  });
  const [groupErrors, setGroupErrors] = useState<Record<string, string | null>>({
    naver: null, social: null, shopping: null,
  });
  const [groupChannels, setGroupChannels] = useState<Record<string, ChannelId[]>>({
    naver: ["naver_cafe", "naver_blog", "naver_news"],
    social: ["youtube", "instagram"],
    shopping: ["smartstore", "naver_ranking"],
  });

  const abortRefs = useRef<Record<string, AbortController | null>>({});

  // 섹션 refs (스크롤용)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const allLoginItems = useMemo(() => {
    return Object.values(groupResults)
      .filter(Boolean)
      .flatMap((r) => r!.channels.flatMap((c) => c.loginRequired));
  }, [groupResults]);

  const anyResult = Object.values(groupResults).some(Boolean);

  // 트렌드 상태
  const [keywordGroups, setKeywordGroups] = useState<KeywordGroups>({});
  const [groupList, setGroupList] = useState<KeywordGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("3months");
  const [customStart, setCustomStart] = useState(getDateBefore(3));
  const [customEnd, setCustomEnd] = useState(getToday());
  const [chartData, setChartData] = useState<Record<string, string | number>[]>([]);
  const [trendError, setTrendError] = useState("");
  const [trendLoading, setTrendLoading] = useState(false);
  const [hiddenBrands, setHiddenBrands] = useState<Set<string>>(new Set());
  const [hoveredBrand, setHoveredBrand] = useState("");
  const [focusedBrand, setFocusedBrand] = useState("");
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [kwLoading, setKwLoading] = useState(false);
  const [addingBrand, setAddingBrand] = useState<{ groupId: string; brandName: string } | null>(null);
  const [newKeyword, setNewKeyword] = useState("");
  const [kwError, setKwError] = useState("");

  const currentGroup = groupList.find((g) => g.id === selectedGroup) ?? null;
  const activeBrand = focusedBrand || hoveredBrand;

  useEffect(() => {
    if (activeTab !== "trend") return;
    setKwLoading(true);
    fetch("/api/keywords")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (!data || typeof data !== "object") return;
        const groups = data as KeywordGroups;
        setKeywordGroups(groups);
        const list = Object.entries(groups)
          .filter(([, g]) => g && Array.isArray(g.brands))
          .map(([id, g]) => ({ id, label: g.label, brands: g.brands }));
        setGroupList(list);
        if (list.length > 0) setSelectedGroup(list[0].id);
      })
      .catch((e) => console.error("키워드 로드 실패:", e))
      .finally(() => setKwLoading(false));
  }, [activeTab]);

  const handleGroupMonitor = useCallback(async (groupId: string) => {
    const trimmed = keywords.map((k) => k.trim()).filter(Boolean);
    if (!trimmed.length) {
      setGroupErrors((prev) => ({ ...prev, [groupId]: "최소 1개의 키워드를 입력해 주세요." }));
      return;
    }
    if (!isValidDateRange(dateRange.startDate, dateRange.endDate)) {
      setGroupErrors((prev) => ({ ...prev, [groupId]: "시작일은 종료일보다 이후일 수 없습니다." }));
      return;
    }

    abortRefs.current[groupId]?.abort();
    const controller = new AbortController();
    abortRefs.current[groupId] = controller;

    setGroupLoading((prev) => ({ ...prev, [groupId]: true }));
    setGroupErrors((prev) => ({ ...prev, [groupId]: null }));

    try {
      const channels = groupChannels[groupId];
      const res = await fetch("/api/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: trimmed, sortOrder, channels, period: dateRange }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "모니터링 요청에 실패했습니다.");
      setGroupResults((prev) => ({ ...prev, [groupId]: data as MonitorResult }));

      // 결과로 스크롤
      setTimeout(() => {
        sectionRefs.current[`result_${groupId}`]?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setGroupErrors((prev) => ({ ...prev, [groupId]: err instanceof Error ? err.message : "오류가 발생했습니다." }));
    } finally {
      setGroupLoading((prev) => ({ ...prev, [groupId]: false }));
    }
  }, [keywords, sortOrder, dateRange, groupChannels]);

  const handleCopyReport = useCallback(async () => {
    const firstResult = Object.values(groupResults).find(Boolean);
    if (!firstResult) return;
    const report = buildNotionReport(firstResult);
    await navigator.clipboard.writeText(report);
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  }, [groupResults]);

  async function fetchTrend() {
    setTrendLoading(true); setTrendError(""); setChartData([]); setHiddenBrands(new Set()); setFocusedBrand("");
    try {
      const res = await fetch("/api/trend", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: selectedGroup, period: selectedPeriod, customStart: selectedPeriod === "custom" ? customStart : undefined, customEnd: selectedPeriod === "custom" ? customEnd : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류 발생");
      setChartData(data.results);
    } catch (e: unknown) {
      setTrendError(e instanceof Error ? e.message : "오류 발생");
    } finally { setTrendLoading(false); }
  }

  async function handleAddKeyword(groupId: string, brandName: string) {
    if (!newKeyword.trim()) { setKwError("키워드를 입력해주세요."); return; }
    setKwError("");
    try {
      const res = await fetch("/api/keywords", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", groupId, brandName, keyword: newKeyword.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setKwError(data.error || "오류 발생"); return; }
      setKeywordGroups(data);
      const list = Object.entries(data as KeywordGroups).map(([id, g]) => ({ id, label: g.label, brands: g.brands }));
      setGroupList(list);
      setNewKeyword(""); setAddingBrand(null);
    } catch { setKwError("서버 오류가 발생했습니다."); }
  }

  async function handleDeleteKeyword(groupId: string, brandName: string, keyword: string) {
    if (!confirm(`"${keyword}" 키워드를 삭제할까요?`)) return;
    try {
      const res = await fetch("/api/keywords", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", groupId, brandName, keyword }),
      });
      const data = await res.json();
      if (!res.ok) return;
      setKeywordGroups(data);
      const list = Object.entries(data as KeywordGroups).map(([id, g]) => ({ id, label: g.label, brands: g.brands }));
      setGroupList(list);
    } catch {}
  }

  const toggleGroupChannel = (groupId: string, channelId: ChannelId) => {
    if (COMING_SOON.includes(channelId)) return;
    setGroupChannels((prev) => {
      const current = prev[groupId] ?? [];
      const updated = current.includes(channelId)
        ? current.filter((c) => c !== channelId)
        : [...current, channelId];
      return { ...prev, [groupId]: updated };
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-kkumbi-50 via-white to-kkumbi-50/30">
      <header className="border-b border-kkumbi-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-kkumbi-500">꿈비 그룹</p>
              <h1 className="text-xl font-bold text-stone-900 sm:text-2xl">전 채널 통합 경쟁사 모니터링</h1>
            </div>
            {/* 채널 바로가기 */}
            <div className="flex flex-wrap gap-1 mt-1 sm:mt-0">
              {CHANNEL_GROUPS.map((group) => (
                <div key={group.id} className="flex items-center gap-1">
                  {group.channels.map((chId) => (
                    <button
                      key={chId}
                      onClick={() => {
                        setActiveTab("monitor");
                        setTimeout(() => {
                          sectionRefs.current[`group_${group.id}`]?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }, 100);
                      }}
                      className={`text-xs px-2 py-1 rounded-full transition ${
                        COMING_SOON.includes(chId)
                          ? "text-stone-300 cursor-default"
                          : "text-stone-500 hover:text-kkumbi-600 hover:bg-kkumbi-50"
                      }`}
                    >
                      {CHANNEL_LABELS[chId]}
                    </button>
                  ))}
                  <span className="text-stone-200 text-xs">·</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-1 mt-3">
            <button onClick={() => setActiveTab("monitor")}
              className={`px-5 py-2 rounded-t-lg text-sm font-semibold transition-colors ${activeTab === "monitor" ? "bg-kkumbi-500 text-white" : "bg-white text-stone-500 border border-stone-200 hover:bg-stone-50"}`}>
              경쟁사 모니터링
            </button>
            <button onClick={() => setActiveTab("trend")}
              className={`px-5 py-2 rounded-t-lg text-sm font-semibold transition-colors ${activeTab === "trend" ? "bg-kkumbi-500 text-white" : "bg-white text-stone-500 border border-stone-200 hover:bg-stone-50"}`}>
              키워드 트렌드
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        {activeTab === "monitor" && (
          <>
            {/* 공통 설정 */}
            <section className="rounded-2xl border border-kkumbi-100 bg-white p-6 shadow-lg shadow-kkumbi-100/40">
              <h2 className="text-base font-bold text-stone-700 mb-4">공통 설정</h2>
              <div className="space-y-4">
                <KeywordInput keywords={keywords} onChange={setKeywords} disabled={false} />
                <DateRangeSelect value={dateRange} onChange={setDateRange} disabled={false} />
                <SortSelect value={sortOrder} onChange={setSortOrder} disabled={false} />
              </div>
            </section>

            {/* 그룹별 모니터링 */}
            {CHANNEL_GROUPS.map((group) => (
              <section
                key={group.id}
                ref={(el) => { sectionRefs.current[`group_${group.id}`] = el; }}
                className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden"
              >
                {/* 그룹 헤더 */}
                <div className="bg-stone-50 border-b border-stone-100 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{group.icon}</span>
                    <div>
                      <h2 className="text-base font-bold text-stone-800">{group.label} 채널</h2>
                      <p className="text-xs text-stone-500">{group.description}</p>
                    </div>
                  </div>
                  {/* 채널 체크박스 */}
                  <div className="flex flex-wrap gap-2">
                    {group.channels.map((chId) => {
                      const isComingSoon = COMING_SOON.includes(chId);
                      const isChecked = groupChannels[group.id]?.includes(chId) ?? false;
                      return (
                        <label
                          key={chId}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium cursor-pointer transition ${
                            isComingSoon
                              ? "border-stone-100 bg-stone-50 text-stone-300 cursor-not-allowed"
                              : isChecked
                              ? "border-kkumbi-400 bg-kkumbi-50 text-kkumbi-700"
                              : "border-stone-200 bg-white text-stone-500 hover:border-kkumbi-200"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isComingSoon}
                            onChange={() => toggleGroupChannel(group.id, chId)}
                            className="h-3 w-3"
                          />
                          {CHANNEL_LABELS[chId]}
                          {isComingSoon && <span className="text-[10px] text-stone-300">(예정)</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 모니터링 시작 버튼 */}
                <div className="px-6 py-4 border-b border-stone-100">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleGroupMonitor(group.id)}
                      disabled={groupLoading[group.id]}
                      className="flex-1 rounded-xl bg-kkumbi-500 py-3 text-sm font-bold text-white shadow transition hover:bg-kkumbi-600 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {groupLoading[group.id] ? (
                        <span className="flex items-center justify-center gap-2">
                          <Spinner />검색 중…
                        </span>
                      ) : `${group.label} 채널 모니터링 시작`}
                    </button>
                    {groupLoading[group.id] && (
                      <button
                        type="button"
                        onClick={() => {
                          abortRefs.current[group.id]?.abort();
                          setGroupLoading((prev) => ({ ...prev, [group.id]: false }));
                        }}
                        className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold text-stone-700 hover:bg-rose-50 hover:text-rose-700"
                      >
                        중지
                      </button>
                    )}
                  </div>
                  {groupErrors[group.id] && (
                    <p className="mt-2 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{groupErrors[group.id]}</p>
                  )}
                </div>

                {/* 결과 */}
                {groupResults[group.id] && (
                  <div
                    ref={(el) => { sectionRefs.current[`result_${group.id}`] = el; }}
                    className="p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-stone-500">
                        수집 완료 · {new Date(groupResults[group.id]!.searchedAt).toLocaleString("ko-KR")}
                      </p>
                      <button
                        type="button"
                        onClick={handleCopyReport}
                        className="rounded-xl border border-kkumbi-300 bg-white px-4 py-2 text-sm font-semibold text-kkumbi-700 hover:bg-kkumbi-50"
                      >
                        {copied ? "복사 완료!" : "노션용 리포트 복사"}
                      </button>
                    </div>
                    <MonitorPeriodBanner period={groupResults[group.id]!.period} />
                    <div className="mt-4">
                      <ChannelTabs
                        channels={groupResults[group.id]!.channels}
                        selectedIds={groupResults[group.id]!.selectedChannels}
                        sortOrder={sortOrder}
                        onSortChange={async (newSort) => {
                          setSortOrder(newSort);
                          setReSearching(true);
                          try {
                            const res = await fetch("/api/monitor", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                keywords: keywords.map((k) => k.trim()).filter(Boolean),
                                sortOrder: newSort,
                                channels: groupChannels[group.id],
                                period: dateRange,
                              }),
                            });
                            const data = await res.json();
                            if (res.ok) setGroupResults((prev) => ({ ...prev, [group.id]: data }));
                          } finally {
                            setReSearching(false);
                          }
                        }}
                        reSearching={reSearching}
                      />
                    </div>
                  </div>
                )}
              </section>
            ))}

            {/* 전체 로그인 필요 + 인사이트 */}
            {anyResult && (
              <>
                <LoginRequiredSection items={allLoginItems} />
                {Object.values(groupResults).find(Boolean)?.insights && (
                  <InsightsPanel insights={Object.values(groupResults).find(Boolean)!.insights} />
                )}
              </>
            )}
          </>
        )}

        {activeTab === "trend" && (
          <div className="space-y-4">
            {kwLoading && <p className="text-sm text-gray-400">키워드 불러오는 중...</p>}
            <div className="flex gap-2 flex-wrap">
              {groupList.map((g) => (
                <button key={g.id} onClick={() => { setSelectedGroup(g.id); setChartData([]); setHiddenBrands(new Set()); setFocusedBrand(""); setExpandedBrands(new Set()); }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedGroup === g.id ? "bg-orange-500 text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-orange-300"}`}>
                  {g.label}
                </button>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex gap-2 flex-wrap mb-3">
                {PRESET_PERIODS.map((p) => (
                  <button key={p.value} onClick={() => setSelectedPeriod(p.value)}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${selectedPeriod === p.value ? "bg-gray-800 text-white" : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              {selectedPeriod === "custom" && (
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-500">시작일</label>
                    <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} max={customEnd}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700" />
                  </div>
                  <span className="text-gray-400">~</span>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-500">종료일</label>
                    <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} min={customStart} max={getToday()}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700" />
                  </div>
                </div>
              )}
            </div>
            {currentGroup && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h2 className="font-semibold text-gray-700 mb-3">{currentGroup.label} 키워드 구성</h2>
                <div className="space-y-3">
                  {currentGroup.brands.map((brand, i) => (
                    <div key={brand.name} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BRAND_COLORS[i] }} />
                          <span className="font-medium text-sm text-gray-700">{brand.name}</span>
                          <span className="text-xs text-gray-400">{brand.keywords.length}개</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setExpandedBrands((prev) => { const n = new Set(prev); n.has(brand.name) ? n.delete(brand.name) : n.add(brand.name); return n; })}
                            className="text-xs text-orange-500 hover:underline">
                            {expandedBrands.has(brand.name) ? "접기" : "전체보기"}
                          </button>
                          <button onClick={() => { setAddingBrand({ groupId: selectedGroup, brandName: brand.name }); setNewKeyword(""); setKwError(""); }}
                            className="text-xs text-blue-500 hover:underline">+ 추가</button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(expandedBrands.has(brand.name) ? brand.keywords : brand.keywords.slice(0, 5)).map((k) => (
                          <span key={k} className="group flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                            {k}
                            <button onClick={() => handleDeleteKeyword(selectedGroup, brand.name, k)}
                              className="hidden group-hover:inline text-red-400 hover:text-red-600 ml-0.5">×</button>
                          </span>
                        ))}
                        {!expandedBrands.has(brand.name) && brand.keywords.length > 5 && (
                          <button onClick={() => setExpandedBrands((prev) => { const n = new Set(prev); n.add(brand.name); return n; })}
                            className="text-xs text-orange-400 px-1">+{brand.keywords.length - 5}개 더보기</button>
                        )}
                      </div>
                      {addingBrand?.groupId === selectedGroup && addingBrand?.brandName === brand.name && (
                        <div className="mt-2 flex gap-2 items-center">
                          <input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddKeyword(selectedGroup, brand.name)}
                            placeholder="새 키워드 입력" className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm" />
                          <button onClick={() => handleAddKeyword(selectedGroup, brand.name)}
                            className="px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600">추가</button>
                          <button onClick={() => setAddingBrand(null)} className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200">취소</button>
                        </div>
                      )}
                      {kwError && addingBrand?.brandName === brand.name && (
                        <p className="text-xs text-red-500 mt-1">{kwError}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {chartData.length > 0 && currentGroup && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-500 mb-2">브랜드 클릭 → 강조 / 더블클릭 → 숨기기</p>
                <div className="flex flex-wrap gap-2">
                  {currentGroup.brands.map((brand, i) => (
                    <button key={brand.name}
                      onClick={() => setFocusedBrand((prev) => prev === brand.name ? "" : brand.name)}
                      onDoubleClick={() => setHiddenBrands((prev) => { const n = new Set(prev); n.has(brand.name) ? n.delete(brand.name) : n.add(brand.name); return n; })}
                      onMouseEnter={() => setHoveredBrand(brand.name)}
                      onMouseLeave={() => setHoveredBrand("")}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${hiddenBrands.has(brand.name) ? "bg-gray-100 text-gray-400 border-gray-200 line-through" : focusedBrand === brand.name ? "bg-orange-50 border-orange-400 text-orange-700 font-bold" : "bg-white text-gray-700 border-gray-300"}`}>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hiddenBrands.has(brand.name) ? "#ccc" : BRAND_COLORS[i] }} />
                      {brand.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button onClick={fetchTrend} disabled={trendLoading}
              className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50">
              {trendLoading ? "데이터 조회 중..." : "트렌드 조회"}
            </button>
            {trendError && <div className="text-red-500 text-sm">{trendError}</div>}
            {chartData.length > 0 && currentGroup && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-700 mb-4">{currentGroup.label} 검색량 추이</h2>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={chartData} onMouseLeave={() => setHoveredBrand("")}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip hoveredBrand={activeBrand} />} />
                    <Legend />
                    {currentGroup.brands.map((brand, i) => (
                      !hiddenBrands.has(brand.name) && (
                        <Line key={brand.name} type="monotone" dataKey={brand.name}
                          stroke={BRAND_COLORS[i]}
                          strokeWidth={activeBrand === brand.name ? 4 : activeBrand ? 1 : 2}
                          opacity={activeBrand && activeBrand !== brand.name ? 0.3 : 1}
                          dot={false} onMouseEnter={() => setHoveredBrand(brand.name)} />
                      )
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
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
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
