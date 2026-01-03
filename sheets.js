console.log("✅ sheets.js loaded");

/**
 * If you want to override URLs from index.html, you can set:
 * window.SCHEDULE_URL = "..."
 * window.ANNOUNCEMENTS_URL = "..."
 * window.STATUS_URL = "..."
 */
const DEFAULT_SCHEDULE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQYXP1-d_DgHENUnWizMZeEN2jsz9y4z5lmfSmN9ktm0Bwseu52-j2_WYaXaurEVk56RDG9KK6ieQPp/pub?output=csv";

const SCHEDULE_URL = window.SCHEDULE_URL || DEFAULT_SCHEDULE_URL;
const ANNOUNCEMENTS_URL = window.ANNOUNCEMENTS_URL || "";
const STATUS_URL = window.STATUS_URL || "";

/* ---------------- CSV helpers ---------------- */

function parseCSV(text) {
  // Robust-ish CSV parser (handles quotes + commas inside quotes)
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      // escaped quote
      cur += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && (ch === "," || ch === "\t")) {
      row.push(cur);
      cur = "";
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      // handle CRLF
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      cur = "";
      // ignore totally empty lines
      if (row.some((c) => String(c || "").trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    cur += ch;
  }

  // last cell
  row.push(cur);
  if (row.some((c) => String(c || "").trim() !== "")) rows.push(row);

  // trim cells
  return rows.map((r) => r.map((c) => String(c ?? "").trim()));
}

async function loadCSV(url) {
  if (!url) return [];
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV HTTP ${res.status}`);
  const text = await res.text();
  return parseCSV(text);
}

function ymdLocal(dateObj = new Date()) {
  // "YYYY-MM-DD" in the user's local time
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function cleanDateCell(v) {
  // Accept: "2026-01-02" OR "2026-01-02 00:00:00" OR "1/2/2026" etc.
  const s = String(v || "").trim();
  if (!s) return "";

  // If it already looks like YYYY-MM-DD
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // Try Date parse fallback
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return ymdLocal(dt);

  return s; // last resort
}

/* ---------------- Schedule ---------------- */

function buildHeaderRow(table, cols) {
  const thead = document.createElement("thead");
  const tr = document.createElement("tr");
  cols.forEach((c) => {
    const th = document.createElement("th");
    th.textContent = c;
    tr.appendChild(th);
  });
  thead.appendChild(tr);
  table.appendChild(thead);
}

function addRow(tbody, rowObj) {
  const tr = document.createElement("tr");

  // Color rules: North = blue, South = gray
  const area = (rowObj.Area || "").toLowerCase();
  if (area === "north") tr.style.background = "rgba(0, 120, 255, 0.18)";
  if (area === "south") tr.style.background = "rgba(150, 150, 150, 0.16)";

  const cols = ["Day", "Area", "Name", "Level", "Shift", "Code"];
  cols.forEach((key) => {
    const td = document.createElement("td");
    td.textContent = rowObj[key] || "";
    tr.appendChild(td);
  });

  tbody.appendChild(tr);
}

async function loadSchedule() {
  const table = document.getElementById("schedule-table");
  if (!table) return;

  // wipe
  table.innerHTML = "";

  if (!SCHEDULE_URL) {
    table.textContent = "Schedule URL not set";
    return;
  }

  try {
    const rows = await loadCSV(SCHEDULE_URL);

    console.log("📅 schedule rows sample:", rows.slice(0, 5));

    if (!rows.length) {
      table.textContent = "No schedule rows found";
      return;
    }

    // Detect header row
    const header = rows[0].map((h) => h.toLowerCase());
    const hasHeader =
      header.includes("date") &&
      header.includes("day") &&
      header.includes("area");

    const dataRows = hasHeader ? rows.slice(1) : rows;

    // Map columns
    const idx = (name) => header.indexOf(name.toLowerCase());

    const colMap = hasHeader
      ? {
          Date: idx("date"),
          Day: idx("day"),
          Area: idx("area"),
          Name: idx("name"),
          Level: idx("level"),
          ShiftStart: idx("shift start"),
          ShiftEnd: idx("shift end"),
          Code: idx("code"),
        }
      : {
          // Fallback to the layout you showed
          Date: 0,
          Day: 1,
          Area: 2,
          Name: 3,
          Level: 4,
          ShiftStart: 5,
          ShiftEnd: 6,
          Code: 7,
        };

    const todayKey = ymdLocal(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = ymdLocal(tomorrow);

    const items = [];

    for (const r of dataRows) {
      const dateRaw = r[colMap.Date] ?? "";
      const dateKey = cleanDateCell(dateRaw);

      if (dateKey !== todayKey && dateKey !== tomorrowKey) continue;

      const day = r[colMap.Day] ?? "";
      const area = r[colMap.Area] ?? "";
      const name = r[colMap.Name] ?? "";
      const level = r[colMap.Level] ?? "";
      const start = r[colMap.ShiftStart] ?? "";
      const end = r[colMap.ShiftEnd] ?? "";
      const code = r[colMap.Code] ?? "";

      const shift = start && end ? `${start}–${end}` : (start || end || "");

      items.push({
        DateKey: dateKey,
        Day: day,
        Area: area,
        Name: name,
        Level: level,
        Shift: shift,
        Code: code,
      });
    }

    console.log("✅ matches for today/tomorrow:", {
      todayKey,
      tomorrowKey,
      count: items.length,
    });

    // Build table
    buildHeaderRow(table, ["Day", "Area", "Name", "Level", "Shift", "Code"]);
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);

    if (!items.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
      td.textContent = "No schedule posted for Today/Tomorrow";
      td.style.padding = "12px 8px";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    // Sort by date, then area, then name
    items.sort((a, b) => {
      if (a.DateKey !== b.DateKey) return a.DateKey.localeCompare(b.DateKey);
      if (a.Area !== b.Area) return a.Area.localeCompare(b.Area);
      return a.Name.localeCompare(b.Name);
    });

    items.forEach((it) => addRow(tbody, it));
  } catch (e) {
    console.warn("📅 Schedule load failed:", e);
    table.textContent = "Schedule unavailable (check CSV publish/link)";
  }
}

/* ---------------- Announcements (optional) ---------------- */

async function loadAnnouncements() {
  const list = document.getElementById("announcements-list");
  if (!list) return;

  list.innerHTML = "";

  if (!ANNOUNCEMENTS_URL) {
    const li = document.createElement("li");
    li.textContent = "No announcements";
    list.appendChild(li);
    return;
  }

  try {
    const rows = await loadCSV(ANNOUNCEMENTS_URL);
    console.log("📣 announcements rows sample:", rows.slice(0, 5));

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
  } catch (e) {
    console.warn("📣 Announcements load failed:", e);
    const li = document.createElement("li");
    li.textContent = "Announcements unavailable";
    list.appendChild(li);
  }
}

/* ---------------- Status (optional) ---------------- */

async function loadStatus() {
  const el = document.getElementById("status-text");
  if (!el) return;
  if (!STATUS_URL) return;

  try {
    const rows = await loadCSV(STATUS_URL);
    console.log("🧾 status rows sample:", rows.slice(0, 3));
    // Expect: [STATUS, message] or [message, STATUS]
    const r0 = rows[0] || [];
    el.textContent = r0.join(" ").trim() || el.textContent;
  } catch (e) {
    console.warn("🧾 Status load failed:", e);
  }
}

/* ---------------- boot ---------------- */

document.addEventListener("DOMContentLoaded", () => {
  loadSchedule();
  loadAnnouncements();
  loadStatus();

  // refresh schedule every 5 min (optional)
  setInterval(loadSchedule, 5 * 60 * 1000);
});
