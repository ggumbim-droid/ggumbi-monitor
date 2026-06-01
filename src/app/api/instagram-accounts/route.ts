import { NextRequest, NextResponse } from "next/server";

const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

const DEFAULT_ACCOUNTS: InstagramAccount[] = [];

interface InstagramAccount {
  id: string;
  brandName: string;
  url: string;
  addedAt: string;
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
      if (Array.isArray(parsed)) return parsed;
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
    const stored = await kvGet("instagram_accounts");
    if (stored) return NextResponse.json(stored);
    return NextResponse.json(DEFAULT_ACCOUNTS);
  } catch {
    return NextResponse.json(DEFAULT_ACCOUNTS);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, brandName, url, id } = body;

    const stored = await kvGet("instagram_accounts");
    const accounts: InstagramAccount[] = stored ?? [];

    if (action === "add") {
      if (!brandName?.trim() || !url?.trim()) {
        return NextResponse.json({ error: "브랜드명과 URL을 입력해주세요." }, { status: 400 });
      }
      const normalizedUrl = url.trim().startsWith("http")
        ? url.trim()
        : `https://instagram.com/${url.trim().replace("@", "")}`;
      const newAccount: InstagramAccount = {
        id: Date.now().toString(),
        brandName: brandName.trim(),
        url: normalizedUrl,
        addedAt: new Date().toISOString().split("T")[0],
      };
      accounts.push(newAccount);
    } else if (action === "delete") {
      const idx = accounts.findIndex((a) => a.id === id);
      if (idx === -1) {
        return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 400 });
      }
      accounts.splice(idx, 1);
    } else {
      return NextResponse.json({ error: "올바르지 않은 action입니다." }, { status: 400 });
    }

    await kvSet("instagram_accounts", accounts);
    return NextResponse.json(accounts);
  } catch {
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
