// Шатахууны үнэ 92 симулятор — локал сервер.
//   GET  /                → public/ доторх статик файлууд
//   GET  /api/runs        → хадгалсан симуляциуд
//   POST /api/runs        → симуляци хадгалах
//   DELETE /api/runs/:id  → устгах
//   POST /api/chat        → загварын туслах (Claude API, Server-Sent Events)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { answer, describeError, assistantInfo } from './assistant.js';
import { createRunsStore } from './runs-store.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1'; // анхдагчаар зөвхөн энэ компьютерээс хандана
const runs = createRunsStore(path.join(ROOT, 'data', 'runs.json'));

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon' };

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req, limit) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw Object.assign(new Error('Хүсэлт хэт том байна'), { status: 413 }); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw Object.assign(new Error('JSON буруу байна'), { status: 400 }); }
}

async function serveStatic(req, res, pathname) {
  const rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  const file = path.resolve(PUBLIC, '.' + rel);
  if (!file.startsWith(PUBLIC + path.sep)) return json(res, 403, { error: 'Хориотой' });
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch { json(res, 404, { error: 'Олдсонгүй' }); }
}

async function handleChat(req, res) {
  const body = await readJson(req, 256 * 1024);
  const ctl = new AbortController();
  res.on('close', () => { if (!res.writableFinished) ctl.abort(); }); // хэрэглэгч «Зогсоох» дарвал
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
  const send = (ev) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(ev)}\n\n`); };
  try {
    await answer({ messages: body.messages, state: body.state, runs: await runs.list(), send, signal: ctl.signal });
    send({ type: 'done' });
  } catch (err) {
    if (!ctl.signal.aborted) { console.error('[chat]', err); send({ type: 'error', message: describeError(err) }); }
  } finally { res.end(); }
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    if (pathname === '/api/chat' && req.method === 'POST') return await handleChat(req, res);
    if (pathname === '/api/runs' && req.method === 'GET') return json(res, 200, { runs: await runs.list() });
    if (pathname === '/api/runs' && req.method === 'POST') return json(res, 200, { runs: await runs.add(await readJson(req, 512 * 1024)) });
    if (pathname.startsWith('/api/runs/') && req.method === 'DELETE') return json(res, 200, { runs: await runs.remove(decodeURIComponent(pathname.slice(10))) });
    if (pathname.startsWith('/api/')) return json(res, 404, { error: 'Олдсонгүй' });
    if (req.method === 'GET' || req.method === 'HEAD') return await serveStatic(req, res, pathname);
    json(res, 405, { error: 'Зөвшөөрөгдөөгүй' });
  } catch (err) {
    if (!res.headersSent) json(res, err.status || 400, { error: err.message });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Шатахууны үнэ 92 симулятор: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`Туслах: ${assistantInfo.model} (effort: ${assistantInfo.effort})${process.env.ANTHROPIC_API_KEY ? '' : ' — ANTHROPIC_API_KEY тохируулаагүй байна'}`);
});
