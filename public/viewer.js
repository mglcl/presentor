const counter = document.querySelector('#slide-count');
const slide = document.querySelector('.slide');
function render(state) {
  counter.textContent = `Live presentation · Slide ${state.currentSlide + 1} of ${state.slideCount}`;
  slide.dataset.slide = state.currentSlide;
}
fetch('/api/state').then((response) => response.json()).then(render);
new EventSource('/events').onmessage = (event) => render(JSON.parse(event.data));
