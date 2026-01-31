import http from 'http';

const PORT = 4000;

let itemsStore = [];

const sendJson = (res, code, obj) => {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
};

const collectRequestData = (req) => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => resolve(body));
  req.on('error', err => reject(err));
});

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/items') {
    try {
      const raw = await collectRequestData(req);
      const payload = JSON.parse(raw || '{}');
      // assign an id and store
      const id = itemsStore.length + 1;
      const item = { id, ...payload };
      itemsStore.push(item);
      sendJson(res, 201, { success: true, item });
    } catch (err) {
      sendJson(res, 400, { success: false, error: 'Invalid JSON' });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/items/bulk') {
    try {
      const raw = await collectRequestData(req);
      const payload = JSON.parse(raw || '[]');
      if (!Array.isArray(payload)) {
        sendJson(res, 400, { success: false, error: 'Expected array' });
        return;
      }
      const created = payload.map((p, i) => {
        const id = itemsStore.length + 1;
        const it = { id, ...p };
        itemsStore.push(it);
        return it;
      });
      sendJson(res, 201, { success: true, createdCount: created.length, created });
    } catch (err) {
      sendJson(res, 400, { success: false, error: 'Invalid JSON' });
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/api/items') {
    sendJson(res, 200, { success: true, items: itemsStore });
    return;
  }

  // default 404
  sendJson(res, 404, { success: false, error: 'Not found' });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Mock API server listening on http://localhost:${PORT}`);
});
