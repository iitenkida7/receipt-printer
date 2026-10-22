import { existsSync, statSync } from "node:fs";
import type { Canvas } from "@napi-rs/canvas";
import { render } from "../render.ts";
import type { Block } from "../types.ts";
import { agenda, weekly } from "./calendar.ts";
import { gaDaily, type GaDaily } from "./ga-daily.ts";
import { memo } from "./memo.ts";
import { ryoshusho, type Ryoshusho } from "./ryoshusho.ts";

export interface ReportParams {
  /** YYYY-MM-DD (省略時 今日) */
  date?: string;
  /** memo: Markdown 風テキスト / blocks: { blocks: Block[] } の JSON 文字列 */
  text?: string;
  /** 入力 JSON のパス (省略時 data/ → examples/ の順に探す) */
  input?: string;
}

export interface ReportDef {
  id: string;
  label: string;
  /** UI に出す入力欄 */
  input: "date" | "text" | "none";
  /** 既定の入力ファイル名 (data/ か examples/ の下) */
  file?: string;
  /** Block[] を返せば共通レイアウトで描画、Canvas を返せばそのまま印刷 (自由レイアウト) */
  build: (p: ReportParams) => Promise<Block[] | Canvas>;
}

export async function renderReport(report: ReportDef, params: ReportParams): Promise<Canvas> {
  const built = await report.build(params);
  return Array.isArray(built) ? render(built) : built;
}

/** data/<file> があればそれ、無ければ examples/<file> */
export function resolveInput(file: string, explicit?: string): string {
  if (explicit) return explicit;
  return existsSync(`data/${file}`) ? `data/${file}` : `examples/${file}`;
}

export function inputInfo(file: string) {
  const path = resolveInput(file);
  return { path, updatedAt: existsSync(path) ? statSync(path).mtime.toISOString() : null };
}

const toDate = (s?: string) => {
  const d = s ? new Date(`${s}T00:00:00`) : new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};
const mondayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
const readJson = (path: string) => Bun.file(path).json();

export const reports: ReportDef[] = [
  {
    id: "agenda",
    label: "今日の予定",
    input: "date",
    file: "events.json",
    build: async (p) => agenda((await readJson(resolveInput("events.json", p.input))).events, toDate(p.date)),
  },
  {
    id: "weekly",
    label: "週次レポート",
    input: "date",
    file: "events.json",
    build: async (p) => weekly((await readJson(resolveInput("events.json", p.input))).events, mondayOf(toDate(p.date))),
  },
  {
    id: "ga-daily",
    label: "GA4 日報",
    input: "none",
    file: "ga-daily.json",
    build: async (p) => gaDaily((await readJson(resolveInput("ga-daily.json", p.input))) as GaDaily),
  },
  {
    id: "ryoshusho",
    label: "領収書",
    input: "none",
    file: "ryoshusho.json",
    build: async (p) => ryoshusho((await readJson(resolveInput("ryoshusho.json", p.input))) as Ryoshusho),
  },
  {
    id: "memo",
    label: "メモ",
    input: "text",
    build: async (p) => memo(p.text ?? ""),
  },
  {
    id: "blocks",
    label: "JSON",
    input: "text",
    build: async (p) => (p.input ? (await readJson(p.input)).blocks : JSON.parse(p.text ?? "{}").blocks) ?? [],
  },
];

export const findReport = (id: string) => reports.find((r) => r.id === id);
