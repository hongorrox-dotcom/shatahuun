// Параметр, графикийн тодорхойлолт. Хөтөч болон сервер (туслах) хоёулаа ашиглана — DOM-гүй байх ёстой.
import { DEFAULTS } from './model.js';
import { num, pct, yearFmt } from './format.js';

// scale: гулсуурын утга × scale = загварын утга
export const SECTORS = {
  s1: {
    params: [
      {k:'gdpShare', name:'ДНБ хувь', min:0,max:0.5,step:0.01, fmt:pct, hint:'2025 оноос хойш нэг хүнд ногдох ДНБ-ийг (1 + хувь)-аар өсгөнө → өрхийн орлого → шинэ автомашин.'},
      {k:'popCap', name:'Хүн амын даац', min:3,max:20,step:0.1, scale:1e6, fmt:v=>num(v/1e6,1)+' сая', hint:'Логистик хязгаар (2025 оноос): хүн ам энэ хэмжээнд ойртох тусам өсөлт нь удааширна.'},
      {k:'tankSize', name:'Савны хэмжээ', min:0,max:500,step:10, scale:1e3, fmt:v=>num(v/1e3,0)+' мян.т', hint:'Нөөцийн сав ашиглалтад орсон жил нийлүүлэлтэд нэмэгдэх хэмжээ.'},
      {k:'invest', name:'Хөрөнгө оруулалт', min:0,max:100,step:1, scale:1e9, fmt:v=>num(v/1e9,0)+' тэрбум ₮', hint:'Зөвхөн «Шатахууны сав барих төсөв»-д орно; бусад хувьсагчид нөлөөлөхгүй.'},
      {k:'ptIncrease', name:'Нийтийн тээвэр нэмэгдүүлэх хувь', min:0,max:0.2,step:0.01, fmt:pct, hint:'Сав нэмэгдүүлэх оноос эхлэн нийтийн тээврийн тоог өсгөж, шатахууны хэрэглээг хэмнэнэ.'},
      {k:'tankYear', name:'Шатахууны нөөцийн сав нэмэгдүүлэх он', min:2026,max:2036,step:1, fmt:yearFmt, ticks:['2026','2036 = идэвхгүй'], hint:'Сав дараа жил нь нийлүүлэлтэд нэг удаа орно. Нийтийн тээврийн өсөлт мөн энэ оноос эхэлнэ.'},
    ],
    charts: [
      {k:'price', name:'Шатахууны үнэ', unit:'₮/л', d:0, feature:true},
      {k:'infl', name:'Инфляци хэмжээ', unit:'%', d:2},
      {k:'reserve', name:'Шатахууны нийт нөөц', unit:'тонн', d:0},
      {k:'car', name:'Автомашин', unit:'нийт бүртгэлтэй', d:0},
      {k:'ptCount', name:'Нийтийн тээврийн тоо', unit:'автобус', d:0},
      {k:'autos', name:'Авто машин', unit:'шатахуун хэрэглэгч', d:0},
      {k:'tank', name:'Шатахууны нөөцийн сав', unit:'тонн', d:0, bar:true},
    ],
  },
  s2: {
    params: [
      {k:'taxYear', name:'Татвар бууруулах он', min:2026,max:2035,step:1, fmt:String, hint:'Доорх 4 татварын шинэ утга энэ оноос үйлчилнэ. Түүнээс өмнө түүхэн утга хэвээр: онцгой 0, автобензин 25 700 ₮/т, гааль 0%, НӨАТ 10%.'},
      {k:'excise', name:'Онцгой албан татварын зардал', min:0,max:400000,step:10000, fmt:v=>num(v)+' ₮/т'},
      {k:'fuelTax', name:'Автобензин, дизель түлшний албан татварын зардал', min:0,max:100000,step:100, fmt:v=>num(v)+' ₮/т'},
      {k:'customs', name:'Гаалийн албан татвар 5%', min:0,max:0.05,step:0.01, fmt:pct, hint:'ХИЛ-ийн үнэд (төгрөгөөр) үржигдэнэ.'},
      {k:'margin', name:'Борлуулагчийн ашгийн марж', min:0,max:100000,step:10000, fmt:v=>num(v)+' ₮/т', hint:'«Үйл ажиллагааны зардал нэмэгдэх он»-оос эхлэн дотоод зардалд нэмэгдэнэ.'},
      {k:'opYear', name:'Үйл ажиллагааны зардал нэмэгдэх он', min:2026,max:2036,step:1, fmt:yearFmt, ticks:['2026','2036 = идэвхгүй']},
      {k:'vat', name:'НӨАТ 10%', min:0,max:0.15,step:0.01, fmt:pct},
    ],
    charts: [
      {k:'cost', name:'Шатахууны нийлүүлэлтийн өртөг', unit:'₮/л', d:0, feature:true},
      {k:'opCost', name:'Үйл ажиллагааны дотоод зардал', unit:'₮/тонн', d:0},
      {k:'tax', name:'Албан татварын зардал', unit:'₮/тонн', d:0},
      {k:'price', name:'Шатахууны үнэ', unit:'₮/л · өртгөөс хамаарна', d:0},
    ],
  },
};

export const PARAMS = {};
for (const S of Object.values(SECTORS)) for (const p of S.params) PARAMS[p.k] = p;
export const PARAM_NAMES = Object.fromEntries(Object.values(PARAMS).map(p => [p.k, p.name]));

// Давхардалгүй бүх график (Сектор 2-ын «Шатахууны үнэ» нь Сектор 1-ийнхтэй ижил)
export const ALL_CHARTS = [...SECTORS.s1.charts, ...SECTORS.s2.charts.filter(c => c.k !== 'price')];
// Хадгалсан симуляцид хадгалах цуврал
export const SERIES_KEYS = ['infl','price','reserve','car','ptCount','autos','tank','cost','opCost','tax','tankBudget','consumption','supply'];
export const INT_PARAMS = new Set(['tankYear','opYear','taxYear']);

export const paramRange = (p) => [p.min * (p.scale || 1), p.max * (p.scale || 1)];

// Гаднаас ирсэн параметрийг шалгаж, хүрээнд нь хавчина. {res, bad}
export function cleanParams(obj) {
  const res = {}, bad = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { res, bad: obj == null ? [] : ['params'] };
  for (const [k, v] of Object.entries(obj)) {
    const p = PARAMS[k], n = Number(v);
    if (!p || v === null || v === '' || !Number.isFinite(n)) { bad.push(k); continue; }
    const [lo, hi] = paramRange(p);
    res[k] = Math.min(hi, Math.max(lo, n));
    if (INT_PARAMS.has(k)) res[k] = Math.round(res[k]);
  }
  return { res, bad };
}

// Анхны утгаас ялгаатай параметрүүдийг «Нэр: утга» хэлбэрээр
export function paramDiff(params) {
  return Object.keys(DEFAULTS)
    .filter(k => params?.[k] !== undefined && params[k] !== DEFAULTS[k] && PARAMS[k])
    .map(k => `${PARAMS[k].name}: ${PARAMS[k].fmt(params[k])}`);
}
