console.log("✅ sheets.js loaded (REPAIR MODE)");

// ===============================
// CONFIG
// ===============================
const SCHEDULE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQYXP1-d_DgHENUnWizMZeEN2jsz9y4z5lmfSmN9ktm0Bwseu52-j2_WYaXaurEVk56RDG9KK6ieQPp/pub?output=csv";

const ANNOUNCEMENTS_URL = window.ANNOUNCEMENTS_URL || "";
const STATUS_URL = window.STATUS_URL || "";

// ===============================
// CSV PARSER (real CSV w/ quotes)
// ===============================
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  text = (text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
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

  row.push(cell);
  rows.push(row);

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
// REPAIR YOUR "ALL DATA IN COL A" ROWS
// Example row you posted:
// "2026-01-01,Thursday,North,J. Lamb,ALS,07:30,07:30,",,,,,,,
// ===============================
function repairRowIfNeeded(row) {
  if (!row || !row.length) return row;

  const first = (row[0] || "").trim();
  if (!first) return row;

  const restEmpty = row.slice(1).every(c => !String(c || "").trim());
  const looksLikePacked = /^\d{4}-\d{2}-\d{2},/.test(first) && first.includes(",");

  if (restEmpty && looksLikePacked) {
    // Split the packed cell into columns
    const parts = first.split(",").map(s => s.trim());
    // Ensure we have at least 8 columns (Date..Code)
    while (parts.length < 8) parts.push("");
    return parts.slice(0, 8);
  }

  return row;
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

function safeGet(row, idx) {
  return idx == null ? "" : (row[idx] || "").toString().trim();
}

function buildHeaderIndexMap(headerRow) {
  const map = {};
  headerRow.forEach((h, idx) => {
    const key = String(h || "").trim().toLowerCase();
    if (!key) return;

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

  // header detection
  const headerLooksLikeHeader = rows[0].some(c =>
    ["date", "day", "area", "name", "level"].includes(String(c).toLowerCase())
  );

  const headerRow = headerLooksLikeHeader
    ? rows[0]
    : ["Date", "Day", "Area", "Name", "Level", "Shift Start", "Shift End", "Code"];

  // repair each data row if needed
  const rawDataRows = headerLooksLikeHeader ? rows.slice(1) : rows;
  const dataRows = rawDataRows.map(repairRowIfNeeded);

  const idx = buildHeaderIndexMap(headerRow);

  // fallback indexes
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

  const matches = dataRows.filter(r => {
    const d = normalizeDateCell(safeGet(r, idx.date));
    return d === todayKey || d === tomorrowKey;
  });

  console.log("📅 schedule rows sample (repaired):", dataRows.slice(0, 5));
  console.log("✅ matches for today/tomorrow:", { todayKey, tomorrowKey, count: matches.length });

  // Build a real table (thead/tbody)
  table.innerHTML = "";
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
// ANNOUNCEMENTS
// ===============================
async function loadAnnouncements() {
  const list = document.getElementById("announcements-list");
  if (!list) {
    console.warn("📣 announcements-list element not found in HTML");
    return;
  }

  list.innerHTML = "<li>Loading…</li>";

  try {
    const res = await fetch(ANNOUNCEMENTS_URL, { cache: "no-store" });
    const text = await res.text();

    // parseCSV returns ALL rows including header
    const all = parseCSV(text.trim());

    console.log("📣 announcements ALL rows:", all);

    // Find column indexes by header names (Active, text)
    const header = all[0].map(h => String(h).trim().toLowerCase());
    const activeIdx = header.indexOf("active");
    const textIdx = header.indexOf("text");

    if (activeIdx === -1 || textIdx === -1) {
      throw new Error(`Header missing. Found: ${header.join(", ")}`);
    }

    const rows = all.slice(1);

    list.innerHTML = "";
    let added = 0;

    rows.forEach((r) => {
      const active = String(r[activeIdx] ?? "").trim().toUpperCase();
      const msg = String(r[textIdx] ?? "").trim();

      if (active === "TRUE" && msg) {
        const li = document.createElement("li");
        li.textContent = msg;
        list.appendChild(li);
        added++;
      }
    });

    if (!added) {
      list.innerHTML = "<li>No announcements</li>";
    }

    console.log("📣 announcements rendered:", added);
  } catch (err) {
    console.warn("📣 loadAnnouncements failed:", err);
    list.innerHTML = "<li>Announcements unavailable</li>";
  }
}

// ===============================
// BOOT
// ===============================
loadSchedule();
loadAnnouncements();
loadStatus();

setInterval(loadSchedule, 5 * 60 * 1000);
setInterval(loadAnnouncements, 5 * 60 * 1000);
setInterval(loadStatus, 60 * 1000);
