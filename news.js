(() => {
  "use strict";

  console.log("✅ news.js loaded (FINAL)");

  // ===============================
  // FEEDS (RSS)
  // ===============================
  // NOTE: We will NOT try direct fetch anymore (it’s what’s throwing CORS/403/404).
  const FEEDS = [
    // EMS / Industry
    "https://www.jems.com/feed/",
    // EMS1 RSS often changes / blocks – if it fails, it won’t break anything
    "https://www.ems1.com/rss/",

    // Local / Regional (Google News RSS)
    "https://news.google.com/rss/search?q=Livingston%20County%20Kentucky&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=Paducah%20Kentucky&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=Western%20Kentucky&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=Kentucky%20EMS&hl=en-US&gl=US&ceid=US:en",

    // National backup
    "https://rss.nytimes.com/services/xml/rss/nyt/US.xml"
  ];

  // ===============================
  // PROXIES (fallbacks)
  // Put the most reliable FIRST.
  // ===============================
  const PROXIES = [
    // This one is usually the most consistent on GH Pages:
    (u) => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u),

    // Often works, sometimes rate-limits:
    (u) => "https://corsproxy.io/?" + encodeURIComponent(u),

    // Flaky lately (500s), keep as last resort:
    (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u)
  ];

  // ===============================
  // TICKER TUNING
  // ===============================
  const MAX_HEADLINES = 80;

  // Slower = smaller number
  // You said ~4 minutes full scroll felt right; we’ll bias slower.
  const CHARS_PER_SECOND = 2.2;

  // Clamp duration
  const MIN_SECONDS = 240; // 4 minutes minimum
  const MAX_SECONDS = 720; // 12 minutes maximum

  // Timeout per request (don’t hang forever)
  const FETCH_TIMEOUT_MS = 8000;

  // Cache so you never stare at "Loading..." for long
  const CACHE_KEY = "ems_board_headlines_cache_v2";

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

    // RSS
    const rss = Array.from(doc.querySelectorAll("item > title")).map((n) =>
      stripHtml(n.textContent || "")
    );

    // Atom
    const atom = Array.from(doc.querySelectorAll("entry > title")).map((n) =>
      stripHtml(n.textContent || "")
    );

    return [...rss, ...atom].filter(Boolean);
  }

  async function fetchText(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } finally {
      clearTimeout(t);
    }
  }

  async function fetchFeed(feedUrl) {
    // Try proxies in order — no direct fetch.
    for (const proxyFn of PROXIES) {
      try {
        const text = await fetchText(proxyFn(feedUrl));
        const titles = parseRssTitles(text);
        if (titles.length) return titles;
      } catch (_) {
        // keep going
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
    void el.offsetHeight;
    el.style.animation = "tickerScroll 240s linear infinite";
  }

  function setTickerSpeedByText(text) {
    const el = document.getElementById("news-content");
    if (!el) return;

    const len = (text || "").length || 1;
    let seconds = len / CHARS_PER_SECOND;

    if (seconds < MIN_SECONDS) seconds = MIN_SECONDS;
    if (seconds > MAX_SECONDS) seconds = MAX_SECONDS;

    el.style.animationDuration = `${seconds}s`;
    console.log(`🕒 ticker duration ~${Math.round(seconds)}s (${len} chars)`);
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
    // Show cached immediately (so you never sit on Loading)
    const cached = loadCachedLine();
    if (cached) {
      setTickerText(cached);
      setTickerSpeedByText(cached);
    } else {
      setTickerText("Loading headlines…");
      setTickerSpeedByText("Loading headlines…");
    }

    const results = await Promise.allSettled(FEEDS.map(fetchFeed));
    const titles = results
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => r.value);

    const unique = Array.from(new Set(titles))
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, MAX_HEADLINES);

    if (!unique.length) {
      console.warn("📰 All feeds failed — keeping cached headlines if available.");
      if (!cached) {
        const fallback = "Headlines unavailable • Check internet / feed sources";
        setTickerText(fallback);
        setTickerSpeedByText(fallback);
      }
      return;
    }

    const line = unique.join("  |  ");
    setTickerText(line);
    setTickerSpeedByText(line);
    saveCachedLine(line);

    console.log(`📰 Loaded ${unique.length} headlines`);
  }

  loadHeadlines();
  setInterval(loadHeadlines, 15 * 60 * 1000);
})();
