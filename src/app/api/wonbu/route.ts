// app/api/wonbu/route.ts
//
// 원부사전 저장소 — Vercel KV
//
// 프로토타입(HTML)은 클로드 아티팩트 전용 window.storage 를 썼습니다.
// 채팅창 미리보기 밖에서는 동작하지 않으므로, 앱으로 옮기면서
// 이미 운영 중인 KV(src/lib/kv.ts)로 갈아탑니다.
//
// ▶ 필드명은 프로토타입 등록 폼을 그대로 따릅니다.
//   (repOption / func / cert / ban / note, keywords: {term, volume})
//   화면 코드를 고치지 않고 저장소만 바꿔 끼우기 위함입니다.
//
// ▶ 키 구조
//     wonbu:entries → Entry[]
//
//   원부가 수십~수백 개 수준이라 키를 쪼개지 않았습니다.
//   한 번의 왕복으로 전체를 읽고 씁니다. 다만 마지막 저장이 이깁니다
//   (last-write-wins) — 두 사람이 동시에 편집하면 나중 저장이 덮습니다.
//
// ▶ 사용법
//     GET    /api/wonbu            전체 조회
//     POST   /api/wonbu            등록·수정 (id 있으면 수정)
//     DELETE /api/wonbu?id=xxx     삭제

import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet, isKvConfigured } from "@/lib/kv";

const KV_KEY = "wonbu:entries";

export interface WonbuKeyword {
  term: string;
  volume: number;
}

export interface WonbuEntry {
  id: string;
  brand: string;
  /** 등록카테고리 — 최하위 카테고리까지 (네이버 적합도의 전제) */
  category: string;
  /** 원부명(표준 / 사내 공식명) */
  name: string;
  /** 대표옵션 — 색상·사이즈·용량 중 대표 1개 (자유 입력) */
  repOption: string;
  keywords: WonbuKeyword[];
  /** 기능·효능 (쉼표 구분) */
  func: string;
  /** 인증·필수표기 (쉼표 구분) */
  cert: string;
  /** 금칙어·주의 표현 (쉼표 구분) */
  ban: string;
  note: string;
  updatedAt?: string;
}

async function readEntries(): Promise<WonbuEntry[]> {
  const data = await kvGet<WonbuEntry[]>(KV_KEY);
  return Array.isArray(data) ? data : [];
}

function kvUnavailable() {
  return NextResponse.json(
    { error: "KV가 설정되지 않았습니다. KV_REST_API_URL / KV_REST_API_TOKEN 환경변수를 확인하세요." },
    { status: 500 }
  );
}

/**
 * 원부 ID 생성.
 * 프로토타입은 entries.length 로 번호를 매겼는데, 중간을 삭제하면
 * 다음 등록이 이미 쓰인 번호를 다시 받습니다. 저장된 최대 번호 기준으로 바꿉니다.
 */
function makeId(entries: WonbuEntry[]): string {
  let max = 0;
  for (const e of entries) {
    const m = /^RM-(\d+)/.exec(e.id ?? "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const seq = String(max + 1).padStart(3, "0");
  return `RM-${seq}-${Date.now().toString().slice(-4)}`;
}

function toNumber(v: unknown): number {
  if (typeof v === "number" && !isNaN(v)) return v;
  const n = parseInt(String(v ?? "").replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

export async function GET() {
  if (!isKvConfigured()) return kvUnavailable();
  const entries = await readEntries();
  return NextResponse.json({ entries, total: entries.length });
}

export async function POST(req: NextRequest) {
  if (!isKvConfigured()) return kvUnavailable();

  let body: Partial<WonbuEntry>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 본문을 읽을 수 없습니다." }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "원부명을 입력해주세요." }, { status: 400 });
  }

  const entries = await readEntries();

  const keywords: WonbuKeyword[] = (body.keywords ?? [])
    .filter((k) => k?.term?.trim())
    .map((k) => ({ term: k.term.trim(), volume: toNumber(k.volume) }));

  const fields = {
    brand: (body.brand ?? "").trim(),
    category: (body.category ?? "").trim(),
    name: body.name.trim(),
    repOption: (body.repOption ?? "").trim(),
    keywords,
    func: (body.func ?? "").trim(),
    cert: (body.cert ?? "").trim(),
    ban: (body.ban ?? "").trim(),
    note: (body.note ?? "").trim(),
    updatedAt: new Date().toISOString(),
  };

  let entry: WonbuEntry;
  const idx = body.id ? entries.findIndex((e) => e.id === body.id) : -1;

  if (idx !== -1) {
    entry = { ...entries[idx], ...fields };
    entries[idx] = entry;
  } else {
    entry = { id: makeId(entries), ...fields };
    entries.push(entry);
  }

  const ok = await kvSet(KV_KEY, entries);
  if (!ok) {
    return NextResponse.json({ error: "저장에 실패했습니다. 다시 시도해 주세요." }, { status: 502 });
  }

  return NextResponse.json({ entry, entries });
}

export async function DELETE(req: NextRequest) {
  if (!isKvConfigured()) return kvUnavailable();

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  const entries = await readEntries();
  const next = entries.filter((e) => e.id !== id);
  if (next.length === entries.length) {
    return NextResponse.json({ error: "해당 원부를 찾을 수 없습니다." }, { status: 404 });
  }

  const ok = await kvSet(KV_KEY, next);
  if (!ok) {
    return NextResponse.json({ error: "삭제에 실패했습니다. 다시 시도해 주세요." }, { status: 502 });
  }

  return NextResponse.json({ deleted: id, entries: next });
}
