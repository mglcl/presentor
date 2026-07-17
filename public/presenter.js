let state = { currentSlide: 0, slideCount: 8, ratingCounts: [0, 0, 0, 0, 0], playerNames: [], race: { running: false, order: [] }, gameUrl: 'https://example.com' };
const stage = document.querySelector('#stage');
const counter = document.querySelector('#slide-count');
const clientId = localStorage.presenterClientId || (localStorage.presenterClientId = crypto.randomUUID());
let ownRating = Number(localStorage.presenterRating || 0);
const templates = [
  () => `<article class="slide intro"><div><div class="kicker">Wednesday · a small pause</div><h1 class="display">Wednesday<br>Check-in</h1></div><span class="number">01</span></article>`,
  () => `<article class="slide rating"><div><div class="kicker">A moment for yourself</div><h1 class="display">How are you<br>today?</h1><div class="stars" aria-label="Rate your day from 1 to 5">${[1,2,3,4,5].map((n) => `<button class="star ${n <= ownRating ? 'selected' : ''}" data-rating="${n}" aria-label="${n} star">★</button>`).join('')}</div></div><span class="number">02</span></article>`,
  () => `<article class="slide results"><div class="kicker">Our check-in, together</div><h1 class="display">The room,<br>in a line.</h1><div class="response-total" id="response-total"></div><svg class="graph" viewBox="0 0 1000 260" preserveAspectRatio="none" id="rating-graph"></svg><span class="number">03</span></article>`,
  () => `<article class="slide share"><div><div class="kicker">A little sharing</div><h1 class="share-copy">What is your most favourite book?<br><em>(A movie, if none.)</em></h1><p>What is it about? Why does it stay with you?</p></div><div class="image-placeholder">Your image / cover goes here</div><span class="number">04</span></article>`,
  () => `<article class="slide race ${state.race.running ? 'race-running' : ''}"><div class="race-head"><div><div class="kicker">Order of sharing</div><h1 class="display">The duck race</h1></div><div class="kicker">19 runners</div></div><div class="race-board" id="race-board"></div><div class="race-settings"><button id="run-race">${state.race.running ? 'Racing…' : 'Run race'}</button><button id="edit-names">Edit names</button></div><div class="names-panel" id="names-panel"><div class="kicker">Add the 19 names</div><div class="names-grid" id="names-grid"></div><br><button id="save-names">Save names</button> <button id="close-names">Close</button></div><span class="number">05</span></article>`,
  () => `<article class="slide game"><div><div class="kicker">A little game</div><h1 class="display">Ready to play?</h1><a class="game-link" target="_blank" rel="noopener" href="${state.gameUrl}">Open the game ↗</a></div><div class="game-settings"><input id="game-url" value="${state.gameUrl}" aria-label="Game URL"><button id="save-game">Save link</button></div><span class="number">06</span></article>`,
  () => `<article class="slide end"><div><div class="kicker">Until next time</div><h1 class="display">fin</h1></div><span class="number">07</span></article>`,
  () => `<article class="slide black"><span class="number">08</span></article>`
];
function request(path, body) { return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.ok ? r.json() : Promise.reject()); }
function render(next) {
  state = next; counter.textContent = `${String(state.currentSlide + 1).padStart(2, '0')} / 08`;
  stage.innerHTML = templates[state.currentSlide]();
  document.querySelector('#previous').disabled = state.currentSlide === 0;
  document.querySelector('#next').disabled = state.currentSlide === 7;
  hydrate();
}
function hydrate() {
  document.querySelectorAll('.star').forEach((star) => star.addEventListener('click', () => { ownRating = Number(star.dataset.rating); localStorage.presenterRating = ownRating; render(state); request('/api/ratings', { clientId, rating: ownRating }); }));
  const graph = document.querySelector('#rating-graph');
  if (graph) {
    const values = state.ratingCounts, max = Math.max(1, ...values), points = values.map((value, i) => `${110 + i * 195},${216 - value / max * 160}`).join(' ');
    graph.innerHTML = `<path d="M70 216H940" stroke="#ffffff36"/><polyline class="chart-line" points="${points}"/>${values.map((value, i) => { const x = 110 + i * 195, y = 216 - value / max * 160; return `<circle class="chart-dot" cx="${x}" cy="${y}" r="8"/><text class="axis-label" x="${x}" y="247" text-anchor="middle">${i + 1} ★</text><text class="axis-label" x="${x}" y="${y - 16}" text-anchor="middle">${value}</text>`; }).join('')}`;
    document.querySelector('#response-total').textContent = `${values.reduce((a, b) => a + b, 0)} response${values.reduce((a, b) => a + b, 0) === 1 ? '' : 's'} received`;
  }
  const board = document.querySelector('#race-board');
  if (board) { const order = state.race.order.length ? state.race.order : state.playerNames; board.innerHTML = order.map((name, i) => `<div class="duck"><b>${state.race.order.length ? String(i + 1).padStart(2, '0') : '—'}</b><span>🦆</span>${name}</div>`).join(''); }
  document.querySelector('#run-race')?.addEventListener('click', () => request('/api/race', {}));
  document.querySelector('#edit-names')?.addEventListener('click', () => { document.querySelector('#names-panel').classList.add('open'); document.querySelector('#names-grid').innerHTML = state.playerNames.map((name, i) => `<input value="${name.replace(/"/g, '&quot;')}" aria-label="Player ${i + 1}">`).join(''); });
  document.querySelector('#close-names')?.addEventListener('click', () => document.querySelector('#names-panel').classList.remove('open'));
  document.querySelector('#save-names')?.addEventListener('click', () => request('/api/players', { playerNames: [...document.querySelectorAll('#names-grid input')].map((input) => input.value) }));
  document.querySelector('#save-game')?.addEventListener('click', () => request('/api/game', { gameUrl: document.querySelector('#game-url').value }));
}
function move(delta) { const currentSlide = Math.max(0, Math.min(7, state.currentSlide + delta)); if (currentSlide !== state.currentSlide) { render({ ...state, currentSlide }); request('/api/state', { currentSlide }); } }
document.querySelector('#previous').addEventListener('click', () => move(-1)); document.querySelector('#next').addEventListener('click', () => move(1));
document.addEventListener('keydown', (event) => { if (event.key === 'ArrowLeft') move(-1); if (['ArrowRight', ' '].includes(event.key)) { event.preventDefault(); move(1); } });
fetch('/api/state').then((r) => r.json()).then(render); new EventSource('/events').onmessage = (event) => render(JSON.parse(event.data));
