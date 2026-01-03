console.log("✅ sheets.js loaded");

// Published CSV URLs
const ANNOUNCEMENTS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSjU3xZI4zsPk0ECZHaFKWKZjdvTdVWk3X4VcYlNh9OV00SHwzuT0TsABo3xzdjJnwo5jci80SJgkhe/pub?output=csv";

const SCHEDULE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQYXP1-d_DgHENUnWizMZeEN2jsz9y4z5lmfSmN9ktm0Bwseu52-j2_WYaXaurEVk56RDG9KK6ieQPp/pub?output=csv";

const STATUS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRKMYW3E7RImjEQV253Vj7bPtQYUI2HrYUoyh9TeqkrfdaYGqKbGWe83voMA6VGRruLvo-zSPx1_FaH/pub?output=csv";

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
      cell += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      rows.push(row.map((c) => (c ?? "").trim()));
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row.map((c) => (c ?? "").trim()));
  }

  // remove completely empty rows
  return rows.filter((r) => r.some((c) => c !== ""));
}

async function loadCSV(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV HTTP ${res.status}`);
  const text = await res.text();
  const all = parseCSV(text.trim());
  return all.slice(1); // drop header row
}

/* ---------------- Status banner ---------------- */
async function loadStatus() {
  const rows = await loadCSV(STATUS_URL);

  // Expected: first data row columns like: Mode, Message
  const message = rows?.[0]?.[1] || rows?.[0]?.[0] || "Normal Operations";
  document.getElementById("status-banner").textContent = message;
}

/* ---------------- Announcements ---------------- */
async function loadAnnouncements() {
  const rows = await loadCSV(ANNOUNCEMENTS_URL);
  const list = document.getElementById("announcements-list");
  if (!list) return;

  list.innerHTML = "";

  const looksActive = (v) => {
    const a = String(v || "").trim().toUpperCase();
    return a === "TRUE" || a === "YES" || a === "1" || a === "Y" || a === "ON";
  };

  console.log("📣 Announcements rows (first 10):", rows.slice(0, 10));

  rows.forEach((r) => {
    const cells = (r || []).map((c) => String(c ?? "").trim());
    if (!cells.some((c) => c)) return;

    const isActive = cells.some(looksActive);

    // text = join all non-active cells
    const text = cells.filter((c) => c && !looksActive(c)).join(" — ").trim();

    if (isActive && text) {
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


/* ---------------- Schedule ---------------- */
async function loadSchedule() {
  const rows = await loadCSV(SCHEDULE_URL);
  const table = document.getElementById("schedule-table");
  table.innerHTML = "";

  if (!rows.length) {
    table.innerHTML = `<tr><td colspan="3">No schedule posted</td></tr>`;
    return;
  }

  // If your sheet has 8 columns: Date | Day | Area | Name | Level | Start | End | Code
  // We'll show: Area/Name/Time
  rows.forEach((r) => {
    const area = r[2] || "";
    const name = r[3] || "";
    const start = r[5] || "";
    const end = r[6] || "";
    const time = start && end ? `${start}-${end}` : (start || end || "");
    table.innerHTML += `<tr><td>${area}</td><td>${name}</td><td>${time}</td></tr>`;
  });
}

/* ---------------- Refresh loop ---------------- */
async function refreshSheets() {
  try {
    await loadStatus();
  } catch (e) {
    console.warn("Status failed:", e);
    // Keep previous status instead of overwriting
  }

  try {
    await loadAnnouncements();
  } catch (e) {
    console.warn("Announcements failed:", e);
  }

  try {
    await loadSchedule();
  } catch (e) {
    console.warn("Schedule failed:", e);
  }
}

refreshSheets();
setInterval(refreshSheets, 120000);
