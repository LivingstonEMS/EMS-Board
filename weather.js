const WEATHER_URL = "/.netlify/functions/weather";

function weatherDescription(code) {
  const map = {
    0: "Clear",
    1: "Mostly Clear",
    2: "Partly Cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Dense Fog",
    51: "Light Drizzle",
    61: "Rain",
    71: "Snow",
    80: "Rain Showers",
    95: "Thunderstorms",
    96: "Thunderstorms (Hail)",
    99: "Severe Storms"
  };
  return map[code] || "Conditions";
}

function isStorm(code) {
  return code >= 61 && code <= 99;
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function findHourlyIndex(times, targetTime) {
  if (!Array.isArray(times)) return 0;
  const idx = times.indexOf(targetTime);
  return idx >= 0 ? idx : 0;
}

async function loadWeather() {
  try {
    const res = await fetch(WEATHER_URL, { cache: "no-store" });
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    const w = data.current_weather;
    const idx = findHourlyIndex(data.hourly.time, w.time);

    const temp = Math.round(w.temperature);
    const wind = Math.round(w.windspeed);
    const windDir = Math.round(w.winddirection);

    const high = Math.round(data.daily.temperature_2m_max[0]);
    const low = Math.round(data.daily.temperature_2m_min[0]);

    const humidity = data.hourly.relativehumidity_2m[idx];
    const gust = Math.round(data.hourly.windgusts_10m[idx] ?? wind);

    document.getElementById("weather-temp").textContent = `${temp}°`;
    document.getElementById("weather-desc").textContent =
      weatherDescription(w.weathercode);

    document.getElementById("weather-extra").innerHTML = `
      High ${high}° / Low ${low}°<br>
      Wind ${wind} mph (Gusts ${gust})<br>
      Wind Dir ${windDir}°<br>
      Humidity ${humidity}%<br>
      Updated ${formatTime(w.time)}
    `;

    const weatherBox = document.getElementById("weather");
    if (isStorm(w.weathercode)) weatherBox.classList.add("weather-alert");
    else weatherBox.classList.remove("weather-alert");

  } catch (err) {
    console.warn("Weather load failed:", err);
    document.getElementById("weather-desc").textContent = "Weather unavailable";
  }
}

loadWeather();
setInterval(loadWeather, 600000);
