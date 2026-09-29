// Chart.js графикууд ба толгойн LED үнийн самбар
import { el, css } from './dom.js';
import { num, compact } from './format.js';

export function makeChart(canvas, c, years) {
  return new Chart(canvas, {
    type: c.bar ? 'bar' : 'line',
    data: { labels: years, datasets: [
      { label:'Хувилбар', data:[], borderWidth:2, pointRadius:0, pointHoverRadius:4, tension:0, borderRadius:3, barPercentage:.9, categoryPercentage:.7 },
      { label:'Суурь', data:[], borderWidth:c.bar?0:1.5, borderDash:[5,4], pointRadius:0, pointHoverRadius:3, tension:0, borderRadius:3, barPercentage:.9, categoryPercentage:.7 },
    ]},
    options: {
      animation:false, maintainAspectRatio:false, responsive:true,
      interaction:{ mode:'index', intersect:false },
      plugins:{ legend:{display:false},
        tooltip:{ callbacks:{ label:(ctx)=>` ${ctx.dataset.label}: ${num(ctx.parsed.y, c.d)}` } } },
      scales:{
        x:{ grid:{display:false}, ticks:{ maxRotation:0, autoSkip:true, callback:(v,i)=>((years[i]-2014)%3===0 ? years[i] : '') } },
        y:{ ticks:{ maxTicksLimit:5, callback:(v)=>compact(v) }, border:{display:false} },
      },
    },
    plugins:[{ id:'nowline', beforeDraw(ch){ // 2025: түүхэн өгөгдөл / төсөөллийн зааг
      const x=ch.scales.x.getPixelForValue(years.indexOf(2025)); const {top,bottom}=ch.chartArea; const g=ch.ctx;
      g.save(); g.strokeStyle=css('--line-2'); g.setLineDash([2,3]); g.beginPath(); g.moveTo(x,top); g.lineTo(x,bottom); g.stroke();
      g.fillStyle=css('--muted'); g.font='11px '+css('--mono'); g.textAlign='left'; g.fillText('төсөөлөл →', x+4, top+10); g.restore(); } }],
  });
}

// Харьцуулж буй хадгалсан симуляцийн шугам
export function compareDataset(label, slot, data) {
  const col = css('--c' + slot);
  return { label, _slot:slot, data, borderColor:col, backgroundColor:col, pointHoverBackgroundColor:col, pointHoverBorderColor:css('--surface'),
    borderWidth:1.75, pointRadius:0, pointHoverRadius:3, tension:0, borderRadius:3, barPercentage:.9, categoryPercentage:.7 };
}

export function applyTheme(charts) {
  const ink2=css('--ink-2'), muted=css('--muted'), line=css('--line'), scen=css('--scen'), base=css('--base'), surf=css('--surface'), ink=css('--ink');
  Chart.defaults.font.family = css('--sans');
  for (const ch of charts) {
    const [a, b] = ch.data.datasets;
    const isBar = ch.config.type === 'bar';
    a.borderColor=scen; a.backgroundColor=scen; a.pointHoverBackgroundColor=scen; a.pointHoverBorderColor=surf;
    b.borderColor=base; b.backgroundColor=isBar?base+'88':base; b.pointHoverBackgroundColor=base; b.pointHoverBorderColor=surf;
    for (const d of ch.data.datasets.slice(2)) { const col=css('--c'+d._slot); d.borderColor=col; d.backgroundColor=col; d.pointHoverBackgroundColor=col; d.pointHoverBorderColor=surf; }
    const o = ch.options;
    o.scales.x.ticks.color=muted; o.scales.y.ticks.color=muted; o.scales.y.grid={color:line, drawTicks:false};
    o.scales.x.ticks.font={family:css('--mono'),size:10.5}; o.scales.y.ticks.font={family:css('--mono'),size:10.5}; o.scales.y.ticks.padding=6;
    o.scales.x.border={color:css('--line-2')};
    Object.assign(o.plugins.tooltip, { backgroundColor:surf, titleColor:ink, bodyColor:ink2, borderColor:css('--line-2'), borderWidth:1, padding:10,
      titleFont:{family:css('--mono'),weight:'500'}, bodyFont:{family:css('--mono')}, usePointStyle:true, boxWidth:14, boxHeight:2 });
    ch.update('none');
  }
}

// ── LED самбар: 7 сегментийн цифр ──
const SEG = { '0':'abcdef','1':'bc','2':'abged','3':'abgcd','4':'fgbc','5':'afgcd','6':'afgedc','7':'abc','8':'abcdefg','9':'abcdfg','-':'g',' ':'' };
const SEG_R = { a:[2,0,8,2], b:[10,2,2,8], c:[10,12,2,8], d:[2,20,8,2], e:[0,12,2,8], f:[0,2,2,8], g:[2,10,8,2] };
const SVGNS = 'http://www.w3.org/2000/svg';
function rect(attrs) { const r = document.createElementNS(SVGNS, 'rect'); for (const [k, v] of Object.entries(attrs)) r.setAttribute(k, v); return r; }

function seg7(text, label) {
  const svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('class','seg7'); svg.setAttribute('role','img'); svg.setAttribute('aria-label',label);
  const g = document.createElementNS(SVGNS, 'g'); g.setAttribute('transform','skewX(-7) translate(2 0)'); svg.append(g);
  let x = 0;
  for (const ch of text) {
    if (ch === '.' || ch === ',') { g.append(rect({x:x-1,y:20,width:2.4,height:2.2,rx:.5,class:'on'})); x += 4; continue; }
    if (ch === '_') { x += 5; continue; } // мянгатын зай
    const on = SEG[ch] ?? '';
    for (const [s, [sx, sy, w, h]] of Object.entries(SEG_R)) g.append(rect({x:x+sx, y:sy, width:w, height:h, rx:.9, class:on.includes(s)?'on':'off'}));
    x += 15;
  }
  svg.setAttribute('viewBox', `0 -1 ${x+2} 24`);
  return svg;
}
function ledNum(v, d = 0) {
  const neg = v < 0; const [i, f] = Math.abs(v).toFixed(d).split('.');
  return (neg ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '_') + (f ? '.' + f : '');
}

export function renderBoard(node, last, base, comparing) {
  const rel = (last.price - base.price) / base.price;
  const dTxt = Math.abs(rel) < 5e-5 ? 'суурьтай ижил' : `${rel > 0 ? '+' : '−'}${num(Math.abs(rel) * 100, 1)}% суурьтай харьц.`;
  const cell = (lbl, v, d, unit, aria) => el('div', {class:'cell'}, el('span', {class:'lbl', text:lbl}), el('div', {class:'row'}, seg7(ledNum(v, d), aria), el('span', {class:'u', text:unit})));
  node.replaceChildren(
    el('div', {class:'cap'}, el('span', {}, 'АИ-92 · ', el('i', {text:'2035'}), ' он'), el('span', {text: comparing ? `+${comparing} харьцуулалт` : 'таны хувилбар'})),
    el('div', {class:'cell main'}, seg7(ledNum(last.price), `2035 оны үнэ ${num(last.price)} төгрөг литр тутамд`), el('div', {class:'side'}, el('span', {class:'u', text:'₮/л'}), el('span', {class:'delta', text:dTxt}))),
    cell('Суурь', base.price, 0, '₮/л', `Суурь үнэ ${num(base.price)}`),
    cell('Инфляци', last.infl, 1, '%', `Инфляци ${num(last.infl, 1)} хувь`),
  );
}
