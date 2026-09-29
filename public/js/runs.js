// Хадгалсан симуляциуд: сервер дээрх data/runs.json-д хадгалагдана (/api/runs)
import { DEFAULTS } from './model.js';
import { PARAM_NAMES, ALL_CHARTS, SERIES_KEYS, cleanParams, paramDiff } from './config.js';
import { num, compact, fmtDate } from './format.js';
import { el, downloadText, safeName } from './dom.js';

const MAX_SHOWN = 4;
const LS_SHOWN = 'fuel92-shown'; // графикт харьцуулж буй симуляцууд (зөвхөн энэ хөтчийн тохиргоо)

export function initRuns(app) {
  const $ = (id) => document.getElementById(id);
  const ui = { where:$('saved-where'), count:$('saved-count'), form:$('save-form'), name:$('save-name'),
    btn:$('save-btn'), msg:$('save-msg'), list:$('runs'), empty:$('runs-empty') };
  let runs = [];
  const slotOf = app.slotOf;
  try { Object.assign(slotOf, JSON.parse(localStorage.getItem(LS_SHOWN) || '{}')); } catch {}
  const persistShown = () => { try { localStorage.setItem(LS_SHOWN, JSON.stringify(slotOf)); } catch {} };

  app.shownRuns = () => runs.filter(s => slotOf[s.id]).sort((a, b) => slotOf[a.id] - slotOf[b.id]);
  app.savedRuns = () => runs;

  function flash(t) { ui.msg.textContent = t; clearTimeout(flash.t); flash.t = setTimeout(() => { ui.msg.textContent = ''; }, 4000); }

  async function api(method, path = '', body) {
    const res = await fetch('/api/runs' + path, {
      method, headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  function setRuns(list) {
    runs = list.filter(s => s && typeof s.name === 'string' && s.series).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    let changed = false;
    for (const id of Object.keys(slotOf)) if (!runs.some(s => s.id === id)) { delete slotOf[id]; changed = true; }
    if (changed) persistShown();
    render(); app.recompute();
  }

  function csvForRun(s) {
    const q = (x) => '"' + String(x).replace(/"/g, '""') + '"';
    const rows = [['Он', ...ALL_CHARTS.map(c => `${c.name} (${c.unit})`)].map(q).join(',')];
    app.years.forEach((y, i) => rows.push([y, ...ALL_CHARTS.map(c => { const v = s.series?.[c.k]?.[i]; return v == null ? '' : +Number(v).toFixed(6); })].join(',')));
    const ps = Object.keys(DEFAULTS).map(k => `# ${PARAM_NAMES[k] || k} = ${s.params?.[k] ?? DEFAULTS[k]}`);
    return [`# Хадгалсан симуляци: ${s.name} (${fmtDate(s.createdAt)})`, ...ps, ...rows].join('\r\n');
  }

  function render() {
    ui.count.textContent = runs.length ? String(runs.length) : '';
    ui.empty.hidden = runs.length > 0;
    ui.list.replaceChildren(...runs.map(s => {
      const on = !!slotOf[s.id];
      const cb = el('input', {type:'checkbox', 'aria-label':`${s.name} — графикт харьцуулах`}); cb.checked = on;
      const sw = el('i', {class:'swatch'}); if (on) sw.style.borderTopColor = `var(--c${slotOf[s.id]})`;
      cb.addEventListener('change', () => {
        if (cb.checked) {
          const used = new Set(Object.values(slotOf)); const free = [1, 2, 3, 4].find(n => !used.has(n));
          if (!free) { cb.checked = false; flash(`Нэг дор ${MAX_SHOWN} хүртэл симуляци харьцуулна. Аль нэгийг нь унтраана уу.`); return; }
          slotOf[s.id] = free;
        } else delete slotOf[s.id];
        persistShown(); render(); app.recompute();
      });
      const diff = paramDiff(s.params || {});
      const last = (k) => s.series?.[k]?.[app.years.length - 1] ?? 0;
      const load = el('button', {class:'mini', type:'button', text:'Ачаалах', title:'Энэ симуляцийн параметрүүдийг гулсууруудад тавина'});
      load.addEventListener('click', () => { app.setParams(cleanParams(s.params).res, { reset: true }); flash(`«${s.name}»-ийн параметрүүдийг ачааллаа.`); });
      const dl = el('button', {class:'mini', type:'button', text:'CSV ↓'});
      dl.addEventListener('click', () => downloadText(dl, `fuel92_${safeName(s.name)}.csv`, csvForRun(s)));
      const del = el('button', {class:'mini danger', type:'button', text:'Устгах'});
      let armed = false;
      del.addEventListener('click', async () => {
        if (!armed) { armed = true; del.textContent = 'Устгах уу? Дахин дар'; setTimeout(() => { armed = false; del.textContent = 'Устгах'; }, 3500); return; }
        del.disabled = true;
        try { setRuns((await api('DELETE', '/' + encodeURIComponent(s.id))).runs); flash(`«${s.name}»-ийг устгалаа.`); }
        catch { del.disabled = false; flash('Устгаж чадсангүй. Сервер ажиллаж байгаа эсэхийг шалгана уу.'); }
      });
      return el('div', {class:'run'},
        el('label', {class:'sw'}, cb, sw),
        el('div', {},
          el('div', {class:'nm', text:s.name}),
          el('div', {class:'sub'}, `${fmtDate(s.createdAt)} · `, diff.length ? diff.join(' · ') : 'бүх параметр анхны утгатай'),
          el('div', {class:'sub'}, '2035: үнэ ', el('span', {class:'kv', text:num(last('price')) + ' ₮/л'}), ' · инфляци ', el('span', {class:'kv', text:num(last('infl'), 2) + '%'}), ' · нөөц ', el('span', {class:'kv', text:compact(last('reserve')) + ' т'}))),
        el('div', {class:'acts'}, load, dl, del));
    }));
  }

  ui.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = ui.name.value.trim() || `Симуляци ${fmtDate(Date.now())}`;
    const series = {}; for (const k of SERIES_KEYS) series[k] = app.run.map(r => +r[k].toPrecision(10));
    ui.btn.disabled = true;
    try {
      setRuns((await api('POST', '', { name, params: { ...app.state }, series })).runs);
      ui.name.value = ''; flash(`«${name}» хадгалагдлаа.`);
    } catch (err) { flash('Хадгалж чадсангүй: ' + err.message); }
    finally { ui.btn.disabled = false; }
  });

  api('GET').then(d => {
    ui.where.textContent = 'Энэ компьютерийн data/runs.json файлд хадгалагдана';
    ui.btn.disabled = false;
    setRuns(d.runs || []);
  }).catch(() => {
    ui.where.textContent = 'Сервертэй холбогдож чадсангүй — «npm start»-аар ажиллуулна уу';
  });
}
