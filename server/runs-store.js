// Хадгалсан симуляциудыг data/runs.json файлд хадгална (нэг хэрэглэгчийн локал апп).
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { cleanParams, SERIES_KEYS } from '../public/js/config.js';

const MAX_RUNS = 500;
const YEARS = 22; // 2014–2035

export function createRunsStore(file) {
  let queue = Promise.resolve(); // бичилтүүдийг дараалалд оруулж, зэрэг бичихээс сэргийлнэ

  async function readAll() {
    try { return JSON.parse(await readFile(file, 'utf8')); }
    catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  }
  async function writeAll(runs) {
    await mkdir(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    await writeFile(tmp, JSON.stringify(runs, null, 1));
    await rename(tmp, file);
  }
  const serial = (fn) => (queue = queue.then(fn, fn));

  return {
    list: readAll,
    add: (input) => serial(async () => {
      const name = typeof input?.name === 'string' ? input.name.trim().slice(0, 80) : '';
      if (!name) throw new Error('Нэр хоосон байна');
      const { res: params } = cleanParams(input.params);
      const series = {};
      for (const k of SERIES_KEYS) {
        const a = input.series?.[k];
        if (!Array.isArray(a) || a.length !== YEARS || !a.every(Number.isFinite)) throw new Error(`«${k}» цуврал буруу байна`);
        series[k] = a;
      }
      const runs = await readAll();
      if (runs.length >= MAX_RUNS) throw new Error(`Хамгийн ихдээ ${MAX_RUNS} симуляци хадгална. Хуучнаасаа устгана уу.`);
      runs.push({ id: randomUUID(), name, createdAt: Date.now(), params, series, v: 1 });
      await writeAll(runs);
      return runs;
    }),
    remove: (id) => serial(async () => {
      const runs = (await readAll()).filter(r => r.id !== id);
      await writeAll(runs);
      return runs;
    }),
  };
}
