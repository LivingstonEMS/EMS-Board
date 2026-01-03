console.log("✅ news.js loaded");

// RSS feeds
const FEEDS = [
  "https://www.ems1.com/rss/",
  "https://www.jems.com/feed/",
  "https://rss.nytimes.com/services/xml/rss/nyt/US.xml"
];

// Proxy (can fail sometimes)
const PROXY = "https://api.allorigins.win/raw?url=";

// Settings
const MAX_HEADLINES = 30;
const TICKER_SECONDS = 75; // slower = more readable
let lastTickerText = "";

function stripHtml(s) {
  return (s || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRssTitles(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  return Array.from(doc.querySelectorAll("item"))
    .map(it => stripHtml(it.querySelector("title")?.textContent || ""))
    .filter(Boolean);
}

async function fetchFeed(url) {
  const res = await fetch(PROXY + encodeURIComponent(url), { cache: "no-store" });
  if (!res.ok) throw new Error(`Feed HTTP ${res.status}`);
  const text = await res.text();
  return parseRssTitles(text);
}

function startTicker(text) {
  const el = document.getElementById("news-content");
  const wrap = document.getElementById("global-ticker");
  if (!el || !wrap) return;

  // If text didn't change, DO NOT restart animation
  if (text === lastTickerText) return;
  lastTickerText = text;

  el.classList.remove("ticking");
  el.textContent = text || "No headlines available";

  // Wait one frame so layout is updated
  requestAnimationFrame(() => {
    const wrapW = wrap.clientWidth;
    const textW = el.scrollWidth;

    // End point: move all the way off screen to the left
    const end = -(textW + 50);
    el.style.setProperty("--ticker-end", `${end}px`);
    el.style.animationDuration = `${TICKER_SECONDS}s`;

    // restart clean
    void el.offsetHeight;
    el.classList.add("ticking");
  });
}

async function loadHeadlines() {
  try {
    const results = await Promise.allSettled(FEEDS.map(fetchFeed));
    const titles = results
      .filter(r => r.status === "fulfilled")
      .flatMap(r => r.value);

    const unique = Array.from(new Set(titles)).slice(0, MAX_HEADLINES);
    if (!unique.length) throw new Error("No headlines parsed");

    const line = unique.join("  |  ");
    startTicker(line);

    console.log(`📰 Loaded ${unique.length} headlines`);
  } catch (e) {
    console.warn("📰 Headlines failed:", e);
    startTicker("Headlines unavailable • (RSS / proxy blocked)");
  }
}

loadHeadlines();
setInterval(loadHeadlines, 25 * 60 * 1000);
