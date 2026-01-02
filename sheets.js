// ===============================
// Google Sheets Admin Integration
// ===============================

// Published CSV URLs
const ANNOUNCEMENTS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSjU3xZI4zsPk0ECZHaFKWKZjdvTdVWk3X4VcYlNh9OV00SHwzuT0TsABo3xzdjJnwo5jci80SJgkhe/pub?output=csv";

const SCHEDULE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vStmTvJPfr46sHRtY3h8aLp40EN_4jD_lX813MEp7aSuKcWYkroNRi-evzAnZCvN8uiUGgWGGiaP50d/pub?output=csv";

const STATUS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRKMYW3E7RImjEQV253Vj7bPtQYUI2HrYUoyh9TeqkrfdaYGqKbGWe83voMA6VGRruLvo-zSPx1_FaH/pub?output=csv";

// -------------------------------
// Debug helpers (shows errors in status bar)
// -------------------------------
function setStatusText(msg) {
  const el = document.getElementById("status-banner");
  if (el) el.textContent = msg;
}

window.addEventListener("error", (e) => {
  // If sheets.js has any runtime error, you’ll SEE it on the screen
  setStatusText(`Sheets error: ${e.message}`);
});

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
      if (row.length > 1 || row[0]) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  if (cell.length || row.length) {
    row.push(cell.trim());
    if (row.length > 1 || row[0]) rows.push(row);
  }

  return rows;
}

async function loadCSV(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  const text = await res.text();
  return parseCSV(text.trim()).slice(1); // drop header row
}

// -------------------------------
// Status banner
// Sheet formats supported:
//   Mode,Message   (uses Message)
//   Message        (uses first column)
// -------------------------------
async function loadStatus() {
  const rows = await loadCSV(STATUS_URL);
  const message = rows?.[0]?.[1] || rows?.[0]?.[0] || "Normal Operations";
  setStatusText(message);
}

// -------------------------------
// Announcements
// Columns: Text,Active (Active supports TRUE/YES/1)
// -------------------------------
async function loadAnnouncements() {
  const list = document.getElementById("announcements-list");
  if (!list) return;

  const rows = await loadCSV(ANNOUNCEMENTS_URL);
  list.innerHTML = "";

  rows.forEach(([text, active]) => {
    const a = String(active || "").trim().toUpperCase();
    const on = a === "TRUE" || a === "YES" || a === "1";
    if (on && text) {
      const li = document.createElement("li");
      li.textContent = text;
      list.appendChild(li);
    }
  });

  if (!list.children.length) {
    list.innerHTML = "<li>No announcements</li>";
  }
}

// -------------------------------
// Schedule (simple list; won’t break anything if sheet changes)
// -------------------------------
async function loadSchedule() {
  const table = document.getElementById("schedule-table");
  if (!table) return;

  const rows = await loadCSV(SCHEDULE_URL);
  table.innerHTML = "";

  // Just render first ~12 non-empty rows (safe mode)
  let shown = 0;
  for (const r of rows) {
    if (shown >= 12) break;
    if (!r.join("").trim()) continue;

    const crew = r[0] || "";
    const unit = r[1] || "";
    const time = r[2] || "";

    table.innerHTML += `<tr><td>${crew}</td><td>${unit}</td><td>${time}</td></tr>`;
    shown++;
  }

  if (!table.children.length) {
    table.innerHTML = `<tr><td colspan="3">No schedule posted</td></tr>`;
  }
}

// -------------------------------
// Refresh loop
// -------------------------------
async function refreshSheets() {
  try {
    await Promise.all([loadStatus(), loadAnnouncements(), loadSchedule()]);
  } catch (e) {
    // If ANY fetch fails, you’ll see it in the status bar
    setStatusText(`Sheets fetch error: ${e.message || e}`);
    console.warn("Sheets refresh failed:", e);
  }
}

window.addEventListener("load", () => {
  // Immediate proof it’s running:
  setStatusText("Sheets loading…");
  refreshSheets();
  setInterval(refreshSheets, 120000); // every 2 minutes
});
