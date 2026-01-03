// ===============================
// sheets.js (FINAL LOCKED)
// Livingston County EMS Board
// ===============================

console.log("✅ sheets.js loaded (FINAL LOCKED)");

// Paste your "Publish to web" CSV URLs here
const ANNOUNCEMENTS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSjU3xZI4zsPk0ECZHaFKWKZjdvTdVWk3X4VcYlNh9OV00SHwzuT0TsABo3xzdjJnwo5jci80SJgkhe/pub?output=csv";

const SCHEDULE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQYXP1-d_DgHENUnWizMZeEN2jsz9y4z5lmfSmN9ktm0Bwseu52-j2_WYaXaurEVk56RDG9KK6ieQPp/pub?output=csv";

const STATUS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRKMYW3E7RImjEQV253Vj7bPtQYUI2HrYUoyh9TeqkrfdaYGqKbGWe83voMA6VGRruLvo-zSPx1_FaH/pub?output=csv";

// -------------------------------
// Robust CSV Parser (quoted commas)
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
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  const all = parseCSV(text.trim());
  // Drop header row safely
  return all.length ? all.slice(1) : [];
}

// -------------------------------
// Helpers
// -------------------------------
function pad2(n) {
  return String(n).padStart(2, "0");
}

function yyyyMmDd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function prettyDate(d) {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "numeric", day: "numeric" });
}

function normArea(area) {
  const a = (area || "").trim().toLowerCase();
  if (a.startsWith("n")) return "North";
  if (a.startsWith("s")) return "South";
  return area ? area.trim() : "";
}

function fmtTime(t) {
  if (!t) return "";
  const s = String(t).trim();
  // if it's already HH:MM
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [h, m] = s.split(":");
    return `${pad2(h)}:${pad2(m)}`;
  }
  return s;
}

// 🔥 Key fix: normalize dates coming from Sheets
function cleanDateCell(v) {
  const raw = String(v || "").trim();
  if (!raw) return "";

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // Common US formats: M/D/YYYY or M/D/YY
  const mdY = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdY) {
    let m = Number(mdY[1]);
    let d = Number(mdY[2]);
    let y = Number(mdY[3]);
    if (y < 100) y = 2000 + y;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${pad2(m)}-${pad2(d)}`;
    }
  }

  // Try Date.parse fallback
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return yyyyMmDd(parsed);

  // Give up (return raw so debug can show it)
  return raw;
}

function looksActive(v) {
  const a = String(v || "").trim().toUpperCase();
  return a === "TRUE" || a === "YES" || a === "1" || a === "Y" || a === "ON";
}

// -------------------------------
// Announcements
// -------------------------------
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

      // allow [Text, Active] or [Active, Text]
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

// -------------------------------
// Status Banner
// -------------------------------
async function loadStatus() {
  try {
    const rows = await loadCSV(STATUS_URL);
    console.log("🧾 status rows sample:", rows.slice(0, 5));

    // Accept either:
    // [Message] OR [Label, Message]
    const first = rows?.[0] || [];
    const message = first.length >= 2 ? first[1] : (first[0] || "Normal Operations");

    const el = document.getElementById("status-banner");
    if (el) el.textContent = message || "Normal Operations";
  } catch (e) {
    console.warn("🧾 status failed:", e);
  }
}

// -------------------------------
// Schedule (Today + Tomorrow)
// -------------------------------
async function loadSchedule() {
  try {
    const rows = await loadCSV(SCHEDULE_URL);
    console.log("📅 schedule rows sample:", rows.slice(0, 5));

    const table = document.getElementById("schedule-table");
    if (!table) return;

    table.innerHTML = "";

    const today = new Date();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const todayKey = yyyyMmDd(today);
    const tomorrowKey = yyyyMmDd(tomorrow);

    // Build entries
    const entries = rows
      .map((r) => {
        const dateRaw = r[0] || "";
        const date = cleanDateCell(dateRaw);

        return {
          date,
          day: (r[1] || "").trim(),
          area: normArea(r[2]),
          name: (r[3] || "").trim(),
          level: (r[4] || "").trim(),
          start: fmtTime(r[5]),
          end: fmtTime(r[6]),
          code: (r[7] || "").trim(),
          _dateRaw: dateRaw
        };
      });

    console.log(
      "📅 schedule date cells (raw → cleaned):",
      entries.slice(0, 10).map((e) => [e._dateRaw, e.date])
    );

    const filtered = entries.filter((e) => e.date === todayKey || e.date === tomorrowKey);

    console.log("✅ matches for today/tomorrow:", {
      todayKey,
      tomorrowKey,
      count: filtered.length
    });

    // Table header
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    ["Date", "Area", "Name", "Level", "Start", "End"].forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    if (!filtered.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
      td.textContent = "No schedule found for Today/Tomorrow";
      td.style.padding = "14px";
      tr.appendChild(td);
      tbody.appendChild(tr);
      table.appendChild(tbody);
      return;
    }

    // Sort: date then area
    filtered.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.area.localeCompare(b.area);
    });

    // Add a date divider row
    let lastDate = "";
    filtered.forEach((e) => {
      if (e.date !== lastDate) {
        lastDate = e.date;
        const divider = document.createElement("tr");
        divider.className = "row-divider";
        const td = document.createElement("td");
        td.colSpan = 6;
        const d = new Date(e.date + "T00:00:00");
        td.textContent = `${prettyDate(d)} (${e.date})`;
        td.style.fontWeight = "800";
        td.style.padding = "12px";
        td.style.background = "rgba(255,255,255,0.06)";
        divider.appendChild(td);
        tbody.appendChild(divider);
      }

      const tr = document.createElement("tr");

      // North blue / South gray (matches your CSS)
      if (e.area.toLowerCase().startsWith("north")) tr.classList.add("row-north");
      if (e.area.toLowerCase().startsWith("south")) tr.classList.add("row-south");

      const cells = [
        e.date,
        e.area,
        e.name,
        e.level,
        e.start,
        e.end
      ];

      cells.forEach((c) => {
        const td = document.createElement("td");
        td.textContent = c || "";
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
  } catch (e) {
    console.warn("📅 schedule failed:", e);
  }
}

// -------------------------------
// Boot + Refresh
// -------------------------------
async function loadAllSheets() {
  await Promise.allSettled([loadAnnouncements(), loadStatus(), loadSchedule()]);
}

loadAllSheets();
setInterval(loadAllSheets, 2 * 60 * 1000); // refresh every 2 min
