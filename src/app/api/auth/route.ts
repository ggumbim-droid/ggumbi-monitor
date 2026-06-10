import { NextRequest, NextResponse } from "next/server";

const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "ggumbi_secret_2026";

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

interface UserAccount {
  id: string;
  password: string;
  role: "admin" | "viewer";
  name: string;
  createdAt: string;
}

export async function POST(request: NextRequest) {
  try {
    const { action, id, password, name, role, targetId } = await request.json();

    if (action === "login") {
      // 관리자 계정 체크
      const adminId = process.env.ADMIN_ID ?? "marketing";
      const adminPassword = process.env.ADMIN_PASSWORD ?? "ggumbimkt2026";

      if (id === adminId && password === adminPassword) {
        return NextResponse.json({
          success: true,
          token: ADMIN_SECRET,
          user: { id, name: "마케팅팀", role: "admin" },
        });
      }

      // 일반 계정 체크
      const accounts = (await kvGet("user_accounts")) as UserAccount[] ?? [];
      const user = accounts.find((u) => u.id === id && u.password === password);
      if (user) {
        return NextResponse.json({
          success: true,
          token: ADMIN_SECRET,
          user: { id: user.id, name: user.name, role: user.role },
        });
      }

      return NextResponse.json({ success: false, error: "아이디 또는 패스워드가 틀렸습니다." }, { status: 401 });
    }

    if (action === "verify") {
      const { token } = await request.json().catch(() => ({}));
      if (token === ADMIN_SECRET) {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ success: false }, { status: 401 });
    }

    if (action === "add_user") {
      const accounts = (await kvGet("user_accounts")) as UserAccount[] ?? [];
      if (accounts.find((u) => u.id === id)) {
        return NextResponse.json({ error: "이미 존재하는 아이디입니다." }, { status: 400 });
      }
      accounts.push({
        id,
        password,
        role: role ?? "viewer",
        name: name ?? id,
        createdAt: new Date().toISOString().split("T")[0],
      });
      await kvSet("user_accounts", accounts);
      return NextResponse.json({ success: true, accounts });
    }

    if (action === "delete_user") {
      const accounts = (await kvGet("user_accounts")) as UserAccount[] ?? [];
      const updated = accounts.filter((u) => u.id !== targetId);
      await kvSet("user_accounts", updated);
      return NextResponse.json({ success: true, accounts: updated });
    }

    if (action === "list_users") {
      const accounts = (await kvGet("user_accounts")) as UserAccount[] ?? [];
      return NextResponse.json({ accounts });
    }

    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
