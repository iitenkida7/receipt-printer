import { createCanvas, type Canvas } from "@napi-rs/canvas";
import { font, WIDTH } from "../render.ts";

/** 飲食店などで出す横向きの領収書 */
export interface Ryoshusho {
  /** 宛名 (空なら下線だけ) */
  to?: string;
  /** 税込金額 */
  amount: number;
  /** 但し書き */
  note?: string;
  /** 表示用の日付 "2026年10月22日" */
  date: string;
  no?: string;
  /** 消費税率 (%) */
  taxRate?: number;
  issuer: { name: string; address?: string; tel?: string; registrationNo?: string };
  /** 見本の透かしを入れる */
  sample?: boolean;
}

const LENGTH = 760; // 用紙の送り方向の長さ (約 95mm)
const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

/** 横長に描いてから 90° 回して、紙を横にして読む向きにする。 */
export function ryoshusho(r: Ryoshusho): Canvas {
  const W = LENGTH;
  const H = WIDTH;
  const land = createCanvas(W, H);
  const ctx = land.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "black";
  ctx.strokeStyle = "black";
  ctx.textBaseline = "alphabetic";

  const text = (s: string, x: number, y: number, size: number, bold = false, align: "left" | "right" | "center" = "left") => {
    ctx.font = font(size, bold);
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
  };
  const line = (x1: number, y1: number, x2: number, y2: number, w = 2) => {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  const L = 24;
  const R = W - 24;

  // 外枠
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, W - 16, H - 16);

  // 見出し
  text("領　収　書", W / 2, 62, 40, true, "center");
  line(W / 2 - 120, 72, W / 2 + 120, 72, 2);
  line(W / 2 - 120, 77, W / 2 + 120, 77, 2);
  text(r.date, R, 44, 20, true, "right");
  if (r.no) text(`No. ${r.no}`, R, 70, 20, true, "right");

  // 宛名
  text(r.to ?? "", L + 8, 118, 26, true);
  line(L, 126, L + 400, 126, 2);
  text("様", L + 408, 124, 26, true);

  // 金額
  const boxY = 142;
  const boxH = 70;
  ctx.lineWidth = 3;
  ctx.strokeRect(L, boxY, R - L, boxH);
  ctx.fillRect(L, boxY, 92, boxH);
  ctx.fillStyle = "white";
  text("金額", L + 46, boxY + 45, 26, true, "center");
  ctx.fillStyle = "black";
  text(`${yen(r.amount)}-`, (L + 92 + R) / 2, boxY + 54, 52, true, "center");

  // 但し書き
  text(`但し　${r.note ?? "お食事代として"}`, L + 8, 248, 22, true);
  text("上記正に領収いたしました", L + 8, 278, 20);

  // 内訳
  const rate = r.taxRate ?? 10;
  const tax = Math.floor((r.amount * rate) / (100 + rate));
  const bx = L;
  const by = 292;
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, 300, 72);
  line(bx, by + 36, bx + 300, by + 36, 1);
  text("内訳", bx + 8, by + 26, 20, true);
  text(`税抜 ${yen(r.amount - tax)}`, bx + 292, by + 26, 20, false, "right");
  text(`消費税(${rate}%)`, bx + 8, by + 62, 20, true);
  text(yen(tax), bx + 292, by + 62, 20, false, "right");

  // 発行者
  const ix = R;
  let iy = 252;
  text(r.issuer.name, ix, iy, 26, true, "right");
  for (const s of [r.issuer.address, r.issuer.tel && `TEL ${r.issuer.tel}`, r.issuer.registrationNo && `登録番号 ${r.issuer.registrationNo}`]) {
    if (!s) continue;
    iy += 28;
    text(s, ix, iy, 20, false, "right");
  }

  // 5万円以上は収入印紙欄
  if (r.amount >= 50000) {
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(L + 320, by, 72, 72);
    ctx.setLineDash([]);
    text("印紙", L + 356, by + 44, 20, false, "center");
  }

  if (r.sample) {
    ctx.save();
    ctx.translate(W - 175, 118);
    ctx.rotate(-0.25);
    ctx.lineWidth = 4;
    ctx.strokeRect(-70, -40, 140, 70);
    text("見本", 0, 12, 40, true, "center");
    ctx.restore();
  }

  // 90° 回転して印刷向きに
  const out = createCanvas(H, W);
  const octx = out.getContext("2d");
  octx.translate(H, 0);
  octx.rotate(Math.PI / 2);
  octx.drawImage(land, 0, 0);
  return out;
}
