console.log("✅ news.js loaded");

// RSS feeds
const FEEDS = [
  "https://www.ems1.com/rss/",
  "https://www.jems.com/feed/",
  "https://rss.nytimes.com/services/xml/rss/nyt/US.xml"
];

// CORS proxy (sometimes flaky — but you said that’s fine for now)
const PROXY = "https://api.allorigins.win/raw?url=";

const MAX_HEADLINES = 25;

// Speed controls (tweak these)
const BASE_SECONDS = 45;     // minimum scroll duration
const SECONDS_PER_100_CHARS = 8; // slower = bigger number

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

function setTicker(line) {
  const el = document.getElementById("news-content");
  const wrap = document.getElementById("global-ticker");
  if (!el || !wrap) return;

  // Make it loop smoothly by repeating the string with spacing
  const spacer = "     •     ";
  const full = (line || "No headlines available") + spacer + (line || "No headlines available");

  el.textContent = full;

  // Compute duration based on text length
  const len = full.length;
  const dynamic = BASE_SECONDS = 60 + (len / 100) * SECONDS_PER_100_CHARS = 12;

  el.style.animationDuration = `${Math.round(dynamic)}s`;

  // Restart animation cleanly
  el.style.animation = "none";
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
    setTicker(line);

    console.log(`📰 Loaded ${unique.length} headlines`);
  } catch (e) {
    console.warn("📰 Headlines failed:", e);
    setTicker("Headlines unavailable • Check internet / feed sources");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadHeadlines();
  setInterval(loadHeadlines, 15 * 60 * 1000);
});
