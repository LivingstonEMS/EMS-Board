console.log("✅ sheets.js loaded (SCHEDULE FIXED)");

// ===============================
// CONFIG — put your published CSV links here
// ===============================
const SCHEDULE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQYXP1-d_DgHENUnWizMZeEN2jsz9y4z5lmfSmN9ktm0Bwseu52-j2_WYaXaurEVk56RDG9KK6ieQPp/pub?output=csv";

// If you also have published CSVs for these, drop them in:
const ANNOUNCEMENTS_URL = window.ANNOUNCEMENTS_URL || ""; // optional
const STATUS_URL = window.STATUS_URL || ""; // optional

// ===============================
// CSV PARSER (handles quotes + commas inside cells)
// ===============================
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  // normalize newlines
  text = (text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      // doubled quote inside quoted string -> literal quote
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  // last cell
  row.push(cell);
  rows.push(row);

  // trim cells
  return rows.map(r => r.map(c => (c ?? "").toString().trim()));
}

async function loadCSV(url) {
  if (!url) return [];
  const bust = url.includes("?") ? "&" : "?";
  const res = await fetch(url + bust + "v=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV HTTP ${res.status}`);
  const text = await res.text();
  return parseCSV(text).filter(r => r.some(c => String(c || "").trim() !== ""));
}

// ===============================
// HELPERS
// ===============================
function ymdLocal(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeDateCell(v) {
  const s = String(v || "");
  const m = s.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : "";
}

function buildHeaderIndexMap(headerRow) {
  const map = {};
  headerRow.forEach((h, idx) => {
    const key = String(h || "").trim().toLowerCase();
    if (!key) return;

    // allow flexible header naming
    if (key === "date") map.date = idx;
    if (key === "day") map.day = idx;
    if (key === "area") map.area = idx;
    if (key === "name") map.name = idx;
    if (key === "level") map.level = idx;
    if (key.includes("shift start") || key === "start") map.start = idx;
    if (key.includes("shift end") || key === "end") map.end = idx;
    if (key === "code") map.code = idx;
  });
  return map;
}

function safeGet(row, idx) {
  return idx == null ? "" : (row[idx] || "").toString().trim();
}

// ===============================
// SCHEDULE
// ===============================
async function loadSchedule() {
  const table = document.getElementById("schedule-table");
  if (!table) return;

  table.innerHTML = "";

  let rows = [];
  try {
    rows = await loadCSV(SCHEDULE_URL);
  } catch (e) {
    console.warn("📅 schedule load failed:", e);
    table.innerHTML = `<tr><td>Schedule unavailable (failed to load)</td></tr>`;
    return;
  }

  if (!rows.length) {
    table.innerHTML = `<tr><td>No schedule data</td></tr>`;
    return;
  }

  // detect header row
  const headerLooksLikeHeader = rows[0].some(c =>
    ["date", "day", "area", "name", "level"].includes(String(c).toLowerCase())
  );

  const headerRow = headerLooksLikeHeader ? rows[0] : ["Date", "Day", "Area", "Name", "Level", "Shift Start", "Shift End", "Code"];
  const dataRows = headerLooksLikeHeader ? rows.slice(1) : rows;

  const idx = buildHeaderIndexMap(headerRow);

  // fallback positions if we didn't detect headers
  if (idx.date == null) idx.date = 0;
  if (idx.day == null) idx.day = 1;
  if (idx.area == null) idx.area = 2;
  if (idx.name == null) idx.name = 3;
  if (idx.level == null) idx.level = 4;
  if (idx.start == null) idx.start = 5;
  if (idx.end == null) idx.end = 6;
  if (idx.code == null) idx.code = 7;

  const todayKey = ymdLocal(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = ymdLocal(tomorrow);

  // filter today + tomorrow
  const matches = dataRows.filter(r => {
    const d = normalizeDateCell(safeGet(r, idx.date));
    return d === todayKey || d === tomorrowKey;
  });

  console.log("📅 schedule rows sample:", dataRows.slice(0, 5));
  console.log("✅ matches for today/tomorrow:", { todayKey, tomorrowKey, count: matches.length });

  // render header
  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  ["Date", "Day", "Area", "Name", "Level", "Start", "End", "Code"].forEach(t => {
    const th = document.createElement("th");
    th.textContent = t;
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  table.appendChild(tbody);

  if (!matches.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.textContent = "No schedule posted for Today/Tomorrow";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  matches.forEach(r => {
    const date = normalizeDateCell(safeGet(r, idx.date));
    const day = safeGet(r, idx.day);
    const area = safeGet(r, idx.area);
    const name = safeGet(r, idx.name);
    const level = safeGet(r, idx.level);
    const start = safeGet(r, idx.start);
    const end = safeGet(r, idx.end);
    const code = safeGet(r, idx.code);

    const tr = document.createElement("tr");

    const areaKey = area.toLowerCase();
    if (areaKey.includes("north")) tr.classList.add("row-north");
    if (areaKey.includes("south")) tr.classList.add("row-south");

    [date, day, area, name, level, start, end, code].forEach(val => {
      const td = document.createElement("td");
      td.textContent = val;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

// ===============================
// ANNOUNCEMENTS (kept working)
// ===============================
async function loadAnnouncements() {
  const list = document.getElementById("announcements-list");
  if (!list || !ANNOUNCEMENTS_URL) return;

  list.innerHTML = "";

  let rows = [];
  try {
    rows = await loadCSV(ANNOUNCEMENTS_URL);
  } catch (e) {
    console.warn("📣 announcements load failed:", e);
    const li = document.createElement("li");
    li.textContent = "Announcements unavailable";
    list.appendChild(li);
    return;
  }

  // remove header if present
  if (rows[0] && rows[0].some(c => String(c).toLowerCase().includes("active"))) {
    rows = rows.slice(1);
  }

  const looksActive = (v) => {
    const a = String(v || "").trim().toUpperCase();
    return a === "TRUE" || a === "YES" || a === "1" || a === "Y" || a === "ON";
  };

  rows.forEach((r) => {
    const c0 = (r[0] || "").trim();
    const c1 = (r[1] || "").trim();

    let text = "";
    let activeVal = "";

    if (looksActive(c0) && c1) {
      activeVal = c0;
      text = c1;
    } else {
      text = c0;
      activeVal = c1;
    }

    if (looksActive(activeVal) && text) {
      const li = document.createElement("li");
      li.textContent = text;
      list.appendChild(li);
    }
  });

  if (!list.children.length) {
    const li = document.createElement("li");
    li.textContent = "No announcements";
    list.appendChild(li);
  }
}

// ===============================
// STATUS (optional)
// ===============================
async function loadStatus() {
  const el = document.getElementById("status-banner");
  if (!el || !STATUS_URL) return;

  try {
    const rows = await loadCSV(STATUS_URL);
    // Expect first cell to contain status text
    const status = rows?.[0]?.[0]?.trim();
    if (status) el.textContent = status;
  } catch (e) {
    console.warn("🧾 status load failed:", e);
  }
}

// ===============================
// BOOT
// ===============================
loadSchedule();
loadAnnouncements();
loadStatus();

// refresh schedule occasionally
setInterval(loadSchedule, 5 * 60 * 1000);
setInterval(loadAnnouncements, 5 * 60 * 1000);
setInterval(loadStatus, 60 * 1000);
