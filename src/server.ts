#!/usr/bin/env bun
/** ローカル Web UI。 bun run ui → http://localhost:3939 */
import index from "./ui/index.html";
import { findPrinter, send, toEscPos } from "./printer.ts";
import { findReport, inputInfo, renderReport, reports, type ReportParams } from "./reports/index.ts";

const PORT = Number(process.env.PORT ?? 3939);

async function renderFromRequest(req: Request) {
  const { report: id, ...params } = (await req.json()) as ReportParams & { report: string };
  const report = findReport(id);
  if (!report) throw new Error(`unknown report: ${id}`);
  return renderReport(report, params);
}

const errorResponse = (e: unknown) =>
  Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });

let printing = false;

const server = Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  routes: {
    "/": index,
    "/api/reports": () =>
      Response.json(
        reports.map(({ id, label, input, file }) => ({ id, label, input, source: file ? inputInfo(file) : null })),
      ),
    "/api/status": async () => {
      try {
        return Response.json({ connected: Boolean(await findPrinter()) });
      } catch (e) {
        return Response.json({ connected: false, error: String(e) });
      }
    },
    "/api/preview": {
      POST: async (req) => {
        try {
          const canvas = await renderFromRequest(req);
          return new Response(new Uint8Array(await canvas.encode("png")), { headers: { "content-type": "image/png" } });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
    "/api/print": {
      POST: async (req) => {
        if (printing) return Response.json({ error: "印刷中です" }, { status: 409 });
        printing = true;
        try {
          await send(toEscPos(await renderFromRequest(req)));
          return Response.json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        } finally {
          printing = false;
        }
      },
    },
  },
  development: process.env.NODE_ENV !== "production",
});

console.log(`🧾 receipt-printer UI: ${server.url}`);
