// Загварын туслах — Claude API (Messages API + tool use, streaming).
// Хэрэгслүүд (симуляци, параметр) сервер дээр ажиллана; set_parameters нь хөтөч рүү үйлдэл болж очно.
import Anthropic from '@anthropic-ai/sdk';
import { simulate, DEFAULTS } from '../public/js/model.js';
import { PARAMS, PARAM_NAMES, ALL_CHARTS, cleanParams, paramDiff, paramRange } from '../public/js/config.js';
import { num, fmtDate } from '../public/js/format.js';

// Клиентийг анх хэрэгтэй үед үүсгэнэ: түлхүүргүй үед ч сервер (симулятор) асч чадна.
// Түлхүүрийг ANTHROPIC_API_KEY орчны хувьсагчаас (эсвэл `ant auth login` профайлаас) уншина.
let client;
function getClient() {
  if (!client) {
    try { client = new Anthropic(); }
    catch { throw new Error('Claude API түлхүүр тохируулаагүй байна. .env файлд ANTHROPIC_API_KEY-г оруулаад серверийг дахин эхлүүлнэ үү.'); }
  }
  return client;
}
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';
const EFFORT = process.env.ANTHROPIC_EFFORT || 'medium';
const MAX_ROUNDS = 8;      // нэг асуултад хийх хэрэгслийн дугуйн дээд тоо
const KEY_YEARS = [2014, 2020, 2025, 2028, 2030, 2033, 2035];
const BASE = simulate(DEFAULTS);

const SYSTEM = `Чи бол "Шатахууны үнэ 92" нэртэй Vensim системийн динамик загварын вэб симулятор дээрх туслах. Хэрэглэгчтэй үргэлж монгол хэлээр, товч, тодорхой ярь. Тоог загвараас (хэрэгслээр) авч хэлнэ, таамаглаж зохиохгүй. Загварын хязгаарлалтыг шударгаар хэл.

ЗАГВАРЫН БҮТЭЦ (2014–2035, алхам 1 жил, Euler):
• Сектор 1 "Шатахууны хэрэглээ": Автомашин (stock) = шинээр бүртгэгдэх − хасагдах. Шинэ машин = −112433 + 0.026848·(өрхийн сарын орлого) + 0.046·(хүн ам). Өрхийн орлого = 172676 + 0.10825·(нэг хүнд ногдох ДНБ); 2025 оноос нэг хүнд ногдох ДНБ-ийг (1+ДНБ хувь)-аар өсгөнө. Хүн ам 2025 оноос логистик: өсөлт·(1 − хүн ам/хүн амын даац), даацын анхны утга 10 сая. Авто машин = Автомашин × шатахуун хэрэглэгчийн хувь. Шатахууны хэрэглээ = Авто машин × нэг машины хэрэглээ − нийтийн тээврээр хэмнэгдэх хэмжээ. Нийтийн тээврийн тоо нь "сав нэмэгдүүлэх он"-оос эхлэн (1+Нийтийн тээвэр нэмэгдүүлэх хувь)-аар өснө. Шатахууны нийт нөөц (stock) = нийлүүлэлт (импорт + сав) − хэрэглээ; нөөцийн сав нь "сав нэмэгдүүлэх он"-оос дараа жил нь нэг удаа "савны хэмжээ"-гээр нийлүүлэлтэд нэмэгдэнэ. Хөрөнгө оруулалт зөвхөн "сав барих төсөв"-т орно, бусад хувьсагчид нөлөөлөхгүй. Инфляци = 9.3925 + 0.00878·үнэ − 4.21e−5·мөнгөний нийлүүлэлт/1e9 + 0.0881·ДНБ өсөлт(%) − 0.00809·долларын ханш.
• Сектор 2 "Шатахууны өртөг": Нийлүүлэлтийн өртөг (₮/л) = (ХИЛ үнэ·гааль + албан татвар + дотоод зардал + тээвэрлэлт + зээлийн хүү + ХИЛ үнэ)·(1+НӨАТ)/1000·0.76. 2026 оноос энэ дүнг инфляцийн хоцрогдлоор (өмнөх жилийн 1+инфляци/100) үржүүлдэг, түүнээс өмнө үржүүлэхгүй. Албан татварын зардал = онцгой албан татвар + автобензин/дизель түлшний татвар (₮/тонн). Онцгой, автобензин/дизель, гааль, НӨАТ гэсэн 4 татварын гулсуурын утга зөвхөн "Татвар бууруулах он"-оос (анхны утга 2026) үйлчилнэ; түүнээс өмнө түүхэн утга (0, 25700 ₮/т, 0%, 10%) хэрэглэгдэх тул 2026 оноос өмнөх үр дүн тохиргооноос үл хамаарна. Үйл ажиллагааны дотоод зардал = удирдлага + хадгалалт + хорогдол + ШТС зардал (+ борлуулагчийн марж "Үйл ажиллагааны зардал нэмэгдэх он"-оос), инфляцийн хоцрогдлоор үржинэ.
• Үнэ: 2025 он хүртэл түүхэн өөрчлөлтөөр; 2026 оноос Шатахууны үнэ(stock)-ийн жилийн өөрчлөлт = −нөөц/5000 + өртөг·0.1. Иймээс өртөг өсөх → үнэ өсөх → инфляци өсөх; нөөц ихсэх → үнэ буурах.
• 2036 гэсэн он = тухайн арга хэмжээ идэвхгүй (симуляцийн хугацаанаас гадуур).

ХЭРЭГСЛҮҮД: get_parameters (одоогийн утга, хязгаар), list_saved_runs (хэрэглэгчийн хадгалсан симуляцууд), run_scenario (хуудсыг өөрчлөхгүйгээр хувилбар турших), set_parameters (хуудасны гулсуурыг өөрчилнө). Хэрэглэгч "тохируул", "өөрчил", "тавь" гэж тодорхой хүсээгүй бол set_parameters бүү ашигла — зөвхөн run_scenario-гоор туршиж хариул. Хариултад гол тоонуудыг суурьтай харьцуулж, өөрчлөлтийг хувиар хэл. Markdown-оос зөвхөн **тод** ба "- " жагсаалт ашигла (хүснэгт, гарчиг хэрэглэхгүй). 250 үгнээс хэтрүүлэхгүй.`;

const paramsSchema = { type: 'object', description: 'Параметрийн түлхүүр → тоон утга (загварын нэгжээр), жишээ нь {"vat":0.12,"tankYear":2028}', additionalProperties: { type: 'number' } };
const TOOLS = [
  { name: 'get_parameters', description: 'Returns every slider parameter: key, Mongolian name, current value on the page, default, min, max (model units) and a note on what it affects.',
    input_schema: { type: 'object', properties: {} } },
  { name: 'list_saved_runs', description: 'Returns the simulations the user has saved: name, saved time, parameters that differ from default, and each graphed variable in 2025, 2030 and 2035. Use to compare saved runs or when the user refers to one by name.',
    input_schema: { type: 'object', properties: {} } },
  { name: 'run_scenario', description: 'Runs the model 2014–2035 with the current page parameters overridden by `params` (keys from get_parameters), WITHOUT changing the page. Returns each graphed variable for key years (2014, 2020, 2025, 2028, 2030, 2033, 2035) as {хувилбар, суурь}. Pass {} for the current settings.',
    input_schema: { type: 'object', properties: { params: paramsSchema } }, eager_input_streaming: true },
  { name: 'set_parameters', description: 'Moves the page sliders to the given values (clamped to range) and re-runs the charts. Only when the user asks to set/change parameters. Returns the applied values.',
    input_schema: { type: 'object', properties: { params: paramsSchema }, required: ['params'] }, eager_input_streaming: true },
];

function summarize(run) {
  const out = {};
  for (const c of ALL_CHARTS) {
    out[`${c.name} (${c.unit})`] = Object.fromEntries(KEY_YEARS.map(y => {
      const i = y - 2014, r = (v) => +v.toFixed(c.d > 0 ? 2 : 0);
      return [y, { хувилбар: r(run[i][c.k]), суурь: r(BASE[i][c.k]) }];
    }));
  }
  return out;
}

function pageContext(state, runs) {
  const last = simulate(state).at(-1), b = BASE.at(-1);
  const changed = Object.keys(DEFAULTS).filter(k => state[k] !== DEFAULTS[k]).map(k => `${PARAM_NAMES[k]} = ${state[k]} (анхны ${DEFAULTS[k]})`);
  return `\n\n[Одоогийн хуудасны төлөв]\nӨөрчилсөн параметр: ${changed.length ? changed.join('; ') : 'байхгүй (бүгд анхны утгатай)'}` +
    `\n2035 оны үр дүн (хувилбар / суурь): ` + ALL_CHARTS.map(c => `${c.name} ${num(last[c.k], c.d)} / ${num(b[c.k], c.d)} ${c.unit}`).join('; ') +
    `\nХадгалсан симуляци: ${runs.length ? runs.slice(0, 10).map(s => s.name).join('; ') : 'байхгүй'}`;
}

// Хөтчөөс ирсэн яриаг шалгана: зөвхөн текст, user/assistant ээлжилсэн, user-ээр төгссөн
function cleanHistory(raw) {
  if (!Array.isArray(raw)) throw new Error('messages буруу байна');
  const msgs = raw.slice(-16).filter(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.slice(0, 8000) }));
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  const out = [];
  for (const m of msgs) { if (out.length && out.at(-1).role === m.role) out[out.length - 1] = m; else out.push(m); }
  if (!out.length || out.at(-1).role !== 'user') throw new Error('Сүүлийн мессеж хэрэглэгчийнх байх ёстой');
  return out;
}

// Хэрэглэгчид харуулах алдааны мессеж (SDK-ийн төрөлжсөн алдаагаар)
export function describeError(err) {
  if (err instanceof Anthropic.AuthenticationError) return 'Claude API түлхүүр буруу эсвэл тохируулаагүй байна. .env файлд ANTHROPIC_API_KEY-г оруулаад серверийг дахин эхлүүлнэ үү.';
  if (err instanceof Anthropic.PermissionDeniedError) return 'Энэ API түлхүүрээр сонгосон загварыг ашиглах эрхгүй байна.';
  if (err instanceof Anthropic.NotFoundError) return `«${MODEL}» загвар олдсонгүй. .env доторх ANTHROPIC_MODEL-ийг шалгана уу.`;
  if (err instanceof Anthropic.RateLimitError) return 'Claude API-н хязгаарт хүрлээ. Хэсэг хүлээгээд дахин оролдоно уу.';
  if (err instanceof Anthropic.BadRequestError) return 'Claude API хүсэлтийг хүлээж авсангүй: ' + err.message;
  if (err instanceof Anthropic.APIConnectionError) return 'Claude API-д холбогдож чадсангүй. Интернэт холболтоо шалгана уу.';
  if (err instanceof Anthropic.APIError) return `Claude API алдаа (${err.status ?? '?'}). Дахин оролдоно уу.`;
  if (err instanceof Anthropic.AnthropicError) return `Claude API-г дуудаж чадсангүй (${err.message}). .env доторх ANTHROPIC_API_KEY-г шалгана уу.`;
  return err?.message || 'Тодорхойгүй алдаа гарлаа.';
}

/**
 * Нэг асуултад хариулна. send(event) нь хөтөч рүү SSE үйл явдал илгээнэ:
 * {type:'text', text} | {type:'tool', name} | {type:'set_params', params} | {type:'round'}
 */
export async function answer({ messages: rawMessages, state: rawState, runs, send, signal }) {
  let state = { ...DEFAULTS, ...cleanParams(rawState).res };
  const messages = cleanHistory(rawMessages);
  messages[messages.length - 1] = { role: 'user', content: messages.at(-1).content + pageContext(state, runs) };

  const tools = {
    get_parameters: () => Object.values(PARAMS).map(p => {
      const [min, max] = paramRange(p);
      return { key: p.k, name: p.name, current: state[p.k], default: DEFAULTS[p.k], min, max, note: p.hint || '' };
    }),
    list_saved_runs: () => runs.slice(0, 20).map(s => ({
      name: s.name, saved: fmtDate(s.createdAt), changedParams: paramDiff(s.params || {}),
      results: Object.fromEntries(ALL_CHARTS.map(c => [`${c.name} (${c.unit})`,
        Object.fromEntries([2025, 2030, 2035].map(y => [y, +Number(s.series?.[c.k]?.[y - 2014] ?? NaN).toFixed(c.d > 0 ? 2 : 0)]))])),
    })),
    run_scenario: ({ params }) => {
      const { res, bad } = cleanParams(params ?? {});
      if (bad.length) throw new Error('Unknown or invalid params: ' + bad.join(', '));
      const applied = { ...state, ...res };
      return { applied, results: summarize(simulate(applied)) };
    },
    set_parameters: ({ params }) => {
      const { res, bad } = cleanParams(params);
      if (bad.length) throw new Error('Unknown or invalid params: ' + bad.join(', '));
      if (!Object.keys(res).length) throw new Error('params is empty');
      state = { ...state, ...res };
      send({ type: 'set_params', params: res });
      return { applied: res, note: 'Хэрэглэгч «Анхны утгад буцаах» товчоор буцааж болно.' };
    },
  };

  let jsonRetries = 0;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (round) send({ type: 'round' });
    const stream = getClient().beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default', // аюулгүй байдлын шалтгаанаар татгалзвал Anthropic-ийн санал болгосон загвараар дахин ажиллуулна
      thinking: { type: 'adaptive' },
      output_config: { effort: EFFORT },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: TOOLS,
      messages,
    }, { signal });
    let streamed = false; // хариу урсаж эхэлсэн эсэх (эхлэхээс өмнөх алдаа = тохиргоо/холболтын алдаа)
    stream.on('streamEvent', () => { streamed = true; });
    stream.on('text', (delta) => send({ type: 'text', text: delta }));

    let message;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      // Хариу урсаж байх үед хэрэгслийн оролтын JSON задрахгүй бол тухайн ээлжийг дахин илгээнэ (2 хүртэл удаа).
      // API, баталгаажуулалт, холболтын алдааг шууд дамжуулна.
      if (!streamed || err instanceof Anthropic.APIError || signal.aborted || jsonRetries++ >= 2) throw err;
      continue;
    }

    if (message.stop_reason === 'refusal') throw new Error('Энэ асуултад хариулах боломжгүй байна. Өөрөөр асууж үзнэ үү.');
    if (message.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: message.content }); continue; }
    const uses = message.content.filter(b => b.type === 'tool_use');
    if (!uses.length) return;
    if (message.stop_reason === 'max_tokens') throw new Error('Хариу хэт урт болж тасарлаа. Асуултаа хуваагаад дахин асууна уу.');

    messages.push({ role: 'assistant', content: message.content });
    const results = [];
    for (const use of uses) {
      send({ type: 'tool', name: use.name });
      const fn = tools[use.name];
      const input = use.input && typeof use.input === 'object' && !Array.isArray(use.input) ? use.input : null;
      try {
        if (!fn) throw new Error('Unknown tool');
        if (!input) throw new Error('Tool input must be a JSON object');
        results.push({ type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(fn(input)) });
      } catch (e) {
        results.push({ type: 'tool_result', tool_use_id: use.id, is_error: true, content: e.message });
      }
    }
    messages.push({ role: 'user', content: results });
  }
  throw new Error('Туслах хэт олон алхам хийлээ. Асуултаа тодорхой болгоод дахин асууна уу.');
}

export const assistantInfo = { model: MODEL, effort: EFFORT };
