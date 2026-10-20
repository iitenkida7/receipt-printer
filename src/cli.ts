#!/usr/bin/env bun
/**
 * bun src/cli.ts <report> [input.json] [YYYY-MM-DD] [--preview]
 *
 *   agenda   input = Calendar list_events の JSON   date = 対象日 (省略時 今日)
 *   weekly   input = Calendar list_events の JSON   date = その週のどこか (省略時 今週)
 *   ga-daily input = GaDaily 形式の JSON
 *   blocks   input = { blocks: Block[] } をそのまま印刷
 *   memo     input = Markdown 風テキストファイル
 *
 * input を省略すると data/ → examples/ の順に探す。
 * プレビュー画像は out/<report>.png に保存。--preview なら印刷しない。
 */
import { mkdirSync } from "node:fs";
import { findReport, reports } from "./reports/index.ts";
import { render } from "./render.ts";
import { send, toEscPos } from "./printer.ts";

const args = process.argv.slice(2);
const preview = args.includes("--preview");
const positional = args.filter((a) => !a.startsWith("--"));
const report = findReport(positional[0] ?? "");
if (!report) {
  console.error(`usage: bun src/cli.ts <${reports.map((r) => r.id).join("|")}> [input] [YYYY-MM-DD] [--preview]`);
  process.exit(1);
}
const date = positional.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const input = positional.slice(1).find((a) => a !== date);

const blocks =
  report.id === "memo"
    ? await report.build({ text: input ? await Bun.file(input).text() : "" })
    : await report.build({ input, date });

const canvas = render(blocks);
mkdirSync("out", { recursive: true });
await Bun.write(`out/${report.id}.png`, await canvas.encode("png"));
console.log(`preview: out/${report.id}.png`);

if (!preview) {
  await send(toEscPos(canvas));
  console.log("🧾 印刷完了");
}
