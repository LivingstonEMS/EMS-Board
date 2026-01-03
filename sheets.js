console.log("✅ sheets.js loaded");

/* ===============================
   Google Sheets Admin Integration
   =============================== */

const ANNOUNCEMENTS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSjU3xZI4zsPk0ECZHaFKWKZjdvTdVWk3X4VcYlNh9OV00SHwzuT0TsABo3xzdjJnwo5jci80SJgkhe/pub?output=csv";

const SCHEDULE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQYXP1-d_DgHENUnWizMZeEN2jsz9y4z5lmfSmN9ktm0Bwseu52-j2_WYaXaurEVk56RDG9KK6ieQPp/pub?output=csv";

const STATUS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRKMYW3E7RImjEQV253Vj7bPtQYUI2HrYUoyh9TeqkrfdaYGqKbGWe83voMA6VGRruLvo-zSPx1_FaH/pub?output=csv";

/* -------------------------------
   CSV Parser (handles quoted commas)
--------------------------------- */
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
      cell = "";

      if (row.length > 1 || (row[0] || "").trim() !== "") rows.push(row);
      row = [];
      continue;
    }

    cell += ch;
  }

  if (cell.length || row.length) {
    row.push(cell.trim());
    if (row.length > 1 || (row[0] || "").trim() !== "") rows.push(row);
  }

  return rows;
}

function normalizeRow(r) {
  return (r || []).map((x) => String(x ?? "").trim());
}

async function loadCSV(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV HTTP ${res.status} for ${url}`);
  const text = await res.text();

  const all = parseCSV(text.trim()).map(normalizeRow);

  return all.slice(1); // drop header
}

/* -------------------------------
   Helpers
--------------------------------- */

// ✅ LOCAL date key
function yyyyMmDdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysLocal(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

// ✅ Extract YYYY-MM-DD from messy input like "2026-01-02 00:00:00" or BOM
function cleanDate(raw) {
  const s = String(raw || "").replace(/^\uFEFF/, "").trim();
  const m = s.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : s;
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

/* ---------------- Announcements ---------------- */
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
    console.warn("📣 announcements failed:", e);
  }
}

/* ---------------- Status banner ---------------- */
async function loadStatus() {
  try {
    const rows = await loadCSV(STATUS_URL);
    console.log("🧾 status rows sample:", rows.slice(0, 5));

    const banner = document.getElementById("status-banner");
    if (!banner) return;

    const r0 = rows[0] || [];
    const status = (r0[0] || "").trim();
    const message = (r0[1] || r0[0] || "Normal Operations").trim();

    banner.textContent = message;
    banner.dataset.status = status.toLowerCase();
  } catch (e) {
    console.warn("🧾 status failed:", e);
  }
}

/* ---------------- Schedule (Today + Tomorrow) ---------------- */
async function loadSchedule() {
  try {
    const rows = await loadCSV(SCHEDULE_URL);
    console.log("📅 schedule rows sample:", rows.slice(0, 5));

    // 🔎 Debug: show the first few raw date cells
    console.log(
      "📅 schedule date cells (raw → cleaned):",
      rows.slice(0, 10).map((r) => [r[0], cleanDate(r[0])])
    );

    const table = document.getElementById("schedule-table");
    if (!table) return;

    table.innerHTML = "";

    const now = new Date();
    const todayKey = yyyyMmDdLocal(now);
    const tomorrowKey = yyyyMmDdLocal(addDaysLocal(now, 1));

    const entries = rows
      .map((r) => ({
        date: cleanDate(r[0]),
        day: (r[1] || "").trim(),
        area: normArea(r[2]),
        name: (r[3] || "").trim(),
        level: (r[4] || "").trim(),
        start: fmtTime(r[5]),
        end: fmtTime(r[6]),
        code: (r[7] || "").trim()
      }))
      .filter((e) => e.date === todayKey || e.date === tomorrowKey);

    console.log("✅ matches for today/tomorrow:", {
      todayKey,
      tomorrowKey,
      count: entries.length
    });

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

    entries.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.area !== b.area) return a.area.localeCompare(b.area);
      return (a.start || "").localeCompare(b.start || "");
    });

    entries.forEach((e) => {
      const tr = document.createElement("tr");

      if (e.area === "North") tr.classList.add("row-north");
      if (e.area === "South") tr.classList.add("row-south");

      const shift = e.start && e.end ? `${e.start}–${e.end}` : "";

      tr.innerHTML = `
        <td>${e.day || ""}</td>
        <td>${e.area || ""}</td>
        <td>${e.name || ""}</td>
        <td>${e.level || ""}</td>
        <td>${shift}</td>
        <td>${e.code || ""}</td>
      `;

      table.appendChild(tr);
    });
  } catch (e) {
    console.warn("📅 schedule failed:", e);
  }
}

/* ---------------- Boot ---------------- */
async function refreshAll() {
  await Promise.allSettled([loadStatus(), loadAnnouncements(), loadSchedule()]);
}

refreshAll();
setInterval(refreshAll, 60 * 1000);
