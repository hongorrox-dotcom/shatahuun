import { getRunsStore, readJsonBody, methodNotAllowed, sendJson } from '../server/vercel.js';

export default async function handler(req, res) {
  try {
    const store = getRunsStore();
    if (req.method === 'GET') return sendJson(res, 200, { runs: await store.list() });
    if (req.method === 'POST') return sendJson(res, 200, { runs: await store.add(await readJsonBody(req, 512 * 1024)) });
    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (error) {
    sendJson(res, error.status || 400, { error: error.message });
  }
}
