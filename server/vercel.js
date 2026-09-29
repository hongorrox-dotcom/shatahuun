import { createRunsStore } from './runs-store.js';

const runs = createRunsStore('/tmp/fuel92-runs.json');

export function getRunsStore() {
  return runs;
}

export async function readJsonBody(req, limit = 256 * 1024) {
  if (req.body && typeof req.body === 'object') return req.body;
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Хүсэлт хэт том байна'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw Object.assign(new Error('JSON буруу байна'), { status: 400 });
  }
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  res.statusCode = 405;
  res.end(JSON.stringify({ error: 'Зөвшөөрөгдөөгүй' }));
}

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
