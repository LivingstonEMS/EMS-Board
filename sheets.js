console.log("✅ sheets.js loaded (FINAL LOCKED)");

// Published CSV URLs
const ANNOUNCEMENTS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSjU3xZI4zsPk0ECZHaFKWKZjdvTdVWk3X4VcYlNh9OV00SHwzuT0TsABo3xzdjJnwo5jci80SJgkhe/pub?output=csv";

const SCHEDULE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQYXP1-d_DgHENUnWizMZeEN2jsz9y4z5lmfSmN9ktm0Bwseu52-j2_WYaXaurEVk56RDG9KK6ieQPp/pub?output=csv";

const STATUS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRKMYW3E7RImjEQV253Vj7bPtQYUI2HrYUoyh9TeqkrfdaYGqKbGWe83voMA6VGRruLvo-zSPx1_FaH/pub?output=csv";

/* ---------------- CSV Parser (robust) ---------------- */
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
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }

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
  return all.slice(1); // drop header
}

/* ---------------- Helpers ---------------- */
function pad2(n) { return String(n).padStart(2, "0"); }

function yyyyMmDd(d) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function normArea(area) {
  const a = (area || "").trim().toLowerCase();
  if (a.startsWith("n")) return "North";
  if (a.startsWith("s")) return "South";
  return (area || "").trim();
}

function fmtTime(t) {
  if (!t) return "";
  const s = String(t).trim();
  const parts = s.split(":");
  if (parts.length < 2) return s;
  return `${pad2(parts[0])}:${pad2(parts[1])}`;
}

/* 🔥 THE FIX: handle ISO dates, timestamps, BOM, and SERIAL dates */
function cleanDateCell(v) {
  let raw = String(v ?? "").trim();
  if (!raw) return "";

  raw = raw.replace(/\uFEFF/g, "").trim(); // remove BOM / hidden chars

  // ISO date or ISO with time
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  // Serial date number (Sheets/Excel)
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (!isNaN(serial) && serial > 20000 && serial < 90000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(excelEpoch.getTime() + serial * 86400000);
      return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
    }
  }

  // M/D/YYYY
  const mdY = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdY) {
    let m = Number(mdY[1]);
    let d = Number(mdY[2]);
    let y = Number(mdY[3]);
    if (y < 100) y = 2000 + y;
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  // last resort parse
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return yyyyMmDd(parsed);

  return raw;
}

/* ---------------- Announcements ---------------- */
function looksActive(v) {
  const a = String(v || "").trim().toUpperCase();
  return a === "TRUE" || a === "YES" || a === "1" || a === "Y" || a === "ON";
}

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

      // allow either [Text, Active] or [Active, Text]
      let text = c0;
      let activeVal = c1;

      if (looksActive(c0) && c1) {
        activeVal = c0;
        text = c1;
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
    console.warn("📣 Announcements failed:", e);
  }
}

/* ---------------- Status banner ---------------- */
async function loadStatus() {
  try {
    const rows = await loadCSV(STATUS_URL);
    console.log("🧾 status rows sample:", rows.slice(0, 5));

    // supports either [Message] or [Label, Message]
    const first = rows?.[0] || [];
    const msg = (first[1] || first[0] || "Normal Operations").trim();

    const banner = document.getElementById("status-banner");
    if (banner) banner.textContent = msg;
  } catch (e) {
    console.warn("🧾 Status failed:", e);
  }
}

/* ---------------- Schedule (Today + Tomorrow) ---------------- */
async function loadSchedule() {
  try {
    const rows = await loadCSV(SCHEDULE_URL);
    console.log("📅 schedule rows sample:", rows.slice(0, 5));

    const table = document.getElementById("schedule-table");
    if (!table) return;
    table.innerHTML = "";

    const today = new Date();
    const tomorrow = new Date(Date.now() + 86400000);
    const todayKey = yyyyMmDd(today);
    const tomorrowKey = yyyyMmDd(tomorrow);

    const entries = rows.map((r) => {
      // 🔥 FIX: rebuild columns if name contains commas
      let cells = [...r];

      // Ensure we end with exactly 8 columns
      // Date, Day, Area, Name, Level, Start, End, Code
      if (cells.length > 8) {
        const date = cells[0];
        const day = cells[1];
        const area = cells[2];

        // Level is always ALS or BLS → find it
        const levelIndex = cells.findIndex(c =>
          c === "ALS" || c === "BLS"
        );

        const name = cells.slice(3, levelIndex).join(", ").trim();
        const level = cells[levelIndex];
        const start = cells[levelIndex + 1];
        const end = cells[levelIndex + 2];
        const code = cells[levelIndex + 3] || "";

        cells = [date, day, area, name, level, start, end, code];
      }

      return {
        date: cleanDateCell(cells[0]),
        day: (cells[1] || "").trim(),
        area: normArea(cells[2]),
        name: (cells[3] || "").trim(),
        level: (cells[4] || "").trim(),
        start: fmtTime(cells[5]),
        end: fmtTime(cells[6]),
        code: (cells[7] || "").trim()
      };
    });

    const matches = entries.filter(e =>
      e.date === todayKey || e.date === tomorrowKey
    );

    console.log("✅ matches for today/tomorrow:", {
      todayKey,
      tomorrowKey,
      count: matches.length
    });

    // Header
    const header = document.createElement("tr");
    header.innerHTML = `
      <th>Date</th><th>Day</th><th>Area</th>
      <th>Name</th><th>Level</th><th>Start</th><th>End</th>
    `;
    table.appendChild(header);

    if (!matches.length) {
      table.innerHTML += `<tr><td colspan="7">No schedule found.</td></tr>`;
      return;
    }

    matches.forEach(e => {
      const tr = document.createElement("tr");
      tr.className =
        e.area === "North" ? "row-north" :
        e.area === "South" ? "row-south" : "";

      tr.innerHTML = `
        <td>${e.date}</td>
        <td>${e.day}</td>
        <td>${e.area}</td>
        <td>${e.name}</td>
        <td>${e.level}</td>
        <td>${e.start}</td>
        <td>${e.end}</td>
      `;
      table.appendChild(tr);
    });

  } catch (e) {
    console.error("📅 Schedule load failed:", e);
  }
}

/* ---------------- Run + refresh ---------------- */
loadAnnouncements();
loadStatus();
loadSchedule();

setInterval(loadAnnouncements, 5 * 60 * 1000);
setInterval(loadStatus, 2 * 60 * 1000);
setInterval(loadSchedule, 2 * 60 * 1000);
