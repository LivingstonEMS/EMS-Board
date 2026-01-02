// Paste your "Publish to web" CSV URLs here
const ANNOUNCEMENTS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSjU3xZI4zsPk0ECZHaFKWKZjdvTdVWk3X4VcYlNh9OV00SHwzuT0TsABo3xzdjJnwo5jci80SJgkhe/pub?output=csv";
const SCHEDULE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vStmTvJPfr46sHRtY3h8aLp40EN_4jD_lX813MEp7aSuKcWYkroNRi-evzAnZCvN8uiUGgWGGiaP50d/pub?output=csv";
const STATUS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRKMYW3E7RImjEQV253Vj7bPtQYUI2HrYUoyh9TeqkrfdaYGqKbGWe83voMA6VGRruLvo-zSPx1_FaH/pub?output=csv";

/** Robust CSV parser (handles quoted commas) */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      // Escaped quote
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
  const text = await res.text();

  const all = parseCSV(text.trim());
  // drop header row
  return all.slice(1);
}

function yyyyMmDd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function prettyDate(d) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "numeric",
    day: "numeric"
  });
}

function normArea(area) {
  const a = (area || "").trim().toLowerCase();
  if (a.startsWith("n")) return "North";
  if (a.startsWith("s")) return "South";
  return area || "";
}

function fmtTime(t) {
  // Sheet times might be "07:30" or "7:30" — normalize to HH:MM
  if (!t) return "";
  const parts = String(t).trim().split(":");
  if (parts.length < 2) return String(t).trim();
  const hh = String(parts[0]).padStart(2, "0");
  const mm = String(parts[1]).padStart(2, "0");
  return `${hh}:${mm}`;
}

/* ---------------- Announcements ---------------- */
async function loadAnnouncements() {
  const rows = await loadCSV(ANNOUNCEMENTS_URL);
  const list = document.getElementById("announcements-list");
  list.innerHTML = "";

  rows.forEach(([text, active]) => {
    if ((active || "").toUpperCase() === "TRUE" && text) {
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

/* ---------------- Status banner ---------------- */
async function loadStatus() {
  const rows = await loadCSV(STATUS_URL);
  const message = rows?.[0]?.[1] || "Normal Operations";
  document.getElementById("status-banner").textContent = message;
}

/* ---------------- Schedule (Today + Tomorrow) ---------------- */
async function loadSchedule() {
  const rows = await loadCSV(SCHEDULE_URL);

  // Expected columns (in this exact order):
  // Date | Day | Area | Name | Level | Shift Start | Shift End | Code
  //
  // We'll rebuild the slide as a clean two-day board.

  const table = document.getElementById("schedule-table");
  table.innerHTML = "";

  const today = new Date();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
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
      code: (r[7] || "").trim()
    }))
    .filter((e) => e.date === todayKey || e.date === tomorrowKey);

  function groupByDateArea(dateKey
