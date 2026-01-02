console.log("✅ news.js loaded");

// Mix of EMS + Local sources (RSS)
const FEEDS = [
  "https://www.ems1.com/rss/",
  "https://www.jems.com/feed/",
  "https://www.wpsdlocal6.com/search/?f=rss&t=article&c=news",
  "https://rss.nytimes.com/services/xml/rss/nyt/US.xml"
];

// Proxy to avoid CORS (NOTE: sometimes gets blocked)
const PROXY = "https://api.allorigins.win/raw?url=";

// How many headlines total to show
const MAX_HEADLINES = 25;

// Speed in pixels per second (higher = faster)
const TICKER_PX_PER_SEC = 140; // try 120-180

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

// ---- THE FIX: pixel-based scrolling that never cuts off ----
function startTickerScroll(text) {
  const el = document.getElementById("news-content");
  const wrap = document.getElementById("global-ticker");
  if (!el || !wrap) return;

  // If the text didn't change, don't restart (prevents mid-run snapping)
  if (el.dataset.currentText === text) return;
  el.dataset.currentText = text;

  el.textContent = text || "No headlines available";

  requestAnimationFrame(() => {
    const wrapW = wrap.clientWidth;
    const textW = el.scrollWidth;

    const distance = wrapW + textW; // full travel
    const durationSec = distance / TICKER_PX_PER_SEC;

    // Kill any existing animation
    if (el._anim) el._anim.cancel();

    el._anim = el.animate(
      [
        { transform: `translateX(${wrapW}px)` },
        { transform: `translateX(${-textW}px)` }
      ],
      {
        duration: durationSec * 1000,
        iterations: Infinity,
        easing: "linear"
      }
    );
  });
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
    startTickerScroll(line);

    console.log(`📰 Loaded ${unique.length} headlines`);
  } catch (e) {
    console.warn("📰 Headlines failed:", e);
    startTickerScroll("Headlines unavailable • Check internet / feed sources");
  }
}

loadHeadlines();
setInterval(loadHeadlines, 15 * 60 * 1000);
