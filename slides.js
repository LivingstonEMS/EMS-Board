(() => {
  "use strict";

  console.log("✅ slides.js loaded (FINAL)");

  // ===============================
  // Slide rotation + manual controls
  // ===============================
  let slides = [];
  let currentSlide = 0;

  // Auto-advance time (seconds)
  const AUTO_SECONDS = 30;

  let autoTimer = null;

  function setActive(index) {
    if (!slides.length) return;

    slides.forEach((s) => s.classList.remove("active"));

    currentSlide = (index + slides.length) % slides.length;
    slides[currentSlide].classList.add("active");
  }

  function restartAuto() {
    if (autoTimer) clearInterval(autoTimer);

    autoTimer = setInterval(() => {
      console.log("⏱️ slide tick");
      // IMPORTANT: do NOT restart timer on auto ticks
      setActive(currentSlide + 1);
    }, AUTO_SECONDS * 1000);
  }

  function nextSlide() {
    setActive(currentSlide + 1);
    restartAuto(); // reset timer after manual use
  }

  function prevSlide() {
    setActive(currentSlide - 1);
    restartAuto(); // reset timer after manual use
  }

  function wireControls() {
    // Buttons (if present)
    const nextBtn = document.getElementById("next-slide");
    if (nextBtn) nextBtn.addEventListener("click", nextSlide);

    const prevBtn = document.getElementById("prev-slide");
    if (prevBtn) prevBtn.addEventListener("click", prevSlide);

    // Keyboard controls
    window.addEventListener("keydown", (e) => {
      // ignore if typing in inputs
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
      if (tag === "input" || tag === "textarea") return;

      if (e.key === "ArrowRight" || e.key === "PageDown") nextSlide();
      if (e.key === "ArrowLeft" || e.key === "PageUp") prevSlide();
    });
  }

  function initSlides() {
    slides = Array.from(document.querySelectorAll(".slide"));
    if (!slides.length) {
      console.warn("⚠️ No .slide elements found");
      return;
    }

    // Show first slide and start
    setActive(0);
    wireControls();
    restartAuto();
  }

  document.addEventListener("DOMContentLoaded", initSlides);
})();
