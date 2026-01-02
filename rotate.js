let slides = document.querySelectorAll('.slide');
let index = 0;
let paused = false;

function rotateSlides() {
  if (paused) return;

  slides[index].classList.remove('active');
  index = (index + 1) % slides.length;
  slides[index].classList.add('active');
}

let rotationInterval = setInterval(rotateSlides, ROTATE_TIME);

document.getElementById("pauseBtn").addEventListener("click", () => {
  paused = !paused;

  const btn = document.getElementById("pauseBtn");
  if (paused) {
    btn.textContent = "▶️ Resume";
    btn.classList.add("paused");
  } else {
    btn.textContent = "⏸️ Pause";
    btn.classList.remove("paused");
  }
});
