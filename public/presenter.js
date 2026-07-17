const previousButton = document.querySelector('#previous');
const nextButton = document.querySelector('#next');
const counter = document.querySelector('#slide-count');
const slide = document.querySelector('.slide');
let state = { currentSlide: 0, slideCount: 8 };

function render(nextState) {
  state = nextState;
  counter.textContent = `Slide ${state.currentSlide + 1} of ${state.slideCount}`;
  slide.dataset.slide = state.currentSlide;
  previousButton.disabled = state.currentSlide === 0;
  nextButton.disabled = state.currentSlide === state.slideCount - 1;
}
async function move(amount) {
  const nextSlide = Math.max(0, Math.min(state.slideCount - 1, state.currentSlide + amount));
  if (nextSlide === state.currentSlide) return;

  // Update the presenter immediately, then keep every viewer in sync through the server.
  render({ ...state, currentSlide: nextSlide });
  try {
    const response = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentSlide: nextSlide })
    });
    if (response.ok) render(await response.json());
  } catch {
    // The local slide still changes; synchronization resumes when the app is served again.
  }
}
previousButton.addEventListener('click', () => move(-1));
nextButton.addEventListener('click', () => move(1));
document.addEventListener('keydown', (event) => {
  if (['ArrowLeft', 'PageUp'].includes(event.key)) move(-1);
  if (['ArrowRight', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); move(1); }
});
fetch('/api/state').then((response) => response.json()).then(render);
new EventSource('/events').onmessage = (event) => render(JSON.parse(event.data));
