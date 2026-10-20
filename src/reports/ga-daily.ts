import type { Block } from "../types.ts";

/** GA4 の数字 (Claude が analytics MCP から取ってこの形にして渡す) */
export interface GaDaily {
  site: string;
  date: string; // 表示用 "2026/10/19 (月)"
  compareLabel: string; // "直近7日平均 (10/12-18)"
  sessions: number;
  sessionsAvg: number;
  keyEvents: number;
  keyEventsAvg: number;
  users: number;
  keyEventBreakdown: { name: string; count: number; important?: boolean }[];
  sources: { name: string; sessions: number; keyEvents: number }[];
  note?: string;
}

const pct = (v: number, base: number) => {
  const p = Math.round((v / base - 1) * 100);
  return `${p >= 0 ? "+" : ""}${p}%`;
};
const avg = (n: number) => (n >= 100 ? Math.round(n).toString() : n.toFixed(1));

export function gaDaily(g: GaDaily): Block[] {
  return [
    { type: "title", text: `${g.site} 日報` },
    { type: "sub", text: g.date },
    { type: "row", left: `比較: ${g.compareLabel}`, size: 14 },
    { type: "hr", width: 3 },
    { type: "row", left: "セッション", right: g.sessions.toLocaleString(), size: 22, bold: true },
    { type: "row", left: `平均 ${avg(g.sessionsAvg)}`, right: pct(g.sessions, g.sessionsAvg), size: 16, indent: 16 },
    { type: "row", left: "キーイベント", right: g.keyEvents.toLocaleString(), size: 22, bold: true },
    { type: "row", left: `平均 ${avg(g.keyEventsAvg)}`, right: pct(g.keyEvents, g.keyEventsAvg), size: 16, indent: 16 },
    { type: "row", left: "ユーザー", right: g.users.toLocaleString(), bold: true },
    { type: "hr" },
    { type: "sub", text: "キーイベント内訳" },
    ...g.keyEventBreakdown.map((k): Block => ({ type: "row", left: k.name, right: `${k.count}`, size: 16, bold: k.important })),
    { type: "hr" },
    { type: "sub", text: `流入元 TOP${g.sources.length}  (セッション/KE)` },
    ...g.sources.map((s): Block => ({ type: "row", left: s.name, right: `${s.sessions} / ${s.keyEvents}`, size: 16 })),
    ...(g.note ? ([{ type: "hr" }, { type: "text", text: `※ ${g.note}`, size: 15 }] satisfies Block[]) : []),
  ];
}
