// ===============================
// Livingston EMS Board - sheets.js
// Loads: Status banner, Announcements, Schedule (Today + Tomorrow)
// ===============================

console.log("✅ sheets.js loaded");

// ---- Published CSV URLs ----
const ANNOUNCEMENTS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSjU3xZI4zsPk0ECZHaFKWKZjdvTdVWk3X4VcYlNh9OV00SHwzuT0TsABo3xzdjJnwo5jci80SJgkhe/pub?output=csv";

const SCHEDULE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vStmTvJPfr46sHRtY3h8aLp40EN_4jD_lX813MEp7aSuKcWYkroNRi-evzAnZCvN8uiUGgWGGiaP50d/pub?output=csv";

const STATUS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRKMYW3E7RImjEQV253Vj7bPtQYUI2HrYUoyh9TeqkrfdaYGqKbGWe83voMA6VGRruLvo-zSPx1_FaH/pub?output=csv";

// -------------------------------
// CSV Parser (handles quoted commas)
// -------------------------------
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    // Escaped quote inside quotes: ""
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
      if (ch === "\r" && next === "\n") i++; // Windows newline
      row.push(cell.trim());
      cell = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      continue;
    }

    cell += ch;
  }

  // last cell
  if (cell.length || row.length) {
    row.push(cell.trim());
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }

  return rows;
}

async function loadCSV(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV HTTP ${res.status}`);
  const text = await res.text();
  const all = parseCSV(text.trim());
  return all.slice(1); // drop header
}

// -------------------------------
// Date helpers (LOCAL TIME FIX ✅)
// -------------------------------
function yyyyMmDd(d) {
  // local date string, not UTC
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function prettyDate(d) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "numeric",
    day: "numeric",
  });
}

function normArea(area) {
  const a = (area || "").trim().toLowerCase();
  if (a.startsWith("n")) return "North";
  if (a.startsWith("s")) return "South";
  return (area || "").trim();
}

function fmtTime(t) {
  if (!t) return "";
  const parts = String(t).trim().split(":");
  if (parts.length < 2) return String(t).trim();
  const hh = String(parts[0]).padStart(2, "0");
  const mm = String(parts[1]).padStart(2, "0");
  return `${hh}:${mm}`;
}

function looksActive(v) {
  const a = String(v || "").trim().toUpperCase();
  return a === "TRUE" || a === "YES" || a === "1" || a === "Y" || a === "ON";
}

// -------------------------------
// Announcements
// Expected sheet columns (either order):
//   Text | Active
//   Active | Text
// -------------------------------
async function loadAnnouncements() {
  const list = document.getElementById("announcements-list");
  if (!list) return;

  try {
    const rows = await loadCSV(ANNOUNCEMENTS_URL);
    list.innerHTML = "";

    rows.forEach((r) => {
      const c0 = (r[0] || "").trim();
      const c1 = (r[1] || "").trim();

      let text = "";
      let activeVal = "";

      // If first column looks like active, swap
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
    console.warn("Announcements failed:", e);
    list.innerHTML = `<li>Announcements unavailable</li>`;
  }
}

// -------------------------------
// Status banner
// Expected first data row: Mode, Message
// -------------------------------
async function loadStatus() {
  const el = document.getElementById("status-banner");
  if (!el) return;

  try {
    const rows = await loadCSV(STATUS_URL);
    const mode = rows?.[0]?.[0] || "NORMAL";
    const message = rows?.[0]?.[1] || "Normal Operations";
    el.textContent = `${mode}, ${message}`;
  } catch (e) {
    console.warn("Status failed:", e);
    el.textContent = "NORMAL, Normal Operations";
  }
}

// -------------------------------
// Schedule (TODAY + TOMORROW)
// Expected columns in this order:
// Date | Day | Area | Name | Level | Shift Start | Shift End | Code
// -------------------------------
async function loadSchedule() {
  const table = document.getElementById("schedule-table");
  if (!table) return;

  try {
    const rows = await loadCSV(SCHEDULE_URL);

    // LOCAL time today/tomorrow ✅
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const todayKey = yyyyMmDd(today);
    const tomorrowKey = yyyyMmDd(tomorrow);

    const entries = rows
      .map((r) => ({
        date: (r[0] || "").trim(),
        day: (r[1] || "").trim(),
        area: normArea(r[2]),
        name: (r[3] || "").trim(),
        level: (r[4] || "").trim(),
        start: fmtTime(r[5]),
        end: fmtTime(r[6]),
        code: (r[7] || "").trim(),
      }))
      .filter((e) => e.date === todayKey || e.date === tomorrowKey);

    table.innerHTML = "";

    // Header row
    table.innerHTML += `
      <tr>
        <th style="text-align:left;">Day</th>
        <th style="text-align:left;">Area</th>
        <th style="text-align:left;">Name</th>
        <th style="text-align:left;">Level</th>
        <th style="text-align:left;">Shift</th>
        <th style="text-align:left;">Code</th>
      </tr>
    `;

    if (!entries.length) {
      table.innerHTML += `<tr><td colspan="6">No schedule posted for Today/Tomorrow</td></tr>`;
      return;
    }

    // Group by date then area (North/South)
    const groups = {};
    for (const e of entries) {
      groups[e.date] ??= { North: [], South: [], Other: [] };
      if (e.area === "North") groups[e.date].North.push(e);
      else if (e.area === "South") groups[e.date].South.push(e);
      else groups[e.date].Other.push(e);
    }

    const dateOrder = [todayKey, tomorrowKey].filter((k) => groups[k]);

    for (const dateKey of dateOrder) {
      const d = new Date(dateKey + "T12:00:00"); // avoid timezone shift
      table.innerHTML += `
        <tr>
          <td colspan="6" style="font-weight:700; padding-top:14px;">
            ${prettyDate(d)}
          </td>
        </tr>
      `;

      const addArea = (label, arr) => {
        if (!arr.length) return;
        table.innerHTML += `
          <tr>
            <td colspan="6" style="opacity:.85; font-weight:700;">
              ${label}
            </td>
          </tr>
        `;
        arr.forEach((e) => {
          const shift = e.start && e.end ? `${e.start}–${e.end}` : "";
          table.innerHTML += `
            <tr>
              <td>${e.day || ""}</td>
              <td>${e.area || ""}</td>
              <td>${e.name || ""}</td>
              <td>${e.level || ""}</td>
              <td>${shift}</td>
              <td>${e.code || ""}</td>
            </tr>
          `;
        });
      };

      addArea("North", groups[dateKey].North);
      addArea("South", groups[dateKey].South);
      addArea("Other", groups[dateKey].Other);
    }
  } catch (e) {
    console.warn("Schedule failed:", e);
    table.innerHTML = `<tr><td colspan="6">Schedule unavailable</td></tr>`;
  }
}

// -------------------------------
// Refresh everything
// -------------------------------
async function refreshSheets() {
  await Promise.allSettled([loadStatus(), loadAnnouncements(), loadSchedule()]);
}

refreshSheets();
setInterval(refreshSheets, 120000); // every 2 minutes
