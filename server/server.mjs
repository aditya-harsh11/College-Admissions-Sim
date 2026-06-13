// Tiny local API that stores study responses in a SQLite database file you can open in VS Code
// (e.g. the "SQLite Viewer" extension). Uses Node's built-in `node:sqlite` — no native build, no
// extra dependencies. This is a stand-in for the eventual real store (Google Sheet / Qualtrics);
// it's here so we can show Randy that responses land in a database.
//
// Run it alongside the app:  node server/server.mjs   (or: npm run server)
// The Vite dev server proxies /api → here (see vite.config.ts).

import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';

const PORT = 3001;
const DB_PATH = 'data/responses.db';

mkdirSync('data', { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS responses (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    p3_name         TEXT,
    p3_school       TEXT,
    p3_group        TEXT,
    p4_pre_weights  TEXT,
    p6_post_weights TEXT,
    condition       TEXT,
    duration_ms     INTEGER,
    event_count     INTEGER,
    payload         TEXT
  )
`);

const insert = db.prepare(`
  INSERT INTO responses
    (p3_name, p3_school, p3_group, p4_pre_weights, p6_post_weights, condition, duration_ms, event_count, payload)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const send = (res, code, obj) => {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  });
  res.end(JSON.stringify(obj));
};

createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});

  if (req.method === 'POST' && req.url === '/api/response') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const p = JSON.parse(body);
        insert.run(
          p.name ?? null,
          p.school?.label ?? null,
          p.group?.label ?? null,
          p.preWeights ? JSON.stringify(p.preWeights) : null,
          p.postWeights ? JSON.stringify(p.postWeights) : p.weights ? JSON.stringify(p.weights) : null,
          p.condition ?? null,
          p.durationMs ?? null,
          Array.isArray(p.events) ? p.events.length : null,
          body,
        );
        console.log(`[server] stored response from ${p.name} (condition ${p.condition})`);
        send(res, 200, { ok: true });
      } catch (e) {
        send(res, 400, { ok: false, error: String(e) });
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/responses') {
    const rows = db
      .prepare('SELECT id, p3_name, p3_school, p3_group, condition, duration_ms, event_count FROM responses ORDER BY id DESC')
      .all();
    return send(res, 200, rows);
  }

  send(res, 404, { error: 'not found' });
}).listen(PORT, () => {
  console.log(`[server] responses API → http://localhost:${PORT}  ·  DB: ${DB_PATH}`);
});
