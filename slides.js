console.log("✅ slides.js loaded");
setInterval(() => console.log("⏱️ slide tick"), 5000);
// Slide rotation (every 10 seconds) + Pause/Resume button
let currentSlide = 0;
const rotationMs = 10000;
let timer = null;
let paused = false;

function slides() {
  return Array.from(document.querySelectorAll(".slide"));
}

function showSlide(i) {
  const s = slides();
  if (!s.length) return;

  s.forEach((el) => el.classList.remove("active"));
  currentSlide = (i + s.length) % s.length;
  s[currentSlide].classList.add("active");
}

function nextSlide() {
  showSlide(currentSlide + 1);
}

function start() {
  stop();
  timer = setInterval(() => {
    if (!paused) nextSlide();
  }, rotationMs);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

function hookPause() {
  const btn = document.getElementById("pauseBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    paused = !paused;
    btn.classList.toggle("paused", paused);
    btn.textContent = paused ? "▶️ Resume" : "⏸️ Pause";
  });
}

// Debug helper: shows slide number briefly in the top bar so you know it's rotating
function setDebug(text) {
  const banner = document.getElementById("status-banner");
  if (!banner) return;
  banner.dataset.original = banner.dataset.original || banner.textContent;
  banner.textContent = text;
  setTimeout(() => {
    banner.textContent = banner.dataset.original || banner.textContent;
  }, 900);
}

window.addEventListener("load", () => {
  const s = slides();
  if (!s.length) return;

  // Find initial active slide
  currentSlide = s.findIndex((el) => el.classList.contains("active"));
  if (currentSlide < 0) currentSlide = 0;

  // Force exactly one active
  showSlide(currentSlide);

  hookPause();
  start();

  // Prove rotation is alive
  setDebug("Slides: rotation ON");
});
