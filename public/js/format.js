// Тоо форматлах туслах функцууд (хөтөч ба сервер хоёулаа ашиглана)
const NF = (d) => {
  try { return new Intl.NumberFormat('mn-MN', { maximumFractionDigits: d, minimumFractionDigits: d }); }
  catch { return new Intl.NumberFormat('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }); }
};
const f0 = NF(0), f1 = NF(1), f2 = NF(2);

export const num = (v, d = 0) => (d === 0 ? f0 : d === 1 ? f1 : f2).format(v);
export const compact = (v) => {
  const a = Math.abs(v);
  if (a >= 1e9) return num(v / 1e9, 1) + ' тэрбум';
  if (a >= 1e6) return num(v / 1e6, 2) + ' сая';
  if (a >= 1e4) return num(v / 1e3, 0) + ' мянга';
  return num(v, a < 100 ? 1 : 0);
};
export const pct = (v) => num(v * 100, 0) + '%';
export const yearFmt = (v) => (v >= 2036 ? 'Идэвхгүй' : String(v));
export const fmtDate = (ms) => {
  const d = new Date(ms), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
