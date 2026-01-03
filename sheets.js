console.log("✅ sheets.js loaded (FINAL LOCKED)");

// ===============================
// Published CSV URLs
// ===============================
const ANNOUNCEMENTS_URL =
  https://docs.google.com/spreadsheets/d/e/2PACX-1vSjU3xZI4zsPk0ECZHaFKWKZjdvTdVWk3X4VcYlNh9OV00SHwzuT0TsABo3xzdjJnwo5jci80SJgkhe/pub?output=csv;

const SCHEDULE_URL =
  https://docs.google.com/spreadsheets/d/e/2PACX-1vQYXP1-d_DgHENUnWizMZeEN2jsz9y4z5lmfSmN9ktm0Bwseu52-j2_WYaXaurEVk56RDG9KK6ieQPp/pub?output=csv;

const STATUS_URL =
  https://docs.google.com/spreadsheets/d/e/2PACX-1vRKMYW3E7RImjEQV253Vj7bPtQYUI2HrYUoyh9TeqkrfdaYGqKbGWe83voMA6VGRruLvo-zSPx1_FaH/pub?output=csv;

// ===============================
// Robust CSV parser (handles quoted commas)
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
      row.push(cell);
      cell = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => String(c).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }

  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((c) => String(c).trim() !== "")) rows.push(row);
  }

  return rows;
}

async function fetchCSV(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const text = await res.text();

  // If Google returns HTML, you're using the wrong link or not published
  if (text.trim().startsWith("<!DOCTYPE") || text.includes("<html")) {
    throw new Error("Got HTML instead of CSV (check Publish to Web + output=csv link)");
  }

  return parseCSV(text.trim());
}

function looksActive(v) {
  const a = String(v || "").trim().toUpperCase();
  return a === "TRUE" || a === "YES" || a === "1" || a === "Y" || a === "ON";
}

function yyyyMmDd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function cleanDateCell(raw) {
  // Handles: "2026-01-02" or "2026-01-02 00:00:00" or Date-like strings
  const s = String(raw || "").trim();
  if (!s) return "";
  if (s.includes("T")) return s.slice(0, 10);
  if (s.includes(" ")) return s.split(" ")[0];
  return s.slice(0, 10);
}

function normArea(area) {
  const a = String(area || "").trim().toLowerCase();
  if (a.startsWith("n")) return "North";
  if (a.startsWith("s")) return "South";
  return String(area || "").trim();
}

function fmtTime(t) {
  if (!t) return "";
  const str = String(t).trim();

  // If it's already like 07:30
  if (/^\d{1,2}:\d{2}$/.test(str)) {
    const [hh, mm] = str.split(":");
    return `${String(hh).padStart(2, "0")}:${mm}`;
  }

  // Otherwise just return it
  return str;
}

// ===============================
// STATUS
// ===============================
async function loadStatus() {
  const banner = document.getElementById("status-banner");
  if (!banner) return;

  try {
    banner.textContent = "Loading status…";

    const all = await fetchCSV(STATUS_URL);
    // expect header row then data
    const rows = all.slice(1);

    console.log("🧾 status rows sample:", rows.slice(0, 2));

    // Common patterns:
    // Column 0 = Label, Column 1 = Message
    // We'll take first data row, column 1 if exists
    const message = rows?.[0]?.[1] || rows?.[0]?.[0] || "Normal Operations";
    banner.textContent = String(message).trim() || "Normal Operations";
  } catch (err) {
    console.warn("🧾 loadStatus failed:", err);
    banner.textContent = `Status unavailable (${err.message})`;
  }
}

// ===============================
// ANNOUNCEMENTS (FIXED)
// Sheet must have header: Active,text
// Example:
// Active,text
// TRUE,February Availability due by January 15th
// ===============================
async function loadAnnouncements() {
  const list = document.getElementById("announcements-list");
  if (!list) {
    console.warn("📣 announcements-list element not found");
    return;
  }

  list.innerHTML = "<li>Loading announcements…</li>";

  try {
    const all = await fetchCSV(ANNOUNCEMENTS_URL);

    console.log("📣 announcements ALL rows:", all);

    if (!all.length) throw new Error("CSV empty");

    const header = all[0].map((h) => String(h).trim().toLowerCase());
    const activeIdx = header.indexOf("active");
    const textIdx = header.indexOf("text");

    if (activeIdx === -1 || textIdx === -1) {
      throw new Error(`Missing header columns. Found: ${header.join(", ")}`);
    }

    const rows = all.slice(1);
    console.log("📣 announcements rows sample:", rows.slice(0, 5));

    list.innerHTML = "";
    let added = 0;

    rows.forEach((r) => {
      const activeVal = r[activeIdx];
      const msg = String(r[textIdx] ?? "").trim();

      if (looksActive(activeVal) && msg) {
        const li = document.createElement("li");
        li.textContent = msg;
        list.appendChild(li);
        added++;
      }
    });

    if (!added) list.innerHTML = "<li>No announcements</li>";
  } catch (err) {
    console.warn("📣 loadAnnouncements failed:", err);
    list.innerHTML = `<li>Announcements unavailable (${err.message})</li>`;
  }
}

// ===============================
// SCHEDULE (Today + Tomorrow)
// Expected columns:
// Date | Day | Area | Name | Level | Shift Start | Shift End | Code
// ===============================
async function loadSchedule() {
  const table = document.getElementById("schedule-table");
  if (!table) return;

  table.innerHTML = "<tr><td>Loading schedule…</td></tr>";

  try {
    const all = await fetchCSV(SCHEDULE_URL);
    const rows = all.slice(1);

    console.log("📅 schedule rows sample:", rows.slice(0, 5));
    console.log(
      "📅 schedule date cells (raw → cleaned):",
      rows.slice(0, 10).map((r) => [r[0], cleanDateCell(r[0])])
    );

    const todayKey = yyyyMmDd(new Date());
    const tomorrowKey = yyyyMmDd(new Date(Date.now() + 86400000));

    const entries = rows
      .map((r) => ({
        date: cleanDateCell(r[0]),
        day: String(r[1] || "").trim(),
        area: normArea(r[2]),
        name: String(r[3] || "").trim(),
        level: String(r[4] || "").trim(),
        start: fmtTime(r[5]),
        end: fmtTime(r[6]),
        code: String(r[7] || "").trim()
      }))
      .filter((e) => e.date === todayKey || e.date === tomorrowKey);

    console.log("✅ matches for today/tomorrow:", {
      todayKey,
      tomorrowKey,
      count: entries.length
    });

    if (!entries.length) {
      table.innerHTML = "<tr><td>No schedule for today/tomorrow</td></tr>";
      return;
    }

    // Build simple table rows
    table.innerHTML = "";
    entries.forEach((e) => {
      const tr = document.createElement("tr");
      tr.className = e.area === "North" ? "row-north" : e.area === "South" ? "row-south" : "";

      tr.innerHTML = `
        <td>${e.date}</td>
        <td>${e.day}</td>
        <td>${e.area}</td>
        <td>${e.name}</td>
        <td>${e.level}</td>
        <td>${e.start}</td>
        <td>${e.end}</td>
        <td>${e.code || ""}</td>
      `;

      table.appendChild(tr);
    });
  } catch (err) {
    console.warn("📅 loadSchedule failed:", err);
    table.innerHTML = `<tr><td>Schedule unavailable (${err.message})</td></tr>`;
  }
}

// ===============================
// Boot
// ===============================
loadStatus();
loadAnnouncements();
loadSchedule();

// refresh loops
setInterval(loadStatus, 60 * 1000);
setInterval(loadAnnouncements, 60 * 1000);
setInterval(loadSchedule, 5 * 60 * 1000);
