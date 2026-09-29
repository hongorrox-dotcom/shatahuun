// DOM туслах функцууд
export function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [a, v] of Object.entries(attrs || {})) {
    if (a === 'class') e.className = v;
    else if (a === 'text') e.textContent = v;
    else e.setAttribute(a, v);
  }
  for (const k of kids) if (k != null) e.append(k);
  return e;
}

export const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Файл татах. Excel-д кирилл зөв харагдахын тулд CSV-д BOM нэмнэ.
export function downloadText(btn, filename, text, type = 'text/csv;charset=utf-8') {
  const label = btn.textContent;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type }));
  a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  btn.textContent = 'Татагдлаа';
  setTimeout(() => { btn.textContent = label; }, 1500);
}

export const safeName = (n) => (n || 'simulation').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60);
