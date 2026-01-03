console.log("✅ slides.js loaded");

// ===============================
// Slide rotation + manual controls
// ===============================
let slides = [];
let currentSlide = 0;

// Auto-advance time (seconds)
const AUTO_SECONDS = 30;

let autoTimer = null;

function showSlide(index) {
  if (!slides.length) return;

  slides.forEach((s) => s.classList.remove("active"));

  currentSlide = (index + slides.length) % slides.length;
  slides[currentSlide].classList.add("active");

  // Reset auto timer whenever user manually moves
  restartAuto();
}

function nextSlide() {
  showSlide(currentSlide + 1);
}

function prevSlide() {
  showSlide(currentSlide - 1);
}

function restartAuto() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = setInterval(() => {
    console.log("⏱️ slide tick");
    showSlide(currentSlide + 1);
  }, AUTO_SECONDS * 1000);
}

function wireControls() {
  // Button (if present)
  const nextBtn = document.getElementById("next-slide");
  if (nextBtn) nextBtn.addEventListener("click", nextSlide);

  const prevBtn = document.getElementById("prev-slide");
  if (prevBtn) prevBtn.addEventListener("click", prevSlide);

  // Keyboard controls
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "PageDown") nextSlide();
    if (e.key === "ArrowLeft" || e.key === "PageUp") prevSlide();
  });
}

function initSlides() {
  slides = Array.from(document.querySelectorAll(".slide"));
  if (!slides.length) return;

  // show first
  showSlide(0);

  // wire controls + start auto
  wireControls();
  restartAuto();
}

document.addEventListener("DOMContentLoaded", initSlides);
