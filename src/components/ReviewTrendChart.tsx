"use client";

import type { SmartStoreReviewData } from "@/types/monitor";

interface ReviewTrendChartProps {
  data: SmartStoreReviewData;
}

const CHART_W = 560;
const CHART_H = 200;
const PAD = { top: 20, right: 16, bottom: 36, left: 48 };

export function ReviewTrendChart({ data }: ReviewTrendChartProps) {
  const points = data.trend;
  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-stone-400">
        리뷰 추이 데이터가 없습니다.
      </p>
    );
  }

  const counts = points.map((p) => p.reviewCount);
  const minY = Math.min(...counts);
  const maxY = Math.max(...counts);
  const range = maxY - minY || 1;
  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;

  const coords = points.map((p, i) => {
    const x =
      PAD.left +
      (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = PAD.top + innerH - ((p.reviewCount - minY) / range) * innerH;
    return { x, y, ...p };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${PAD.top + innerH} L ${coords[0].x.toFixed(1)} ${PAD.top + innerH} Z`;

  const changePositive = data.changeRatePercent >= 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="현재 리뷰 총 수"
          value={`${data.currentTotalReviews.toLocaleString("ko-KR")}건`}
        />
        <StatCard
          label="이번 주 신규"
          value={`${data.thisWeekNewReviews}건`}
          accent="kkumbi"
        />
        <StatCard label="지난 주 신규" value={`${data.lastWeekNewReviews}건`} />
        <StatCard
          label="주간 증감률"
          value={`${changePositive ? "+" : ""}${data.changeRatePercent.toFixed(1)}%`}
          accent={changePositive ? "emerald" : "rose"}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-100 bg-white p-4">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="mx-auto w-full max-w-2xl"
          role="img"
          aria-label="스마트스토어 리뷰 수 추이 꺾은선 그래프"
        >
          <defs>
            <linearGradient id="reviewArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f56b3d" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#f56b3d" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = PAD.top + innerH * (1 - t);
            const val = Math.round(minY + range * t);
            return (
              <g key={t}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={CHART_W - PAD.right}
                  y2={y}
                  stroke="#e7e5e4"
                  strokeDasharray="4 4"
                />
                <text
                  x={PAD.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-stone-400 text-[10px]"
                >
                  {val.toLocaleString("ko-KR")}
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill="url(#reviewArea)" />
          <path
            d={linePath}
            fill="none"
            stroke="#f56b3d"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {coords.map((c, i) => (
            <g key={i}>
              <circle cx={c.x} cy={c.y} r="4" fill="#f56b3d" />
              <circle cx={c.x} cy={c.y} r="7" fill="#f56b3d" fillOpacity="0.2" />
              <text
                x={c.x}
                y={CHART_H - 8}
                textAnchor="middle"
                className="fill-stone-500 text-[10px]"
              >
                {c.label ?? c.date.slice(5)}
              </text>
            </g>
          ))}
        </svg>
        <p className="mt-2 text-center text-xs text-stone-400">
          리뷰 증가 속도 → 판매 추이 간접 지표
        </p>
      </div>

      <p className="rounded-xl border-l-4 border-kkumbi-400 bg-kkumbi-50/50 px-4 py-3 text-sm text-stone-700">
        {data.interpretation}
      </p>

      {data.storeUrl && (
        <a
          href={data.storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-sm font-medium text-kkumbi-600 hover:underline"
        >
          스마트스토어 상품 보기 →
        </a>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "kkumbi" | "emerald" | "rose";
}) {
  const valueClass =
    accent === "emerald"
      ? "text-emerald-700"
      : accent === "rose"
        ? "text-rose-700"
        : accent === "kkumbi"
          ? "text-kkumbi-600"
          : "text-stone-800";

  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50/80 px-4 py-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}
