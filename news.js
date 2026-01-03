console.log("✅ news.js loaded");

// Mix of EMS + Local sources (RSS)
const FEEDS = [
  "https://www.ems1.com/rss/",
  "https://www.jems.com/feed/",
  "https://www.wpsdlocal6.com/search/?f=rss&t=article&c=news",
  "https://rss.nytimes.com/services/xml/rss/nyt/US.xml"
];

// Proxy to avoid CORS (NOTE: this proxy sometimes has outages)
const PROXY = "https://api.allorigins.win/raw?url=";

// How many headlines total to show
const MAX_HEADLINES = 25;

function stripHtml(s) {
  return (s || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRssTitles(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  const items = Array.from(doc.querySelectorAll("item"));
  return items
    .map((it) => stripHtml(it.querySelector("title")?.textContent || ""))
    .filter(Boolean);
}

async function fetchFeed(url) {
  const res = await fetch(PROXY + encodeURIComponent(url), { cache: "no-store" });
  if (!res.ok) throw new Error(`Feed HTTP ${res.status}`);
  const text = await res.text();
  return parseRssTitles(text);
}

function setTickerText(text) {
  const el = document.getElementById("news-content");
  if (!el) return;

  el.textContent = text || "No headlines available";

  // Restart animation cleanly
  el.style.animation = "none";
  void el.offsetHeight; // force reflow
  el.style.animation = "";
}

/**
 * Auto-speed: longer text scrolls slower so it's always readable.
 * - Minimum 90s
 * - Typical 110-180s depending on length
 */
function setTickerSpeedFromText(text) {
  const el = document.getElementById("news-content");
  if (!el) return;

  const len = (text || "").length;

  // 10-12 chars/sec feels readable for a wall board
  const seconds = Math.max(90, Math.ceil(len / 10));
  el.style.animationDuration = `${seconds}s`;

  console.log("📰 ticker duration set to:", seconds, "seconds");
}

async function loadHeadlines() {
  try {
    const results = await Promise.allSettled(FEEDS.map(fetchFeed));

    const titles = results
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => r.value);

    const unique = Array.from(new Set(titles)).slice(0, MAX_HEADLINES);

    if (!unique.length) throw new Error("No headlines parsed");

    const line = unique.join("  |  ");
    setTickerText(line);
    setTickerSpeedFromText(line);

    console.log(`📰 Loaded ${unique.length} headlines`);
  } catch (e) {
    console.warn("📰 Headlines failed:", e);
    const fallback = "Headlines unavailable • Check internet / feed sources";
    setTickerText(fallback);
    setTickerSpeedFromText(fallback);
  }
}

loadHeadlines();
setInterval(loadHeadlines, 15 * 60 * 1000);
