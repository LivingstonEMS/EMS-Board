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
    rows.push(row);
  }

  return rows;
}

async function loadCSV(url) {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  return parseCSV(text).slice(1); // drop header
}

// ===============================
// Helpers
// ===============================
function todayKey(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = String(t).split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

// ===============================
// Announcements
// ===============================
async function loadAnnouncements() {
  const rows = await loadCSV(ANNOUNCEMENTS_URL);
  const list = document.getElementById("announcements-list");
  if (!list) return;

  list.innerHTML = "";

  rows.forEach(([a, b]) => {
    const text = a?.toString().trim();
    const active = b?.toString().trim().toUpperCase();
    if (text && ["TRUE", "YES", "1", "Y", "ON"].includes(active)) {
      const li = document.createElement("li");
      li.textContent = text;
      list.appendChild(li);
    }
  });

  if (!list.children.length) {
    list.innerHTML = "<li>No announcements</li>";
  }
}

// ===============================
// Status Banner
// ===============================
async function loadStatus() {
  const rows = await loadCSV(STATUS_URL);
  const banner = document.getElementById("status-banner");
  if (!banner) return;

  banner.textContent = rows?.[0]?.[1] || "Normal Operations";
}

// ===============================
// Schedule (THIS IS THE FIX)
// ===============================
async function loadSchedule() {
  const rows = await loadCSV(SCHEDULE_URL);
  const table = document.getElementById("schedule-table");
  if (!table) return;

  table.innerHTML = "";

  const today = todayKey(0);
  const tomorrow = todayKey(1);

  const matches = rows.filter((r) => {
    const date = r[0]?.trim();
    return date === today || date === tomorrow;
  });

  if (!matches.length) {
    table.innerHTML =
      "<tr><td colspan='6'>No schedule posted for Today/Tomorrow</td></tr>";
    return;
  }

  matches.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r[1]}</td>
      <td>${r[2]}</td>
      <td>${r[3]}</td>
      <td>${r[4]}</td>
      <td>${fmtTime(r[5])}–${fmtTime(r[6])}</td>
      <td>${r[7] || ""}</td>
    `;
    table.appendChild(tr);
  });
}

// ===============================
// Init
// ===============================
loadAnnouncements();
loadStatus();
loadSchedule();

// Refresh every 5 min
setInterval(() => {
  loadAnnouncements();
  loadStatus();
  loadSchedule();
}, 5 * 60 * 1000);
