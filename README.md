# Шатахууны үнэ 92 — вэб симулятор

Vensim-ийн «Шатахууны үнэ 92 - макро нөлөөлөл.mdl» загварыг хөтөч дээр ажиллуулдаг симулятор.
Параметрүүдийг гулсуураар өөрчилж, 2014–2035 оны үр дүнг график, хүснэгтээр харна.
Симуляцийг хадгалж харьцуулах, CSV-ээр татах, Claude API дээр ажилладаг загварын туслахаас асуух боломжтой.

## Ажиллуулах

Node.js 22 буюу түүнээс шинэ хувилбар хэрэгтэй.

```bash
npm install
cp .env.example .env      # дараа нь .env доторх ANTHROPIC_API_KEY-г өөрийн түлхүүрээр солино
npm start
```

Хөтчөөр http://localhost:3000 хаягийг нээнэ.
API түлхүүргүй үед симулятор ажиллана, зөвхөн туслах ажиллахгүй.
Түлхүүрийг https://console.anthropic.com хаягаас авна.

## Vercel дээр байрлуулах

1. Vercel дээр GitHub-ийн `hongorrox-dotcom/shatahuun` repository-г импортлоно.
2. Framework Preset-ийг `Other`, Build Command-ийг хоосон үлдээнэ.
3. Дараах Environment Variables-ийг нэмнэ:

```text
ANTHROPIC_API_KEY=таны_claude_api_key
ANTHROPIC_MODEL=claude-opus-5
ANTHROPIC_EFFORT=medium
```

`api/` доторх Serverless Function-ууд `/api/chat` болон `/api/runs` endpoint-уудыг ажиллуулж, `vercel.json` нь `public/` доторх frontend-ийг үйлчилнэ.

Vercel-ийн function filesystem байнгын хадгалалтгүй тул хадгалсан симуляциуд одоогоор `/tmp` дотор best-effort хадгалагдана. Олон хэрэглэгчтэй эсвэл байнгын хадгалалт шаардлагатай deployment-д `server/vercel.js`-ийн store-г Vercel KV, Supabase зэрэг database-ээр солих хэрэгтэй.

## Бүтэц

```
public/                 Хөтөч дээр ажиллах хэсэг
  index.html
  css/styles.css
  js/model.js           Vensim загварын тэгшитгэлүүд (simulate) — сервер ч ашиглана
  js/config.js          Параметр, графикийн тодорхойлолт — сервер ч ашиглана
  js/format.js          Тоо форматлах
  js/app.js             Гулсуур, график, хүснэгт, CSV, табууд
  js/charts.js          Chart.js график ба LED үнийн самбар
  js/runs.js            Хадгалсан симуляциуд
  js/chat.js            Туслахын цонх (сервертэй SSE-ээр холбогдоно)
  js/dom.js             DOM туслах функцууд
server/
  index.js              HTTP сервер: статик файл, /api/runs, /api/chat
  assistant.js          Claude API: системийн заавар, хэрэгслүүд, streaming
  runs-store.js         data/runs.json-д хадгалах
scripts/verify_pysd.py  Симуляторыг Vensim загвартай PySD-ээр тулгах
data/runs.json          Хадгалсан симуляциуд (автоматаар үүснэ)
```

## Туслах хэрхэн ажилладаг вэ

1. Хөтөч асуулт, ярианы түүх болон гулсууруудын одоогийн утгыг `/api/chat` руу илгээнэ.
2. Сервер Claude API-г (`@anthropic-ai/sdk`, streaming) дуудна. Туслах дараах хэрэгслүүдийг ашиглана:
   - `get_parameters`: параметрүүдийн одоогийн утга ба хүрээ
   - `run_scenario`: хуудсыг өөрчлөхгүйгээр хувилбар симуляци
   - `set_parameters`: хуудасны гулсууруудыг хөдөлгөнө. Зөвхөн хэрэглэгч хүссэн үед ашиглана.
   - `list_saved_runs`: хадгалсан симуляциуд
3. Хэрэгслүүд сервер дээр `public/js/model.js`-ээр тооцоолно. `set_parameters` нь хөтөч рүү үйлдэл болж очиж гулсууруудыг хөдөлгөнө.
4. Хариу хөтөч рүү Server-Sent Events-ээр урсаж ирнэ.

API түлхүүр зөвхөн сервер дээр байх бөгөөд хөтөч рүү илгээгддэггүй.

`.env` доторх тохиргоо:

| Хувьсагч | Анхны утга | Тайлбар |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Claude API түлхүүр |
| `ANTHROPIC_MODEL` | `claude-opus-5` | Туслахын загвар |
| `ANTHROPIC_EFFORT` | `medium` | `low`–`max`. Өндөр болгох тусам удаан, үнэтэй болно. |
| `PORT`, `HOST` | `3000`, `127.0.0.1` | `HOST=0.0.0.0` бол сүлжээний бусад компьютер хандах боломжтой |

Хүсэлтэд `fallbacks: "default"` тохиргоо орсон. Claude аюулгүй байдлын шалтгаанаар хариулахаас татгалзвал Anthropic-ийн санал болгосон өөр загвараар автоматаар дахин оролдоно.

## Загварыг тулгаж шалгах

`model.js` доторх тэгшитгэлийг өөрчилсний дараа Vensim загвартай таарч байгаа эсэхийг шалгана:

```bash
pip install pysd
python3 scripts/verify_pysd.py            # ../Шатахууны үнэ 92 - макро нөлөөлөл.mdl-тэй тулгана
```
