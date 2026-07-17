const http = require('http');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const clientStreams = new Set();
let currentSlide = 0;
const slideCount = 8;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function broadcast() {
  const message = `data: ${JSON.stringify({ currentSlide, slideCount })}\n\n`;
  for (const stream of clientStreams) stream.write(message);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    res.write(`data: ${JSON.stringify({ currentSlide, slideCount })}\n\n`);
    clientStreams.add(res);
    req.on('close', () => clientStreams.delete(res));
    return;
  }

  if (url.pathname === '/api/state' && req.method === 'GET') {
    return sendJson(res, 200, { currentSlide, slideCount });
  }

  if (url.pathname === '/api/state' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const requestedSlide = Number(JSON.parse(body).currentSlide);
        if (!Number.isInteger(requestedSlide) || requestedSlide < 0 || requestedSlide >= slideCount) {
          return sendJson(res, 400, { error: 'Invalid slide number' });
        }
        currentSlide = requestedSlide;
        broadcast();
        sendJson(res, 200, { currentSlide, slideCount });
      } catch {
        sendJson(res, 400, { error: 'Invalid request body' });
      }
    });
    return;
  }

  const requestedFile = url.pathname === '/viewer' ? 'viewer.html' : url.pathname === '/' ? 'presenter.html' : url.pathname.slice(1);
  const safeFile = path.normalize(requestedFile).replace(/^\.{2}(?:[\\/]|$)/, '');
  const filePath = path.join(publicDir, safeFile);
  if (!filePath.startsWith(publicDir)) return sendJson(res, 403, { error: 'Forbidden' });

  fs.readFile(filePath, (error, contents) => {
    if (error) return sendJson(res, 404, { error: 'Not found' });
    const extension = path.extname(filePath);
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
    res.writeHead(200, { 'Content-Type': types[extension] || 'application/octet-stream' });
    res.end(contents);
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`Presenter: http://localhost:${process.env.PORT || 3000}`);
  console.log(`Viewer:    http://localhost:${process.env.PORT || 3000}/viewer`);
});
