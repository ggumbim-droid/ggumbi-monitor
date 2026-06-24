"use client";

import { useState, useEffect, useCallback } from "react";

type Status = "good" | "warn" | "bad" | "unk";

interface ReportItem {
  id: string;
  title: string;
  metric: string;
  badge: string;
  badgeStatus: Status;
  cause: string;
  action: string;
  due: string;
  gap: string;
}

interface ReportCategory {
  id: string;
  title: string;
  target: string;
  actual: string;
  rateLabel: string;
  rateNum: number | null;
  status: Status;
  note: string;
  items: ReportItem[];
  updatedBy?: string;
  updatedAt?: string;
}

interface WeeklyReportData {
  week: string;
  prevFeedback: string;
  categories: ReportCategory[];
}

const TEAM_NAMES = ["방승현TL", "혜림SM", "소원JM", "조혜림JM", "이수현AM", "희수AM", "수지SM", "봄봄시니어"];

const STATUS_LABEL: Record<Status, string> = { good: "달성", warn: "주의", bad: "미달", unk: "산출중" };
const STATUS_CLASS: Record<Status, string> = {
  good: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  bad: "bg-rose-50 text-rose-700",
  unk: "bg-stone-100 text-stone-500",
};
const STATUS_TEXT: Record<Status, string> = {
  good: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-rose-700",
  unk: "text-stone-500",
};
const STATUS_BAR: Record<Status, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-rose-500",
  unk: "bg-stone-300",
};

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyItem(): ReportItem {
  return { id: newId(), title: "", metric: "", badge: "", badgeStatus: "warn", cause: "", action: "", due: "", gap: "" };
}

interface CategoryEditFormProps {
  draft: ReportCategory;
  onField: <K extends keyof ReportCategory>(key: K, value: ReportCategory[K]) => void;
  onItemChange: (itemId: string, patch: Partial<ReportItem>) => void;
  onAddItem: () => void;
  onRemoveItem: (itemId: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

function CategoryEditForm({ draft, onField, onItemChange, onAddItem, onRemoveItem, onSave, onCancel, saving }: CategoryEditFormProps) {
  return (
    <div className="space-y-4 bg-stone-50 rounded-xl p-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-stone-500 block mb-1">목표</label>
          <input value={draft.target} onChange={(e) => onField("target", e.target.value)} className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-stone-500 block mb-1">실적</label>
          <input value={draft.actual} onChange={(e) => onField("actual", e.target.value)} className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-stone-500 block mb-1">달성률 표시 (예: 88.8%)</label>
          <input value={draft.rateLabel} onChange={(e) => onField("rateLabel", e.target.value)} className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-stone-500 block mb-1">막대그래프용 숫자 (0~100, 선택)</label>
          <input type="number" value={draft.rateNum ?? ""} onChange={(e) => onField("rateNum", e.target.value === "" ? null : Number(e.target.value))} className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-stone-500 block mb-1">상태</label>
          <select value={draft.status} onChange={(e) => onField("status", e.target.value as Status)} className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-sm">
            <option value="good">달성</option>
            <option value="warn">주의</option>
            <option value="bad">미달</option>
            <option value="unk">산출중</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-stone-500 block mb-1">비고 (선택)</label>
          <input value={draft.note} onChange={(e) => onField("note", e.target.value)} className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div className="space-y-3">
        {draft.items.map((it) => (
          <div key={it.id} className="bg-white border border-stone-200 rounded-lg p-3 space-y-2">
            <div className="flex gap-2">
              <input placeholder="항목명 (예: 꿈비 — 시공매트)" value={it.title} onChange={(e) => onItemChange(it.id, { title: e.target.value })} className="flex-1 border border-stone-200 rounded-lg px-2 py-1.5 text-sm" />
              <button onClick={() => onRemoveItem(it.id)} className="text-xs text-rose-400 hover:text-rose-600 px-2 shrink-0">삭제</button>
            </div>
            <input placeholder="수치 / 지표" value={it.metric} onChange={(e) => onItemChange(it.id, { metric: e.target.value })} className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-sm" />
            <div className="flex gap-2">
              <input placeholder="배지 텍스트 (예: 하락)" value={it.badge} onChange={(e) => onItemChange(it.id, { badge: e.target.value })} className="flex-1 border border-stone-200 rounded-lg px-2 py-1.5 text-sm" />
              <select value={it.badgeStatus} onChange={(e) => onItemChange(it.id, { badgeStatus: e.target.value as Status })} className="border border-stone-200 rounded-lg px-2 py-1.5 text-sm">
                <option value="good">긍정</option>
                <option value="warn">주의</option>
                <option value="bad">부정</option>
                <option value="unk">중립</option>
              </select>
            </div>
            <textarea placeholder="구조적 원인 (채널 / 상품 / 광고 / 비용구조 중 하나 특정)" value={it.cause} onChange={(e) => onItemChange(it.id, { cause: e.target.value })} rows={2} className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-sm" />
            <textarea placeholder="차주 실행" value={it.action} onChange={(e) => onItemChange(it.id, { action: e.target.value })} rows={2} className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-sm" />
            <div className="flex gap-2">
              <input placeholder="마감일 (선택, 예: 6/30)" value={it.due} onChange={(e) => onItemChange(it.id, { due: e.target.value })} className="flex-1 border border-stone-200 rounded-lg px-2 py-1.5 text-sm" />
              <input placeholder="보완 필요 메모 (선택)" value={it.gap} onChange={(e) => onItemChange(it.id, { gap: e.target.value })} className="flex-1 border border-stone-200 rounded-lg px-2 py-1.5 text-sm" />
            </div>
          </div>
        ))}
        <button onClick={onAddItem} className="w-full border border-dashed border-stone-300 rounded-lg py-2 text-xs text-stone-500 hover:border-kkumbi-400 hover:text-kkumbi-600">+ 항목 추가</button>
      </div>

      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving} className="px-4 py-2 bg-kkumbi-500 text-white text-xs font-bold rounded-lg hover:bg-kkumbi-600 disabled:opacity-50">
          {saving ? "저장 중..." : "저장"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-stone-200 text-xs font-bold rounded-lg text-stone-600">취소</button>
      </div>
    </div>
  );
}

export function WeeklyReport() {
  const [reporterName, setReporterName] = useState("");
  const [namePromptOpen, setNamePromptOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const [weeks, setWeeks] = useState<string[]>([]);
  const [week, setWeek] = useState("");
  const [report, setReport] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState("");
  const [draftCategory, setDraftCategory] = useState<ReportCategory | null>(null);
  const [savingCat, setSavingCat] = useState(false);

  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [editingFeedback, setEditingFeedback] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ggumbi_reporter_name");
    if (saved) setReporterName(saved);
  }, []);

  const loadWeek = useCallback(async (w?: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/weekly-report${w ? `?week=${encodeURIComponent(w)}` : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류 발생");
      setWeeks(data.weeks ?? []);
      setWeek(data.week ?? "");
      setReport(data.report ?? null);
      setFeedbackDraft(data.report?.prevFeedback ?? "");
    } catch (e) {
      console.error("주간보고 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWeek(); }, [loadWeek]);

  function confirmName() {
    const finalName = nameInput.trim();
    if (!finalName) return;
    localStorage.setItem("ggumbi_reporter_name", finalName);
    setReporterName(finalName);
    setNamePromptOpen(false);
  }

  async function handleNewWeek() {
    let suggestion = "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(week)) {
      const d = new Date(week);
      d.setDate(d.getDate() + 7);
      suggestion = d.toISOString().split("T")[0];
    }
    const input = window.prompt("새 주차 키를 입력해주세요 (예: 2026-06-29 = 그 주 마감일 기준 날짜)", suggestion);
    if (!input) return;
    setLoading(true);
    try {
      const res = await fetch("/api/weekly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "new_week", week: input, copyFrom: week || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류 발생");
      setWeeks(data.weeks ?? []);
      setWeek(data.report.week);
      setReport(data.report);
      setFeedbackDraft("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "오류 발생");
    } finally {
      setLoading(false);
    }
  }

  async function saveFeedback() {
    if (!week) return;
    try {
      const res = await fetch("/api/weekly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_feedback", week, prevFeedback: feedbackDraft }),
      });
      const data = await res.json();
      if (res.ok) { setReport(data.report); setEditingFeedback(false); }
    } catch {}
  }

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function startEdit(cat: ReportCategory) {
    if (!reporterName) { setNameInput(""); setNamePromptOpen(true); return; }
    setDraftCategory(JSON.parse(JSON.stringify(cat)));
    setEditingId(cat.id);
    setOpenIds((prev) => new Set(prev).add(cat.id));
  }
  function cancelEdit() { setEditingId(""); setDraftCategory(null); }

  async function saveCategory() {
    if (!draftCategory || !week) return;
    setSavingCat(true);
    try {
      const res1 = await fetch("/api/weekly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_category", week, categoryId: draftCategory.id,
          target: draftCategory.target, actual: draftCategory.actual,
          rateLabel: draftCategory.rateLabel, rateNum: draftCategory.rateNum,
          status: draftCategory.status, note: draftCategory.note, updatedBy: reporterName,
        }),
      });
      const d1 = await res1.json();
      if (!res1.ok) throw new Error(d1.error || "오류 발생");
      const res2 = await fetch("/api/weekly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_items", week, categoryId: draftCategory.id, items: draftCategory.items, updatedBy: reporterName }),
      });
      const d2 = await res2.json();
      if (!res2.ok) throw new Error(d2.error || "오류 발생");
      setReport(d2.report);
      setEditingId(""); setDraftCategory(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "오류 발생");
    } finally {
      setSavingCat(false);
    }
  }

  function updateDraftField<K extends keyof ReportCategory>(key: K, value: ReportCategory[K]) {
    setDraftCategory((prev) => (prev ? { ...prev, [key]: value } : prev));
  }
  function updateDraftItem(itemId: string, patch: Partial<ReportItem>) {
    setDraftCategory((prev) => prev ? { ...prev, items: prev.items.map((it) => it.id === itemId ? { ...it, ...patch } : it) } : prev);
  }
  function addDraftItem() {
    setDraftCategory((prev) => prev ? { ...prev, items: [...prev.items, emptyItem()] } : prev);
  }
  function removeDraftItem(itemId: string) {
    setDraftCategory((prev) => prev ? { ...prev, items: prev.items.filter((it) => it.id !== itemId) } : prev);
  }

  const categories = report?.categories ?? [];
  const tally: Record<Status, number> = { good: 0, warn: 0, bad: 0, unk: 0 };
  categories.forEach((c) => tally[c.status]++);

  const actionRows: { catId: string; text: string; due: string }[] = [];
  const gapRows: { catTitle: string; itemTitle: string; text: string }[] = [];
  categories.forEach((c) => {
    c.items.forEach((it) => {
      if (it.action) actionRows.push({ catId: c.id, text: it.action, due: it.due });
      if (it.gap) gapRows.push({ catTitle: c.title, itemTitle: it.title || "(제목없음)", text: it.gap });
    });
  });

  if (loading && !report) {
    return <p className="text-sm text-stone-400 text-center py-12">불러오는 중...</p>;
  }

  if (!loading && !week) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-10 text-center space-y-3">
        <p className="text-sm text-stone-500">아직 등록된 주차가 없습니다.</p>
        <button onClick={handleNewWeek} className="px-4 py-2 bg-kkumbi-500 text-white text-sm font-bold rounded-lg hover:bg-kkumbi-600">+ 첫 주차 시작하기</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-stone-800">주간보고 대시보드</h2>
          <p className="text-xs text-stone-500">팬슈머마케팅팀 · {reporterName ? `로그인: ${reporterName}` : "이름을 설정해주세요"}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={week} onChange={(e) => loadWeek(e.target.value)} className="border border-stone-200 rounded-lg px-3 py-2 text-sm">
            {weeks.slice().reverse().map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <button onClick={handleNewWeek} className="px-3 py-2 bg-kkumbi-500 text-white text-xs font-semibold rounded-lg hover:bg-kkumbi-600">+ 새 주차</button>
          <button onClick={() => { setNameInput(reporterName); setNamePromptOpen(true); }} className="px-3 py-2 border border-stone-200 rounded-lg text-xs text-stone-600 hover:border-kkumbi-300">
            {reporterName || "이름 설정"}
          </button>
          <button onClick={() => window.print()} className="px-3 py-2 border border-stone-200 rounded-lg text-xs text-stone-600 hover:border-kkumbi-300">인쇄</button>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl px-4 py-3 text-xs text-stone-500 flex flex-wrap gap-4">
        <span><b className="text-stone-700">3종 세트 필수</b> 달성률 · 구조적 원인 · 차주 실행</span>
        <span><b className="text-stone-700">원인 특정</b> 채널 / 상품 / 광고 / 비용구조 중 1개</span>
        <span><b className="text-stone-700">업로드</b> 매주 화 18:00까지</span>
        <span><b className="text-stone-700">회의 중 신규 자료 공유 금지</b></span>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-amber-800">전주 회장님 피드백</span>
          {!editingFeedback && <button onClick={() => setEditingFeedback(true)} className="text-xs text-amber-700 hover:underline">수정</button>}
        </div>
        {editingFeedback ? (
          <div className="space-y-2">
            <textarea value={feedbackDraft} onChange={(e) => setFeedbackDraft(e.target.value)} rows={2} className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button onClick={saveFeedback} className="px-3 py-1 bg-kkumbi-500 text-white text-xs rounded-lg">저장</button>
              <button onClick={() => { setEditingFeedback(false); setFeedbackDraft(report?.prevFeedback ?? ""); }} className="px-3 py-1 border border-stone-200 text-xs rounded-lg">취소</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-stone-700">{report?.prevFeedback || "(미기재)"}</p>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["good", "warn", "bad", "unk"] as Status[]).map((s) => (
          <div key={s} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${STATUS_CLASS[s]}`}>
            <span>{tally[s]}</span><span>{STATUS_LABEL[s]}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {categories.map((c) => (
          <button key={c.id} onClick={() => toggleOpen(c.id)} className="text-left bg-white border border-stone-200 rounded-xl p-3 hover:border-kkumbi-300 transition">
            <div className="text-xs font-mono text-stone-400 mb-1">KPI {c.id}</div>
            <div className="text-xs font-bold text-stone-700 mb-2 leading-snug min-h-[2.2em]">{c.title}</div>
            <div className={`text-lg font-extrabold ${STATUS_TEXT[c.status]}`}>{c.rateLabel || STATUS_LABEL[c.status]}</div>
            <div className="h-1.5 bg-stone-100 rounded-full mt-2 overflow-hidden">
              <div className={`h-full rounded-full ${STATUS_BAR[c.status]}`} style={{ width: `${Math.min(c.rateNum ?? 0, 100)}%` }} />
            </div>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {categories.map((c) => {
          const isOpen = openIds.has(c.id);
          const isEditing = editingId === c.id;
          return (
            <div key={c.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => toggleOpen(c.id)}>
                <span className="text-xs font-mono text-stone-400 w-6 shrink-0">{c.id}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-stone-800">{c.title}</h3>
                  <p className="text-xs text-stone-500 mt-0.5 truncate">
                    목표 {c.target || "—"} · 실적 {c.actual || "—"}{c.note ? ` · ${c.note}` : ""}
                  </p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${STATUS_CLASS[c.status]}`}>{c.rateLabel || STATUS_LABEL[c.status]}</span>
                <button onClick={(e) => { e.stopPropagation(); startEdit(c); }} className="text-xs text-kkumbi-600 font-semibold hover:underline shrink-0">수정</button>
              </div>
              {isOpen && (
                <div className="border-t border-stone-100 px-4 py-3 space-y-3">
                  {c.updatedBy && (
                    <p className="text-xs text-stone-400">
                      마지막 수정: {c.updatedBy}{c.updatedAt ? ` · ${new Date(c.updatedAt).toLocaleString("ko-KR")}` : ""}
                    </p>
                  )}
                  {isEditing && draftCategory ? (
                    <CategoryEditForm
                      draft={draftCategory}
                      onField={updateDraftField}
                      onItemChange={updateDraftItem}
                      onAddItem={addDraftItem}
                      onRemoveItem={removeDraftItem}
                      onSave={saveCategory}
                      onCancel={cancelEdit}
                      saving={savingCat}
                    />
                  ) : c.items.length === 0 ? (
                    <p className="text-xs text-stone-400">등록된 항목이 없습니다. 수정 버튼을 눌러 추가해주세요.</p>
                  ) : (
                    c.items.map((it) => (
                      <div key={it.id} className="border-b border-stone-100 pb-3 last:border-b-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-semibold text-stone-700">{it.title || "(제목없음)"}</span>
                          {it.badge && <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_CLASS[it.badgeStatus]}`}>{it.badge}</span>}
                        </div>
                        {it.metric && <p className="text-xs text-stone-500 mb-2">{it.metric}</p>}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div><p className="text-[11px] font-bold text-stone-400 uppercase mb-1">구조적 원인</p><p className="text-xs text-stone-700 leading-relaxed">{it.cause || "—"}</p></div>
                          <div><p className="text-[11px] font-bold text-stone-400 uppercase mb-1">차주 실행</p><p className="text-xs text-stone-700 leading-relaxed">{it.action || "—"}{it.due ? ` (마감 ${it.due})` : ""}</p></div>
                        </div>
                        {it.gap && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1 mt-2">⚠ {it.gap}</p>}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-4">
        <h4 className="text-sm font-bold text-stone-800 mb-3">차주 핵심 실행 체크리스트</h4>
        {actionRows.length === 0 ? (
          <p className="text-xs text-stone-400">등록된 실행 항목이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {actionRows.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <input type="checkbox" className="mt-0.5" />
                <span className="font-mono text-stone-400 shrink-0">{r.catId}</span>
                <span className="text-stone-700 flex-1">{r.text}</span>
                {r.due && <span className="text-kkumbi-600 font-semibold shrink-0">마감 {r.due}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-4">
        <h4 className="text-sm font-bold text-stone-800 mb-3">업로드 전 보완 필요 항목</h4>
        {report?.prevFeedback && gapRows.length === 0 ? (
          <p className="text-xs text-stone-400">보완할 항목이 없습니다.</p>
        ) : (
          <ul className="space-y-1.5">
            {!report?.prevFeedback && <li className="text-xs text-stone-500"><b className="text-stone-700">전주 회장님 피드백</b> — 내용 미기재</li>}
            {gapRows.map((r, i) => (
              <li key={i} className="text-xs text-stone-500"><b className="text-stone-700">{r.catTitle} · {r.itemTitle}</b> — {r.text}</li>
            ))}
          </ul>
        )}
      </div>

      {namePromptOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4" onClick={() => setNamePromptOpen(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-stone-800">이름을 선택해주세요</h3>
            <p className="text-xs text-stone-500">입력·수정 시 &quot;마지막 수정자&quot;로 기록됩니다.</p>
            <select value={TEAM_NAMES.includes(nameInput) ? nameInput : ""} onChange={(e) => setNameInput(e.target.value)} className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm">
              <option value="">선택...</option>
              {TEAM_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <input placeholder="목록에 없으면 직접 입력" value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button onClick={confirmName} className="flex-1 bg-kkumbi-500 text-white text-sm font-bold rounded-lg py-2">확인</button>
              <button onClick={() => setNamePromptOpen(false)} className="px-4 border border-stone-200 rounded-lg text-sm text-stone-600">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
