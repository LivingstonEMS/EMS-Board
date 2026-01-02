// Flight Wx (KPAH) via AllOrigins proxy to avoid CORS
const PROXY = "https://api.allorigins.win/raw?url=";

const METAR_URL = "https://aviationweather.gov/api/data/metar?ids=KPAH&format=json";
const TAF_URL   = "https://aviationweather.gov/api/data/taf?ids=KPAH&format=json";

async function fetchJson(url) {
  const r = await fetch(PROXY + encodeURIComponent(url), { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

function computeCeilingFt(metarObj) {
  const clouds = metarObj?.clouds || [];
  let ceiling = null;
  for (const c of clouds) {
    const cover = (c.cover || "").toUpperCase();
    const base = c.base;
    if (base == null) continue;
    if (cover === "BKN" || cover === "OVC" || cover === "VV") {
      const ft = Number(base);
      if (!Number.isNaN(ft)) ceiling = ceiling === null ? ft : Math.min(ceiling, ft);
    }
  }
  return ceiling;
}

function computeFlightCategory(ceilingFt, visSm) {
  const vis = Number(visSm);
  const ceil = ceilingFt === null ? Infinity : Number(ceilingFt);
  if (ceil < 500 || vis < 1) return "LIFR";
  if (ceil < 1000 || vis < 3) return "IFR";
  if (ceil < 3000 || vis < 5) return "MVFR";
  return "VFR";
}

function setCategoryUI(cat) {
  const el = document.getElementById("av-category");
  el.classList.remove("av-vfr", "av-mvfr", "av-ifr", "av-lifr");
  if (cat === "VFR") el.classList.add("av-vfr");
  if (cat === "MVFR") el.classList.add("av-mvfr");
  if (cat === "IFR") el.classList.add("av-ifr");
  if (cat === "LIFR") el.classList.add("av-lifr");
  el.textContent = `Category: ${cat}`;
}

function setUnavailable(msg) {
  document.getElementById("av-category").textContent = "Flight Wx unavailable";
  document.getElementById("av-details").textContent = msg || "";
  document.getElementById("av-raw").textContent = "";
}

async function loadAviation() {
  try {
    const metars = await fetchJson(METAR_URL);
    const tafs   = await fetchJson(TAF_URL);

    const metar = Array.isArray(metars) ? metars[0] : null;
    const taf   = Array.isArray(tafs) ? tafs[0] : null;
    if (!metar) throw new Error("No METAR returned");

    const rawMetar = metar.raw_text || metar.raw || metar.text || "";
    const visSm = metar.visibility?.value ?? metar.visibility_statute_mi ?? 99;

    const windSpd = metar.wind_speed?.value ?? metar.wind_speed_kt ?? "";
    const windDir = metar.wind_direction?.value ?? metar.wind_dir_degrees ?? "";
    const wx = metar.wx_codes?.join(" ") || metar.wx_string || "";

    const ceilingFt = computeCeilingFt(metar);
    const cat = computeFlightCategory(ceilingFt, visSm);
    setCategoryUI(cat);

    const ceilingLine = ceilingFt === null ? "Ceiling: None (CLR/SCT)" : `Ceiling: ${ceilingFt} ft`;
    const windLine = windSpd ? `Wind: ${windDir || "VRB"}° @ ${windSpd} kt` : "Wind: Calm";
    const visLine = `Vis: ${visSm} sm`;
    const wxLine = wx ? `Wx: ${wx}` : "Wx: —";

    document.getElementById("av-details").innerHTML =
      `${ceilingLine}<br>${visLine}<br>${windLine}<br>${wxLine}`;

    const rawTaf = taf?.raw_text || taf?.raw || taf?.text || "";
    const tafLine = rawTaf ? `TAF: ${rawTaf.slice(0, 160)}${rawTaf.length > 160 ? "…" : ""}` : "";

    document.getElementById("av-raw").innerHTML =
      `METAR: ${rawMetar.slice(0, 160)}${rawMetar.length > 160 ? "…" : ""}` +
      (tafLine ? `<br><br>${tafLine}` : "");
  } catch (e) {
    console.warn("Aviation load failed:", e);
    setUnavailable(String(e?.message || e));
  }
}

loadAviation();
setInterval(loadAviation, 300000);
