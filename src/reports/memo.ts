import type { Block } from "../types.ts";

/**
 * Markdown 風テキスト → Block[]
 *   # 見出し / ## 小見出し / --- 区切り / - [ ] チェック / - 箇条書き / 左 | 右 / 空行 / それ以外は本文
 */
export function memo(text: string): Block[] {
  return text.split("\n").map((raw): Block => {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) return { type: "sub", text: line.slice(3) };
    if (line.startsWith("# ")) return { type: "title", text: line.slice(2) };
    if (/^-{3,}$/.test(line)) return { type: "hr" };
    if (/^- \[ \] /.test(line)) return { type: "row", left: `□ ${line.slice(6)}`, size: 19 };
    if (/^- \[x\] /i.test(line)) return { type: "row", left: `■ ${line.slice(6)}`, size: 19 };
    if (line.startsWith("- ")) return { type: "row", left: `・${line.slice(2)}` };
    if (line.includes(" | ")) {
      const [left = "", right] = line.split(" | ");
      return { type: "row", left, right };
    }
    if (line === "") return { type: "space", h: 8 };
    return { type: "text", text: line, size: 18 };
  });
}
