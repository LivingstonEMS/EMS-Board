(() => {
  "use strict";

  console.log("✅ news.js loaded");

  // ===============================
  // FEEDS (RSS)
  // ===============================
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
  // Added codetabs proxy + timeouts so nothing hangs forever.
  const PROXIES = [
    (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
    (u) => "https://corsproxy.io/?" + encodeURIComponent(u),
    (u) => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u),
    (u) => "https://r.jina.ai/http://" + u.replace(/^https?:\/\//, "")
  ];

  // ===============================
  // TICKER TUNING
  // ===============================
  const MAX_HEADLINES = 100;

  // Lower = slower
  const CHARS_PER_SECOND = 3.0;

  // Clamp duration
  const MIN_SECONDS = 180; // 3 minutes
  const MAX_SECONDS = 420; // 7 minutes

  // If a proxy/feed hangs, kill it
  const FETCH_TIMEOUT_MS = 8000;

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

    const rssItems = Array.from(doc.querySelectorAll("item > title")).map((n) =>
      stripHtml(n.textContent || "")
    );

    const atomItems = Array.from(doc.querySelectorAll("entry > title")).map((n) =>
      stripHtml(n.textContent || "")
    );

    return [...rssItems, ...atomItems].filter(Boolean);
  }

  async function fetchText(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: ctrl.signal
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } finally {
      clearTimeout(t);
    }
  }

  async function fetchFeedWithFallbacks(feedUrl) {
    // Try direct first (some feeds might allow it)
    try {
      const text = await fetchText(feedUrl);
      const titles = parseRssTitles(text);
      if (titles.length) return titles;
    } catch (_) {
      // ignore
    }

    // Try proxies
    for (const proxyFn of PROXIES) {
      try {
        const text = await fetchText(proxyFn(feedUrl));
        const titles = parseRssTitles(text);
        if (titles.length) return titles;
      } catch (_) {
        // keep trying
      }
    }

    return [];
  }

  function setTickerText(text) {
    const el = document.getElementById("news-content");
    if (!el) return;

    el.textContent = text || "No headlines available";

    // restart animation
    el.style.animation = "none";
    void el.offsetHeight;
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
    const el = document.getElementById("news-content");
    if (el && (!el.textContent || el.textContent.trim() === "")) {
      setTickerText("Loading headlines…");
    }

    try {
      const results = await Promise.allSettled(FEEDS.map(fetchFeedWithFallbacks));

      // Helpful debug: see which feeds worked
      results.forEach((r, i) => {
        const count = r.status === "fulfilled" ? r.value.length : 0;
        console.log(`🧪 feed[${i}] titles:`, count, FEEDS[i]);
      });

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
