console.log("✅ news.js loaded");

// Mix of EMS + Local sources (RSS)
const FEEDS = [
  // EMS
  "https://www.ems1.com/rss/",
  "https://www.jems.com/feed/",
  // Local-ish (WPSD doesn't provide a clean RSS consistently; use a general local feed as fallback)
  "https://www.wpsdlocal6.com/search/?f=rss&t=article&c=news",
  // National backup
  "https://rss.nytimes.com/services/xml/rss/nyt/US.xml"
];

// Proxy to avoid CORS
const PROXY = "https://api.allorigins.win/raw?url=";

// How many headlines total to show
const MAX_HEADLINES = 25;

// Speed control (lower = faster)
const TICKER_SECONDS = 22; // <-- change this to speed up/down

function setTickerSpeed(seconds) {
  const el = document.getElementById("news-content");
  if (!el) return;
  el.style.animationDuration = `${seconds}s`;
}

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
    .map((it) => {
      const t = it.querySelector("title")?.textContent || "";
      return stripHtml(t);
    })
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
  // force reflow
  void el.offsetHeight;
  el.style.animation = "";
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
    setTickerSpeed(TICKER_SECONDS);

    console.log(`📰 Loaded ${unique.length} headlines`);
  } catch (e) {
    console.warn("📰 Headlines failed:", e);
    setTickerText("Headlines unavailable • Check internet / feed sources");
    setTickerSpeed(28);
  }
}

loadHeadlines();
setInterval(loadHeadlines, 5 * 60 * 1000);
