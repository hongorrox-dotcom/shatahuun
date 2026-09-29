// Загварын туслах: сервер дээрх /api/chat (Claude API)-тай SSE-ээр харилцана.
// API түлхүүр зөвхөн серверт байна; хөтөч рүү хэзээ ч ирэхгүй.
import { cleanParams } from './config.js';
import { el } from './dom.js';

const SUGGEST = [
  'Энэ загвар хэрхэн ажилладаг вэ?',
  'НӨАТ-ыг 12% болговол 2035 онд үнэ хэд болох вэ?',
  '2028 онд 300 мянган тонны сав барьж, нийтийн тээврийг 15% нэмэгдүүлбэл?',
  'Одоогийн тохиргооны үр дүнг тайлбарла',
];
const STATUS = {
  get_parameters: 'Параметрүүдийг уншиж байна…',
  run_scenario: 'Хувилбар симуляци хийж байна…',
  set_parameters: 'Гулсууруудыг тохируулж байна…',
  list_saved_runs: 'Хадгалсан симуляцуудыг уншиж байна…',
};

function inline(parent, text) { // **тод** → <strong>, бусдыг текстээр
  text.split(/(\*\*[^*]+\*\*)/g).forEach(s => {
    if (/^\*\*[^*]+\*\*$/.test(s)) parent.append(el('strong', {text:s.slice(2, -2)}));
    else if (s) parent.append(s);
  });
}
function renderMd(node, text) {
  node.replaceChildren(); let ul = null;
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const m = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/);
    if (m) { if (!ul) { ul = el('ul'); node.append(ul); } const li = el('li'); inline(li, m[1]); ul.append(li); continue; }
    ul = null; if (!line.trim()) continue;
    const p = el('p'); inline(p, line.replace(/^#+\s*/, '')); node.append(p);
  }
}

// fetch-ийн хариуг Server-Sent Events болгон задлах
async function* readSSE(res) {
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const data = chunk.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
      if (data) yield JSON.parse(data);
    }
  }
}

export function initChat(app) {
  const $ = (id) => document.getElementById(id);
  const chatEl = $('chat'), fab = $('chat-open'), msgs = $('chat-msgs'), form = $('chat-form');
  const input = $('chat-input'), sendBtn = $('chat-send'), chips = $('chat-chips');
  const turns = []; // [{role, content}] — зөвхөн текст; хэрэгслийн дэлгэрэнгүйг сервер тухайн ээлжид л хадгална
  let ctl = null;

  const openChat = (on) => { chatEl.hidden = !on; fab.hidden = on; fab.setAttribute('aria-expanded', on); (on ? input : fab).focus(); };
  fab.addEventListener('click', () => openChat(true));
  $('chat-close').addEventListener('click', () => openChat(false));
  chatEl.addEventListener('keydown', e => { if (e.key === 'Escape') openChat(false); });

  const addMsg = (role, text) => {
    const m = el('div', {class:'msg ' + role});
    if (role === 'bot') renderMd(m, text); else m.textContent = text;
    msgs.append(m); msgs.scrollTop = msgs.scrollHeight; return m;
  };
  SUGGEST.forEach(s => {
    const b = el('button', {class:'chip', type:'button', text:s});
    b.addEventListener('click', () => { input.value = s; form.requestSubmit(); });
    chips.append(b);
  });

  const setBusy = (b) => { sendBtn.textContent = b ? 'Зогсоох' : 'Илгээх'; sendBtn.classList.toggle('stop', b); sendBtn.type = b ? 'button' : 'submit'; input.disabled = b; };
  sendBtn.addEventListener('click', e => { if (ctl) { e.preventDefault(); ctl.abort(); } });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; });

  async function ask(q) {
    addMsg('user', q); chips.hidden = true;
    turns.push({ role: 'user', content: q });
    const bubble = addMsg('bot', 'Бодож байна…');
    const status = el('span', {class:'status'});
    let text = '';
    const paint = () => { renderMd(bubble, text || 'Бодож байна…'); if (status.textContent) bubble.append(status); msgs.scrollTop = msgs.scrollHeight; };
    ctl = new AbortController(); setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
        body: JSON.stringify({ messages: turns.slice(-16), state: app.state }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Сервер ${res.status} алдаа буцаалаа`);
      }
      for await (const ev of readSSE(res)) {
        if (ev.type === 'text') { text += ev.text; status.textContent = ''; paint(); }
        else if (ev.type === 'round') { if (text && !text.endsWith('\n')) text += '\n\n'; }
        else if (ev.type === 'tool') { status.textContent = STATUS[ev.name] || 'Ажиллаж байна…'; paint(); }
        else if (ev.type === 'set_params') { app.setParams(cleanParams(ev.params).res); }
        else if (ev.type === 'error') throw new Error(ev.message);
      }
      status.textContent = '';
      if (!text.trim()) throw new Error('Хариу хоосон ирлээ. Асуултаа өөрөөр бичээд дахин илгээнэ үү.');
      paint();
      turns.push({ role: 'assistant', content: text });
    } catch (e) {
      status.textContent = '';
      if (text) paint(); else bubble.remove();
      if (e.name === 'AbortError') { if (text) turns.push({ role: 'assistant', content: text }); else turns.pop(); }
      else {
        if (text) turns.push({ role: 'assistant', content: text }); else turns.pop();
        addMsg('sys', e.message === 'Failed to fetch' ? 'Сервертэй холбогдож чадсангүй. «npm start» ажиллаж байгаа эсэхийг шалгана уу.' : e.message);
      }
    } finally { ctl = null; setBusy(false); input.focus(); }
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = input.value.trim(); if (!q || ctl) return;
    input.value = ''; input.style.height = 'auto'; ask(q);
  });

  addMsg('bot', 'Сайн байна уу! Би энэ загварын туслах. Загварын бүтцийг тайлбарлаж, **хувилбар симуляци** хийж, хүсвэл гулсууруудыг таны өмнөөс тохируулна.');
}
