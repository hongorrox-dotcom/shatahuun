// Симуляторын үндсэн модуль: гулсуур, график, хүснэгт, CSV, табууд
import { simulate, DEFAULTS } from './model.js';
import { SECTORS, PARAMS, PARAM_NAMES } from './config.js';
import { num, compact } from './format.js';
import { el, downloadText } from './dom.js';
import { makeChart, compareDataset, applyTheme, renderBoard } from './charts.js';
import { initRuns } from './runs.js';
import { initChat } from './chat.js';

const baseRun = simulate(DEFAULTS);
const years = baseRun.map(r => r.t);
const charts = [];
const views = { s1: 'chart', s2: 'chart' };

// Бусад модулиудтай хуваалцах төлөв
const app = {
  state: { ...DEFAULTS },
  run: baseRun,
  baseRun,
  years,
  shownRuns: () => [],        // runs.js солино
  slotOf: {},                 // runs.js солино
  recompute,
  // Гаднаас (хадгалсан симуляци, туслах) параметр тавих
  setParams(params, { reset = false } = {}) {
    if (reset) Object.assign(app.state, DEFAULTS);
    Object.assign(app.state, params);
    for (const p of Object.values(PARAMS)) p._sync?.();
    recompute();
  },
};

function buildSector(id) {
  const S = SECTORS[id], root = document.getElementById(id);
  const panel = el('aside', {class:'panel'}, el('h2', {}, 'Параметрүүд', el('span', {text:'| = анхны утга'})));
  const list = el('div', {class:'params'});
  for (const p of S.params) {
    const scale = p.scale || 1;
    const inp = el('input', {type:'range', id:`p-${p.k}`, min:p.min, max:p.max, step:p.step, value:app.state[p.k] / scale});
    const val = el('span', {class:'val def'});
    const frac = (v) => Math.min(1, Math.max(0, (v / scale - p.min) / (p.max - p.min)));
    const upd = () => {
      val.textContent = p.fmt(app.state[p.k]);
      val.classList.toggle('def', app.state[p.k] === DEFAULTS[p.k]);
      inp.style.setProperty('--fill', (frac(app.state[p.k]) * 100) + '%');
    };
    const notch = el('span', {class:'notch', 'aria-hidden':'true'});
    notch.style.left = `calc(5px + (100% - 10px) * ${frac(DEFAULTS[p.k])})`;
    inp.addEventListener('input', () => { app.state[p.k] = +inp.value * scale; upd(); recompute(); });
    p._sync = () => { inp.value = app.state[p.k] / scale; upd(); };
    upd();
    const box = el('div', {class:'param'}, el('label', {for:`p-${p.k}`}, el('span', {text:p.name}), val), el('div', {class:'rng'}, inp, notch));
    if (p.ticks) box.append(el('div', {class:'ticks'}, el('span', {text:p.ticks[0]}), el('span', {text:p.ticks[1]})));
    if (p.hint) box.append(el('div', {class:'hint', text:p.hint}));
    list.append(box);
  }
  panel.append(list);
  const reset = el('button', {class:'btn primary', type:'button', text:'Анхны утгад буцаах'});
  reset.addEventListener('click', () => { for (const p of S.params) { app.state[p.k] = DEFAULTS[p.k]; p._sync(); } recompute(); });
  panel.append(el('div', {class:'actions'}, reset));
  if (id === 's1') { S.readout = el('div', {class:'readout'}); panel.append(S.readout); }

  const main = el('div', {class:'main'});
  const seg = el('div', {class:'seg', role:'group', 'aria-label':'Харагдац'});
  const bC = el('button', {type:'button', 'aria-pressed':'true', text:'График'});
  const bT = el('button', {type:'button', 'aria-pressed':'false', text:'Хүснэгт'});
  seg.append(bC, bT);
  const dlAll = el('button', {class:'btn', type:'button', text:'Бүх графикийг CSV татах'});
  S.legend = el('div', {class:'legend'});
  main.append(el('div', {class:'bar'}, S.legend, el('div', {style:'display:flex;gap:8px;flex-wrap:wrap'}, seg, dlAll)));
  const grid = el('div', {class:'grid'});
  const tbl = el('div', {class:'tablewrap', hidden:''});
  main.append(grid, tbl);
  S.tbl = tbl;
  const setView = (v) => {
    views[id] = v;
    bC.setAttribute('aria-pressed', v === 'chart'); bT.setAttribute('aria-pressed', v === 'table');
    grid.hidden = v !== 'chart'; tbl.hidden = v !== 'table';
    if (v === 'table') renderTable(id);
  };
  bC.addEventListener('click', () => setView('chart'));
  bT.addEventListener('click', () => setView('table'));
  dlAll.addEventListener('click', () => downloadText(dlAll, `fuel92_${id === 's1' ? 'sektor1_hereglee' : 'sektor2_urtug'}.csv`, csvFor(S.charts)));

  for (const c of S.charts) {
    const end = el('div', {class:'end'});
    const canvas = el('canvas', {role:'img', 'aria-label':`${c.name}, 2014–2035`});
    const dl = el('button', {class:'mini', type:'button', title:`${c.name} — CSV татах`, 'aria-label':`${c.name} өгөгдлийг CSV-ээр татах`, text:'CSV ↓'});
    dl.addEventListener('click', () => downloadText(dl, `fuel92_${c.k}.csv`, csvFor([c])));
    grid.append(el('div', {class:'card' + (c.feature ? ' feature' : '')},
      el('div', {class:'card-h'}, el('h3', {}, c.name, el('br'), el('span', {class:'unit', text:c.unit})), end),
      el('div', {class:'cv'}, canvas),
      el('div', {class:'card-f'}, dl)));
    c._end = end;
    c._chart = makeChart(canvas, c, years);
    charts.push(c._chart);
  }
  root.append(panel, main);
}

// CSV: хувилбар, суурь, харьцуулж буй хадгалсан симуляциуд
function csvFor(list) {
  const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
  const cmp = app.shownRuns();
  const head = ['Он'];
  list.forEach(c => { head.push(`${c.name} (${c.unit}) — хувилбар`, `${c.name} (${c.unit}) — суурь`); cmp.forEach(s => head.push(`${c.name} (${c.unit}) — ${s.name}`)); });
  const rows = [head.map(q).join(',')];
  app.run.forEach((r, i) => {
    const row = [r.t];
    list.forEach(c => {
      row.push(+r[c.k].toFixed(6), +baseRun[i][c.k].toFixed(6));
      cmp.forEach(s => { const v = s.series?.[c.k]?.[i]; row.push(v == null ? '' : +Number(v).toFixed(6)); });
    });
    rows.push(row.join(','));
  });
  const ps = Object.keys(DEFAULTS).map(k => `# ${PARAM_NAMES[k] || k} = ${app.state[k]}`);
  return ['# Шатахууны үнэ 92 симулятор — параметрүүд', ...ps, ...rows].join('\r\n');
}

function renderTable(id) {
  const S = SECTORS[id];
  const hr = el('tr', {}, el('th', {text:'Он'}));
  S.charts.forEach(c => hr.append(el('th', {}, c.name, el('br'), el('span', {class:'unit', text:c.unit}))));
  const tb = el('tbody');
  app.run.forEach(r => {
    const tr = el('tr', {class: r.t > 2025 ? 'proj' : ''}, el('td', {text:String(r.t)}));
    S.charts.forEach(c => tr.append(el('td', {text:num(r[c.k], c.d)})));
    tb.append(tr);
  });
  S.tbl.replaceChildren(el('table', {}, el('thead', {}, hr), tb));
}

function renderLegend(S) {
  const items = [
    el('span', {}, el('i', {class:'key'}), 'Хувилбар (таны тохиргоо)'),
    el('span', {}, el('i', {class:'key base'}), 'Суурь (анхны утга)'),
  ];
  for (const s of app.shownRuns()) {
    const k = el('i', {class:'key'}); k.style.borderTopColor = `var(--c${app.slotOf[s.id]})`;
    items.push(el('span', {}, k, s.name));
  }
  S.legend.replaceChildren(...items);
}

function recompute() {
  const run = app.run = simulate(app.state);
  const shown = app.shownRuns();
  for (const id of ['s1', 's2']) {
    const S = SECTORS[id];
    for (const c of S.charts) {
      const ch = c._chart;
      ch.data.datasets[0].data = run.map(r => r[c.k]);
      ch.data.datasets[1].data = baseRun.map(r => r[c.k]);
      ch.data.datasets.length = 2;
      for (const s of shown) ch.data.datasets.push(compareDataset(s.name, app.slotOf[s.id], years.map((y, i) => s.series?.[c.k]?.[i] ?? null)));
      ch.update('none');
      const v = run.at(-1)[c.k], b = baseRun.at(-1)[c.k];
      const diff = v - b, rel = b !== 0 ? diff / Math.abs(b) : 0;
      let dTxt = 'суурьтай ижил', cls = 'd';
      if (Math.abs(diff) > 1e-9 * Math.max(1, Math.abs(b))) {
        dTxt = (diff > 0 ? '+' : '−') + (b !== 0 ? num(Math.abs(rel) * 100, 1) + '%' : compact(Math.abs(diff))) + ' суурьтай харьц.';
        cls += diff > 0 ? ' up' : ' down';
      }
      c._end.replaceChildren(el('div', {class:'v', text:num(v, c.d)}), el('div', {class:cls, text:'2035 · ' + dTxt}));
    }
    if (views[id] === 'table') renderTable(id);
    renderLegend(S);
  }
  renderBoard(document.getElementById('board'), run.at(-1), baseRun.at(-1), shown.length);
  const S1 = SECTORS.s1, row = run.find(r => r.tankBudget > 0), tRow = run.find(r => r.tank > 0);
  S1.readout.replaceChildren();
  if (row) S1.readout.append('Сав барих төсөв: ', el('b', {text:num(row.tankBudget / 1e9, 0) + ' тэрбум ₮'}), ` (${row.t} он). Нийлүүлэлтэд нэмэгдэх: `, el('b', {text:num(tRow.tank) + ' тонн'}), '.');
  else S1.readout.append('Нөөцийн сав нэмэгдүүлэх он 2035-аас хойш байгаа тул сав 2014–2035 хооронд ашиглалтад орохгүй (төсөв = 0).');
}

// ── Табууд ──
const tabs = [...document.querySelectorAll('.tab')];
function selectTab(tab) {
  tabs.forEach(t => {
    const on = t === tab;
    t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  });
  try { localStorage.setItem('fuel92-tab', tab.id); } catch {}
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      selectTab(n); n.focus();
    }
  });
});

// ── Эхлүүлэх ──
buildSector('s1'); buildSector('s2');
initRuns(app);
applyTheme(charts); recompute();
initChat(app);
let savedTab = null; try { savedTab = localStorage.getItem('fuel92-tab'); } catch {}
const hashTab = location.hash === '#s2' ? 'tab-s2' : location.hash === '#s1' ? 'tab-s1' : null;
const start = document.getElementById(hashTab || savedTab || 'tab-s1'); if (start) selectTab(start);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(charts));
