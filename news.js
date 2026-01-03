(() => {
  "use strict";
  console.log("✅ news.js loaded (FINAL v2)");

  // ===============================
  // FEEDS
  // ===============================
  const FEEDS = [
    "https://www.jems.com/feed/",
    "https://www.ems1.com/rss/",
    "https://news.google.com/rss/search?q=Livingston%20County%20Kentucky&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=Paducah%20Kentucky&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=Western%20Kentucky&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=Kentucky%20EMS&hl=en-US&gl=US&ceid=US:en",
    "https://rss.nytimes.com/services/xml/rss/nyt/US.xml"
  ];

  // Most reliable first
  const PROXIES = [
    (u) => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u),
    (u) => "https://corsproxy.io/?" + encodeURIComponent(u),
    (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u)
  ];

  // ===============================
  // SPEED (SLOWER = smaller)
  // ===============================
  const MAX_HEADLINES = 80;

  // Target speed: pixels per second (super stable vs chars)
  // Lower = slower. Try 40–70 for very readable.
  const PX_PER_SECOND = 55;

  // Clamp duration
  const MIN_SECONDS = 240; // 4 min minimum
  const MAX_SECONDS = 900; // 15 min maximum

  const FETCH_TIMEOUT_MS = 8000;
  const CACHE_KEY = "ems_board_headlines_cache_v3";

  // ===============================
  // Ensure ticker CSS exists (so CSS conflicts don't break it)
  // ===============================
  function ensureTickerCSS() {
    if (document.getElementById("ticker-css")) return;

    const style = document.createElement("style");
    style.id = "ticker-css";
    style.textContent = `
      @keyframes tickerScrollFinal {
        from { transform: translateX(100%); }
        to   { transform: translateX(var(--ticker-end, -200%)); }
      }
      #news-content.ticking-final {
        animation-name: tickerScrollFinal !important;
        animation-timing-function: linear !important;
        animation-iteration-count: infinite !important;
        will-change: transform;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  // ===============================
  // Parsing helpers
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
    const rss = Array.from(doc.querySelectorAll("item > title")).map((n) =>
      stripHtml(n.textContent || "")
    );
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
    for (const proxyFn of PROXIES) {
      try {
        const text = await fetchText(proxyFn(feedUrl));
        const titles = parseRssTitles(text);
        if (titles.length) return titles;
      } catch (_) {}
    }
    return [];
  }

  // ===============================
  // Cache
  // ===============================
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
  // Ticker control (the important part)
  // ===============================
  function applyTicker(line) {
    ensureTickerCSS();

    const el = document.getElementById("news-content");
    const box = document.getElementById("global-ticker");
    if (!el || !box) return;

    el.textContent = line || "No headlines available";

    // Measure widths
    // (force layout so we get real widths)
    el.classList.remove("ticking-final");
    el.style.animation = "none";
    void el.offsetWidth;

    const boxW = box.clientWidth || window.innerWidth;
    const textW = el.scrollWidth || 2000;

    // End position = move left past the full text width
    // Use CSS var so keyframes always hit the right end
    el.style.setProperty("--ticker-end", `-${textW + boxW}px`);

    // Duration based on pixels per second
    let seconds = (textW + boxW) / PX_PER_SECOND;
    if (seconds < MIN_SECONDS) seconds = MIN_SECONDS;
    if (seconds > MAX_SECONDS) seconds = MAX_SECONDS;

    el.style.animationDuration = `${seconds}s`;

    // Start animation
    el.classList.add("ticking-final");
    el.style.animation = ""; // let class drive it

    console.log(`🕒 ticker duration ~${Math.round(seconds)}s (textW=${textW}, boxW=${boxW})`);
  }

  async function loadHeadlines() {
    // Show cached immediately so you never see "stuck"
    const cached = loadCachedLine();
    if (cached) applyTicker(cached);
    else applyTicker("Loading headlines…");

    const results = await Promise.allSettled(FEEDS.map(fetchFeed));
    const titles = results
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => r.value);

    const unique = Array.from(new Set(titles))
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, MAX_HEADLINES);

    if (!unique.length) {
      console.warn("📰 All feeds failed — keeping cached if available.");
      if (!cached) applyTicker("Headlines unavailable • Check internet / feed sources");
      return;
    }

    const line = unique.join("  |  ");
    applyTicker(line);
    saveCachedLine(line);
    console.log(`📰 Loaded ${unique.length} headlines`);
  }

  // Re-apply on resize so it never freezes after a layout change
  window.addEventListener("resize", () => {
    const el = document.getElementById("news-content");
    if (el && el.textContent) applyTicker(el.textContent);
  });

  loadHeadlines();
  setInterval(loadHeadlines, 15 * 60 * 1000);
})();
