import { createCanvas, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import type { Block } from "./types.ts";

export const WIDTH = 384; // 58mm 用紙 / 203dpi
const LEFT = 10;
const RIGHT = 374;

const font = (size: number, bold = false) => `${bold ? 600 : 300} ${size}px "Hiragino Sans"`;

function wrap(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of text) {
    if (line && ctx.measureText(line + ch).width > maxWidth) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  lines.push(line);
  return lines;
}

/** Block 配列を白黒レシート画像に描画し、必要な高さで切り出して返す。 */
export function render(blocks: Block[]): Canvas {
  const canvas = createCanvas(WIDTH, 4000);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, WIDTH, canvas.height);
  ctx.fillStyle = "black";
  ctx.strokeStyle = "black";
  ctx.textBaseline = "top";

  let y = 10;
  const text = (s: string, x: number, align: "left" | "right" = "left") => {
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
  };

  for (const b of blocks) {
    switch (b.type) {
      case "title":
      case "sub": {
        const size = b.size ?? (b.type === "title" ? 28 : 20);
        ctx.font = font(size, true);
        for (const line of wrap(ctx, b.text, RIGHT - LEFT)) {
          text(line, LEFT);
          y += size + 10;
        }
        break;
      }
      case "hr":
        y += 2;
        ctx.lineWidth = b.width ?? 2;
        ctx.beginPath();
        ctx.moveTo(LEFT, y);
        ctx.lineTo(RIGHT, y);
        ctx.stroke();
        y += 12;
        break;
      case "row": {
        const size = b.size ?? 18;
        ctx.font = font(size, b.bold);
        const right = b.right ?? "";
        const x = LEFT + (b.indent ?? 0);
        const rightW = ctx.measureText(right).width;
        text(right, RIGHT, "right");
        for (const line of wrap(ctx, b.left, RIGHT - x - rightW - 10)) {
          text(line, x);
          y += size + 8;
        }
        break;
      }
      case "text": {
        const size = b.size ?? 16;
        ctx.font = font(size, b.bold);
        for (const line of wrap(ctx, b.text, RIGHT - LEFT)) {
          text(line, LEFT);
          y += size + 6;
        }
        break;
      }
      case "bar": {
        const size = b.size ?? 17;
        ctx.font = font(size, true);
        const x0 = LEFT + 90;
        const x1 = RIGHT - 64;
        const ratio = b.max > 0 ? Math.min(b.value / b.max, 1) : 0;
        text(b.label, LEFT);
        ctx.lineWidth = 1;
        ctx.strokeRect(x0, y + 2, x1 - x0, size - 2);
        ctx.fillRect(x0, y + 2, (x1 - x0) * ratio, size - 2);
        text(b.right ?? "", RIGHT, "right");
        y += size + 10;
        break;
      }
      case "space":
        y += b.h ?? 10;
        break;
    }
  }

  ctx.font = font(14);
  y += 6;
  const now = new Date().toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" });
  text(`printed ${now}`, RIGHT, "right");
  y += 30;

  const out = createCanvas(WIDTH, y);
  out.getContext("2d").drawImage(canvas, 0, 0);
  return out;
}
