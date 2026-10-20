#!/usr/bin/env bun
/**
 * bun src/cli.ts <report> <input.json> [YYYY-MM-DD] [--preview]
 *
 *   agenda   input = Calendar list_events の JSON   date = 対象日 (省略時 今日)
 *   weekly   input = Calendar list_events の JSON   date = 今週の月曜 (省略時 今週)
 *   ga-daily input = GaDaily 形式の JSON
 *   blocks   input = { blocks: Block[] } をそのまま印刷
 *
 * プレビュー画像は out/<report>.png に保存。--preview なら印刷しない。
 */
import { mkdirSync } from "node:fs";
import { agenda, weekly } from "./reports/calendar.ts";
import { gaDaily, type GaDaily } from "./reports/ga-daily.ts";
import { render } from "./render.ts";
import { send, toEscPos } from "./printer.ts";
import type { Block } from "./types.ts";

const args = process.argv.slice(2);
const preview = args.includes("--preview");
const [report, inputPath, dateArg] = args.filter((a) => !a.startsWith("--"));
if (!report || !inputPath) {
  console.error("usage: bun src/cli.ts <agenda|weekly|ga-daily|blocks> <input.json> [YYYY-MM-DD] [--preview]");
  process.exit(1);
}

const input = await Bun.file(inputPath).json();
const date = dateArg ? new Date(`${dateArg}T00:00:00`) : new Date();
const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7));

const builders: Record<string, () => Block[]> = {
  agenda: () => agenda(input.events, date),
  weekly: () => weekly(input.events, monday),
  "ga-daily": () => gaDaily(input as GaDaily),
  blocks: () => input.blocks,
};
const build = builders[report];
if (!build) throw new Error(`unknown report: ${report}`);

const canvas = render(build());
mkdirSync("out", { recursive: true });
await Bun.write(`out/${report}.png`, await canvas.encode("png"));
console.log(`preview: out/${report}.png`);

if (!preview) {
  await send(toEscPos(canvas));
  console.log("🧾 印刷完了");
}
