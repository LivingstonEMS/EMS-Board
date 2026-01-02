// Slide rotation + pause button
let slides = document.querySelectorAll(".slide");
let index = 0;
let paused = false;

function rotateSlides() {
  if (paused) return;
  slides[index].classList.remove("active");
  index = (index + 1) % slides.length;
  slides[index].classList.add("active");
}

let rotationInterval = setInterval(rotateSlides, 10000); // default 10s

const pauseBtn = document.getElementById("pauseBtn");
pauseBtn.addEventListener("click", () => {
  paused = !paused;
  if (paused) {
    pauseBtn.textContent = "▶️ Resume";
    pauseBtn.classList.add("paused");
  } else {
    pauseBtn.textContent = "⏸️ Pause";
    pauseBtn.classList.remove("paused");
  }
});

// Expose a helper so other scripts can pause/resume rotation (tornado override)
window.setRotationPaused = function (shouldPause) {
  paused = !!shouldPause;
  if (paused) {
    pauseBtn.textContent = "▶️ Resume";
    pauseBtn.classList.add("paused");
  } else {
    pauseBtn.textContent = "⏸️ Pause";
    pauseBtn.classList.remove("paused");
  }
};
