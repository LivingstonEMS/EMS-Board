console.log("✅ sheets.js loaded");

/**
 * ✅ IMPORTANT:
 * These URLs must be the *published CSV* URLs (output=csv).
 * Example:
 * https://docs.google.com/spreadsheets/d/e/.../pub?gid=0&single=true&output=csv
 */
const STATUS_URL = window.STATUS_URL || ""; // optional
const ANNOUNCEMENTS_URL = window.ANNOUNCEMENTS_URL || "";
const SCHEDULE_URL = window.SCHEDULE_URL || "";

// ---------- CSV HELPERS (handles quoted CSV properly) ----------
function parseCSV(text) {
  // Robust CSV parse with quotes, commas, newlines
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        // escaped quote
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === ",") {
      row.push(cur);
      cur = "";
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      // handle CRLF
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      cur = "";
      // avoid adding totally empty trailing row
      const isEmpty = row.every((c) => String(c || "").trim() === "");
      if (!isEmpty) rows.push(row);
      row = [];
      continue;
    }

    cur += ch;
  }

  // last cell
  row.push(cur);
  const isEmpty = row.every((c) => String(c || "").trim() === "");
  if (!isEmpty) rows.push(row);

  // trim cells
  return rows.map((r) => r.map((c) => String(c ?? "").trim()));
}

async function loadCSV(url) {
  if (!url) return [];
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV HTTP ${res.status}`);
  const text = await res.text();
  return parseCSV(text);
}

// If Google Sheets exported a single cell that contains the entire comma row,
// split it safely into columns.
function normalizeRowMaybeSingleCell(row, expectedCols = 0) {
  if (!row || !row.length) return row;

  // Single-cell but looks like CSV data inside it
  if (row.length === 1 && row[0].includes(",")) {
    // Split on commas (this is safe here because we already parsed CSV quoting;
    // if it's one cell, the commas are literally part of that cell text)
    const parts = row[0].split(",").map((x) => String(x || "").trim());
    if (expectedCols && parts.length >= expectedCols) return parts;
    return parts;
  }

  return row;
}

function cleanDateKey(v) {
  // Remove stray quotes and keep YYYY-MM-DD if present
  const s = String(v || "").trim().replace(/^"+|"+$/g, "");
  // If contains time or extra, grab date part
  const m = s.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : s;
}

function todayTomorrowKeys() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const toKey = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  return { todayKey: toKey(today), tomorrowKey: toKey(tomorrow) };
}

// ---------- STATUS ----------
async function loadStatus() {
  if (!STATUS_URL) return;

  try {
    const rows = await loadCSV(STATUS_URL);
    console.log("🧾 status rows sample:", rows.slice(0, 1));

    const el = document.getElementById("status-text");
    if (!el) return;

    // Expect either:
    // [StatusText] OR [StatusText, Active] etc — keep it simple:
    const first = rows.find((r) => r.some((c) => String(c).trim() !== ""));
    if (!first) return;

    const text = (first[0] || "").trim();
    el.textContent = text || "NORMAL";
  } catch (e) {
    console.warn("🧾 status failed:", e);
  }
}

// ---------- ANNOUNCEMENTS ----------
async function loadAnnouncements() {
  if (!ANNOUNCEMENTS_URL) return;

  try {
    const rowsRaw = await loadCSV(ANNOUNCEMENTS_URL);
    console.log("📣 announcements rows sample:", rowsRaw.slice(0, 3));

    const list = document.getElementById("announcements-list");
    if (!list) return;

    list.innerHTML = "";

    const looksActive = (v) => {
      const a = String(v || "").trim().toUpperCase();
      return a === "TRUE" || a === "YES" || a === "1" || a === "Y" || a === "ON";
    };

    rowsRaw.forEach((r0) => {
      const r = normalizeRowMaybeSingleCell(r0, 2);
      const c0 = (r[0] || "").trim().replace(/^"+|"+$/g, "");
      const c1 = (r[1] || "").trim().replace(/^"+|"+$/g, "");

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
    console.warn("📣 announcements failed:", e);
    const list = document.getElementById("announcements-list");
    if (list) {
      list.innerHTML = `<li>No announcements</li>`;
    }
  }
}

// ---------- SCHEDULE ----------
async function loadSchedule() {
  if (!SCHEDULE_URL) return;

  try {
    const rowsRaw = await loadCSV(SCHEDULE_URL);

    // Drop totally empty rows
    const rowsClean = rowsRaw.filter((r) =>
      r.some((c) => String(c || "").trim() !== "")
    );

    // Normalize possible one-cell rows
    const rows = rowsClean.map((r) => normalizeRowMaybeSingleCell(r, 7));

    console.log("📅 schedule rows sample:", rows.slice(0, 5));

    // If first row is header, detect it
    const header = rows[0] || [];
    const headerLooksLike =
      header.join(" ").toLowerCase().includes("date") ||
      header.join(" ").toLowerCase().includes("shift");

    const data = headerLooksLike ? rows.slice(1) : rows;

    const { todayKey, tomorrowKey } = todayTomorrowKeys();

    // Indices based on your sheet:
    // Date | Day | Area | Name | Level | Shift Start | Shift End | Code
    const IDX = {
      date: 0,
      day: 1,
      area: 2,
      name: 3,
      level: 4,
      start: 5,
      end: 6,
      code: 7
    };

    // Build matches for today + tomorrow
    const matches = [];
    const debugDates = [];

    data.forEach((r) => {
      const dateKey = cleanDateKey(r[IDX.date]);
      if (debugDates.length < 10) debugDates.push([r[IDX.date], dateKey]);

      if (dateKey === todayKey || dateKey === tomorrowKey) {
        matches.push({
          dateKey,
          day: (r[IDX.day] || "").trim(),
          area: (r[IDX.area] || "").trim(),
          name: (r[IDX.name] || "").trim(),
          level: (r[IDX.level] || "").trim(),
          start: (r[IDX.start] || "").trim(),
          end: (r[IDX.end] || "").trim(),
          code: (r[IDX.code] || "").trim()
        });
      }
    });

    console.log("📅 schedule date cells (raw → cleaned):", debugDates);
    console.log("✅ matches for today/tomorrow:", {
      todayKey,
      tomorrowKey,
      count: matches.length
    });

    const tbody = document.getElementById("schedule-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!matches.length) {
      // Fallback message row
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="6" style="padding:12px; opacity:.85;">No schedule posted for Today/Tomorrow</td>`;
      tbody.appendChild(tr);
      return;
    }

    // Sort: today first, then tomorrow; within date keep North then South
    const areaRank = (a) => (String(a).toLowerCase() === "north" ? 0 : 1);

    matches.sort((a, b) => {
      if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
      return areaRank(a.area) - areaRank(b.area);
    });

    matches.forEach((m) => {
      const tr = document.createElement("tr");

      const areaLower = m.area.toLowerCase();
      if (areaLower === "north") tr.classList.add("area-north");
      if (areaLower === "south") tr.classList.add("area-south");

      // Shift display: show start-end like 07:30–19:30
      const shift = m.start && m.end ? `${m.start}–${m.end}` : (m.start || m.end || "");

      tr.innerHTML = `
        <td>${m.day || ""}</td>
        <td>${m.area || ""}</td>
        <td>${m.name || ""}</td>
        <td>${m.level || ""}</td>
        <td>${shift}</td>
        <td>${m.code || ""}</td>
      `;

      tbody.appendChild(tr);
    });
  } catch (e) {
    console.warn("📅 schedule failed:", e);
    const tbody = document.getElementById("schedule-body");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding:12px; opacity:.85;">Schedule unavailable</td></tr>`;
    }
  }
}

// ---------- INIT ----------
loadStatus();
loadAnnouncements();
loadSchedule();

// Refresh schedule + announcements every 10 min
setInterval(() => {
  loadAnnouncements();
  loadSchedule();
}, 10 * 60 * 1000);
