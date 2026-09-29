import { answer, describeError } from '../server/assistant.js';
import { getRunsStore, readJsonBody, methodNotAllowed } from '../server/vercel.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    const body = await readJsonBody(req);
    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) controller.abort();
    });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    const send = (event) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    await answer({
      messages: body.messages,
      state: body.state,
      runs: await getRunsStore().list(),
      send,
      signal: controller.signal,
    });
    send({ type: 'done' });
    res.end();
  } catch (error) {
    if (res.headersSent) {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify({ type: 'error', message: describeError(error) })}\n\n`);
      if (!res.writableEnded) res.end();
    } else {
      const status = error.status || 500;
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: describeError(error) }));
    }
  }
}
