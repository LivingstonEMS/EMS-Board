const NEWS_FEEDS = [
  "https://www.wpsdlocal6.com/rss/category/news/local-news/",
  "https://feeds.bbci.co.uk/news/world/rss.xml",
  "https://www.ems1.com/rss/",
  "https://www.firehouse.com/rss/"
];


// NWS zone codes (your counties)
const NWS_ZONES = [
  "KY121", // Livingston
  "KY143", // Lyon
  "KY145", // McCracken
  "KY157"  // Marshall
];

// RSS proxy to avoid CORS issues
const PROXY = "https://api.allorigins.win/raw?url=";

async function fetchRSS(url) {
  const res = await fetch(PROXY + encodeURIComponent(url));
  const text = await res.text();
  const xml = new DOMParser().parseFromString(text, "text/xml");
  return [...xml.querySelectorAll("item")].slice(0, 4);
}

function normalizeArea(areaDesc) {
  // NWS areaDesc can be long; shorten a bit
  return (areaDesc || "")
    .replace(/;?\s*and\s*/gi, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function fetchNWSAlerts() {
  let alerts = [];

  for (const zone of NWS_ZONES) {
    try {
      const res = await fetch(`https://api.weather.gov/alerts/active?zone=${zone}`);
      const data = await res.json();

      (data.features || []).forEach((a) => {
        const p = a.properties || {};
        alerts.push({
          event: p.event || "Alert",
          area: normalizeArea(p.areaDesc),
          severity: p.severity || "Unknown"
        });
      });
    } catch (e) {
      console.warn("NWS alert fetch failed:", zone, e);
    }
  }

  // Remove duplicates (same event+area)
  const seen = new Set();
  alerts = alerts.filter((a) => {
    const key = `${a.event}|${a.area}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return alerts;
}

function isTornadoWarning(alert) {
  const e = (alert.event || "").toLowerCase();
  return e.includes("tornado warning") || e.includes("tornado emergency");
}

function showTornadoOverride(areasText) {
  const overlay = document.getElementById("tornado-override");
  const areas = document.getElementById("tornado-areas");
  areas.textContent = areasText || "Your area is under a Tornado Warning.";

  overlay.classList.remove("hidden");

  // Pause slide rotation
  if (typeof window.setRotationPaused === "function") {
    window.setRotationPaused(true);
  }
}

function hideTornadoOverride() {
  const overlay = document.getElementById("tornado-override");
  overlay.classList.add("hidden");

  // Do NOT auto-resume if user manually paused? We will resume.
  // If you want "stay paused until manual resume", tell me and I'll tweak it.
  if (typeof window.setRotationPaused === "function") {
    window.setRotationPaused(false);
  }
}

async function loadTicker() {
  let parts = [];

  // 1) NWS alerts first
  const alerts = await fetchNWSAlerts();

  // Tornado override check
  const tornadoAlerts = alerts.filter(isTornadoWarning);
  if (tornadoAlerts.length) {
    const areaList = tornadoAlerts
      .map((a) => a.area || "Affected area")
      .filter(Boolean)
      .slice(0, 6)
      .join(" • ");

    showTornadoOverride(areaList);
  } else {
    hideTornadoOverride();
  }

  alerts.forEach((a) => {
    const severe = a.severity === "Severe" || a.severity === "Extreme";
    const label = `${a.event} — ${a.area}`;

    parts.push(
      severe
        ? `⚠️ <span class="alert-severe">${label}</span>`
        : `⚠️ <span class="alert-text">${label}</span>`
    );
  });

  // 2) News RSS feeds
  for (const feed of NEWS_FEEDS) {
    try {
      const items = await fetchRSS(feed);
      items.forEach((item) => {
        const title = item.querySelector("title")?.textContent?.trim();
        if (title) parts.push(title);
      });
    } catch (e) {
      console.warn("RSS feed failed:", feed, e);
    }
  }

  if (!parts.length) {
    parts.push("No alerts or headlines available");
  }

  const ticker = document.getElementById("news-content");
  ticker.innerHTML = " 📰  " + parts.join(" &nbsp; | &nbsp; ");

  // Force ticker animation restart after DOM update
  ticker.style.animation = "none";
  ticker.offsetHeight; // reflow
  ticker.style.animation = "scroll-left 28s linear infinite";
}

loadTicker();
setInterval(loadTicker, 180000); // every 3 minutes
