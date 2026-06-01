import { NextRequest, NextResponse } from "next/server";

const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

interface ShoppingRecord {
  date: string;
  price: number;
  reviewCount: number;
}

interface ShoppingHistory {
  productId: string;
  title: string;
  mallName: string;
  link: string;
  records: ShoppingRecord[];
}

interface ShoppingHistoryStore {
  [productKey: string]: ShoppingHistory;
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
    } catch {
      return null;
    }
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
    const stored = await kvGet("shopping_history");
    return NextResponse.json(stored ?? {});
  } catch {
    return NextResponse.json({});
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { products } = body as {
      products: {
        productId: string;
        title: string;
        mallName: string;
        link: string;
        price: number;
        reviewCount: number;
      }[];
    };

    const today = new Date().toISOString().split("T")[0];
    const stored = (await kvGet("shopping_history")) as ShoppingHistoryStore ?? {};

    for (const product of products) {
      const key = `${product.mallName}:${product.productId}`;
      const existing = stored[key] ?? {
        productId: product.productId,
        title: product.title,
        mallName: product.mallName,
        link: product.link,
        records: [],
      };

      const alreadyToday = existing.records.some((r: ShoppingRecord) => r.date === today);
      if (!alreadyToday) {
        existing.records.push({
          date: today,
          price: product.price,
          reviewCount: product.reviewCount,
        });
        if (existing.records.length > 8) {
          existing.records = existing.records.slice(-8);
        }
      }
      stored[key] = existing;
    }

    await kvSet("shopping_history", stored);
    return NextResponse.json({ ok: true, saved: products.length });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
