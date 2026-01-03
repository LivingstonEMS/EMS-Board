(function () {
  // If this file gets loaded twice, don't re-init.
  if (window.__EMS_NEWS_LOADED__) {
    console.log("ℹ️ news.js already initialized — skipping duplicate load");
    return;
  }
  window.__EMS_NEWS_LOADED__ = true;

  console.log("✅ news.js loaded");

  // ===============================
  // FEEDS
  // ===============================
  const FEEDS = [
    "https://www.ems1.com/rss/",
    "https://www.jems.com/feed/",
    "https://rss.nytimes.com/services/xml/rss/nyt/US.xml"
  ];

  const MAX_HEADLINES = 25;

  // ✅ 4-minute full scroll
  const TARGET_SCROLL_SECONDS = 240;
  const SPACER = "     •     ";

  // ===============================
  // PROXIES (inside closure = no global collisions)
  // ===============================
  const PROXIES = [
    (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
    (u) => "https://r.jina.ai/http/" + u.replace(/^https?:\/\//, ""),
    (u) => "https://r.jina.ai/https/" + u.replace(/^https?:\/\//, "")
  ];

  // ===============================
  // HELPERS
  // ===============================
  function $(id) {
    return document.getElementById(id);
  }

  function restartTicker(el) {
    el.style.animation = "none";
    void el.offsetHeight; // force reflow
    el.style.animation = "";
  }

  function setTicker(line) {
    const el = $("news-content");
    const wrap = $("global-ticker");

    if (!el || !wrap) {
      console.warn("📰 Missing #news-content or #global-ticker in HTML");
      return;
    }

    const base = (line && String(line).trim()) || "Headlines unavailable";
    const full = base + SPACER + base + SPACER + base;

    el.textContent = full;

    requestAnimationFrame(() => {
      el.style.animationDuration = `${TARGET_SCROLL_SECONDS}s`;
      restartTicker(el);
    });
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
      .map((it) => stripHtml(it.querySelector("title")?.textContent || ""))
      .filter(Boolean);
  }

  async function fetchTextWithFallback(url) {
    // try direct first
    try {
      const r0 = await fetch(url, { cache: "no-store" });
      if (r0.ok) return await r0.text();
    } catch (_) {}

    // try proxies
    for (const make of PROXIES) {
      try {
        const proxyUrl = make(url);
        const r = await fetch(proxyUrl, { cache: "no-store" });
        if (!r.ok) continue;
        const txt = await r.text();
        if (txt && txt.length > 50) return txt;
      } catch (_) {}
    }

    throw new Error("All proxies failed");
  }

  async function fetchFeedTitles(feedUrl) {
    const xmlText = await fetchTextWithFallback(feedUrl);
    return parseRssTitles(xmlText);
  }

  // ===============================
  // MAIN
  // ===============================
  async function loadHeadlines() {
    // ✅ never stuck on loading
    setTicker("Loading headlines…");

    try {
      const results = await Promise.allSettled(FEEDS.map(fetchFeedTitles));

      const titles = results
        .filter((r) => r.status === "fulfilled")
        .flatMap((r) => r.value);

      const unique = Array.from(new Set(titles)).slice(0, MAX_HEADLINES);
      if (!unique.length) throw new Error("No headlines parsed");

      setTicker(unique.join("  |  "));
      console.log(`📰 Loaded ${unique.length} headlines`);
    } catch (e) {
      console.warn("📰 Headlines failed:", e);
      setTicker("Headlines unavailable • Proxy/feed error");
    }
  }

  function initNews() {
    loadHeadlines();
    setInterval(loadHeadlines, 15 * 60 * 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNews);
  } else {
    initNews();
  }
})();
