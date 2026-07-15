"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface Brand { name: string; keywords: string[] }
interface KeywordGroup { id: string; label: string; brands: Brand[] }
interface KeywordGroups { [key: string]: { label: string; brands: Brand[] } }

type Row = Record<string, string | number>;

const BRAND_COLORS = ["#FF6B35", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#FF9FF3", "#54A0FF"];
const STACK = [
  { label: "주간", value: "1week" },
  { label: "3개월", value: "3months" },
  { label: "1년", value: "1year" },
  { label: "3년", value: "3years" },
];

function todayStr() {
  return new Date().toISOString().split("T")[0];
}
function dateBefore(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split("T")[0];
}

interface TooltipEntry { name: string; value: number; color: string; }
function TrendTooltip({ active, payload, label, activeBrand }: { active?: boolean; payload?: TooltipEntry[]; label?: string; activeBrand?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "10px 12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", minWidth: "160px" }}>
      <p style={{ fontSize: "11px", color: "#6b7280", marginBottom: "6px", fontWeight: 500 }}>{label}</p>
      {payload.map((e) => {
        const hi = activeBrand ? e.name === activeBrand : false;
        return (
          <div key={e.name} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "2px 0", opacity: activeBrand && !hi ? 0.4 : 1 }}>
            <div style={{ width: hi ? "11px" : "8px", height: hi ? "11px" : "8px", borderRadius: "50%", backgroundColor: e.color, flexShrink: 0 }} />
            <span style={{ fontSize: hi ? "14px" : "12px", fontWeight: hi ? 700 : 400, color: hi ? "#111" : "#6b7280", flex: 1 }}>{e.name}</span>
            <span style={{ fontSize: hi ? "14px" : "12px", fontWeight: hi ? 700 : 400, color: e.color }}>{typeof e.value === "number" ? e.value.toFixed(1) : e.value}</span>
          </div>
        );
      })}
    </div>
  );
}

function TrendChart({ badge, title, data, brands, hidden, activeBrand, onHover }: {
  badge: string; title: string; data: Row[]; brands: Brand[];
  hidden: Set<string>; activeBrand: string; onHover: (name: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-kkumbi-50 text-kkumbi-600">{badge}</span>
        <h4 className="text-sm font-semibold text-stone-700">{title}</h4>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} onMouseLeave={() => onHover("")}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#78716c" }} />
          <YAxis tick={{ fontSize: 10, fill: "#a8a29e" }} />
          <Tooltip content={<TrendTooltip activeBrand={activeBrand} />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {brands.map((b, i) => (
            !hidden.has(b.name) && (
              <Line key={b.name} type="monotone" dataKey={b.name} stroke={BRAND_COLORS[i % BRAND_COLORS.length]}
                strokeWidth={activeBrand === b.name ? 4 : activeBrand ? 1 : 2}
                opacity={activeBrand && activeBrand !== b.name ? 0.3 : 1}
                dot={false} onMouseEnter={() => onHover(b.name)} />
            )
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function NaverTrendEmbed() {
  const [groupList, setGroupList] = useState<KeywordGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [kwLoading, setKwLoading] = useState(true);

  const [chartsData, setChartsData] = useState<Record<string, Row[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [hiddenBrands, setHiddenBrands] = useState<Set<string>>(new Set());
  const [focusedBrand, setFocusedBrand] = useState("");
  const [hoveredBrand, setHoveredBrand] = useState("");

  const [customStart, setCustomStart] = useState(dateBefore(12));
  const [customEnd, setCustomEnd] = useState(todayStr());
  const [customData, setCustomData] = useState<Row[]>([]);
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState("");
  const [customLoaded, setCustomLoaded] = useState(false);

  const currentGroup = groupList.find((g) => g.id === selectedGroup) ?? null;
  const activeBrand = focusedBrand || hoveredBrand;
  const hasStack = STACK.some((pp) => (chartsData[pp.value]?.length ?? 0) > 0);
  const hasAnyChart = hasStack || customData.length > 0;

  useEffect(() => {
    let alive = true;
    setKwLoading(true);
    fetch("/api/keywords")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (!alive || !data || typeof data !== "object") return;
        const groups = data as KeywordGroups;
        const list = Object.entries(groups)
          .filter(([, g]) => g && Array.isArray(g.brands))
          .map(([id, g]) => ({ id, label: g.label, brands: g.brands }));
        setGroupList(list);
        if (list.length > 0) setSelectedGroup((prev) => prev || list[0].id);
      })
      .catch((e) => console.error("키워드 로드 실패:", e))
      .finally(() => { if (alive) setKwLoading(false); });
    return () => { alive = false; };
  }, []);

  function pickGroup(id: string) {
    setSelectedGroup(id);
    setChartsData({});
    setCustomData([]);
    setCustomLoaded(false);
    setError("");
    setCustomError("");
    setHiddenBrands(new Set());
    setFocusedBrand("");
  }

  async function fetchTrend() {
    if (!selectedGroup) return;
    setLoading(true); setError(""); setChartsData({});
    setHiddenBrands(new Set()); setFocusedBrand("");
    try {
      const entries = await Promise.all(
        STACK.map(async (pp) => {
          const res = await fetch("/api/trend", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ groupId: selectedGroup, period: pp.value }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "오류가 발생했습니다.");
          return [pp.value, (data.results ?? []) as Row[]] as const;
        })
      );
      setChartsData(Object.fromEntries(entries));
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCustom() {
    if (!selectedGroup || !customStart || !customEnd) return;
    if (customStart > customEnd) { setCustomError("시작일이 종료일보다 늦을 수 없습니다."); return; }
    setCustomLoading(true); setCustomError(""); setCustomLoaded(true);
    try {
      const res = await fetch("/api/trend", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: selectedGroup, period: "custom", customStart, customEnd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류가 발생했습니다.");
      setCustomData((data.results ?? []) as Row[]);
    } catch (e) {
      setCustomError(e instanceof Error ? e.message : "오류가 발생했습니다.");
      setCustomData([]);
    } finally {
      setCustomLoading(false);
    }
  }

  return (
    <div className="mt-5 pt-4 border-t border-stone-200 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-stone-800">네이버 검색 트렌드</h3>
        <p className="text-[11px] text-stone-400 mt-0.5">
          카테고리를 고르고 <b className="text-stone-600">트렌드 조회</b>를 누르면 주간 · 3개월 · 1년 · 3년 그래프가 순서대로 나옵니다. 특정 구간을 보려면 아래 <b className="text-stone-600">직접입력</b>을 이용하세요.
        </p>
      </div>

      {kwLoading && <p className="text-xs text-stone-400">카테고리 불러오는 중...</p>}

      {groupList.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {groupList.map((g) => (
            <button key={g.id} onClick={() => pickGroup(g.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedGroup === g.id ? "bg-kkumbi-500 text-white" : "bg-white text-stone-600 border border-stone-200 hover:border-kkumbi-300"}`}>
              {g.label}
            </button>
          ))}
        </div>
      )}

      {currentGroup && hasAnyChart && (
        <div className="bg-stone-50 rounded-xl border border-stone-200 p-3">
          <p className="text-[11px] text-stone-400 mb-2">브랜드 클릭 → 강조 / 더블클릭 → 숨기기 (아래 모든 그래프에 공통 적용)</p>
          <div className="flex flex-wrap gap-1.5">
            {currentGroup.brands.map((brand, i) => (
              <button key={brand.name}
                onClick={() => setFocusedBrand((prev) => (prev === brand.name ? "" : brand.name))}
                onDoubleClick={() => setHiddenBrands((prev) => { const n = new Set(prev); if (n.has(brand.name)) n.delete(brand.name); else n.add(brand.name); return n; })}
                onMouseEnter={() => setHoveredBrand(brand.name)} onMouseLeave={() => setHoveredBrand("")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${hiddenBrands.has(brand.name) ? "bg-stone-100 text-stone-400 border-stone-200 line-through" : focusedBrand === brand.name ? "bg-kkumbi-50 border-kkumbi-400 text-kkumbi-700 font-bold" : "bg-white text-stone-700 border-stone-300"}`}>
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hiddenBrands.has(brand.name) ? "#ccc" : BRAND_COLORS[i % BRAND_COLORS.length] }} />
                {brand.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <button onClick={fetchTrend} disabled={loading || !selectedGroup}
        className="w-full py-2.5 bg-kkumbi-500 text-white text-sm font-semibold rounded-xl hover:bg-kkumbi-600 disabled:opacity-50">
        {loading ? "데이터 조회 중..." : "트렌드 조회 (주간 · 3개월 · 1년 · 3년)"}
      </button>
      {error && <p className="text-xs text-rose-500">{error}</p>}

      {currentGroup && STACK.map((pp) => {
        const data = chartsData[pp.value];
        if (!data || data.length === 0) return null;
        return (
          <TrendChart key={pp.value} badge={pp.label} title={`${currentGroup.label} 검색량 추이`}
            data={data} brands={currentGroup.brands} hidden={hiddenBrands} activeBrand={activeBrand} onHover={setHoveredBrand} />
        );
      })}

      <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">직접입력</span>
          <h4 className="text-sm font-semibold text-stone-700">기간 지정 조회</h4>
        </div>
        <p className="text-[11px] text-stone-400">위 4개 그래프는 &ldquo;오늘 기준 거꾸로&rdquo;라 특정 시작점을 못 봅니다. 시작·종료 날짜를 지정하면 그 구간만 볼 수 있습니다.</p>
        <div className="flex items-end gap-2 flex-wrap">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-stone-500 font-medium">시작일</span>
            <input type="date" value={customStart} max={customEnd} onChange={(e) => setCustomStart(e.target.value)}
              className="border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs" />
          </label>
          <span className="text-stone-400 pb-2">~</span>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-stone-500 font-medium">종료일</span>
            <input type="date" value={customEnd} min={customStart} max={todayStr()} onChange={(e) => setCustomEnd(e.target.value)}
              className="border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs" />
          </label>
          <button onClick={fetchCustom} disabled={customLoading || !selectedGroup}
            className="ml-auto px-4 py-1.5 bg-indigo-500 text-white text-xs font-semibold rounded-lg hover:bg-indigo-600 disabled:opacity-50">
            {customLoading ? "조회 중..." : "구간 조회"}
          </button>
        </div>
        {customError && <p className="text-xs text-rose-500">{customError}</p>}
        {currentGroup && customData.length > 0 && (
          <TrendChart badge={`${customStart} ~ ${customEnd}`} title={`${currentGroup.label} 검색량 추이`}
            data={customData} brands={currentGroup.brands} hidden={hiddenBrands} activeBrand={activeBrand} onHover={setHoveredBrand} />
        )}
        {customLoaded && !customLoading && !customError && customData.length === 0 && (
          <p className="text-xs text-stone-400">해당 구간에 데이터가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
