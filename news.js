// Persistent bottom ticker: World + EMS + Local + NWS alerts
// Uses rss2json (CORS-friendly)
const RSS2JSON = "https://api.rss2json.com/v1/api.json?rss_url=";

// Pick your feeds
const FEEDS = [
  // World news
  "https://feeds.bbci.co.uk/news/world/rss.xml",
  // EMS / emergency services news
  "https://www.ems1.com/rss/",
  // Local (WPSD — if they block feeds, we can swap)
  "https://www.wpsdlocal6.com/search/?f=rss&t=article&c=news"
];

const SEPARATOR = "   |   ";
let headlines = [];
let tickerIndex = 0;

async function fetchFeed(url) {
  const res = await fetch(RSS2JSON + encodeURIComponent(url), { cache: "no-store" });
  const data = await res.json();
  if (!data || data.status !== "ok") return [];
  return (data.items || []).map((i) => i.title).filter(Boolean);
}

function setTickerText(text) {
  const el = document.getElementById("news-content");
  if (!el) return;
  el.textContent = text;
}

async function loadHeadlines() {
  try {
    const results = await Promise.all(FEEDS.map(fetchFeed));
    headlines = results.flat().slice(0, 60);

    if (!headlines.length) {
      setTickerText("No headlines available.");
      return;
    }

    // Build one long ticker string
    const text = headlines.join(SEPARATOR);
    setTickerText(text);
  } catch (e) {
    console.warn("Ticker load failed:", e);
    setTickerText("Headlines unavailable.");
  }
}

loadHeadlines();
setInterval(loadHeadlines, 10 * 60 * 1000); // refresh every 10 minutes
