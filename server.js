const http = require('http');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const slideCount = 8;
const streams = new Set();
const state = {
  currentSlide: 0,
  ratings: {},
  playerNames: Array.from({ length: 19 }, (_, index) => `Player ${String(index + 1).padStart(2, '0')}`),
  race: { running: false, order: [] },
  gameUrl: 'https://example.com'
};

function snapshot() {
  const ratingCounts = [1, 2, 3, 4, 5].map((rating) => Object.values(state.ratings).filter((value) => value === rating).length);
  return { currentSlide: state.currentSlide, slideCount, ratingCounts, playerNames: state.playerNames, race: state.race, gameUrl: state.gameUrl };
}
function sendJson(res, code, payload) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(payload)); }
function broadcast() {
  const message = `data: ${JSON.stringify(snapshot())}\n\n`;
  for (const stream of streams) stream.write(message);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON')); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
    streams.add(res); req.on('close', () => streams.delete(res)); return;
  }
  if (url.pathname === '/api/state' && req.method === 'GET') return sendJson(res, 200, snapshot());

  try {
    const body = ['POST', 'PUT'].includes(req.method) ? await readBody(req) : null;
    if (url.pathname === '/api/state' && req.method === 'POST') {
      if (!Number.isInteger(body.currentSlide) || body.currentSlide < 0 || body.currentSlide >= slideCount) return sendJson(res, 400, { error: 'Invalid slide number' });
      state.currentSlide = body.currentSlide; broadcast(); return sendJson(res, 200, snapshot());
    }
    if (url.pathname === '/api/ratings' && req.method === 'POST') {
      if (!/^[a-z0-9-]{8,64}$/i.test(body.clientId) || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) return sendJson(res, 400, { error: 'Invalid rating' });
      state.ratings[body.clientId] = body.rating; broadcast(); return sendJson(res, 200, snapshot());
    }
    if (url.pathname === '/api/players' && req.method === 'POST') {
      if (!Array.isArray(body.playerNames) || body.playerNames.length !== 19) return sendJson(res, 400, { error: 'Exactly 19 names are required' });
      state.playerNames = body.playerNames.map((name, index) => String(name).trim().slice(0, 32) || `Player ${index + 1}`);
      state.race = { running: false, order: [] }; broadcast(); return sendJson(res, 200, snapshot());
    }
    if (url.pathname === '/api/race' && req.method === 'POST') {
      if (state.race.running) return sendJson(res, 409, { error: 'Race already running' });
      state.race = { running: true, order: [] }; broadcast();
      setTimeout(() => {
        state.race = { running: false, order: [...state.playerNames].sort(() => Math.random() - 0.5) };
        broadcast();
      }, 4200);
      return sendJson(res, 200, snapshot());
    }
    if (url.pathname === '/api/game' && req.method === 'POST') {
      try { state.gameUrl = new URL(body.gameUrl).toString(); } catch { return sendJson(res, 400, { error: 'Enter a valid full URL' }); }
      broadcast(); return sendJson(res, 200, snapshot());
    }
  } catch { return sendJson(res, 400, { error: 'Invalid request' }); }

  const requested = url.pathname === '/viewer' ? 'viewer.html' : url.pathname === '/' ? 'presenter.html' : url.pathname.slice(1);
  const filePath = path.join(publicDir, path.normalize(requested));
  if (!filePath.startsWith(publicDir)) return sendJson(res, 403, { error: 'Forbidden' });
  fs.readFile(filePath, (error, content) => {
    if (error) return sendJson(res, 404, { error: 'Not found' });
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
    res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' }); res.end(content);
  });
});
const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Presenter: http://localhost:${port}\nViewer: http://localhost:${port}/viewer`));
