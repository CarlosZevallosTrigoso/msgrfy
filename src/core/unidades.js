// Unidades y formato numérico. Sin DOM.
// El proyecto se guarda en metros. La vista Muro trabaja en centímetros (núcleo de MuseoDraft):
// la conversión ocurre solo en la frontera, con estas dos funciones.

export const cmAm = (cm) => (Number.isFinite(cm) ? cm / 100 : cm);
export const mAcm = (m) => (Number.isFinite(m) ? m * 100 : m);

// Redondeo estable para guardar (evita 0.30000000000000004)
export const r6 = (v) => Math.round(v * 1e6) / 1e6;

// Acepta coma o punto decimal; devuelve NaN si no es un número
export const parseNum = (s) => {
  if (typeof s === 'number') return s;
  const t = String(s ?? '').trim().replace(/\s+/g, '').replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return NaN;
  return parseFloat(t);
};

// Formato en español: coma decimal, sin ceros finales opcionales si recortar=true
export const fmtNum = (n, dec = 2, recortar = false) => {
  if (!Number.isFinite(n)) return '—';
  const f = 10 ** dec;
  let s = (Math.round((n + Math.sign(n) * 1e-9) * f) / f).toFixed(dec);
  if (recortar && dec > 0) s = s.replace(/\.?0+$/, '');
  if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
  return s.replace('.', ',');
};
export const fmtM = (m, dec = 2) => fmtNum(m, dec) + ' m';
export const fmtCm = (m, dec = 1) => fmtNum(mAcm(m), dec, true) + ' cm';
export const fmtM2 = (a) => fmtNum(a) + ' m²';
