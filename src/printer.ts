import type { Canvas } from "@napi-rs/canvas";
import { WebUSB } from "usb";

// 自分のプリンタの ID は `system_profiler SPUSBDataType` などで調べて環境変数で上書きする
const VENDOR_ID = Number(process.env.PRINTER_VID ?? 0x0483);
const PRODUCT_ID = Number(process.env.PRINTER_PID ?? 0x070b);

/** 画像を ESC/POS ラスタ画像コマンド (GS v 0) に変換する。 */
export function toEscPos(canvas: Canvas): Uint8Array {
  const { width, height } = canvas;
  const px = canvas.getContext("2d").getImageData(0, 0, width, height).data;
  const widthBytes = width / 8;
  const raster = new Uint8Array(widthBytes * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const dark = (px[i]! + px[i + 1]! + px[i + 2]!) / 3 < 128 && px[i + 3]! > 128;
      if (dark) raster[y * widthBytes + (x >> 3)]! |= 0x80 >> (x & 7);
    }
  }
  const header = [0x1b, 0x40, 0x1d, 0x76, 0x30, 0x00, widthBytes & 0xff, widthBytes >> 8, height & 0xff, height >> 8];
  const feed = new Uint8Array(5).fill(0x0a);
  return new Uint8Array([...header, ...raster, ...feed]);
}

/** USB 接続のレシートプリンタへ生データを送る (ブラウザの WebUSB と同じ API)。 */
export async function findPrinter(): Promise<USBDevice | undefined> {
  const usb = new WebUSB({ allowAllDevices: true });
  return (await usb.getDevices()).find((d) => d.vendorId === VENDOR_ID && d.productId === PRODUCT_ID);
}

export async function send(data: Uint8Array): Promise<void> {
  const device = await findPrinter();
  if (!device) throw new Error("プリンタが見つかりません (USB 接続を確認)");
  await device.open();
  try {
    if (!device.configuration) await device.selectConfiguration(1);
    await device.claimInterface(0);
    const iface = device.configuration!.interfaces.find((i) => i.interfaceNumber === 0)!;
    const out = iface.alternates[0]!.endpoints.find((e) => e.direction === "out");
    if (!out) throw new Error("OUT エンドポイントがありません");
    for (let i = 0; i < data.length; i += 4096) {
      await device.transferOut(out.endpointNumber, data.slice(i, i + 4096));
    }
    await device.releaseInterface(0);
  } finally {
    await device.close();
  }
}
