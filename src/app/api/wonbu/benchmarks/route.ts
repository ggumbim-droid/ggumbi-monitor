// app/api/wonbu/benchmarks/route.ts
//
// 경쟁사 벤치마킹 이력 저장소 — Vercel KV
//
// 프로토타입의 window.storage('competitor_benchmarks') 자리를 대신합니다.
// 원부 사전(wonbu:entries)과 키를 나눈 이유: 벤치마킹은 회차마다 쌓이는
// 로그 성격이라 원부 편집 때마다 같이 읽고 쓸 필요가 없습니다.
//
//     GET    /api/wonbu/benchmarks              전체 조회
//     GET    /api/wonbu/benchmarks?brand=꿈비    브랜드 필터
//     POST   /api/wonbu/benchmarks              회차 추가
//     DELETE /api/wonbu/benchmarks?id=BM-xxx    회차 삭제

import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet, isKvConfigured } from "@/lib/kv";

const KV_KEY = "wonbu:benchmarks";

export interface BenchmarkAnalysis {
  topKeywords?: string[];
  pattern?: string;
  gapKeywords?: string[];
}

export interface Benchmark {
  id: string;
  brand: string;
  query: string;
  rawNames: string[];
  analysis: BenchmarkAnalysis;
  date: string;
}

async function readAll(): Promise<Benchmark[]> {
  const data = await kvGet<Benchmark[]>(KV_KEY);
  return Array.isArray(data) ? data : [];
}

function kvUnavailable() {
  return NextResponse.json(
    { error: "KV가 설정되지 않았습니다. KV_REST_API_URL / KV_REST_API_TOKEN 환경변수를 확인하세요." },
    { status: 500 }
  );
}

export async function GET(req: NextRequest) {
  if (!isKvConfigured()) return kvUnavailable();

  const brand = req.nextUrl.searchParams.get("brand");
  const all = await readAll();
  const benchmarks = brand ? all.filter((b) => b.brand === brand) : all;

  return NextResponse.json({ benchmarks });
}

export async function POST(req: NextRequest) {
  if (!isKvConfigured()) return kvUnavailable();

  let body: Partial<Benchmark>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 본문을 읽을 수 없습니다." }, { status: 400 });
  }

  if (!body.brand?.trim()) {
    return NextResponse.json({ error: "brand가 필요합니다." }, { status: 400 });
  }

  const all = await readAll();

  const benchmark: Benchmark = {
    id: `BM-${Date.now()}`,
    brand: body.brand.trim(),
    query: (body.query ?? "(미입력)").trim(),
    rawNames: Array.isArray(body.rawNames) ? body.rawNames : [],
    analysis: body.analysis ?? {},
    date: new Date().toISOString().slice(0, 10),
  };

  all.push(benchmark);

  const ok = await kvSet(KV_KEY, all);
  if (!ok) {
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 502 });
  }

  return NextResponse.json({ benchmark, benchmarks: all });
}

export async function DELETE(req: NextRequest) {
  if (!isKvConfigured()) return kvUnavailable();

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  const all = await readAll();
  const next = all.filter((b) => b.id !== id);

  const ok = await kvSet(KV_KEY, next);
  if (!ok) {
    return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 502 });
  }

  return NextResponse.json({ deleted: id, benchmarks: next });
}
