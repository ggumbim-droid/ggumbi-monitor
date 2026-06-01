"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { KeywordInput } from "@/components/KeywordInput";
import { ChannelSelect } from "@/components/ChannelSelect";
import { DateRangeSelect, getDefaultDateRange } from "@/components/DateRangeSelect";
import { MonitorPeriodBanner } from "@/components/MonitorPeriodBanner";
import { SortSelect } from "@/components/SortSelect";
import { isValidDateRange } from "@/lib/date-range";
import { ChannelTabs } from "@/components/ChannelTabs";
import { LoginRequiredSection } from "@/components/LoginRequiredSection";
import { InsightsPanel } from "@/components/InsightsPanel";
import { buildNotionReport } from "@/lib/report";
import { ALL_CHANNEL_IDS } from "@/lib/channels";
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

  // 모니터링 상태
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<ChannelId[]>(ALL_CHANNEL_IDS);
  const [dateRange, setDateRange] = useState<MonitorDateRange>(getDefaultDateRange);
  const [sortOrder, setSortOrder] = useState<SortOrder>("latest");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MonitorResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [reSearching, setReSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const allLoginItems = useMemo(() => result?.channels.flatMap((c) => c.loginRequired) ?? [], [result]);

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

  const handleMonitor = useCallback(async () => {
    const trimmed = keywords.map((k) => k.trim()).filter(Boolean);
    if (!trimmed.length) { setError("최소 1개의 키워드를 입력해 주세요."); return; }
    if (!selectedChannels.length) { setError("최소 1개의 채널을 선택해 주세요."); return; }
    if (!isValidDateRange(dateRange.startDate, dateRange.endDate)) { setError("시작일은 종료일보다 이후일 수 없습니다."); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true); setError(null); setCopied(false);
    try {
      const res = await fetch("/api/monitor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: trimmed, sortOrder, channels: selectedChannels, period: dateRange }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "모니터링 요청에 실패했습니다.");
      setResult(data as MonitorResult);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      setResult(null);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
    }
  }, [keywords, sortOrder, selectedChannels, dateRange]);

  const handleStopMonitor = useCallback(() => {
    abortRef.current?.abort(); abortRef.current = null;
    setLoading(false); setError(null); setResult(null); setCopied(false);
  }, []);

  const handleCopyReport = useCallback(async () => {
    if (!result) return;
    const report = buildNotionReport(result);
    await navigator.clipboard.writeText(report);
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  }, [result]);

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
  return (
    <div className="min-h-screen bg-gradient-to-b from-kkumbi-50 via-white to-kkumbi-50/30">
      <header className="border-b border-kkumbi-100 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-kkumbi-500">꿈비 그룹</p>
              <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">전 채널 통합 경쟁사 모니터링</h1>
            </div>
            <p className="text-sm text-stone-500">카페 · 블로그 · 뉴스 · 유튜브 · 인스타 · Meta 광고 · 스토어 · 리뷰</p>
          </div>
          {/* 탭 */}
          <div className="flex gap-1 mt-4">
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

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">

        {/* ── 경쟁사 모니터링 탭 ── */}
        {activeTab === "monitor" && (
          <>
            <section className="rounded-2xl border border-kkumbi-100 bg-white p-6 shadow-lg shadow-kkumbi-100/40">
              <div className="space-y-6">
                <KeywordInput keywords={keywords} onChange={setKeywords} disabled={loading} />
                <DateRangeSelect value={dateRange} onChange={setDateRange} disabled={loading} />
                <ChannelSelect selected={selectedChannels} onChange={setSelectedChannels} disabled={loading} />
                <SortSelect value={sortOrder} onChange={setSortOrder} disabled={loading} />
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={handleMonitor} disabled={loading}
                    className="flex-1 rounded-xl bg-kkumbi-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-kkumbi-300/50 transition hover:bg-kkumbi-600 disabled:cursor-not-allowed disabled:opacity-60">
                    {loading ? (
                      <span className="flex items-center justify-center gap-2"><Spinner />채널별 검색 중… ({selectedChannels.length}개)</span>
                    ) : "통합 모니터링 시작"}
                  </button>
                  {loading && (
                    <button type="button" onClick={handleStopMonitor}
                      className="rounded-xl border border-stone-300 bg-white px-6 py-3.5 text-sm font-bold text-stone-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 sm:shrink-0">
                      모니터링 중지
                    </button>
                  )}
                </div>
                {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
              </div>
            </section>

            {result && (
              <>
                <MonitorPeriodBanner period={result.period} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-stone-500">
                    수집 완료 · {new Date(result.searchedAt).toLocaleString("ko-KR")} · {result.selectedChannels.length}개 채널
                  </p>
                  <button type="button" onClick={handleCopyReport}
                    className="rounded-xl border border-kkumbi-300 bg-white px-5 py-2.5 text-sm font-semibold text-kkumbi-700 shadow-sm transition hover:bg-kkumbi-50">
                    {copied ? "복사 완료!" : "노션용 리포트 복사"}
                  </button>
                </div>
                <ChannelTabs
                  channels={result.channels}
                  selectedIds={result.selectedChannels}
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
                          channels: selectedChannels,
                          period: dateRange,
                        }),
                      });
                      const data = await res.json();
                      if (res.ok) setResult(data);
                    } finally {
                      setReSearching(false);
                    }
                  }}
                  reSearching={reSearching}
                />
                <LoginRequiredSection items={allLoginItems} />
                <InsightsPanel insights={result.insights} />
              </>
            )}
          </>
        )}

        {/* ── 트렌드 탭 ── */}
        {activeTab === "trend" && (
          <div className="space-y-4">
            {kwLoading && <p className="text-sm text-gray-400">키워드 불러오는 중...</p>}

            {/* 그룹 탭 */}
            <div className="flex gap-2 flex-wrap">
              {groupList.map((g) => (
                <button key={g.id} onClick={() => { setSelectedGroup(g.id); setChartData([]); setHiddenBrands(new Set()); setFocusedBrand(""); setExpandedBrands(new Set()); }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedGroup === g.id ? "bg-orange-500 text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-orange-300"}`}>
                  {g.label}
                </button>
              ))}
            </div>

            {/* 기간 선택 */}
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

            {/* 키워드 구성 + 추가/삭제 */}
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
                      {/* 키워드 추가 인풋 */}
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

            {/* 브랜드 토글 */}
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

            {/* 조회 버튼 */}
            <button onClick={fetchTrend} disabled={trendLoading}
              className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50">
              {trendLoading ? "데이터 조회 중..." : "트렌드 조회"}
            </button>

            {trendError && <div className="text-red-500 text-sm">{trendError}</div>}

            {/* 차트 */}
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
