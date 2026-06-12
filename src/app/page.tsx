"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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

// 사이드바 메뉴 구조
const SIDEBAR_MENUS = [
  {
    id: "dashboard",
    label: "전체 요약",
    icon: "📊",
    children: [],
  },
  {
    id: "kpi_keyword",
    label: "01. 키워드 검색량",
    icon: "🔍",
    children: [
      { id: "keyword_trend", label: "경쟁사 트렌드" },
      { id: "keyword_ranking", label: "검색 노출 순위" },
    ],
  },
  {
    id: "kpi_performance",
    label: "02. 퍼포먼스 매출",
    icon: "💰",
    children: [
      { id: "monitor_naver", label: "네이버 모니터링" },
      { id: "monitor_social", label: "소셜 모니터링" },
    ],
  },
  {
    id: "kpi_ads",
    label: "03. 주력제품 광고매출",
    icon: "📦",
    children: [
      { id: "monitor_shopping", label: "쇼핑 모니터링" },
    ],
  },
  {
    id: "kpi_exposure",
    label: "04. 키워드 1페이지 노출",
    icon: "🏆",
    children: [
      { id: "keyword_ranking", label: "순위 추이" },
    ],
  },
  {
    id: "kpi_newuser",
    label: "05. 신규유입",
    icon: "👥",
    children: [],
  },
  {
    id: "kpi_synergy",
    label: "06. 계열사 시너지",
    icon: "🤝",
    children: [],
  },
  {
    id: "kpi_budget",
    label: "07. 예산 효율",
    icon: "💡",
    children: [],
  },
  {
    id: "kpi_ai",
    label: "08. AI 업무 절감",
    icon: "🤖",
    children: [],
  },
];

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

interface IntegratedInsights {
  competitorSummary: string;
  benchmarkPoints: string[];
  kkumbiStrategy: string;
  actionPlan: string[];
  channelStrategy: string[];
}

export default function HomePage() {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set(["kpi_keyword"]));
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [dateRange, setDateRange] = useState<MonitorDateRange>(getDefaultDateRange);
  const [sortOrder, setSortOrder] = useState<SortOrder>("latest");
  const [copied, setCopied] = useState(false);
  const [reSearching, setReSearching] = useState(false);

  const [groupKeywords, setGroupKeywords] = useState<Record<string, string[]>>({
    naver: [], social: [], shopping: [],
  });
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
  const [exportLoading, setExportLoading] = useState(false);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [newGroupId, setNewGroupId] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [addingBrandToGroup, setAddingBrandToGroup] = useState("");
  const [groupMgrError, setGroupMgrError] = useState("");

  const currentGroup = groupList.find((g) => g.id === selectedGroup) ?? null;
  const activeBrand = focusedBrand || hoveredBrand;
  const anyResult = Object.values(groupResults).some(Boolean);
  const allLoginItems = Object.values(groupResults)
    .filter(Boolean)
    .flatMap((r) => r!.channels.flatMap((c) => c.loginRequired));

  useEffect(() => {
    if (activeMenu !== "keyword_trend") return;
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
        if (list.length > 0 && !selectedGroup) setSelectedGroup(list[0].id);
      })
      .catch((e) => console.error("키워드 로드 실패:", e))
      .finally(() => setKwLoading(false));
  }, [activeMenu]);

  const handleGroupMonitor = useCallback(async (groupId: string) => {
    const trimmed = (groupKeywords[groupId] ?? []).map((k) => k.trim()).filter(Boolean);
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
      const res = await fetch("/api/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: trimmed,
          sortOrder,
          channels: groupChannels[groupId],
          period: dateRange,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "모니터링 요청에 실패했습니다.");
      setGroupResults((prev) => ({ ...prev, [groupId]: data as MonitorResult }));
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setGroupErrors((prev) => ({ ...prev, [groupId]: err instanceof Error ? err.message : "오류가 발생했습니다." }));
    } finally {
      setGroupLoading((prev) => ({ ...prev, [groupId]: false }));
    }
  }, [groupKeywords, sortOrder, dateRange, groupChannels]);

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

  async function handleExportToSheets() {
    if (!chartData.length || !currentGroup) return;
    setExportLoading(true);
    try {
      const rows = chartData.flatMap((point) =>
        currentGroup.brands.map((brand) => ({
          category: currentGroup.label,
          brand: brand.name,
          avgIndex: typeof point[brand.name] === "number" ? (point[brand.name] as number).toFixed(1) : "0",
          growthRate: "",
          peakDate: point.period,
          trendStatus: "",
        }))
      );
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_keyword_trend", rows }),
      });
      const data = await res.json();
      if (data.success) alert("✅ 구글 시트에 저장 완료!");
      else alert("❌ 저장 실패: " + (data.error ?? "오류 발생"));
    } catch {
      alert("❌ 오류가 발생했습니다.");
    } finally {
      setExportLoading(false);
    }
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

  async function handleAddGroup() {
    if (!newGroupLabel.trim()) { setGroupMgrError("카테고리 이름을 입력해주세요."); return; }
    setGroupMgrError("");
    const groupId = newGroupId.trim() || newGroupLabel.trim().replace(/\s+/g, "_");
    try {
      const res = await fetch("/api/keywords", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_group", groupId, label: newGroupLabel.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setGroupMgrError(data.error || "오류 발생"); return; }
      setKeywordGroups(data);
      const list = Object.entries(data as KeywordGroups).map(([id, g]) => ({ id, label: g.label, brands: g.brands }));
      setGroupList(list);
      setNewGroupLabel(""); setNewGroupId("");
    } catch { setGroupMgrError("서버 오류가 발생했습니다."); }
  }

  async function handleDeleteGroup(groupId: string, label: string) {
    if (!confirm(`"${label}" 카테고리를 삭제할까요?`)) return;
    try {
      const res = await fetch("/api/keywords", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_group", groupId }),
      });
      const data = await res.json();
      if (!res.ok) return;
      setKeywordGroups(data);
      const list = Object.entries(data as KeywordGroups).map(([id, g]) => ({ id, label: g.label, brands: g.brands }));
      setGroupList(list);
      if (selectedGroup === groupId && list.length > 0) setSelectedGroup(list[0].id);
    } catch {}
  }

  async function handleAddBrand(groupId: string) {
    if (!newBrandName.trim()) { setGroupMgrError("브랜드명을 입력해주세요."); return; }
    setGroupMgrError("");
    try {
      const res = await fetch("/api/keywords", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_brand", groupId, brandName: newBrandName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setGroupMgrError(data.error || "오류 발생"); return; }
      setKeywordGroups(data);
      const list = Object.entries(data as KeywordGroups).map(([id, g]) => ({ id, label: g.label, brands: g.brands }));
      setGroupList(list);
      setNewBrandName(""); setAddingBrandToGroup("");
    } catch { setGroupMgrError("서버 오류가 발생했습니다."); }
  }

  async function handleDeleteBrand(groupId: string, brandName: string) {
    if (!confirm(`"${brandName}" 브랜드를 삭제할까요?`)) return;
    try {
      const res = await fetch("/api/keywords", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_brand", groupId, brandName }),
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

  const toggleMenu = (menuId: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      next.has(menuId) ? next.delete(menuId) : next.add(menuId);
      return next;
    });
  };

  // 현재 활성 메뉴에 해당하는 모니터링 그룹
  const activeMonitorGroup = activeMenu === "monitor_naver" ? "naver"
    : activeMenu === "monitor_social" ? "social"
    : activeMenu === "monitor_shopping" ? "shopping"
    : null;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 사이드바 */}
      <aside className={`${sidebarOpen ? "w-64" : "w-16"} bg-[#1a1a2e] text-white flex flex-col transition-all duration-300 shrink-0 sticky top-0 h-screen overflow-y-auto`}>
        {/* 로고 */}
        <div className="px-4 py-5 border-b border-white/10 flex items-center justify-between">
          {sidebarOpen && (
            <div>
              <p className="text-xs text-kkumbi-300 font-semibold uppercase tracking-widest">꿈비 그룹</p>
              <p className="text-sm font-bold text-white">팬슈머마케팅팀</p>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white/60 hover:text-white p-1">
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        {/* 메뉴 */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {SIDEBAR_MENUS.map((menu) => (
            <div key={menu.id}>
              <button
                onClick={() => {
                  if (menu.children.length > 0) {
                    toggleMenu(menu.id);
                  } else {
                    setActiveMenu(menu.id);
                  }
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  activeMenu === menu.id
                    ? "bg-kkumbi-500 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="text-base shrink-0">{menu.icon}</span>
                {sidebarOpen && (
                  <>
                    <span className="flex-1 text-left text-xs">{menu.label}</span>
                    {menu.children.length > 0 && (
                      <span className="text-xs text-white/40">
                        {expandedMenus.has(menu.id) ? "▲" : "▼"}
                      </span>
                    )}
                  </>
                )}
              </button>

              {/* 하위 메뉴 */}
              {sidebarOpen && menu.children.length > 0 && expandedMenus.has(menu.id) && (
                <div className="ml-4 mt-1 space-y-1">
                  {menu.children.map((child) => (
                    <button
                      key={`${menu.id}_${child.id}`}
                      onClick={() => setActiveMenu(child.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition ${
                        activeMenu === child.id
                          ? "bg-kkumbi-500/80 text-white"
                          : "text-white/60 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="text-white/40">└</span>
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* 하단 */}
        {sidebarOpen && (
          <div className="px-4 py-3 border-t border-white/10 text-xs text-white/40">
            경쟁사 모니터링 시스템
          </div>
        )}
      </aside>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 상단 헤더 */}
        <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-lg font-bold text-stone-900">
              {SIDEBAR_MENUS.find(m => m.id === activeMenu)?.label ??
               SIDEBAR_MENUS.flatMap(m => m.children).find(c => c.id === activeMenu)?.label ??
               "대시보드"}
            </h1>
            <p className="text-xs text-stone-500">꿈비 그룹 · 전 채널 통합 경쟁사 모니터링</p>
          </div>
          <div className="flex items-center gap-3">
            <DateRangeSelect value={dateRange} onChange={setDateRange} disabled={false} />
          </div>
        </header>

        {/* 콘텐츠 영역 */}
        <main className="flex-1 p-6 space-y-6">

          {/* 대시보드 */}
          {activeMenu === "dashboard" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "키워드 검색량", target: "170만건", icon: "🔍", color: "bg-blue-50 border-blue-200" },
                  { label: "퍼포먼스 매출", target: "24억", icon: "💰", color: "bg-green-50 border-green-200" },
                  { label: "주력제품 광고매출", target: "45억", icon: "📦", color: "bg-purple-50 border-purple-200" },
                  { label: "신규유입", target: "120만", icon: "👥", color: "bg-orange-50 border-orange-200" },
                  { label: "계열사 시너지", target: "5만명", icon: "🤝", color: "bg-pink-50 border-pink-200" },
                  { label: "예산 효율", target: "6.5% 이내", icon: "💡", color: "bg-yellow-50 border-yellow-200" },
                  { label: "AI 업무 절감", target: "300시간", icon: "🤖", color: "bg-teal-50 border-teal-200" },
                  { label: "키워드 1페이지 노출", target: "관리", icon: "🏆", color: "bg-red-50 border-red-200" },
                ].map((kpi) => (
                  <div key={kpi.label} className={`rounded-xl border p-4 ${kpi.color}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{kpi.icon}</span>
                      <span className="text-xs font-semibold text-stone-600">{kpi.label}</span>
                    </div>
                    <p className="text-xs text-stone-500">연간 목표</p>
                    <p className="text-lg font-bold text-stone-800">{kpi.target}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white p-6">
                <p className="text-sm text-stone-500 text-center">왼쪽 메뉴에서 항목을 선택해주세요</p>
              </div>
            </div>
          )}

          {/* 경쟁사 모니터링 (네이버/소셜/쇼핑) */}
          {activeMonitorGroup && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="bg-stone-50 border-b border-stone-100 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">
                      {activeMonitorGroup === "naver" ? "📰" : activeMonitorGroup === "social" ? "📱" : "🛒"}
                    </span>
                    <div>
                      <h2 className="text-base font-bold text-stone-800">
                        {activeMonitorGroup === "naver" ? "네이버" : activeMonitorGroup === "social" ? "소셜" : "쇼핑"} 채널 모니터링
                      </h2>
                      <p className="text-xs text-stone-500">
                        {CHANNEL_GROUPS.find(g => g.id === activeMonitorGroup)?.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CHANNEL_GROUPS.find(g => g.id === activeMonitorGroup)?.channels.map((chId) => {
                      const isComingSoon = COMING_SOON.includes(chId);
                      const isChecked = groupChannels[activeMonitorGroup]?.includes(chId) ?? false;
                      return (
                        <label key={chId} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium cursor-pointer transition ${
                          isComingSoon ? "border-stone-100 bg-stone-50 text-stone-300 cursor-not-allowed"
                          : isChecked ? "border-kkumbi-400 bg-kkumbi-50 text-kkumbi-700"
                          : "border-stone-200 bg-white text-stone-500 hover:border-kkumbi-200"
                        }`}>
                          <input type="checkbox" checked={isChecked} disabled={isComingSoon}
                            onChange={() => toggleGroupChannel(activeMonitorGroup, chId)} className="h-3 w-3" />
                          {CHANNEL_LABELS[chId]}
                          {isComingSoon && <span className="text-[10px] text-stone-300">(예정)</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="px-6 py-4 space-y-3">
                  <KeywordInput
                    keywords={groupKeywords[activeMonitorGroup] ?? []}
                    onChange={(kws) => setGroupKeywords((prev) => ({ ...prev, [activeMonitorGroup]: kws }))}
                    disabled={groupLoading[activeMonitorGroup]}
                  />
                  <div className="flex gap-3">
                    <SortSelect value={sortOrder} onChange={setSortOrder} disabled={groupLoading[activeMonitorGroup]} />
                    <button type="button" onClick={() => handleGroupMonitor(activeMonitorGroup)}
                      disabled={groupLoading[activeMonitorGroup]}
                      className="flex-1 rounded-xl bg-kkumbi-500 py-3 text-sm font-bold text-white shadow transition hover:bg-kkumbi-600 disabled:opacity-60">
                      {groupLoading[activeMonitorGroup] ? (
                        <span className="flex items-center justify-center gap-2"><Spinner />검색 중…</span>
                      ) : "모니터링 시작"}
                    </button>
                    {groupLoading[activeMonitorGroup] && (
                      <button type="button" onClick={() => { abortRefs.current[activeMonitorGroup]?.abort(); setGroupLoading((prev) => ({ ...prev, [activeMonitorGroup]: false })); }}
                        className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold text-stone-700 hover:bg-rose-50 hover:text-rose-700">
                        중지
                      </button>
                    )}
                  </div>
                  {groupErrors[activeMonitorGroup] && (
                    <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{groupErrors[activeMonitorGroup]}</p>
                  )}
                </div>
                {groupResults[activeMonitorGroup] && (
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-stone-500">
                        수집 완료 · {new Date(groupResults[activeMonitorGroup]!.searchedAt).toLocaleString("ko-KR")}
                      </p>
                      <button type="button" onClick={handleCopyReport}
                        className="rounded-xl border border-kkumbi-300 bg-white px-4 py-2 text-sm font-semibold text-kkumbi-700 hover:bg-kkumbi-50">
                        {copied ? "복사 완료!" : "노션용 리포트 복사"}
                      </button>
                    </div>
                    <MonitorPeriodBanner period={groupResults[activeMonitorGroup]!.period} />
                    <ChannelTabs
                      channels={groupResults[activeMonitorGroup]!.channels}
                      selectedIds={groupResults[activeMonitorGroup]!.selectedChannels}
                      sortOrder={sortOrder}
                      onSortChange={async (newSort) => {
                        setSortOrder(newSort);
                        setReSearching(true);
                        try {
                          const res = await fetch("/api/monitor", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              keywords: (groupKeywords[activeMonitorGroup] ?? []).map((k) => k.trim()).filter(Boolean),
                              sortOrder: newSort,
                              channels: groupChannels[activeMonitorGroup],
                              period: dateRange,
                            }),
                          });
                          const data = await res.json();
                          if (res.ok) setGroupResults((prev) => ({ ...prev, [activeMonitorGroup]: data }));
                        } finally { setReSearching(false); }
                      }}
                      reSearching={reSearching}
                    />
                    {groupResults[activeMonitorGroup]!.insights && (
                      <InsightsPanel insights={groupResults[activeMonitorGroup]!.insights} />
                    )}
                  </div>
                )}
              </div>
              {anyResult && (
                <>
                  <LoginRequiredSection items={allLoginItems} />
                  <IntegratedInsightsButton groupResults={groupResults} groupKeywords={groupKeywords} dateRange={dateRange} />
                </>
              )}
            </div>
          )}

          {/* 키워드 트렌드 */}
          {activeMenu === "keyword_trend" && (
            <div className="space-y-4">
              {kwLoading && <p className="text-sm text-gray-400">키워드 불러오는 중...</p>}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex gap-2 flex-wrap">
                  {groupList.map((g) => (
                    <button key={g.id} onClick={() => { setSelectedGroup(g.id); setChartData([]); setHiddenBrands(new Set()); setFocusedBrand(""); setExpandedBrands(new Set()); }}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedGroup === g.id ? "bg-kkumbi-500 text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-kkumbi-300"}`}>
                      {g.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowGroupManager(!showGroupManager)}
                  className="px-4 py-2 rounded-full text-sm font-medium border border-stone-300 bg-white text-stone-600 hover:bg-stone-50">
                  ⚙️ 카테고리 관리
                </button>
              </div>

              {showGroupManager && (
                <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4 shadow-sm">
                  <h3 className="font-bold text-stone-800 text-sm">카테고리 관리</h3>
                  <div className="space-y-2 border-b border-stone-100 pb-4">
                    <p className="text-xs font-semibold text-stone-500">새 카테고리 추가</p>
                    <div className="flex gap-2">
                      <input value={newGroupLabel} onChange={(e) => setNewGroupLabel(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
                        placeholder="카테고리 이름 (예: 아기물티슈)"
                        className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm" />
                      <button onClick={handleAddGroup} className="px-4 py-2 bg-kkumbi-500 text-white text-sm font-semibold rounded-lg hover:bg-kkumbi-600">추가</button>
                    </div>
                    {groupMgrError && <p className="text-xs text-rose-500">{groupMgrError}</p>}
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {groupList.map((g) => (
                      <div key={g.id} className="border border-stone-100 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-stone-700">{g.label}</span>
                          <div className="flex gap-2">
                            <button onClick={() => { setAddingBrandToGroup(g.id); setNewBrandName(""); setGroupMgrError(""); }} className="text-xs text-blue-500 hover:underline">+ 브랜드</button>
                            <button onClick={() => handleDeleteGroup(g.id, g.label)} className="text-xs text-rose-400 hover:text-rose-600">삭제</button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {g.brands.map((brand) => (
                            <span key={brand.name} className="group flex items-center gap-1 text-xs bg-stone-100 text-stone-600 px-2 py-1 rounded-full">
                              {brand.name}
                              <button onClick={() => handleDeleteBrand(g.id, brand.name)} className="hidden group-hover:inline text-rose-400 hover:text-rose-600">×</button>
                            </span>
                          ))}
                        </div>
                        {addingBrandToGroup === g.id && (
                          <div className="flex gap-2 mt-1">
                            <input value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleAddBrand(g.id)}
                              placeholder="브랜드명 입력" className="flex-1 border border-stone-200 rounded px-2 py-1 text-sm" />
                            <button onClick={() => handleAddBrand(g.id)} className="px-3 py-1 bg-kkumbi-500 text-white text-xs rounded hover:bg-kkumbi-600">추가</button>
                            <button onClick={() => setAddingBrandToGroup("")} className="px-3 py-1 bg-stone-100 text-stone-600 text-xs rounded hover:bg-stone-200">취소</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex gap-2 flex-wrap mb-3">
                  {PRESET_PERIODS.map((p) => (
                    <button key={p.value} onClick={() => setSelectedPeriod(p.value)}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${selectedPeriod === p.value ? "bg-stone-800 text-white" : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"}`}>
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
                              className="text-xs text-kkumbi-500 hover:underline">
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
                              className="text-xs text-kkumbi-400 px-1">+{brand.keywords.length - 5}개 더보기</button>
                          )}
                        </div>
                        {addingBrand?.groupId === selectedGroup && addingBrand?.brandName === brand.name && (
                          <div className="mt-2 flex gap-2 items-center">
                            <input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleAddKeyword(selectedGroup, brand.name)}
                              placeholder="새 키워드 입력" className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm" />
                            <button onClick={() => handleAddKeyword(selectedGroup, brand.name)}
                              className="px-3 py-1 bg-kkumbi-500 text-white text-xs rounded hover:bg-kkumbi-600">추가</button>
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
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${hiddenBrands.has(brand.name) ? "bg-gray-100 text-gray-400 border-gray-200 line-through" : focusedBrand === brand.name ? "bg-kkumbi-50 border-kkumbi-400 text-kkumbi-700 font-bold" : "bg-white text-gray-700 border-gray-300"}`}>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hiddenBrands.has(brand.name) ? "#ccc" : BRAND_COLORS[i] }} />
                        {brand.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={fetchTrend} disabled={trendLoading}
                  className="flex-1 py-3 bg-kkumbi-500 text-white font-semibold rounded-xl hover:bg-kkumbi-600 disabled:opacity-50">
                  {trendLoading ? "데이터 조회 중..." : "트렌드 조회"}
                </button>
                {chartData.length > 0 && (
                  <button onClick={handleExportToSheets} disabled={exportLoading}
                    className="flex-1 py-3 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 disabled:opacity-50">
                    {exportLoading ? "내보내는 중..." : "📊 구글 시트 저장"}
                  </button>
                )}
              </div>
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

          {/* 준비 중 화면 */}
          {["kpi_newuser","kpi_synergy","kpi_budget","kpi_ai","kpi_keyword","kpi_performance","kpi_ads","kpi_exposure"].includes(activeMenu) && (
            <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
              <p className="text-4xl mb-4">🔧</p>
              <h3 className="text-lg font-bold text-stone-700 mb-2">
                {SIDEBAR_MENUS.find(m => m.id === activeMenu)?.label}
              </h3>
              <p className="text-sm text-stone-500">해당 KPI 데이터 연동 준비 중입니다.</p>
              <p className="text-xs text-stone-400 mt-2">하위 메뉴를 선택해주세요</p>
            </div>
          )}

          {/* 검색 노출 순위 */}
          {activeMenu === "keyword_ranking" && (
            <div className="rounded-2xl border border-stone-200 bg-white p-6">
              <p className="text-sm text-stone-600">검색 노출 순위 추이는 <strong>쇼핑 채널 모니터링</strong>에서 확인하세요.</p>
              <button onClick={() => setActiveMenu("monitor_shopping")}
                className="mt-3 px-4 py-2 bg-kkumbi-500 text-white text-sm font-semibold rounded-lg hover:bg-kkumbi-600">
                쇼핑 모니터링으로 이동
              </button>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

function IntegratedInsightsButton({
  groupResults, groupKeywords, dateRange,
}: {
  groupResults: Record<string, MonitorResult | null>;
  groupKeywords: Record<string, string[]>;
  dateRange: MonitorDateRange;
}) {
  const [loading, setLoading] = useState(false);
  const [integrated, setIntegrated] = useState<IntegratedInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeGroups = Object.entries(groupResults).filter(([, r]) => r !== null);

  async function handleIntegrated() {
    setLoading(true); setError(null); setIntegrated(null);
    try {
      const res = await fetch("/api/integrated-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groups: activeGroups.map(([groupId, result]) => ({
            groupId,
            keywords: groupKeywords[groupId] ?? [],
            channels: result!.channels,
          })),
          period: dateRange,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "오류 발생");
      setIntegrated(data.integratedInsights);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally { setLoading(false); }
  }

  if (activeGroups.length === 0) return null;
  return (
    <div className="space-y-4">
      <button type="button" onClick={handleIntegrated} disabled={loading}
        className="w-full rounded-2xl bg-gradient-to-r from-kkumbi-500 to-kkumbi-600 py-4 text-base font-bold text-white shadow-lg transition hover:from-kkumbi-600 hover:to-kkumbi-700 disabled:opacity-60">
        {loading ? <span className="flex items-center justify-center gap-2"><Spinner />전 채널 통합 전략 분석 중…</span> : "✨ 전 채널 통합 인사이트 도출"}
      </button>
      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {integrated && (
        <InsightsPanel
          insights={{ consumerInterests: [], positiveKeywords: [], negativeKeywords: [], immediateAction: "", channelHighlights: [] }}
          integrated={integrated}
        />
      )}
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
