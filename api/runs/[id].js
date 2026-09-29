import { getRunsStore, methodNotAllowed, sendJson } from '../../server/vercel.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return methodNotAllowed(res, ['DELETE']);
  try {
    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    return sendJson(res, 200, { runs: await getRunsStore().remove(decodeURIComponent(id || '')) });
  } catch (error) {
    sendJson(res, error.status || 400, { error: error.message });
  }
}
