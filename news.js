(() => {
  "use strict";

  console.log("✅ news.js loaded");

  // ===============================
  // FEEDS (RSS)
  // ===============================
  // Local news via Google News RSS is the most reliable “local” source on GitHub Pages.
  // You can tweak these search queries any time.
  const FEEDS = [
    // EMS
    "https://www.ems1.com/rss/",
    "https://www.jems.com/feed/",

    // LOCAL / REGIONAL (Google News RSS)
    "https://news.google.com/rss/search?q=Livingston%20County%20Kentucky&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=Paducah%20Kentucky&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=KY%20EMS&hl=en-US&gl=US&ceid=US:en",

    // National backup
    "https://rss.nytimes.com/services/xml/rss/nyt/US.xml"
  ];

  // ===============================
  // PROXIES (fallbacks for CORS + downtime)
  // ===============================
  // These sometimes fail depending on their own uptime, so we try several.
  const PROXIES = [
    (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
    (u) => "https://corsproxy.io/?" + encodeURIComponent(u),
    (u) => "https://r.jina.ai/http://" + u.replace(/^https?:\/\//, "") // returns page as text
  ];

  // ===============================
  // TICKER TUNING
  // ===============================
  const MAX_HEADLINES = 25;

  // Target how fast it moves:
  // Lower CHARS_PER_SECOND = slower ticker.
  // For ~4 minutes full scroll, CHARS_PER_SECOND around 2.5–3.5 usually feels right.
  const CHARS_PER_SECOND = 3.0;

  // Clamp duration so it’s never too fast / too slow
  const MIN_SECONDS = 120;  // at least 2 minutes
  const MAX_SECONDS = 300;  // at most 5 minutes (tweak if you want even slower)

  // Cache so if feeds fail you still show something
  const CACHE_KEY = "ems_board_headlines_cache_v1";

  // ===============================
  // Helpers
  // ===============================
  function stripHtml(s) {
    return (s || "")
      .replace(/<!\[CDATA\[|\]\]>/g, "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseRssTitles(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, "text/xml");

    // RSS: <item><title>...
    const rssItems = Array.from(doc.querySelectorAll("item > title")).map((n) =>
      stripHtml(n.textContent || "")
    );

    // Atom: <entry><title>...
    const atomItems = Array.from(doc.querySelectorAll("entry > title")).map((n) =>
      stripHtml(n.textContent || "")
    );

    return [...rssItems, ...atomItems].filter(Boolean);
  }

  async function fetchText(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }

  async function fetchFeedWithFallbacks(feedUrl) {
    // Try direct first
    try {
      const text = await fetchText(feedUrl);
      const titles = parseRssTitles(text);
      if (titles.length) return titles;
    } catch (e) {
      // ignore, try proxies
    }

    // Try proxies
    for (const proxyFn of PROXIES) {
      try {
        const text = await fetchText(proxyFn(feedUrl));
        const titles = parseRssTitles(text);
        if (titles.length) return titles;
      } catch (e) {
        // keep trying
      }
    }

    return [];
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

  function setTickerSpeedByText(text) {
    const el = document.getElementById("news-content");
    if (!el) return;

    const len = (text || "").length || 1;
    let seconds = len / CHARS_PER_SECOND;

    if (seconds < MIN_SECONDS) seconds = MIN_SECONDS;
    if (seconds > MAX_SECONDS) seconds = MAX_SECONDS;

    el.style.animationDuration = `${seconds}s`;
    console.log(`🕒 ticker duration set to ~${Math.round(seconds)}s for ${len} chars`);
  }

  function loadCachedLine() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return "";
      const parsed = JSON.parse(raw);
      return parsed?.line || "";
    } catch {
      return "";
    }
  }

  function saveCachedLine(line) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ line, ts: Date.now() }));
    } catch {
      // ignore
    }
  }

  // ===============================
  // Main
  // ===============================
  async function loadHeadlines() {
    const el = document.getElementById("news-content");
    if (el && (!el.textContent || el.textContent.trim() === "")) {
      setTickerText("Loading headlines…");
    }

    try {
      const results = await Promise.allSettled(FEEDS.map(fetchFeedWithFallbacks));

      const titles = results
        .filter((r) => r.status === "fulfilled")
        .flatMap((r) => r.value);

      const unique = Array.from(new Set(titles))
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, MAX_HEADLINES);

      if (!unique.length) throw new Error("No headlines parsed (all feeds failed)");

      const line = unique.join("  |  ");
      setTickerText(line);
      setTickerSpeedByText(line);
      saveCachedLine(line);

      console.log(`📰 Loaded ${unique.length} headlines`);
    } catch (e) {
      console.warn("📰 Headlines failed:", e);

      const cached = loadCachedLine();
      if (cached) {
        setTickerText(cached);
        setTickerSpeedByText(cached);
        console.log("📰 Using cached headlines");
      } else {
        const fallback = "Headlines unavailable • Check internet / feed sources";
        setTickerText(fallback);
        setTickerSpeedByText(fallback);
      }
    }
  }

  loadHeadlines();
  setInterval(loadHeadlines, 15 * 60 * 1000);
})();
