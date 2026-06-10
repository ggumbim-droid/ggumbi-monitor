"use client";

import { useState, useEffect } from "react";

interface User {
  id: string;
  name: string;
  role: "admin" | "viewer";
}

interface LoginGateProps {
  children: React.ReactNode;
}

export function LoginGate({ children }: LoginGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("ggumbi_token");
    const userStr = sessionStorage.getItem("ggumbi_user");
    if (token && userStr) {
      setUser(JSON.parse(userStr));
    }
    setLoading(false);
  }, []);

  async function handleLogin() {
    if (!id.trim() || !password.trim()) {
      setError("아이디와 패스워드를 입력해주세요.");
      return;
    }
    setLoginLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", id, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "로그인에 실패했습니다.");
        return;
      }
      sessionStorage.setItem("ggumbi_token", data.token);
      sessionStorage.setItem("ggumbi_user", JSON.stringify(data.user));
      setUser(data.user);
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("ggumbi_token");
    sessionStorage.removeItem("ggumbi_user");
    setUser(null);
    setId("");
    setPassword("");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kkumbi-50">
        <div className="animate-spin h-8 w-8 border-4 border-kkumbi-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-kkumbi-50 to-white flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-kkumbi-500 mb-2">꿈비 그룹</p>
            <h1 className="text-2xl font-bold text-stone-900">전 채널 통합 경쟁사 모니터링</h1>
            <p className="text-sm text-stone-500 mt-2">로그인 후 이용하실 수 있습니다.</p>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-lg space-y-4">
            <div>
              <label className="text-sm font-semibold text-stone-700 block mb-1.5">아이디</label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="아이디 입력"
                className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm focus:border-kkumbi-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-stone-700 block mb-1.5">패스워드</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="패스워드 입력"
                className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm focus:border-kkumbi-400 focus:outline-none"
              />
            </div>
            {error && <p className="text-sm text-rose-500">{error}</p>}
            <button
              onClick={handleLogin}
              disabled={loginLoading}
              className="w-full rounded-xl bg-kkumbi-500 py-3 text-sm font-bold text-white hover:bg-kkumbi-600 disabled:opacity-60"
            >
              {loginLoading ? "로그인 중..." : "로그인"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {/* 로그아웃 버튼 - 우측 하단 고정 */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-white border border-stone-200 rounded-full px-4 py-2 shadow-md">
        <span className="text-xs text-stone-500">{user.name}</span>
        {user.role === "admin" && (
          <AccountManager />
        )}
        <button
          onClick={handleLogout}
          className="text-xs font-semibold text-rose-500 hover:text-rose-700"
        >
          로그아웃
        </button>
      </div>
    </>
  );
}

function AccountManager() {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<{ id: string; name: string; role: string; createdAt: string }[]>([]);
  const [newId, setNewId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "viewer">("viewer");
  const [error, setError] = useState("");

  async function loadAccounts() {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list_users" }),
    });
    const data = await res.json();
    setAccounts(data.accounts ?? []);
  }

  async function handleAdd() {
    if (!newId.trim() || !newPassword.trim() || !newName.trim()) {
      setError("모든 항목을 입력해주세요.");
      return;
    }
    setError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_user", id: newId, password: newPassword, name: newName, role: newRole }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "오류 발생"); return; }
    setAccounts(data.accounts);
    setNewId(""); setNewPassword(""); setNewName("");
  }

  async function handleDelete(targetId: string) {
    if (!confirm(`"${targetId}" 계정을 삭제할까요?`)) return;
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_user", targetId }),
    });
    const data = await res.json();
    if (res.ok) setAccounts(data.accounts);
  }

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); loadAccounts(); }}
        className="text-xs font-semibold text-kkumbi-600 hover:text-kkumbi-700"
      >
        계정관리
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-800">계정 관리</h2>
          <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-stone-600">✕</button>
        </div>

        {/* 계정 추가 */}
        <div className="space-y-2 border-b border-stone-100 pb-4">
          <h3 className="text-xs font-semibold text-stone-500 uppercase">새 계정 추가</h3>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="이름 (예: 영업팀)" className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" />
          <input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="아이디" className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" />
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="패스워드" className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" />
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as "admin" | "viewer")} className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm">
            <option value="viewer">일반 (조회만)</option>
            <option value="admin">관리자</option>
          </select>
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <button onClick={handleAdd} className="w-full rounded-lg bg-kkumbi-500 py-2 text-sm font-bold text-white hover:bg-kkumbi-600">
            추가
          </button>
        </div>

        {/* 계정 목록 */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          <h3 className="text-xs font-semibold text-stone-500 uppercase">등록된 계정</h3>
          {accounts.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-2">등록된 계정이 없습니다.</p>
          ) : (
            accounts.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between rounded-lg border border-stone-100 bg-stone-50 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-stone-800">{acc.name}</p>
                  <p className="text-xs text-stone-400">{acc.id} · {acc.role === "admin" ? "관리자" : "일반"} · {acc.createdAt}</p>
                </div>
                <button onClick={() => handleDelete(acc.id)} className="text-xs text-rose-400 hover:text-rose-600">삭제</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
