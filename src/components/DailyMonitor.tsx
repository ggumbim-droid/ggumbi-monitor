"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ══════════════════════════════════════════════════
//  일일 모니터
//
//  기존 트렌드 화면과 달리 "조회" 클릭이 없습니다.
//  매일 새벽 자동 수집된 값이 저장소에 쌓여 있고, 이 화면은 그걸 읽기만 합니다.
//
//  앞으로 사업팀 일단위 매출이 같은 저장소에 들어오면
//  여기에 매출 축을 겹쳐서 "검색이 오른 날 매출도 올랐나"를 볼 수 있습니다.
// ══════════════════════════════════════════════════

const SERIES_COLORS = [
  "#FF6B35", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#DDA0DD", "#FF9FF3", "#54A0FF", "#F6B93B",
];

interface CatalogEntry {
  category: string;
  line: string;
  brand: string;
  series: string[];
}

interface ChartRow {
  date: string;
  [key: string]: string | number | null;
}

const PERIODS = [
  { label: "7일", days: 7 },
  { label: "30일", days: 30 },
  { label: "90일", days: 90 },
  { label: "전체", days: 365 },
];

function fmtTick(d: string) {
  const p = d.split("-");
  return p.length === 3 ? `${Number(p[1])}/${Number(p[2])}` : d;
}

function fmtFull(d: string) {
  return String(d).replace(/-/g, ".");
}

export function DailyMonitor() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [activeLine, setActiveLine] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [days, setDays] = useState(30);
  const [useCustom, setUseCustom] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [rows, setRows] = useState<ChartRow[]>([]);
  const [series, setSeries] = useState<string[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState<{ first: string; last: string; dayCount: number } | null>(null);

  // ── 최초 1회: 저장소에 무엇이 있는지 목록을 읽어옵니다 (클릭 불필요) ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/daily?days=365&view=catalog");
        const data = await res.json();
        if (!alive) return;
        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }
        const list: CatalogEntry[] = data.catalog ?? [];
        setCatalog(list);
        setMeta({
          first: data.firstDate ?? "",
          last: data.lastDate ?? "",
          dayCount: data.dayCount ?? 0,
        });
        if (list.length > 0) {
          setActiveLine(list[0].line);
          setActiveCategory(list[0].category);
        } else {
          setLoading(false);
        }
      } catch {
        if (alive) {
          setError("저장된 데이터를 불러오지 못했습니다.");
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ── 선택이 바뀌면 차트 데이터를 다시 읽습니다 ──
  const loadChart = useCallback(async () => {
    if (!activeCategory) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        view: "chart",
        metric: "trend_index",
        category: activeCategory,
      });
      if (useCustom && customStart && customEnd) {
        params.set("start", customStart);
        params.set("end", customEnd);
      } else {
        params.set("days", String(days));
      }
      const res = await fetch(`/api/daily?${params.toString()}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setRows([]);
        setSeries([]);
      } else {
        setRows(data.rows ?? []);
        setSeries(data.series ?? []);
      }
    } catch {
      setError("차트 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [activeCategory, days, useCustom, customStart, customEnd]);

  useEffect(() => {
    loadChart();
  }, [loadChart]);

  const lines = [...new Set(catalog.map((c) => c.line))];
  const categoriesOfLine = catalog.filter((c) => c.line === activeLine);

  function toggleSeries(name: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  // 저장소가 비어 있는 경우 — 수집이 아직 안 돌았다는 뜻
  if (!loading && catalog.length === 0 && !error) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <p className="text-sm text-stone-600 mb-1">아직 저장된 데이터가 없습니다.</p>
        <p className="text-xs text-stone-400">
          매일 새벽 자동 수집이 한 번 돌고 나면 여기에 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 상단 안내 */}
      <div className="rounded-2xl border border-kkumbi-200 bg-kkumbi-50/50 px-5 py-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-stone-800">
            자동 갱신 · 조회 버튼 없이 바로 표시됩니다
          </p>
          <p className="text-xs text-stone-500 mt-0.5">
            매일 새벽 수집된 값을 읽습니다. 사업팀 매출이 연동되면 이 화면에 함께 표시됩니다.
          </p>
        </div>
        {meta && meta.dayCount > 0 && (
          <span className="text-xs text-stone-500 bg-white border border-stone-200 px-3 py-1.5 rounded-full">
            {fmtFull(meta.first)} ~ {fmtFull(meta.last)} · {meta.dayCount}일치
          </span>
        )}
      </div>

      {/* 브랜드 라인 선택 */}
      <div className="flex gap-2 flex-wrap">
        {lines.map((ln) => (
          <button
            key={ln}
            onClick={() => {
              setActiveLine(ln);
              const first = catalog.find((c) => c.line === ln);
              if (first) setActiveCategory(first.category);
              setHidden(new Set());
            }}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
              activeLine === ln
                ? "bg-kkumbi-500 text-white border-kkumbi-500"
                : "bg-white text-stone-600 border-stone-300 hover:bg-stone-50"
            }`}
          >
            {ln}
          </button>
        ))}
      </div>

      {/* 카테고리 선택 */}
      {categoriesOfLine.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {categoriesOfLine.map((c) => (
            <button
              key={c.category}
              onClick={() => {
                setActiveCategory(c.category);
                setHidden(new Set());
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                activeCategory === c.category
                  ? "bg-stone-800 text-white border-stone-800"
                  : "bg-white text-stone-500 border-stone-200 hover:bg-stone-50"
              }`}
            >
              {c.category}
            </button>
          ))}
        </div>
      )}

      {/* 기간 선택 */}
      <div className="flex gap-2 flex-wrap items-center">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            onClick={() => {
              setDays(p.days);
              setUseCustom(false);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              !useCustom && days === p.days
                ? "bg-kkumbi-500 text-white border-kkumbi-500"
                : "bg-white text-stone-500 border-stone-200 hover:bg-stone-50"
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="text-stone-300">|</span>
        <input
          type="date"
          value={customStart}
          onChange={(e) => setCustomStart(e.target.value)}
          className="border border-stone-200 rounded-lg px-2 py-1.5 text-xs"
        />
        <span className="text-stone-400 text-xs">~</span>
        <input
          type="date"
          value={customEnd}
          onChange={(e) => setCustomEnd(e.target.value)}
          className="border border-stone-200 rounded-lg px-2 py-1.5 text-xs"
        />
        <button
          onClick={() => {
            if (customStart && customEnd) setUseCustom(true);
          }}
          disabled={!customStart || !customEnd}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-700 text-white disabled:bg-stone-200 disabled:text-stone-400"
        >
          기간 적용
        </button>
      </div>

      {/* 차트 */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-stone-800">
            {activeCategory} · 검색 트렌드 지수
          </h3>
          <span className="text-xs text-stone-400">
            네이버 데이터랩 상대지수 · 같은 카테고리 안에서만 비교하세요
          </span>
        </div>

        {error && (
          <p className="text-sm text-rose-500 py-8 text-center">{error}</p>
        )}

        {!error && loading && (
          <p className="text-sm text-stone-400 py-16 text-center">불러오는 중…</p>
        )}

        {!error && !loading && rows.length === 0 && (
          <p className="text-sm text-stone-400 py-16 text-center">
            선택한 기간에 데이터가 없습니다.
          </p>
        )}

        {!error && !loading && rows.length > 0 && (
          <>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtTick}
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                  minTickGap={30}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  labelFormatter={(v) => fmtFull(String(v))}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    fontSize: 12,
                  }}
                />
                <Legend
                  onClick={(e) => toggleSeries(String(e.dataKey))}
                  wrapperStyle={{ fontSize: 12, cursor: "pointer" }}
                />
                {series.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    hide={hidden.has(name)}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-stone-400 mt-2">
              범례를 클릭하면 해당 계열을 숨기거나 다시 표시할 수 있습니다.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
