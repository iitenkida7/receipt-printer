import type { Block, CalendarEvent } from "../types.ts";

const WEEKDAYS = "日月火水木金土";
const DAY_START = 9 * 60;
const DAY_END = 18 * 60;

export const label = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}${WEEKDAYS[d.getDay()]}`;
const hours = (min: number) => `${(min / 60).toFixed(1)}h`;
const hhmm = (d: Date) => d.toTimeString().slice(0, 5);
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const isAllDayOn = (e: CalendarEvent, day: Date) => e.start.date && sameDay(new Date(e.start.date), day);

const self = (e: CalendarEvent) => e.attendees?.find((a) => a.self);
const declined = (e: CalendarEvent) => self(e)?.responseStatus === "declined";
const hasOthers = (e: CalendarEvent) => (e.attendees ?? []).some((a) => !a.self && !a.resource);

/** その日の時間指定の予定 (辞退したものは除く) を開始順で返す。 */
function timedOn(events: CalendarEvent[], day: Date) {
  return events
    .filter((e) => e.start.dateTime && !declined(e))
    .map((e) => ({ ev: e, start: new Date(e.start.dateTime!), end: new Date(e.end.dateTime!) }))
    .filter(({ start }) => sameDay(start, day))
    .sort((a, b) => +a.start - +b.start);
}

/** 区間の和 (重なりは1回だけ数える) を分で返す。 */
function unionMinutes(intervals: [number, number][]): number {
  let total = 0;
  let cur: [number, number] | null = null;
  for (const [s, e] of [...intervals].sort((a, b) => a[0] - b[0])) {
    if (!cur || s > cur[1]) {
      if (cur) total += cur[1] - cur[0];
      cur = [s, e];
    } else cur[1] = Math.max(cur[1], e);
  }
  return total + (cur ? cur[1] - cur[0] : 0);
}

export interface DayStats {
  meetingMin: number;
  count: number;
  freeMin: number;
  off: boolean;
}

/**
 * 会議 = 自分以外の参加者がいる通常予定 (辞退除く)。
 * 空き = 9-18時のうち、会議・集中ブロック・個人予定のどれにも入っていない時間。
 * 休み = 6時間以上の「休み/やすみ/休暇」予定がある日。
 */
export function dayStats(events: CalendarEvent[], day: Date): DayStats {
  const meetings: [number, number][] = [];
  const busy: [number, number][] = [];
  let off = false;
  for (const { ev, start, end } of timedOn(events, day)) {
    const s = start.getHours() * 60 + start.getMinutes();
    const e = sameDay(start, end) ? end.getHours() * 60 + end.getMinutes() : 24 * 60;
    if (/休み|やすみ|休暇/.test(ev.summary ?? "") && e - s >= 360) off = true;
    if ((ev.eventType ?? "DEFAULT") === "DEFAULT" && hasOthers(ev)) meetings.push([s, e]);
    const cs = Math.max(s, DAY_START);
    const ce = Math.min(e, DAY_END);
    if (ce > cs) busy.push([cs, ce]);
  }
  return {
    meetingMin: unionMinutes(meetings),
    count: meetings.length,
    freeMin: DAY_END - DAY_START - unionMinutes(busy),
    off,
  };
}

/** 今日の予定 */
export function agenda(events: CalendarEvent[], day: Date): Block[] {
  const allDay = events.filter((e) => isAllDayOn(e, day));
  const timed = timedOn(events, day).filter(({ ev }) => (ev.eventType ?? "DEFAULT") === "DEFAULT");
  const blocks: Block[] = [
    { type: "title", text: "TODAY'S AGENDA" },
    { type: "sub", text: day.toLocaleDateString("ja-JP", { dateStyle: "full" }) },
    { type: "hr", width: 3 },
    ...allDay.map((e): Block => ({ type: "row", left: `[終日] ${e.summary ?? ""}`, bold: true })),
    ...(allDay.length ? ([{ type: "hr", width: 1 }] satisfies Block[]) : []),
  ];
  for (const { ev, start, end } of timed) {
    blocks.push({ type: "row", left: `${hhmm(start)}  ${ev.summary ?? ""}`, size: 19, bold: true });
    const sub = [`  -${hhmm(end)}`, ev.location && `@ ${ev.location}`].filter(Boolean).join("  ");
    blocks.push({ type: "row", left: sub, size: 15 }, { type: "hr", width: 1 });
  }
  blocks.push({ type: "row", left: `${timed.length} 件`, size: 20, bold: true });
  return blocks;
}

/** 週次レポート: monday の週 (月-金) の会議時間と、翌週の詰まり具合。 */
export function weekly(events: CalendarEvent[], monday: Date): Block[] {
  const week = (offset: number) => [0, 1, 2, 3, 4].map((i) => addDays(monday, offset + i));
  const thisWeek = week(0).map((d) => ({ d, s: dayStats(events, d) }));
  const nextWeek = week(7).map((d) => ({ d, s: dayStats(events, d) }));
  const max = Math.max(8 * 60, ...[...thisWeek, ...nextWeek].map((x) => x.s.meetingMin));
  const sum = (xs: typeof thisWeek, f: (s: DayStats) => number) => xs.reduce((a, x) => a + f(x.s), 0);

  const total = sum(thisWeek, (s) => s.meetingMin);
  const peak = thisWeek.reduce((a, b) => (b.s.meetingMin > a.s.meetingMin ? b : a));
  const working = nextWeek.filter((x) => !x.s.off);
  const busiest = working.reduce<(typeof working)[number] | undefined>(
    (a, b) => (!a || b.s.meetingMin > a.s.meetingMin ? b : a),
    undefined,
  );

  return [
    { type: "title", text: "週次レポート" },
    { type: "sub", text: `${label(thisWeek[0]!.d)} - ${label(thisWeek[4]!.d)}` },
    { type: "hr", width: 3 },
    { type: "row", left: "会議時間 合計", right: hours(total), size: 24, bold: true },
    { type: "row", left: "会議数", right: `${sum(thisWeek, (s) => s.count)} 件` },
    { type: "row", left: "1日平均", right: hours(total / 5) },
    { type: "row", left: "最多", right: `${label(peak.d)} ${hours(peak.s.meetingMin)}`, bold: true },
    { type: "space", h: 4 },
    { type: "text", text: "会議時間 (日別)", size: 15, bold: true },
    ...thisWeek.map(({ d, s }): Block => ({ type: "bar", label: label(d), value: s.meetingMin, max, right: hours(s.meetingMin) })),
    { type: "hr" },
    { type: "sub", text: `来週 ${label(nextWeek[0]!.d)} - ${label(nextWeek[4]!.d)}` },
    { type: "row", left: "会議時間 合計", right: hours(sum(nextWeek, (s) => s.meetingMin)), size: 20, bold: true },
    { type: "row", left: "空き (9-18時)", right: hours(sum(working, (s) => s.freeMin)) },
    { type: "space", h: 4 },
    { type: "text", text: "会議 / 空き (日別)", size: 15, bold: true },
    ...nextWeek.flatMap(({ d, s }): Block[] =>
      s.off
        ? [{ type: "row", left: label(d), right: "休み", size: 17, bold: true }]
        : [
            { type: "bar", label: label(d), value: s.meetingMin, max, right: hours(s.meetingMin) },
            { type: "row", left: "", right: `空き ${hours(s.freeMin)}`, size: 14 },
          ],
    ),
    ...(busiest
      ? ([
          { type: "hr" },
          {
            type: "text",
            text: `来週の山場: ${label(busiest.d)} (会議 ${hours(busiest.s.meetingMin)}、空き ${hours(busiest.s.freeMin)})`,
            bold: true,
          },
        ] satisfies Block[])
      : []),
  ];
}
