import { NextRequest, NextResponse } from "next/server";

const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

interface RankingRecord {
  date: string;
  rank: number;
  price: number;
}

interface RankingHistory {
  productId: string;
  title: string;
  mallName: string;
  link: string;
  keyword: string;
  records: RankingRecord[];
}

interface RankingStore {
  [key: string]: RankingHistory;
}

async function kvGet(key: string) {
  const res = await fetch(`${KV_REST_API_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` },
  });
  const data = await res.json();
  const raw = data.result ?? data.value ?? null;
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object") return parsed;
      if (typeof parsed === "string") return JSON.parse(parsed);
    } catch { return null; }
  }
  return raw;
}

async function kvSet(key: string, value: object) {
  const jsonStr = JSON.stringify(value);
  await fetch(`${KV_REST_API_URL}/set/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(jsonStr),
  });
}

export async function GET() {
  try {
    const stored = await kvGet("ranking_history");
    return NextResponse.json(stored ?? {});
  } catch {
    return NextResponse.json({});
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rankings } = body as {
      rankings: {
        productId: string;
        title: string;
        mallName: string;
        link: string;
        keyword: string;
        rank: number;
        price: number;
      }[];
    };

    const today = new Date().toISOString().split("T")[0];
    const stored = (await kvGet("ranking_history")) as RankingStore ?? {};

    for (const item of rankings) {
      const key = `${item.keyword}:${item.mallName}:${item.productId}`;
      const existing = stored[key] ?? {
        productId: item.productId,
        title: item.title,
        mallName: item.mallName,
        link: item.link,
        keyword: item.keyword,
        records: [],
      };

      const alreadyToday = existing.records.some((r: RankingRecord) => r.date === today);
      if (!alreadyToday) {
        existing.records.push({
          date: today,
          rank: item.rank,
          price: item.price,
        });
        if (existing.records.length > 8) {
          existing.records = existing.records.slice(-8);
        }
      }
      stored[key] = existing;
    }

    await kvSet("ranking_history", stored);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
