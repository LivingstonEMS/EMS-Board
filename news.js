(() => {
  "use strict";

  // Prevent double-loading (common on GitHub Pages when cache + reload happens)
  if (window.__EMS_NEWS_LOADED__) {
    console.warn("📰 news.js already loaded — skipping re-init");
    return;
  }
  window.__EMS_NEWS_LOADED__ = true;

  console.log("✅ news.js loaded (FINAL)");

  // ===============================
  // FEEDS (RSS)
  // ===============================
  const FEEDS = [
    // EMS
    "https://www.ems1.com/rss/",
    "https://www.jems.com/feed/",

    // LOCAL / REGIONAL (Google News RSS - reliable on GitHub Pages)
    "https://news.google.com/rss/search?q=Livingston%20County%20Kentucky&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=Paducah%20Kentucky&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=Kentucky%20EMS&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=Western%20Kentucky&hl=en-US&gl=US&ceid=US:en",

    // National backup
    "https://rss.nytimes.com/services/xml/rss/nyt/US.xml"
  ];

  // ===============================
  // PROXIES (fallbacks for CORS + downtime)
  // ===============================
  const PROXIES = [
    (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
    (u) => "https://corsproxy.io/?" + encodeURIComponent(u),
    (u) => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u),
    (u) => "https://r.jina.ai/http://" + u.replace(/^https?:\/\//, "") // returns page as text
  ];

  // ===============================
  // TICKER TUNING (SLOWER)
  // ===============================
  const MAX_HEADLINES = 80;

  // Lower = slower
  // If you want even slower, drop to 1.5 or 1.2
  const CHARS_PER_SECOND = 2.0;

  // Clamp duration (overall scroll time)
  const MIN_SECONDS = 240; // 4 minutes minimum
  const MAX_SECONDS = 540; // 9 minutes max

  // If a proxy/feed hangs, kill it
  const FETCH_TIMEOUT_MS = 9000;

  // Cache so if feeds fail you still show something
  const CACHE_KEY = "ems_board_headlines_cache_v2";

  // ===============================
  // Helpers
  // ===============================
  function getEl() {
    return document.getElementById("news-content");
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

    // RSS: <item><title>
    const rss = Array.from(doc.querySelectorAll("item > title")).map((n) =>
      stripHtml(n.textContent || "")
    );

    // Atom: <entry><title>
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

  async function fetchFeedWithFallbacks(feedUrl) {
    // Direct first
    try {
      const text = await fetchText(feedUrl);
      const titles = parseRssTitles(text);
      if (titles.length) return titles;
    } catch (_) {}

    // Proxies
    for (const proxyFn of PROXIES) {
      try {
        const text = await fetchText(proxyFn(feedUrl));
        const titles = parseRssTitles(text);
        if (titles.length) return titles;
      } catch (_) {}
    }

    return [];
  }

  function setTickerText(text) {
    const el = getEl();
    if (!el) return;

    el.textContent = text || "No headlines available";

    // Restart animation cleanly
    el.style.animation = "none";
    void el.offsetHeight;
    el.style.animation = "";
  }

  function setTickerSpeedByText(text) {
    const el = getEl();
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
    } catch {}
  }

  // ===============================
  // Main
  // ===============================
  async function loadHeadlines() {
    // Ensure element exists (if defer is missing, this prevents a dead start)
    const el = getEl();
    if (!el) {
      console.warn("📰 #news-content not found yet — retrying soon");
      setTimeout(loadHeadlines, 800);
      return;
    }

    // Always make speed slow even during loading
    setTickerSpeedByText("Loading headlines…");

    // Show cached immediately if available (so you never stare at Loading)
    const cachedNow = loadCachedLine();
    if (cachedNow) setTickerText(cachedNow);

    // If nothing cached, show loading
    if (!el.textContent || el.textContent.trim() === "") {
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
