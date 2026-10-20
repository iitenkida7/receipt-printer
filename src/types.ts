/** レシート1枚 = Block の配列。上から順に描画される。 */
export type Block =
  | { type: "title"; text: string; size?: number }
  | { type: "sub"; text: string; size?: number }
  | { type: "hr"; width?: number }
  | { type: "row"; left: string; right?: string; size?: number; bold?: boolean; indent?: number }
  | { type: "text"; text: string; size?: number; bold?: boolean }
  | { type: "bar"; label: string; value: number; max: number; right?: string; size?: number }
  | { type: "space"; h?: number };

/** Google Calendar list_events の events[] のうち使うフィールドだけ。 */
export interface CalendarEvent {
  summary?: string;
  location?: string;
  eventType?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { email: string; self?: boolean; resource?: boolean; responseStatus?: string }[];
}
