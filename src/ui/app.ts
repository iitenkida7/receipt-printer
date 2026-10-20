interface ReportInfo {
  id: string;
  label: string;
  input: "date" | "text" | "none";
  source: { path: string; updatedAt: string | null } | null;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const tabs = $("tabs");
const dateField = $("date-field");
const dateInput = $<HTMLInputElement>("date");
const textField = $("text-field");
const textArea = $<HTMLTextAreaElement>("text");
const textLabel = $("text-label");
const textHelp = $("text-help");
const source = $("source");
const preview = $<HTMLImageElement>("preview");
const previewError = $("preview-error");
const printButton = $<HTMLButtonElement>("print");
const message = $("message");
const status = $("status");

const TEXT_DEFAULTS: Record<string, { label: string; help: string; value: string }> = {
  memo: {
    label: "メモ",
    help: "# 見出し　## 小見出し　--- 区切り線\n- [ ] チェック　- 箇条書き　左 | 右 で左右に配置",
    value: "# 今日やること\n---\n- [ ] レビューを返す\n- [ ] 資料を仕上げる\n- [ ] 経費精算\n\n## メモ\n会議室 | 3F-A\n締め切り | 17:00\n",
  },
  blocks: {
    label: "Block[] JSON",
    help: 'type: title / sub / hr / row / text / bar / space',
    value: JSON.stringify(
      {
        blocks: [
          { type: "title", text: "Hello" },
          { type: "hr" },
          { type: "row", left: "コーヒー", right: "¥480", bold: true },
          { type: "bar", label: "進捗", value: 7, max: 10, right: "70%" },
        ],
      },
      null,
      2,
    ),
  },
};

const STORAGE_KEY = "receipt-printer:state";
type State = { report: string; date: string; texts: Record<string, string> };
const today = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD

function loadState(): State {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "");
    return { report: s.report ?? "agenda", date: today(), texts: s.texts ?? {} };
  } catch {
    return { report: "agenda", date: today(), texts: {} };
  }
}
const state = loadState();
const saveState = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
};

let reports: ReportInfo[] = [];
const current = () => reports.find((r) => r.id === state.report) ?? reports[0]!;

function params() {
  const r = current();
  return {
    report: r.id,
    ...(r.input === "date" && { date: state.date }),
    ...(r.input === "text" && { text: state.texts[r.id] ?? TEXT_DEFAULTS[r.id]?.value ?? "" }),
  };
}

function renderControls() {
  const r = current();
  for (const b of tabs.querySelectorAll("button")) b.setAttribute("aria-selected", String(b.dataset.id === r.id));
  dateField.hidden = r.input !== "date";
  textField.hidden = r.input !== "text";
  dateInput.value = state.date;
  if (r.input === "text") {
    const d = TEXT_DEFAULTS[r.id];
    textLabel.textContent = d?.label ?? "本文";
    textHelp.textContent = d?.help ?? "";
    textArea.value = state.texts[r.id] ?? d?.value ?? "";
  }
  if (r.source) {
    const at = r.source.updatedAt ? new Date(r.source.updatedAt).toLocaleString("ja-JP") : "なし";
    source.textContent = `データ: ${r.source.path}（更新 ${at}）`;
  } else source.textContent = "";
}

let previewSeq = 0;
let lastUrl = "";
async function refreshPreview() {
  const seq = ++previewSeq;
  preview.classList.add("loading");
  try {
    const res = await fetch("/api/preview", { method: "POST", body: JSON.stringify(params()) });
    if (seq !== previewSeq) return;
    if (!res.ok) throw new Error((await res.json()).error);
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    lastUrl = URL.createObjectURL(await res.blob());
    preview.src = lastUrl;
    preview.hidden = false;
    previewError.hidden = true;
  } catch (e) {
    if (seq !== previewSeq) return;
    previewError.textContent = `プレビューできません: ${(e as Error).message}`;
    previewError.hidden = false;
  } finally {
    if (seq === previewSeq) preview.classList.remove("loading");
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
const refreshSoon = () => {
  clearTimeout(timer);
  timer = setTimeout(refreshPreview, 250);
};

function select(id: string) {
  state.report = id;
  saveState();
  renderControls();
  refreshPreview();
}

function shiftDate(days: number) {
  const d = new Date(`${state.date}T00:00:00`);
  d.setDate(d.getDate() + days);
  state.date = d.toLocaleDateString("sv-SE");
  renderControls();
  refreshPreview();
}

async function print() {
  printButton.disabled = true;
  printButton.textContent = "印刷中…";
  message.textContent = "";
  try {
    const res = await fetch("/api/print", { method: "POST", body: JSON.stringify(params()) });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error);
    message.dataset.kind = "ok";
    message.textContent = `印刷しました (${new Date().toLocaleTimeString("ja-JP")})`;
  } catch (e) {
    message.dataset.kind = "ng";
    message.textContent = `失敗: ${(e as Error).message}`;
  } finally {
    printButton.disabled = false;
    printButton.textContent = "印刷する";
  }
}

async function checkStatus() {
  try {
    const { connected } = await (await fetch("/api/status")).json();
    status.dataset.state = connected ? "ok" : "ng";
    status.textContent = connected ? "プリンタ接続中" : "プリンタ未接続";
  } catch {
    status.dataset.state = "ng";
    status.textContent = "サーバーに接続できません";
  }
}

dateInput.addEventListener("change", () => {
  state.date = dateInput.value || today();
  refreshPreview();
});
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-shift]")) {
  b.addEventListener("click", () => shiftDate(Number(b.dataset.shift)));
}
$("today").addEventListener("click", () => {
  state.date = today();
  renderControls();
  refreshPreview();
});
textArea.addEventListener("input", () => {
  state.texts[current().id] = textArea.value;
  saveState();
  refreshSoon();
});
printButton.addEventListener("click", print);

reports = await (await fetch("/api/reports")).json();
tabs.replaceChildren(
  ...reports.map((r) => {
    const b = document.createElement("button");
    b.type = "button";
    b.role = "tab";
    b.dataset.id = r.id;
    b.textContent = r.label;
    b.addEventListener("click", () => select(r.id));
    return b;
  }),
);
if (!reports.some((r) => r.id === state.report)) state.report = reports[0]!.id;
renderControls();
refreshPreview();
checkStatus();
setInterval(checkStatus, 10_000);
