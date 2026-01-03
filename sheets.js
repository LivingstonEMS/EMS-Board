console.log("✅ sheets.js loaded");

// ===============================
// Published CSV URLs
// ===============================
const ANNOUNCEMENTS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSjU3xZI4zsPk0ECZHaFKWKZjdvTdVWk3X4VcYlNh9OV00SHwzuT0TsABo3xzdjJnwo5jci80SJgkhe/pub?output=csv";

const SCHEDULE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vStmTvJPfr46sHRtY3h8aLp40EN_4jD_lX813MEp7aSuKcWYkroNRi-evzAnZCvN8uiUGgWGGiaP50d/pub?output=csv";

const STATUS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRKMYW3E7RImjEQV253Vj7bPtQYUI2HrYUoyh9TeqkrfdaYGqKbGWe83voMA6VGRruLvo-zSPx1_FaH/pub?output=csv";

// ===============================
// CSV Parser (robust)
// ===============================
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell.trim());
      if (row.length > 1) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }

  if (cell || row.length) {
    row.push(cell.trim());
    if (row.length > 1) rows.push(row);
  }

  return rows;
}

async function loadCSV(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV HTTP ${res.status}`);
  const text = await res.text();
  const rows = parseCSV(text);
  // drop header row if present
  return rows.slice(1);
}

// ===============================
// Helpers
// ===============================
function pad2(n) {
  return String(n).padStart(2, "0");
}

function dateKeyLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function todayKey(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return dateKeyLocal(d);
}

// Converts:
// - "2026-01-02" -> "2026-01-02"
// - "1/2/2026"   -> "2026-01-02"
// - "01/02/2026" -> "2026-01-02"
// - "45678" (Google serial date) -> yyyy-mm-dd
function normalizeDateToKey(v) {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s) return "";

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // M/D/YYYY or MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const mm = pad2(mdy[1]);
    const dd = pad2(mdy[2]);
    const yy = mdy[3];
    return `${yy}-${mm}-${dd}`;
  }

  // Google Sheets serial date (days since 1899-12-30)
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (!Number.isNaN(serial) && serial > 20000 && serial < 90000) {
      const base = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(base.getTime() + serial * 86400000);
      // convert to LOCAL date key (so it matches your todayKey)
      return dateKeyLocal(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }
  }

  // fallback: try Date parsing
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return dateKeyLocal(parsed);

  return s;
}

function fmtTime(t) {
  if (!t) return "";
  const str = String(t).trim();
  if (!str.includes(":")) return str;
  const [h, m] = str.split(":");
  return `${pad2(h)}:${pad2(m)}`;
}

function looksActive(v) {
  const a = String(v || "").trim().toUpperCase();
  return a === "TRUE" || a === "YES" || a === "1" || a === "Y" || a === "ON";
}

function normArea(area) {
  const a = String(area || "").trim().toLowerCase();
  if (a.startsWith("n")) return "North";
  if (a.startsWith("s")) return "South";
  return String(area || "").trim();
}

// ===============================
// Announcements
// ===============================
async function loadAnnouncements() {
  try {
    const rows = await loadCSV(ANNOUNCEMENTS_URL);
    console.log("📣 announcements rows sample:", rows.slice(0, 5));

    const list = document.getElementById("announcements-list");
    if (!list) return;

    list.innerHTML = "";

    rows.forEach((r) => {
      const c0 = (r[0] || "").trim();
      const c1 = (r[1] || "").trim();

      // Detect which column is Active vs Text
      let text = "";
      let active = "";

      if (looksActive(c0) && c1) {
        active = c0;
        text = c1;
      } else if (looksActive(c1) && c0) {
        active = c1;
        text = c0;
      } else {
        // If no active column exists, treat first column as text
        text = c0;
        active = "TRUE";
      }

      if (looksActive(active) && text) {
        const li = document.createElement("li");
        li.textContent = text;
        list.appendChild(li);
      }
    });

    if (!list.children.length) {
      list.innerHTML = "<li>No announcements</li>";
    }
  } catch (e) {
    console.warn("❌ loadAnnouncements failed:", e);
    const list = document.getElementById("announcements-list");
    if (list) list.innerHTML = "<li>Announcements unavailable</li>";
  }
}

// ===============================
// Status Banner
// ===============================
async function loadStatus() {
  try {
    const rows = await loadCSV(STATUS_URL);
    console.log("🧾 status rows sample:", rows.slice(0, 3));

    const banner = document.getElementById("status-banner");
    if (!banner) return;

    const message = rows?.[0]?.[1] || rows?.[0]?.[0] || "Normal Operations";
    banner.textContent = message;
  } catch (e) {
    console.warn("❌ loadStatus failed:", e);
    const banner = document.getElementById("status-banner");
    if (banner) banner.textContent = "Status unavailable";
  }
}

// ===============================
// Schedule (Today + Tomorrow)
// + North blue / South gray
// ===============================
async function loadSchedule() {
  try {
    const rows = await loadCSV(SCHEDULE_URL);
    console.log("📅 schedule rows sample:", rows.slice(0, 5));

    const table = document.getElementById("schedule-table");
    if (!table) return;

    table.innerHTML = "";

    const today = todayKey(0);
    const tomorrow = todayKey(1);

    const entries = rows
      .map((r) => ({
        dateKey: normalizeDateToKey(r[0]),
        day: (r[1] || "").trim(),
        area: normArea(r[2]),
        name: (r[3] || "").trim(),
        level: (r[4] || "").trim(),
        start: fmtTime(r[5]),
        end: fmtTime(r[6]),
        code: (r[7] || "").trim(),
      }))
      .filter((e) => e.dateKey === today || e.dateKey === tomorrow);

    console.log("✅ matches for today/tomorrow:", { today, tomorrow, count: entries.length });

    // Header row
    const header = document.createElement("tr");
    header.innerHTML = `
      <th>Day</th>
      <th>Area</th>
      <th>Name</th>
      <th>Level</th>
      <th>Shift</th>
      <th>Code</th>
    `;
    table.appendChild(header);

    if (!entries.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="6">No schedule posted for Today/Tomorrow</td>`;
      table.appendChild(tr);
      return;
    }

    entries.forEach((e) => {
      const tr = document.createElement("tr");
      if (e.area === "North") tr.classList.add("row-north");
      if (e.area === "South") tr.classList.add("row-south");

      tr.innerHTML = `
        <td>${e.day}</td>
        <td>${e.area}</td>
        <td>${e.name}</td>
        <td>${e.level}</td>
        <td>${e.start}${e.end ? "–" + e.end : ""}</td>
        <td>${e.code}</td>
      `;
      table.appendChild(tr);
    });
  } catch (e) {
    console.warn("❌ loadSchedule failed:", e);
    const table = document.getElementById("schedule-table");
    if (table) {
      table.innerHTML = `<tr><td colspan="6">Schedule unavailable</td></tr>`;
    }
  }
}

// ===============================
// Init + refresh
// ===============================
function refreshAll() {
  loadAnnouncements();
  loadStatus();
  loadSchedule();
}

refreshAll();
setInterval(refreshAll, 5 * 60 * 1000);
