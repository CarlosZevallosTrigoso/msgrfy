// Núcleo de la vista Muro (de MuseoDraft): geometría, cotas, planificador, pintores, isométrica. Sin DOM. Unidades: cm.
/* MuseoDraft · núcleo puro (sin DOM). Unidades: centímetros.
   Origen: esquina superior izquierda del muro; y crece hacia abajo.
   Las alturas "desde el piso" se derivan: piso = muro.h - y.
   Se prueba en Node y se incrusta idéntico en el HTML. */
export const MD = (() => {
'use strict';

const EPS = 1e-6;
const COL = {
  ink: '#111111', line: '#d6d6d0', paste: '#efeeea', white: '#ffffff',
  moss: '#8fa676', mossD: '#586a45', steel: '#4f6b82', orange: '#b06a36',
  marco: '#2e2d29', pp: '#faf8f2', ph: '#e7e6e0', vano: '#eeede8', hatch: '#c9c7bf',
};
const FONT = 'ui-monospace, "Fira Code", "SF Mono", Menlo, Consolas, monospace';

// ---------- utilidades ----------
function fmt(v, d = 1) {
  if (typeof v !== 'number' || !isFinite(v)) return '–';
  const f = Math.pow(10, d);
  let r = Math.round(v * f) / f;
  if (Object.is(r, -0)) r = 0;
  let s = r.toFixed(d);
  if (d > 0) s = s.replace(/\.?0+$/, '');
  return s;
}
let _n = 0;
function uid(p) {
  _n = (_n + 1) % 1e6;
  return (p || 'x') + Date.now().toString(36) + _n.toString(36) + Math.floor(Math.random() * 1296).toString(36);
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const num = (v, def) => { const n = +v; return isFinite(n) ? n : def; };

// ---------- documento ----------
function newDoc() {
  return {
    version: 2, titulo: 'Muro A',
    wall: { w: 500, h: 300, color: '#ffffff', eje: 150, grosor: 15 },
    items: [makePersona({ nombre: 'Persona 170', h: 170, x: -75 }, 300)], images: {}, guides: { v: [], h: [] },
    opts: {
      cotas: 'sel', showEje: true, showHuman: true, showOjos: false, showFichas: false,
      showGrid: false, grid: 10, showGuides: true, showMuro: false, anchoAbajo: true, vista: 'alzado', iso: defaultIso(),
      snapObj: true, snapGuides: true, snapGrid: false,
      exp: defaultExp(),
    },
  };
}
// qué incluye la exportación (se guarda con el proyecto)
function defaultExp() {
  return {
    fmt: 'png', pxcm: 10, margen: 40, scope: 'all', cotaCm: 4,
    imagenes: true, vanos: true, human: true, ojos: false, eje: true, grid: false, guias: false,
    dims: true, gaps: true, bordes: true, centro: true, lineas: true, medidas: true, muro: true,
    fichas: false, escala: true, rotulo: true, notas: true,
    encuadre: 'todo', area: null, areaIso: null, areaIsoSig: '',
  };
}
const EXP_PRESETS = {
  montaje: { notas: true, muro: true, imagenes: true, vanos: true, human: false, ojos: false, eje: true, grid: false, guias: false, dims: true, gaps: true, bordes: true, centro: true, lineas: true, medidas: true, fichas: true, escala: true, rotulo: true },
  presentacion: { notas: false, muro: false, imagenes: true, vanos: true, human: true, ojos: false, eje: false, grid: false, guias: false, dims: false, gaps: false, bordes: false, centro: false, lineas: true, medidas: false, fichas: true, escala: true, rotulo: true },
  tecnico: { notas: true, muro: true, imagenes: false, vanos: true, human: true, ojos: true, eje: true, grid: false, guias: true, dims: true, gaps: true, bordes: true, centro: true, lineas: true, medidas: true, fichas: false, escala: true, rotulo: true },
};
function makeObra(o) {
  return Object.assign({
    id: uid('o'), tipo: 'obra', nombre: 'Obra', x: 0, y: 0, w: 50, h: 70,
    marco: 0, pp: 0, prof: 3, caida: 0, rot: 0, lock: true, bloqueado: false, oculto: false,
    imgId: null, imgRatio: null, est: { w: false, h: false },
    ficha: { titulo: '', autor: '', anio: '', tecnica: '', inv: '' },
  }, o);
}
// nota libre: texto en cm de muro (tam = altura de letra), opcionalmente señala una obra (apunta = id)
function makeNota(o) {
  const it = Object.assign({ id: uid('n'), tipo: 'nota', nombre: 'Nota', texto: 'Nota', x: 0, y: 0, tam: 4, apunta: null, bloqueado: false, oculto: false }, o);
  it.texto = it.texto == null ? '' : String(it.texto);
  it.tam = Math.max(0.5, Math.min(50, num(it.tam, 4)));
  if (typeof it.apunta !== 'string' || !it.apunta) it.apunta = null;
  return it;
}
function notaGeom(it) {
  const tam = Math.max(0.5, num(it.tam, 4)), ls = String(it.texto || ' ').split('\n');
  const n = Math.max(1, ...ls.map((l) => l.length)), pad = tam * 0.35;
  return { tam, ls, pad, lh: tam * 1.25, w: n * TXW * tam + 2 * pad, h: ls.length * tam * 1.25 - tam * 0.25 + 2 * pad };
}
function makeVano(o) {
  return Object.assign({ id: uid('v'), tipo: 'vano', nombre: 'Vano', x: 0, y: 0, w: 90, h: 210, prof: 0, bloqueado: false, oculto: false }, o);
}
// persona de referencia: siempre apoyada en el piso; x = borde izquierdo, h = estatura (o altura total en silla)
const FIG = { pie: { w: 0.29, ojos: 0.936 }, silla: { w: 0.585, ojos: 0.92 } };
function personaW(h, figura) { return h * (FIG[figura] || FIG.pie).w; }
function makePersona(o, wallH) {
  const it = Object.assign({ id: uid('p'), tipo: 'persona', nombre: 'Persona', figura: 'pie', x: 0, y: 0, h: 170, w: 0, dist: 120, bloqueado: false, oculto: false }, o);
  if (!FIG[it.figura]) it.figura = 'pie';
  it.h = Math.max(30, Math.min(260, num(it.h, 170)));
  it.w = personaW(it.h, it.figura);
  it.y = num(wallH, 300) - it.h;
  return it;
}
function groundPersonas(doc) {
  for (const it of doc.items) if (it.tipo === 'persona') { it.w = personaW(it.h, it.figura); it.y = doc.wall.h - it.h; }
}
function ojos(it) { return it.h * (FIG[it.figura] || FIG.pie).ojos; }
// cambia estatura, figura o posición (centro) sin despegarla del piso
function setPersona(doc, it, campo, val) {
  const cx = it.x + it.w / 2;
  if (campo === 'h') it.h = Math.max(30, Math.min(260, num(val, it.h)));
  else if (campo === 'figura') it.figura = FIG[val] ? val : 'pie';
  else if (campo === 'cx') { it.x = num(val, cx) - it.w / 2; return; }
  it.w = personaW(it.h, it.figura); it.y = doc.wall.h - it.h; it.x = cx - it.w / 2;
}
function makeMedida(o) {
  return Object.assign({ id: uid('m'), tipo: 'medida', nombre: 'Medida', x1: 0, y1: 0, x2: 0, y2: 0, bloqueado: false, oculto: false }, o);
}

// ---------- geometría ----------
function frameW(it) { return it.tipo === 'obra' ? Math.max(0, num(it.marco, 0)) + Math.max(0, num(it.pp, 0)) : 0; }
function outer(it) {
  if (it.tipo === 'nota') { const g = notaGeom(it); return { x: it.x, y: it.y, w: g.w, h: g.h }; }
  if (it.tipo === 'medida') {
    return { x: Math.min(it.x1, it.x2), y: Math.min(it.y1, it.y2), w: Math.abs(it.x2 - it.x1), h: Math.abs(it.y2 - it.y1) };
  }
  const f = frameW(it);
  return { x: it.x, y: it.y, w: it.w + 2 * f, h: it.h + 2 * f };
}
function bbox(rects) {
  if (!rects.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
const wallRect = (doc) => ({ x: 0, y: 0, w: doc.wall.w, h: doc.wall.h });
function normRect(a, b) { return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }; }
function intersects(a, b) { return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h; }
function distSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
  let t = L ? ((px - x1) * dx + (py - y1) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function moveItem(it, dx, dy) {
  if (it.tipo === 'medida') { it.x1 += dx; it.y1 += dy; it.x2 += dx; it.y2 += dy; }
  else if (it.tipo === 'persona') it.x += dx; // no se despega del piso
  else { it.x += dx; it.y += dy; }
}
function applyDeltas(doc, deltas) {
  for (const it of doc.items) { const d = deltas[it.id]; if (d) moveItem(it, d.dx, d.dy); }
}

// ---------- lecturas museográficas ----------
function info(doc, it) {
  const o = outer(it), H = doc.wall.h;
  return {
    izq: o.x, der: doc.wall.w - (o.x + o.w),
    inf: H - (o.y + o.h), centro: H - (o.y + o.h / 2), sup: H - o.y,
    extW: o.w, extH: o.h,
    clavo: it.tipo === 'obra' ? H - o.y - Math.max(0, num(it.caida, 0)) : null,
    len: it.tipo === 'medida' ? Math.hypot(it.x2 - it.x1, it.y2 - it.y1) : null,
    ojos: it.tipo === 'persona' ? ojos(it) : null, cx: o.x + o.w / 2,
  };
}
// fija una lectura (en cm desde el piso o desde la izquierda) moviendo el elemento
function setPos(doc, it, campo, val) {
  const o = outer(it), H = doc.wall.h;
  let nx = o.x, ny = o.y;
  if (campo === 'izq') nx = val;
  else if (campo === 'inf') ny = H - val - o.h;
  else if (campo === 'centro') ny = H - val - o.h / 2;
  else if (campo === 'sup') ny = H - val;
  else if (campo === 'clavo') ny = H - val - Math.max(0, num(it.caida, 0));
  moveItem(it, nx - o.x, ny - o.y);
}
// cambia ancho/alto de la obra (sin marco). Con lock, conserva la proporción actual.
// Escribir una medida la marca como medida. Con lock, la otra se recalcula solo si estaba estimada:
// una medida confirmada nunca se pisa por proporción.
function setObraDim(it, campo, val) {
  val = Math.max(0.1, num(val, 0.1));
  if (it.tipo !== 'obra') { it[campo] = val; return; }
  const est = it.est = Object.assign({ w: false, h: false }, it.est), r = it.w / it.h, otro = campo === 'w' ? 'h' : 'w';
  it[campo] = val; est[campo] = false;
  if (it.lock && est[otro]) it[otro] = campo === 'w' ? val / r : val * r;
}
function markEst(it, w, h) {
  if (it.tipo !== 'obra') return;
  it.est = Object.assign({ w: false, h: false }, it.est);
  if (w) it.est.w = true;
  if (h) it.est.h = true;
}
// cambia marco/paspartú creciendo hacia afuera (el centro de la obra no se mueve)
function setFrame(it, campo, val) {
  const before = frameW(it);
  it[campo] = Math.max(0, num(val, 0));
  const d = frameW(it) - before;
  it.x -= d; it.y -= d;
}
function rotate90(it) {
  if (it.tipo === 'medida' || it.tipo === 'nota') return;
  if (it.tipo === 'obra') { const e = Object.assign({ w: false, h: false }, it.est); it.est = { w: e.h, h: e.w }; }
  const o = outer(it), cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  const t = it.w; it.w = it.h; it.h = t;
  if (it.tipo === 'obra') {
    it.rot = (num(it.rot, 0) + 90) % 360;
  }
  const n = outer(it);
  it.x += cx - (n.x + n.w / 2); it.y += cy - (n.y + n.h / 2);
}
// proporción visible de la imagen según su giro
function imgAspect(it) {
  if (!it.imgRatio) return null;
  return (num(it.rot, 0) % 180) ? 1 / it.imgRatio : it.imgRatio;
}

// ---------- alinear / distribuir ----------
function align(items, mode, ref) {
  const out = {};
  for (const it of items) {
    const o = outer(it);
    let x = o.x, y = o.y;
    if (mode === 'left') x = ref.x;
    else if (mode === 'hcenter') x = ref.x + ref.w / 2 - o.w / 2;
    else if (mode === 'right') x = ref.x + ref.w - o.w;
    else if (mode === 'top') y = ref.y;
    else if (mode === 'vmiddle') y = ref.y + ref.h / 2 - o.h / 2;
    else if (mode === 'bottom') y = ref.y + ref.h - o.h;
    out[it.id] = { dx: x - o.x, dy: y - o.y };
  }
  return out;
}
// axis 'h' | 'v'. gap = null → espaciado igual entre extremos (≥3); número → separación fija (≥2)
function distribute(items, axis, gap) {
  const X = axis === 'h';
  const list = items.map((it) => ({ it, o: outer(it) }))
    .sort((a, b) => (X ? a.o.x - b.o.x : a.o.y - b.o.y) || (a.it.id < b.it.id ? -1 : 1));
  const deltas = {};
  const pos = (e) => (X ? e.o.x : e.o.y), size = (e) => (X ? e.o.w : e.o.h);
  if (list.length < 2) return { deltas, gap: null };
  let g = gap;
  if (g == null) {
    if (list.length < 3) return { deltas, gap: null };
    const first = list[0], last = list[list.length - 1];
    const span = pos(last) + size(last) - pos(first);
    const tot = list.reduce((s, e) => s + size(e), 0);
    g = (span - tot) / (list.length - 1);
  }
  let cur = pos(list[0]);
  for (const e of list) {
    const d = cur - pos(e);
    deltas[e.it.id] = X ? { dx: d, dy: 0 } : { dx: 0, dy: d };
    cur += size(e) + g;
  }
  return { deltas, gap: g };
}
// cada elemento con su centro sobre el eje visual
function centerOnEye(doc, items) {
  const yEye = doc.wall.h - doc.wall.eje, out = {};
  for (const it of items) { const o = outer(it); out[it.id] = { dx: 0, dy: yEye - (o.y + o.h / 2) }; }
  return out;
}
// el conjunto centrado horizontalmente en el muro (mueve el grupo en bloque)
function centerGroupH(doc, items) {
  const b = bbox(items.map(outer)), out = {};
  if (!b) return out;
  const dx = doc.wall.w / 2 - (b.x + b.w / 2);
  for (const it of items) out[it.id] = { dx, dy: 0 };
  return out;
}

// ---------- cotas ----------
function overlap(a0, a1, b0, b1) { return Math.min(a1, b1) - Math.max(a0, b0); }
function midOverlap(a0, a1, b0, b1) { return (Math.max(a0, b0) + Math.min(a1, b1)) / 2; }
function neighbors(r, rects) {
  let L = null, R = null, U = null, D = null;
  for (const q of rects) {
    if (overlap(r.y, r.y + r.h, q.y, q.y + q.h) > EPS) {
      if (q.x + q.w <= r.x + EPS) { if (!L || q.x + q.w > L.x + L.w) L = q; }
      else if (q.x >= r.x + r.w - EPS) { if (!R || q.x < R.x) R = q; }
    }
    if (overlap(r.x, r.x + r.w, q.x, q.x + q.w) > EPS) {
      if (q.y + q.h <= r.y + EPS) { if (!U || q.y + q.h > U.y + U.h) U = q; }
      else if (q.y >= r.y + r.h - EPS) { if (!D || q.y < D.y) D = q; }
    }
  }
  return { L, R, U, D };
}
// tamaño: ancho arriba y alto al costado con más espacio libre (hasta la vecina o el borde del muro)
// below = ancho debajo de la obra (número bajo la línea); si no, encima
function sizeCotas(r, nb, W, pad, below, id) {
  const gapL = r.x - (nb.L ? nb.L.x + nb.L.w : 0), gapR = (nb.R ? nb.R.x : W) - (r.x + r.w);
  const right = gapR >= gapL, hx = right ? r.x + r.w + pad : r.x - pad, wy = below ? r.y + r.h + pad : r.y - pad;
  return [
    { x1: r.x, y1: wy, x2: r.x + r.w, y2: wy, v: r.w, k: 'size', under: !!below, id },
    { x1: hx, y1: r.y, x2: hx, y2: r.y + r.h, v: r.h, k: 'size', out: right ? 1 : -1, id },
  ];
}
// cotas completas de un rectángulo (selección). pad en cm.
function cotasFull(r, obst, wall, pad, below) {
  const out = [], nb = neighbors(r, obst), W = wall.w, H = wall.h;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const gapL = r.x - (nb.L ? nb.L.x + nb.L.w : 0), gapR = (nb.R ? nb.R.x : W) - (r.x + r.w);
  const tight = Math.max(gapL, gapR) < 3 * pad; // vecinas muy cerca a ambos lados: la altura del centro va como rótulo
  const cxl = gapR >= gapL ? r.x - pad : r.x + r.w + pad;
  out.push(...sizeCotas(r, nb, W, pad, below, '__sel'));
  const fx = below ? r.x + r.w * 0.8 : cx; // con el ancho debajo, la línea al piso se aparta del número
  { const a = nb.L ? nb.L.x + nb.L.w : 0, y = nb.L ? midOverlap(r.y, r.y + r.h, nb.L.y, nb.L.y + nb.L.h) : cy;
    if (Math.abs(r.x - a) > EPS) out.push({ x1: a, y1: y, x2: r.x, y2: y, v: r.x - a, k: nb.L ? 'gap' : 'wall' }); }
  { const b = nb.R ? nb.R.x : W, y = nb.R ? midOverlap(r.y, r.y + r.h, nb.R.y, nb.R.y + nb.R.h) : cy, d = b - (r.x + r.w);
    if (Math.abs(d) > EPS) out.push({ x1: r.x + r.w, y1: y, x2: b, y2: y, v: d, k: nb.R ? 'gap' : 'wall' }); }
  { const a = nb.U ? nb.U.y + nb.U.h : 0, x = nb.U ? midOverlap(r.x, r.x + r.w, nb.U.x, nb.U.x + nb.U.w) : cx;
    if (Math.abs(r.y - a) > EPS) out.push({ x1: x, y1: a, x2: x, y2: r.y, v: r.y - a, k: nb.U ? 'gap' : 'wall' }); }
  { const b = nb.D ? nb.D.y : H, x = nb.D ? midOverlap(r.x, r.x + r.w, nb.D.x, nb.D.x + nb.D.w) : fx, d = b - (r.y + r.h);
    if (Math.abs(d) > EPS) out.push({ x1: x, y1: r.y + r.h, x2: x, y2: b, v: d, k: nb.D ? 'gap' : 'floor' }); }
  const otherGap = gapR >= gapL ? gapL : gapR; // lado libre para la línea de altura del centro
  if (tight || otherGap < 2.5 * pad) out.push({ x1: r.x + r.w / 2, y1: r.y + r.h, x2: r.x + r.w / 2, y2: r.y + r.h, v: H - cy, k: 'label', id: '__sel' });
  else out.push({ x1: cxl, y1: cy, x2: cxl, y2: H, v: H - cy, k: 'center', side: gapR >= gapL ? 'left' : 'right' });
  return out;
}
// cotas de cada obra para "todas": tamaño, separación a la derecha (o al muro), muro izq. si no hay vecino,
// distancia al piso si no hay nada debajo, y altura del centro como rótulo
function cotasRow(r, obst, wall, pad, id, below) {
  const out = [], nb = neighbors(r, obst), W = wall.w, H = wall.h, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  out.push(...sizeCotas(r, nb, W, pad, below, id));
  { const b = nb.R ? nb.R.x : W, y = nb.R ? midOverlap(r.y, r.y + r.h, nb.R.y, nb.R.y + nb.R.h) : cy, d = b - (r.x + r.w);
    if (Math.abs(d) > EPS) out.push({ x1: r.x + r.w, y1: y, x2: b, y2: y, v: d, k: nb.R ? 'gap' : 'wall' }); }
  if (!nb.L && Math.abs(r.x) > EPS) out.push({ x1: 0, y1: cy, x2: r.x, y2: cy, v: r.x, k: 'wall' });
  const fx = below ? r.x + r.w * 0.8 : cx + pad * 0.6;
  if (!nb.D) { const d = H - (r.y + r.h); if (d > EPS) out.push({ x1: fx, y1: r.y + r.h, x2: fx, y2: H, v: d, k: 'floor' }); }
  out.push({ x1: cx, y1: r.y + r.h, x2: cx, y2: r.y + r.h, v: H - cy, k: 'label', id });
  return out;
}

// ---------- planificador de cotas de tamaño ----------
// Trabaja en px de salida. Cada obra recibe su ancho (debajo o encima) y su alto (a la derecha o a la
// izquierda) en el primer carril libre. Se reserva también la franja entre la obra y su cota, para que
// ninguna línea quede entre una obra y la cota de otra. Si el alto no cabe en ningún costado se une al
// ancho ("100 × 66.8"); si nada cabe, rótulo con línea guía.
const TXW = 0.62; // ancho de un carácter monoespaciado, en em
function textBox(t) {
  const size = t.o.size || 11, w = t.s.length * TXW * size, h = size;
  const al = t.o.align || 'left', base = t.o.base || 'alphabetic';
  const x0 = al === 'center' ? -w / 2 : al === 'right' ? -w : 0;
  const y0 = base === 'top' ? 0 : base === 'middle' ? -h / 2 : -h;
  if (t.o.rot === -90) return { x: t.x + y0, y: t.y - (x0 + w), w: h, h: w };
  return { x: t.x + x0, y: t.y + y0, w, h };
}
function boxHit(b, obst, own, m) {
  for (const q of obst) {
    if (own && q.own && own.has(q.own)) continue;
    if (b.x < q.x + q.w + m && q.x < b.x + b.w + m && b.y < q.y + q.h + m && q.y < b.y + b.h + m) return true;
  }
  return false;
}
// geometría de una cota de ancho (side 'below' | 'above') o alto ('right' | 'left') a distancia d
function cotaGeom(r, side, d, txt, u) {
  const size = 10 * u, tw = txt.length * TXW * size, tick = 4 * u;
  if (side === 'below' || side === 'above') {
    const cx = r.x + r.w / 2, x0 = Math.min(r.x, cx - tw / 2), x1 = Math.max(r.x + r.w, cx + tw / 2);
    if (side === 'below') { const ly = r.y + r.h + d; return { line: ly, box: { x: x0, y: r.y + r.h, w: x1 - x0, h: d + 4 * u + size } }; }
    const ly = r.y - d, top = Math.min(ly - tick, ly - 3 * u - size);
    return { line: ly, box: { x: x0, y: top, w: x1 - x0, h: r.y - top } };
  }
  const cy = r.y + r.h / 2, y0 = Math.min(r.y, cy - tw / 2), y1 = Math.max(r.y + r.h, cy + tw / 2);
  if (side === 'right') { const lx = r.x + r.w + d; return { line: lx, box: { x: r.x + r.w, y: y0, w: d + 4 * u + size, h: y1 - y0 } }; }
  const lx = r.x - d; return { line: lx, box: { x: lx - 4 * u - size, y: y0, w: r.x - (lx - 4 * u - size), h: y1 - y0 } };
}
// reqs: [{ id, own:Set, r:{x,y,w,h} px, vw, vh }] · obst: [{x,y,w,h,own?}] px (se amplía con lo colocado)
// o: { u, below:boolean, floorY }
function planCotas(reqs, obst, o) {
  const u = o.u, m = 2 * u, d0 = 8 * u, step = 3 * u, dMax = d0 + 42 * u, pen = 6 * u;
  const out = [], belowExt = new Map();
  obst = obst.slice();
  if (o.floorY != null) obst.push({ x: -1e9, y: o.floorY, w: 2e9, h: 1e9 });
  const tryPlace = (q, sides, txt, mate) => {
    const own = mate ? new Set([...q.own, 'c:' + q.id]) : q.own;
    const cands = [];
    sides.forEach((sd, i) => { for (let d = d0; d <= dMax + EPS; d += step) cands.push({ sd, d, c: d + i * pen }); });
    cands.sort((a, b) => a.c - b.c);
    for (const c of cands) {
      const g = cotaGeom(q.r, c.sd, c.d, txt, u);
      if (!boxHit(g.box, obst, own, m)) return { side: c.sd, d: c.d, line: g.line, box: g.box, txt };
    }
    return null;
  };
  const keep = (q, kind, p) => { p.est = kind === 'w' ? !!q.estW : !!q.estH; p.box.own = 'c:' + q.id; obst.push(p.box); out.push(Object.assign({ id: q.id, kind, r: q.r }, p)); if (p.side === 'below') belowExt.set(q.id, p.box.h + 2 * u); };
  const wSides = o.below ? ['below', 'above'] : ['above', 'below'], hSides = ['right', 'left'];
  const order = reqs.slice().sort((a, b) => Math.min(a.r.w, a.r.h) - Math.min(b.r.w, b.r.h) || a.r.x - b.r.x);
  for (const q of order) {
    const tw = (q.estW ? '≈' : '') + fmt(q.vw), th = (q.estH ? '≈' : '') + fmt(q.vh);
    const pw = tryPlace(q, wSides, tw);
    if (pw) { obst.push(Object.assign({ own: 'c:' + q.id }, pw.box)); const ph = tryPlace(q, hSides, th, true); obst.pop();
      if (ph) { keep(q, 'w', pw); keep(q, 'h', ph); continue; }
      const pc = tryPlace(q, wSides, tw + ' × ' + th); // el alto no cabe: se une al ancho
      if (pc) { keep(q, 'w', pc); continue; }
      keep(q, 'w', pw); leader(q, 'alto ' + th); continue;
    }
    const ph = tryPlace(q, hSides, th);
    if (ph) { keep(q, 'h', ph); leader(q, 'ancho ' + tw); continue; }
    leader(q, tw + ' × ' + th);
  }
  // rótulo suelto con línea guía hacia el borde más cercano de la obra
  function leader(q, txt) {
    const size = 10 * u, tw = txt.length * TXW * size, r = q.r, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    let best = null;
    for (let d = d0; d <= d0 + 80 * u && !best; d += 4 * u) {
      for (const [dx, dy] of dirs) {
        const bx = dx > 0 ? r.x + r.w + d : dx < 0 ? r.x - d - tw : cx - tw / 2;
        const by = dy > 0 ? r.y + r.h + d : dy < 0 ? r.y - d - size : cy - size / 2;
        const box = { x: bx, y: by, w: tw, h: size };
        if (!boxHit(box, obst, q.own, m)) { best = box; break; }
      }
    }
    const forced = !best;
    if (!best) best = { x: cx - tw / 2, y: r.y + r.h + d0, w: tw, h: size };
    const tx = Math.max(r.x, Math.min(r.x + r.w, best.x + best.w / 2)), ty = Math.max(r.y, Math.min(r.y + r.h, best.y + best.h / 2));
    const lx = Math.max(best.x, Math.min(best.x + best.w, tx)), ly = Math.max(best.y, Math.min(best.y + best.h, ty));
    obst.push(best);
    out.push({ id: q.id, kind: 'leader', r, box: best, txt, from: [tx, ty], to: [lx, ly], forced });
  }
  return { out, belowExt };
}

// ---------- ajuste (snap) ----------
// contexto: rectángulos destino + líneas verticales (v) y horizontales (h) + paso de cuadrícula
function snapContext(doc, exclude, o) {
  const W = doc.wall.w, H = doc.wall.h, rects = [], v = [0, W / 2, W], h = [0, H];
  if (doc.opts.showEje) h.push(H - doc.wall.eje);
  if (o.obj) for (const it of doc.items) {
    if (it.oculto || it.tipo === 'medida' || it.tipo === 'persona' || it.tipo === 'nota' || exclude.has(it.id)) continue;
    rects.push(outer(it));
  }
  if (o.guides && doc.opts.showGuides) { v.push(...doc.guides.v); h.push(...doc.guides.h); }
  return { rects, v, h, grid: o.grid ? Math.max(0.1, num(doc.opts.grid, 10)) : 0 };
}
function bestSnap(ms, ts, thr) {
  let bd = Infinity;
  for (const m of ms) for (const t of ts) { const d = t - m; if (Math.abs(d) <= thr && Math.abs(d) < Math.abs(bd) - EPS) bd = d; }
  if (bd === Infinity) return null;
  const lines = new Set();
  for (const m of ms) for (const t of ts) if (Math.abs(t - m - bd) < 1e-4) lines.add(t);
  return { d: bd, lines: [...lines] };
}
function gridNear(vals, g) { return g ? vals.map((m) => Math.round(m / g) * g) : []; }
function targetsX(c) { const xs = c.v.slice(); for (const q of c.rects) xs.push(q.x, q.x + q.w / 2, q.x + q.w); return xs; }
function targetsY(c) { const ys = c.h.slice(); for (const q of c.rects) ys.push(q.y, q.y + q.h / 2, q.y + q.h); return ys; }
function snapRect(r, c, thr) {
  const mx = [r.x, r.x + r.w / 2, r.x + r.w], my = [r.y, r.y + r.h / 2, r.y + r.h];
  const bx = bestSnap(mx, targetsX(c).concat(gridNear([r.x, r.x + r.w], c.grid)), thr);
  const by = bestSnap(my, targetsY(c).concat(gridNear([r.y, r.y + r.h], c.grid)), thr);
  return { dx: bx ? bx.d : 0, dy: by ? by.d : 0, gx: bx ? bx.lines : [], gy: by ? by.lines : [] };
}
function snapPoint(p, c, thr) {
  const bx = bestSnap([p.x], targetsX(c).concat(gridNear([p.x], c.grid)), thr);
  const by = bestSnap([p.y], targetsY(c).concat(gridNear([p.y], c.grid)), thr);
  return { x: p.x + (bx ? bx.d : 0), y: p.y + (by ? by.d : 0), gx: bx ? bx.lines : [], gy: by ? by.lines : [] };
}

// ---------- selección ----------
function hitTest(doc, x, y, tol) {
  for (let i = doc.items.length - 1; i >= 0; i--) {
    const it = doc.items[i];
    if (it.oculto || it.bloqueado || (it.tipo === 'persona' && doc.opts.showHuman === false)) continue;
    if (it.tipo === 'medida') { if (distSeg(x, y, it.x1, it.y1, it.x2, it.y2) <= tol) return it; continue; }
    const o = outer(it);
    if (x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h) return it;
  }
  return null;
}
function idsInRect(doc, r) {
  const out = [];
  for (const it of doc.items) if (!it.oculto && !it.bloqueado && !(it.tipo === 'persona' && doc.opts.showHuman === false) && intersects(outer(it), r)) out.push(it.id);
  return out;
}
// redimensión desde una esquina; keep = conservar proporción de la obra (sin marco); f = ancho de marco+paspartú
function resizeRect(orig, corner, px, py, keep, f, min) {
  const west = corner.indexOf('w') >= 0, north = corner.indexOf('n') >= 0;
  const ax = west ? orig.x + orig.w : orig.x, ay = north ? orig.y + orig.h : orig.y;
  const lo = 2 * f + (min || 1);
  let w = Math.max(lo, west ? ax - px : px - ax), h = Math.max(lo, north ? ay - py : py - ay);
  if (keep) {
    const r = (orig.w - 2 * f) / (orig.h - 2 * f);
    let iw = w - 2 * f, ih = h - 2 * f;
    if (iw / ih > r) ih = iw / r; else iw = ih * r;
    w = iw + 2 * f; h = ih + 2 * f;
  }
  return { x: west ? ax - w : ax, y: north ? ay - h : ay, w, h };
}
function reorder(items, sel, mode) {
  const a = items.slice();
  if (mode === 'front') return a.filter((i) => !sel.has(i.id)).concat(a.filter((i) => sel.has(i.id)));
  if (mode === 'back') return a.filter((i) => sel.has(i.id)).concat(a.filter((i) => !sel.has(i.id)));
  if (mode === 'up') { for (let i = a.length - 2; i >= 0; i--) if (sel.has(a[i].id) && !sel.has(a[i + 1].id)) { const t = a[i]; a[i] = a[i + 1]; a[i + 1] = t; } }
  if (mode === 'down') { for (let i = 1; i < a.length; i++) if (sel.has(a[i].id) && !sel.has(a[i - 1].id)) { const t = a[i]; a[i] = a[i - 1]; a[i - 1] = t; } }
  return a;
}

// ---------- historial y archivo ----------
function snapshot(doc) { return JSON.stringify(Object.assign({}, doc, { images: undefined, opts: undefined })); }
function restore(str, cur) { const d = JSON.parse(str); d.images = cur.images; d.opts = cur.opts; return d; }
function serialize(doc) {
  const used = {};
  for (const it of doc.items) if (it.imgId && doc.images[it.imgId]) used[it.imgId] = doc.images[it.imgId];
  return JSON.stringify(Object.assign({}, doc, { version: 2, images: used }));
}
function normalize(src) {
  const d = newDoc();
  d.titulo = typeof src.titulo === 'string' ? src.titulo : d.titulo;
  const w = src.wall || {};
  d.wall = { w: Math.max(1, num(w.w, 500)), h: Math.max(1, num(w.h, 300)), color: /^#[0-9a-f]{6}$/i.test(w.color) ? w.color : '#ffffff', eje: num(w.eje, 150), grosor: Math.max(0, num(w.grosor, 15)) };
  d.opts = Object.assign(d.opts, src.opts || {});
  d.opts.exp = Object.assign(defaultExp(), (src.opts && src.opts.exp) || {});
  d.opts.iso = Object.assign(defaultIso(), (src.opts && src.opts.iso) || {});
  if (d.opts.vista !== 'iso') d.opts.vista = 'alzado';
  const g = src.guides || {};
  d.guides = { v: (g.v || []).map(Number).filter(isFinite), h: (g.h || []).map(Number).filter(isFinite) };
  d.images = src.images && typeof src.images === 'object' ? src.images : {};
  d.items = (src.items || []).map((it) => {
    if (it.tipo === 'vano') return makeVano(it);
    if (it.tipo === 'medida') return makeMedida(it);
    if (it.tipo === 'nota') return makeNota(it);
    if (it.tipo === 'persona') return makePersona(it, d.wall.h);
    const o = makeObra(it); o.ficha = Object.assign(makeObra({}).ficha, it.ficha || {});
    o.est = { w: !!(it.est && it.est.w), h: !!(it.est && it.est.h) }; // proyectos anteriores: todo cuenta como medido
    return o;
  }).filter((it) => (it.tipo === 'nota' ? ['x', 'y'] : ['x', 'y', 'w', 'h']).every((k) => it.tipo === 'medida' || isFinite(it[k]))
    && (it.tipo !== 'medida' || ['x1', 'y1', 'x2', 'y2'].every((k) => isFinite(it[k]))));
  const so = src.opts || {};
  if (!d.items.some((i) => i.tipo === 'persona') && so.humanH != null) { // proyecto de la fase 1: una sola figura en opciones
    const h = num(so.humanH, 170);
    d.items.unshift(makePersona({ nombre: 'Persona ' + fmt(h), h, x: num(so.humanX, -60) - personaW(h, 'pie') / 2 }, d.wall.h));
  }
  delete d.opts.humanH; delete d.opts.humanX;
  groundPersonas(d);
  return d;
}
// versión 1 (MuseoDraft/Konva): píxeles de escenario a 10 px/cm; muro arriba en y=50 px.
// La x del muro dependía del ancho de la ventana y no se guardaba: se centra el conjunto.
function migrateV1(s) {
  const d = newDoc(), SC = num(s.scale, 10) || 10;
  d.wall.w = Math.max(1, num(s.wall && s.wall.width, 500));
  d.wall.h = Math.max(1, num(s.wall && s.wall.height, 300));
  const items = Array.isArray(s.items) ? s.items : [], meas = Array.isArray(s.measurements) ? s.measurements : [];
  let minx = Infinity, maxx = -Infinity;
  for (const it of items) { minx = Math.min(minx, it.x); maxx = Math.max(maxx, it.x + num(it.realWidth, 0) * SC); }
  for (const m of meas) { minx = Math.min(minx, m.x1, m.x2); maxx = Math.max(maxx, m.x1, m.x2); }
  if (!isFinite(minx)) { minx = 0; maxx = 0; }
  const x0 = (d.wall.w - (maxx - minx) / SC) / 2;
  const toX = (px) => (px - minx) / SC + x0, toY = (py) => (py - 50) / SC;
  for (const it of items) {
    const imgId = it.src ? uid('i') : null;
    if (imgId) d.images[imgId] = it.src;
    const w = Math.max(0.1, num(it.realWidth, 50)), h = Math.max(0.1, num(it.realHeight, 50));
    d.items.push(makeObra({ nombre: String(it.name || 'Obra'), x: toX(it.x), y: toY(it.y), w, h, imgId, imgRatio: num(it.ratio, w / h) }));
  }
  for (const m of meas) d.items.push(makeMedida({ x1: toX(m.x1), y1: toY(m.y1), x2: toX(m.x2), y2: toY(m.y2) }));
  groundPersonas(d);
  return d;
}
function parseProject(text) {
  let s;
  try { s = JSON.parse(text); } catch (e) { throw new Error('El archivo no es JSON válido.'); }
  if (!s || typeof s !== 'object') throw new Error('El archivo no es un proyecto de MuseoDraft.');
  if (s.version === 2 && s.wall && Array.isArray(s.items)) return { doc: normalize(s), migrated: false };
  if (s.wall && s.wall.width != null && Array.isArray(s.items)) return { doc: migrateV1(s), migrated: true };
  throw new Error('El archivo no es un proyecto de MuseoDraft.');
}
function csvCell(v) { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function toCSV(doc) {
  const head = ['orden', 'tipo', 'nombre', 'titulo', 'autor', 'anio', 'tecnica', 'inventario',
    'ancho_obra_cm', 'alto_obra_cm', 'estado_ancho', 'estado_alto', 'marco_cm', 'paspartu_cm', 'profundidad_cm', 'ancho_ext_cm', 'alto_ext_cm',
    'desde_izquierda_cm', 'piso_a_borde_inf_cm', 'piso_a_centro_cm', 'piso_a_borde_sup_cm', 'caida_cm', 'altura_clavo_cm'];
  const rows = [head];
  const els = doc.items.filter((it) => it.tipo === 'obra' || it.tipo === 'vano').slice().sort((a, b) => outer(a).x - outer(b).x);
  els.forEach((it, i) => {
    const n = info(doc, it), f = it.ficha || {}, o = it.tipo === 'obra';
    rows.push([i + 1, it.tipo, it.nombre, f.titulo, f.autor, f.anio, f.tecnica, f.inv,
      fmt(it.w), fmt(it.h), o ? (it.est && it.est.w ? 'estimado' : 'medido') : '', o ? (it.est && it.est.h ? 'estimado' : 'medido') : '', o ? fmt(num(it.marco, 0)) : '', o ? fmt(num(it.pp, 0)) : '', fmt(num(it.prof, 0)), fmt(n.extW), fmt(n.extH),
      fmt(n.izq), fmt(n.inf), fmt(n.centro), fmt(n.sup), o ? fmt(num(it.caida, 0)) : '', o ? fmt(n.clavo) : '']);
  });
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

// ---------- exportación ----------
const MAX_AREA = 16e6, MAX_SIDE = 16384; // bajo el límite de Safari (16 777 216 px)
function exportBounds(doc, o) {
  const rects = [wallRect(doc)], sh = o.show || {};
  for (const it of doc.items) {
    if (it.oculto) continue;
    if (it.tipo === 'persona' && !o.human) continue;
    if (it.tipo === 'vano' && sh.vanos === false) continue;
    if (it.tipo === 'medida' && sh.medidas === false) continue;
    if (it.tipo === 'nota' && sh.notas === false) continue;
    rects.push(outer(it));
  }
  const b = bbox(rects), m = Math.max(0, num(o.margen, 40));
  if (sh.muro) { const e = Math.max(12, b.w * 0.045); const L = Math.min(b.x, -e), T = Math.min(b.y, -e); b.w += b.x - L; b.h += b.y - T; b.x = L; b.y = T; }
  const pie = (o.pie || o.escala || o.rotulo) ? Math.max(30, b.w * 0.08) : 0;
  return { x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.h + 2 * m + pie };
}
// escala de anotación: en alzado, el texto de cota mide cotaCm sobre el muro, sea cual sea la resolución
// (antes crecía con el ancho de la imagen y en muros largos superaba los huecos entre obras)
function annotU(o, s, Wpx) {
  if (o.iso) return Math.max(1, Wpx / 1200);
  return Math.max(0.2, Math.min(50, num(o.cotaCm, 4)) * s / 10);
}
function maxPxCm(bounds) {
  return Math.min(Math.sqrt(MAX_AREA / (bounds.w * bounds.h)), MAX_SIDE / bounds.w, MAX_SIDE / bounds.h);
}
// exportar solo un área (en cm de alzado o en unidades proyectadas de la isométrica): recorta y deja una franja para el pie
function areaFrame(doc, area, o) {
  const pxcm = num(o.pxcm, 10), withPie = !!(o.escala || o.rotulo);
  let extra = 0;
  if (o.iso && o.escala) { const ax = isoAxes(isoCfg(doc)); extra = Math.abs(ax.dx) * niceLen(Math.min(doc.wall.w, area.w) * 0.3); }
  const frame = (s) => { const u = annotU(o, s, area.w * s), pie = withPie ? (70 * u) / s + extra : 0; return { u, b: { x: area.x, y: area.y, w: area.w, h: area.h + pie } }; };
  let s = Math.max(0.1, Math.min(pxcm, maxPxCm(frame(pxcm).b)));
  s = Math.max(0.1, Math.min(s, maxPxCm(frame(s).b)));
  const { u, b } = frame(s);
  const W = Math.max(1, Math.round(b.w * s)), H = Math.max(1, Math.round(b.h * s));
  return { bounds: b, s, W, H, view: { s, ox: -b.x * s, oy: -b.y * s }, u, capped: s < pxcm - 1e-9, clip: { x: 0, y: 0, w: area.w * s, h: area.h * s } };
}
function exportFrame(doc, o) {
  if (o.area && o.area.w > 0 && o.area.h > 0) return areaFrame(doc, o.area, o);
  const bounds = o.iso ? isoBounds(doc, o) : exportBounds(doc, o);
  const s = Math.max(0.1, Math.min(num(o.pxcm, 10), maxPxCm(bounds)));
  const W = Math.max(1, Math.round(bounds.w * s)), H = Math.max(1, Math.round(bounds.h * s));
  return { bounds, s, W, H, view: { s, ox: -bounds.x * s, oy: -bounds.y * s }, u: annotU(o, s, W), capped: s < num(o.pxcm, 10) - 1e-9 };
}

// ---------- pintores (misma escena para pantalla, PNG y SVG) ----------
function canvasPainter(ctx, getImage) {
  function st(o) {
    ctx.setLineDash(o.dash || []);
    if (o.lw) ctx.lineWidth = o.lw;
    if (o.stroke) ctx.strokeStyle = o.stroke;
    if (o.fill) ctx.fillStyle = o.fill;
  }
  return {
    rect(x, y, w, h, o = {}) { st(o); if (o.fill) ctx.fillRect(x, y, w, h); if (o.stroke) ctx.strokeRect(x, y, w, h); },
    line(x1, y1, x2, y2, o = {}) { st(o); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); },
    poly(pts, o = {}) {
      st(o); ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath(); if (o.fill) ctx.fill(); if (o.stroke) ctx.stroke();
    },
    circle(cx, cy, r, o = {}) { st(o); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); if (o.fill) ctx.fill(); if (o.stroke) ctx.stroke(); },
    text(s, x, y, o = {}) {
      ctx.save(); ctx.setLineDash([]);
      const size = o.size || 11;
      ctx.font = (o.weight || 400) + ' ' + size + 'px ' + FONT;
      ctx.textAlign = o.align || 'left';
      ctx.textBaseline = { top: 'top', middle: 'middle', bottom: 'bottom' }[o.base] || 'alphabetic';
      if (o.rot) { ctx.translate(x, y); ctx.rotate(o.rot * Math.PI / 180); x = 0; y = 0; }
      if (o.halo) { ctx.lineWidth = size * 0.4; ctx.strokeStyle = o.haloColor || '#fff'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
      ctx.fillStyle = o.fill || COL.ink; ctx.fillText(s, x, y);
      ctx.restore();
    },
    clipStart(x, y, w, h) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); },
    clipEnd() { ctx.restore(); },
    imageM(id, m, w, h, rot) {
      const img = getImage(id); if (!img) return false;
      const r = num(rot, 0), sw = (r % 180) ? h : w, sh = (r % 180) ? w : h;
      ctx.save(); ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]); ctx.translate(w / 2, h / 2); ctx.rotate(r * Math.PI / 180);
      ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh); ctx.restore();
      return true;
    },
    image(id, x, y, w, h, rot) {
      const img = getImage(id); if (!img) return false;
      const r = num(rot, 0), sw = (r % 180) ? h : w, sh = (r % 180) ? w : h;
      ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(r * Math.PI / 180);
      ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh); ctx.restore();
      return true;
    },
  };
}
function svgPainter(images) {
  const parts = [];
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const n = (v) => Math.round(v * 100) / 100;
  const sty = (o) => ' fill="' + (o.fill || 'none') + '"' + (o.stroke ? ' stroke="' + o.stroke + '" stroke-width="' + n(o.lw || 1) + '"' : '')
    + (o.dash && o.dash.length ? ' stroke-dasharray="' + o.dash.map(n).join(' ') + '"' : '');
  return {
    rect(x, y, w, h, o = {}) { parts.push('<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(w) + '" height="' + n(h) + '"' + sty(o) + '/>'); },
    line(x1, y1, x2, y2, o = {}) { parts.push('<line x1="' + n(x1) + '" y1="' + n(y1) + '" x2="' + n(x2) + '" y2="' + n(y2) + '"' + sty(Object.assign({}, o, { fill: null })) + '/>'); },
    poly(pts, o = {}) { parts.push('<polygon points="' + pts.map((p) => n(p[0]) + ',' + n(p[1])).join(' ') + '"' + sty(o) + '/>'); },
    circle(cx, cy, r, o = {}) { parts.push('<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(r) + '"' + sty(o) + '/>'); },
    text(s, x, y, o = {}) {
      const anchor = { left: 'start', center: 'middle', right: 'end' }[o.align] || 'start';
      const dy = { top: '0.8em', middle: '0.35em', bottom: '-0.25em' }[o.base] || '0';
      const size = o.size || 11;
      const halo = o.halo ? ' stroke="' + (o.haloColor || '#fff') + '" stroke-width="' + n(size * 0.4) + '" stroke-linejoin="round" paint-order="stroke"' : '';
      parts.push('<text x="' + n(x) + '" y="' + n(y) + '" dy="' + dy + '" font-family="' + esc(FONT) + '" font-size="' + n(size) + '" font-weight="' + (o.weight || 400)
        + '" text-anchor="' + anchor + '" fill="' + (o.fill || COL.ink) + '"' + halo + (o.rot ? ' transform="rotate(' + o.rot + ' ' + n(x) + ' ' + n(y) + ')"' : '') + '>' + esc(s) + '</text>');
    },
    clipStart(x, y, w, h) {
      const id = 'recorte' + (parts.length + 1);
      parts.push('<clipPath id="' + id + '"><rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(w) + '" height="' + n(h) + '"/></clipPath><g clip-path="url(#' + id + ')">');
    },
    clipEnd() { parts.push('</g>'); },
    imageM(id, m, w, h, rot) {
      const src = images[id]; if (!src) return false;
      const r = num(rot, 0), sw = (r % 180) ? h : w, sh = (r % 180) ? w : h;
      parts.push('<g transform="matrix(' + m.map((q) => Math.round(q * 1e4) / 1e4).join(' ') + ')">'
        + '<image href="' + src + '" xlink:href="' + src + '" x="' + n(w / 2 - sw / 2) + '" y="' + n(h / 2 - sh / 2) + '" width="' + n(sw) + '" height="' + n(sh)
        + '" preserveAspectRatio="none"' + (r ? ' transform="rotate(' + r + ' ' + n(w / 2) + ' ' + n(h / 2) + ')"' : '') + '/></g>');
      return true;
    },
    image(id, x, y, w, h, rot) {
      const src = images[id]; if (!src) return false;
      const r = num(rot, 0), sw = (r % 180) ? h : w, sh = (r % 180) ? w : h, cx = x + w / 2, cy = y + h / 2;
      parts.push('<image href="' + src + '" xlink:href="' + src + '" x="' + n(cx - sw / 2) + '" y="' + n(cy - sh / 2) + '" width="' + n(sw) + '" height="' + n(sh)
        + '" preserveAspectRatio="none"' + (r ? ' transform="rotate(' + r + ' ' + n(cx) + ' ' + n(cy) + ')"' : '') + '/>');
      return true;
    },
    toString(w, h, bg) {
      return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + w + '" height="' + h
        + '" viewBox="0 0 ' + w + ' ' + h + '">\n' + (bg ? '<rect width="' + w + '" height="' + h + '" fill="' + bg + '"/>\n' : '') + parts.join('\n') + '\n</svg>\n';
    },
  };
}
// rayado 45° dentro de un rectángulo (en px)
function hatch(x, y, w, h, step) {
  const segs = [];
  for (let d = step; d < w + h; d += step) {
    const p1 = d <= w ? [x + d, y] : [x + w, y + d - w];
    const p2 = d <= h ? [x, y + d] : [x + d - h, y + h];
    segs.push([p1[0], p1[1], p2[0], p2[1]]);
  }
  return segs;
}
function niceLen(maxCm) {
  const c = [10, 20, 50, 100, 200, 500, 1000, 2000];
  let best = c[0]; for (const v of c) if (v <= maxCm) best = v;
  return best;
}

// o: { ui, sel:Set, handles, cotas:'none'|'sel'|'all', eje, human, grid, guides:{v,h}|null,
//      snap:{gx,gy}|null, marquee, tempMed, floorRange:[x0,x1], vw, vh, pie, bounds }
function drawScene(P, doc, v, o) {
  const s = v.s, u = o.ui || 1;
  const X = (x) => v.ox + x * s, Y = (y) => v.oy + y * s, L = (l) => l * s;
  const W = doc.wall.w, H = doc.wall.h;
  const sel = o.sel || new Set();
  const show = Object.assign({ imagenes: true, vanos: true, dims: true, gaps: true, bordes: true, centro: true, lineas: true, medidas: true, muro: false, fichas: false, notas: true }, o.show || {});
  const KIND = { size: 'dims', gap: 'gaps', wall: 'bordes', floor: 'bordes', center: 'centro', label: 'centro', medida: 'medidas', muro: 'muro' };
  const vis = doc.items.filter((it) => !it.oculto && (it.tipo !== 'vano' || show.vanos) && (it.tipo !== 'persona' || o.human));
  const labeled = new Set();
  let belowExt = new Map(); // px que ocupa, bajo cada obra, la cota de ancho colocada debajo
  const below = doc.opts.anchoAbajo !== false;
  const extBelow = (id) => belowExt.get(id) || (sel.has(id) ? belowExt.get('__sel') || 0 : 0);

  if (o.clip) P.clipStart(o.clip.x, o.clip.y, o.clip.w, o.clip.h);
  // piso
  const fr = o.floorRange || [-100, W + 100];
  P.rect(X(fr[0]), Y(H), L(fr[1] - fr[0]), 10 * u, { fill: '#dcdad2' });
  P.line(X(fr[0]), Y(H), X(fr[1]), Y(H), { stroke: COL.ink, lw: 1.5 * u });
  // muro
  P.rect(X(0), Y(0), L(W), L(H), { fill: doc.wall.color || '#fff', stroke: COL.ink, lw: u });
  // cuadrícula
  if (o.grid) {
    const g = Math.max(0.1, num(doc.opts.grid, 10));
    if (g * s >= 5) {
      const gs = { stroke: 'rgba(17,17,17,0.08)', lw: u };
      for (let x = g; x < W - EPS; x += g) P.line(X(x), Y(0), X(x), Y(H), gs);
      for (let y = H - g; y > EPS; y -= g) P.line(X(0), Y(y), X(W), Y(y), gs);
    }
  }
  // eje visual
  if (o.eje) {
    const ye = Y(H - doc.wall.eje);
    P.line(X(0), ye, X(W), ye, { stroke: COL.mossD, lw: u, dash: [6 * u, 4 * u] });
  }
  // elementos
  for (const it of vis) {
    if (it.tipo === 'medida' || it.tipo === 'nota') continue;
    if (it.tipo === 'persona') { drawPersona(it); continue; }
    const r = outer(it), x = X(r.x), y = Y(r.y), w = L(r.w), h = L(r.h);
    if (it.tipo === 'vano') {
      P.rect(x, y, w, h, { fill: COL.vano });
      for (const g of hatch(x, y, w, h, 9 * u)) P.line(g[0], g[1], g[2], g[3], { stroke: COL.hatch, lw: u });
      P.rect(x, y, w, h, { stroke: '#8a8a84', lw: u, dash: [4 * u, 3 * u] });
      if (w > 30 * u && h > 16 * u) P.text(it.nombre || 'Vano', x + w / 2, y + h / 2, { size: 10 * u, fill: '#55554f', align: 'center', base: 'middle', halo: true, haloColor: COL.vano });
      continue;
    }
    const m = Math.max(0, num(it.marco, 0)), pp = Math.max(0, num(it.pp, 0));
    if (m > 0) P.rect(x, y, w, h, { fill: COL.marco });
    if (pp > 0) P.rect(X(r.x + m), Y(r.y + m), L(r.w - 2 * m), L(r.h - 2 * m), { fill: COL.pp });
    const ix = X(it.x + m + pp), iy = Y(it.y + m + pp), iw = L(it.w), ih = L(it.h);
    const drawn = it.imgId && show.imagenes ? P.image(it.imgId, ix, iy, iw, ih, it.rot) : false;
    if (!drawn) {
      P.rect(ix, iy, iw, ih, { fill: COL.ph });
      P.line(ix, iy, ix + iw, iy + ih, { stroke: '#cfcdc5', lw: u });
      P.line(ix + iw, iy, ix, iy + ih, { stroke: '#cfcdc5', lw: u });
      if (iw > 40 * u && ih > 14 * u) P.text(it.nombre || 'Obra', ix + iw / 2, iy + ih / 2, { size: 10 * u, fill: '#55554f', align: 'center', base: 'middle', halo: true, haloColor: COL.ph });
    }
    P.rect(x, y, w, h, { stroke: 'rgba(17,17,17,0.55)', lw: u });
  }
  // encima de obras y vanos: rótulo del eje y medidas
  if (o.eje) P.text('eje ' + fmt(doc.wall.eje), X(0) + 5 * u, Y(H - doc.wall.eje) - 3 * u, { size: 10 * u, fill: COL.mossD, base: 'bottom', halo: true });
  if (show.medidas) for (const it of vis) if (it.tipo === 'medida') drawMedida(it, COL.orange);
  // altura de ojos de las personas
  if (o.ojos) for (const it of vis) {
    if (it.tipo !== 'persona') continue;
    const ye = Y(H - ojos(it)), xr = X(it.x + it.w);
    P.line(X(it.x) - 3 * u, ye, xr + 10 * u, ye, { stroke: COL.steel, lw: u, dash: [2 * u, 2 * u] });
    P.text('ojos ' + fmt(ojos(it)), xr + 12 * u, ye, { size: 9 * u, fill: COL.steel, base: 'middle', halo: true });
  }
  // cotas
  const pad = (16 * u) / s;
  const solid = vis.filter((it) => it.tipo === 'obra' || it.tipo === 'vano');
  // 1) reunir cotas: las de tamaño se planifican; el resto conserva su sitio
  const sizeReq = [], rest = [];
  const pxR = (r) => ({ x: X(r.x), y: Y(r.y), w: L(r.w), h: L(r.h) });
  const estOf = (its, k) => its.some((it) => it.tipo === 'obra' && it.est && it.est[k]);
  const take = (gs, id, own, r, its) => {
    let hasSize = false;
    for (const g of gs) { if (g.k === 'size') hasSize = true; else rest.push(g); }
    if (hasSize) sizeReq.push({ id, own, r: pxR(r), cm: r, vw: r.w, vh: r.h, estW: estOf(its, 'w'), estH: estOf(its, 'h') });
  };
  if (o.cotas === 'all') {
    for (const it of solid) {
      if (sel.has(it.id)) continue;
      const r = outer(it), obst = solid.filter((q) => q !== it).map(outer);
      take(cotasRow(r, obst, doc.wall, pad, it.id, below), it.id, new Set([it.id]), r, [it]);
    }
  }
  if (o.cotas !== 'none' && sel.size) {
    const ss = solid.filter((it) => sel.has(it.id));
    if (ss.length) {
      const r = bbox(ss.map(outer)), obst = solid.filter((q) => !sel.has(q.id)).map(outer);
      take(cotasFull(r, obst, doc.wall, pad, below), '__sel', new Set(ss.map((it) => it.id).concat('__sel')), r, ss);
    }
  }
  // 2) obstáculos: obras, vanos, personas y los rótulos de las demás cotas
  let plan = null;
  if (show.dims && sizeReq.length) {
    const obst = solid.map((it) => Object.assign({ own: it.id }, pxR(outer(it))));
    for (const it of vis) if (it.tipo === 'persona' || (it.tipo === 'nota' && show.notas)) obst.push(pxR(outer(it)));
    for (const g of rest) { const t = dimText(g); if (t) obst.push(textBox(t)); }
    plan = planCotas(sizeReq, obst, { u, below, floorY: Y(H) });
    belowExt = plan.belowExt;
  }
  // 3) dibujar
  for (const g of rest) drawDim(g, COL.steel);
  // o.hits (solo pantalla): zonas de cada cota de tamaño, para editarla con doble clic
  const hit = (p, dim, b) => { if (o.hits) o.hits.push({ id: p.id, dim, box: b }); };
  const union = (a, b) => { const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y); return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }; };
  if (plan) for (const p of plan.out) {
    const r = sizeReq.find((q) => q.id === p.id).cm, cmX = (px) => (px - v.ox) / s, cmY = (py) => (py - v.oy) / s;
    if (p.kind === 'w' || p.kind === 'h') {
      const g = p.kind === 'w'
        ? { x1: r.x, y1: cmY(p.line), x2: r.x + r.w, y2: cmY(p.line), v: r.w, k: 'size', under: p.side === 'below', t: p.txt, est: p.est }
        : { x1: cmX(p.line), y1: r.y, x2: cmX(p.line), y2: r.y + r.h, v: r.h, k: 'size', out: p.side === 'right' ? 1 : -1, t: p.txt, est: p.est };
      drawDim(g, COL.steel);
      const t = dimText(g), x1 = X(g.x1), y1 = Y(g.y1), x2 = X(g.x2), y2 = Y(g.y2), k = 4 * u;
      if (t) hit(p, p.kind === 'h' ? 'h' : (p.txt.indexOf('×') >= 0 ? 'wh' : 'w'), union(textBox(t), { x: Math.min(x1, x2) - k, y: Math.min(y1, y2) - k, w: Math.abs(x2 - x1) + 2 * k, h: Math.abs(y2 - y1) + 2 * k }));
    } else {
      if (show.lineas) P.line(p.from[0], p.from[1], p.to[0], p.to[1], { stroke: COL.steel, lw: 0.75 * u });
      P.text(p.txt, p.box.x + p.box.w / 2, p.box.y + p.box.h / 2, { size: 10 * u, fill: COL.steel, align: 'center', base: 'middle', halo: true });
      hit(p, /^alto/.test(p.txt) ? 'h' : /^ancho/.test(p.txt) ? 'w' : 'wh', p.box);
    }
  }
  // tamaño total del muro: ancho arriba, alto a la izquierda
  if (show.muro) {
    const pm = (26 * u) / s;
    drawDim({ x1: 0, y1: -pm, x2: W, y2: -pm, v: W, k: 'muro' }, COL.ink);
    drawDim({ x1: -pm, y1: 0, x2: -pm, y2: H, v: H, k: 'muro', out: -1 }, COL.ink);
  }
  // fichas bajo cada obra (desplazadas si ya hay rótulo de altura)
  if (show.fichas) {
    for (const it of vis) {
      if (it.tipo !== 'obra') continue;
      const f = it.ficha || {}, r = outer(it);
      const lines = [f.titulo || '', [f.autor, f.anio].filter(Boolean).join(', '), f.tecnica || ''].filter(Boolean);
      let y0 = Y(r.y + r.h) + 5 * u + extBelow(it.id) + (labeled.has(it.id) || (labeled.has('__sel') && sel.has(it.id)) ? 15 * u : 0);
      if (!lines.length) continue;
      // fondo tipo cédula (tipografía monoespaciada: ancho ≈ 0,6 em por carácter)
      const bw = Math.max(...lines.map((t, i) => t.length * (i ? 9.5 : 10.5) * 0.61)) * u + 6 * u, bh = lines.length * 13 * u + 4 * u;
      P.rect(X(r.x) - 3 * u, y0 - 2 * u, bw, bh, { fill: doc.wall.color || '#fff' });
      lines.forEach((t, i) => P.text(t, X(r.x), y0 + i * 13 * u, { size: (i ? 9.5 : 10.5) * u, fill: i ? '#44443f' : COL.ink, weight: i ? 400 : 600, base: 'top' }));
    }
  }
  // notas: recuadro con texto y, si señala una obra visible, línea guía hasta su borde más cercano
  if (show.notas) for (const it of vis) {
    if (it.tipo !== 'nota') continue;
    const g = notaGeom(it), b = outer(it), tgt = it.apunta ? vis.find((q) => q.id === it.apunta && q.tipo === 'obra') : null;
    if (tgt) {
      const t = outer(tgt), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const ex = Math.max(t.x, Math.min(t.x + t.w, cx)), ey = Math.max(t.y, Math.min(t.y + t.h, cy));
      const sx = Math.max(b.x, Math.min(b.x + b.w, ex)), sy = Math.max(b.y, Math.min(b.y + b.h, ey));
      if (Math.hypot(ex - sx, ey - sy) > EPS) {
        P.line(X(sx), Y(sy), X(ex), Y(ey), { stroke: COL.orange, lw: u });
        P.circle(X(ex), Y(ey), 2.2 * u, { fill: COL.orange });
      }
    }
    P.rect(X(b.x), Y(b.y), L(b.w), L(b.h), { fill: '#fffdf6', stroke: COL.orange, lw: u });
    g.ls.forEach((ln, i) => P.text(ln, X(b.x + g.pad), Y(b.y + g.pad + i * g.lh), { size: L(g.tam), fill: COL.ink, base: 'top' }));
  }
  // guías del usuario
  if (o.guides) {
    const gs = { stroke: COL.moss, lw: u };
    for (const g of o.guides.v) P.line(X(g), 0, X(g), o.vh, gs);
    for (const g of o.guides.h) P.line(0, Y(g), o.vw, Y(g), gs);
  }
  // guías inteligentes
  if (o.snap) {
    const ss = { stroke: COL.orange, lw: 1, dash: [3, 3] };
    for (const g of o.snap.gx) P.line(X(g), 0, X(g), o.vh, ss);
    for (const g of o.snap.gy) P.line(0, Y(g), o.vw, Y(g), ss);
  }
  // selección
  for (const it of vis) {
    if (!sel.has(it.id)) continue;
    if (it.tipo === 'medida') { drawMedida(it, COL.mossD, 2.5); continue; }
    const r = outer(it);
    P.rect(X(r.x) - 1, Y(r.y) - 1, L(r.w) + 2, L(r.h) + 2, { stroke: COL.mossD, lw: 2, dash: it.bloqueado ? [4, 3] : null });
  }
  if (o.handles && sel.size === 1) {
    const it = vis.find((q) => sel.has(q.id));
    if (it && it.tipo !== 'medida' && it.tipo !== 'nota' && !it.bloqueado) {
      const r = outer(it);
      for (const c of corners(r)) if (it.tipo !== 'persona' || c[2][0] === 'n') P.rect(X(c[0]) - 4, Y(c[1]) - 4, 8, 8, { fill: '#fff', stroke: COL.mossD, lw: 1.5 });
    }
  }
  if (o.marquee) {
    const m = o.marquee;
    P.rect(X(m.x), Y(m.y), L(m.w), L(m.h), { fill: 'rgba(88,106,69,0.08)', stroke: COL.mossD, lw: 1, dash: [3, 3] });
  }
  if (o.tempMed) drawMedida(o.tempMed, COL.orange, 1.5);
  if (o.clip) P.clipEnd();
  // pie: escala gráfica y rótulo (exportación)
  const escala = o.escala != null ? o.escala : o.pie, rotulo = o.rotulo != null ? o.rotulo : o.pie;
  if ((escala || rotulo) && o.bounds) {
    const b = o.bounds, yb = Y(b.y + b.h) - 22 * u;
    if (escala) {
    const len = niceLen(Math.min(W, b.w) * 0.3), segs = 4, sw = L(len) / segs, x0 = Math.max(X(0), X(b.x) + 14 * u);
    for (let i = 0; i < segs; i++) P.rect(x0 + i * sw, yb, sw, 6 * u, { fill: i % 2 ? '#fff' : COL.ink, stroke: COL.ink, lw: u });
    P.text('0', x0, yb - 4 * u, { size: 10 * u, align: 'center', base: 'bottom' });
    P.text(fmt(len / 2), x0 + L(len / 2), yb - 4 * u, { size: 10 * u, align: 'center', base: 'bottom' });
    P.text(fmt(len) + ' cm', x0 + L(len), yb - 4 * u, { size: 10 * u, align: 'center', base: 'bottom' });
    }
    if (rotulo) {
    const tit = (doc.titulo || 'Muro') + ' — ' + fmt(W) + ' × ' + fmt(H) + ' cm' + (o.eje ? ', eje visual ' + fmt(doc.wall.eje) + ' cm' : '');
    P.text(tit, Math.min(X(W), X(b.x + b.w) - 14 * u), yb + 6 * u, { size: 11 * u, align: 'right', base: 'bottom', weight: 600 });
    }
  }

  function drawPersona(it) {
    paintPersona(P, personaGeom(it), (x, h) => [X(x), Y(H - h)], (c, r, st) => P.circle(X(c[0]), Y(H - c[1]), L(r), st), u);
    P.text(fmt(it.h), X(it.x + it.w / 2), Y(it.y) - 4 * u, { size: 9 * u, fill: COL.steel, align: 'center', base: 'bottom', halo: true });
  }
  function drawMedida(m, col, lw) {
    const len = Math.hypot(m.x2 - m.x1, m.y2 - m.y1);
    drawDim({ x1: m.x1, y1: m.y1, x2: m.x2, y2: m.y2, v: len, k: 'medida' }, col, lw);
  }
  // ubicación del texto de una cota (sin dibujar): sirve para dibujarla y para medirla como obstáculo
  function dimText(g) {
    if (KIND[g.k] && !show[KIND[g.k]]) return null;
    const x1 = X(g.x1), y1 = Y(g.y1), x2 = X(g.x2), y2 = Y(g.y2);
    if (g.k === 'label') return { s: 'c ' + fmt(g.v), x: x1, y: y1 + 4 * u + (g.id ? extBelow(g.id) : 0), o: { size: 10 * u, align: 'center', base: 'top' } };
    if (Math.hypot(x2 - x1, y2 - y1) < 2) return null;
    const strong = g.k === 'medida' || g.k === 'muro';
    const label = g.t || ((g.k === 'center' ? 'c ' : '') + fmt(g.v) + (strong ? ' cm' : ''));
    const size = (strong ? 11 : 10) * u, mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    if (g.k === 'center') return { s: label, x: g.side === 'right' ? x1 + 4 * u : x1 - 4 * u, y: y1 + 2 * u, o: { size, align: g.side === 'right' ? 'left' : 'right', base: 'top' } };
    if (g.under) return { s: label, x: mx, y: my + 4 * u, o: { size, align: 'center', base: 'top' } };
    if (Math.abs(x2 - x1) >= Math.abs(y2 - y1)) return { s: label, x: mx, y: my - 3 * u, o: { size, align: 'center', base: 'bottom' } };
    if (g.k === 'medida') return { s: label, x: mx + 5 * u, y: my, o: { size, align: 'left', base: 'middle' } };
    const out = g.out || 1;
    return { s: label, x: mx + out * 4 * u, y: my, o: { size, align: 'center', base: out > 0 ? 'top' : 'bottom', rot: -90 } };
  }
  function drawDim(g, col, lwMul) {
    if (KIND[g.k] && !show[KIND[g.k]]) return;
    if (g.k === 'label' && g.id) labeled.add(g.id);
    const lw = (lwMul || 1) * u;
    const x1 = X(g.x1), y1 = Y(g.y1), x2 = X(g.x2), y2 = Y(g.y2);
    const t = dimText(g);
    if (g.k === 'label') { if (t) P.text(t.s, t.x, t.y, Object.assign({ fill: col, halo: true }, t.o)); return; }
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 2) return;
    if (show.lineas || g.k === 'medida') {
      P.line(x1, y1, x2, y2, { stroke: col, lw, dash: g.k === 'center' ? [2 * u, 3 * u] : g.est ? [5 * u, 3 * u] : null });
      const nx = -(y2 - y1) / len, ny = (x2 - x1) / len, tk = 4 * u;
      P.line(x1 - nx * tk, y1 - ny * tk, x1 + nx * tk, y1 + ny * tk, { stroke: col, lw });
      P.line(x2 - nx * tk, y2 - ny * tk, x2 + nx * tk, y2 + ny * tk, { stroke: col, lw });
    }
    const strong = g.k === 'medida' || g.k === 'muro';
    P.text(t.s, t.x, t.y, Object.assign({ fill: col, halo: true, weight: strong ? 600 : 400 }, t.o));
  }
}

// ---------- personas: geometría en cm (x, altura desde el piso) ----------
function personaGeom(it) {
  const cx = it.x + it.w / 2, out = [];
  if (it.figura === 'silla') { // silla de ruedas de perfil, normalizada a 130 de alto
    const k = it.h / 130, Pt = (x, y) => [cx + x * k, y * k];
    out.push({ t: 'circle', c: Pt(-8, 30), r: 29 * k, st: 'wheel' }, { t: 'circle', c: Pt(-8, 30), r: 3 * k, st: 'hub' },
      { t: 'circle', c: Pt(28, 6), r: 6 * k, st: 'caster' },
      { t: 'line', a: Pt(-26, 38), b: Pt(24, 38) }, { t: 'line', a: Pt(-26, 38), b: Pt(-30, 88) },
      { t: 'line', a: Pt(-30, 88), b: Pt(-38, 88) }, { t: 'line', a: Pt(24, 38), b: Pt(28, 12), lw: 1.2 },
      { t: 'poly', pts: [Pt(-24, 104), Pt(-6, 104), Pt(-2, 50), Pt(26, 50), Pt(30, 44), Pt(30, 16), Pt(38, 14), Pt(38, 9), Pt(22, 9), Pt(22, 40), Pt(-24, 40)] },
      { t: 'circle', c: Pt(-14, 117), r: 12 * k, st: 'body' });
  } else {
    const k = it.h / 170, Pt = (x, y) => [cx + x * k, y * k];
    out.push({ t: 'poly', pts: [[-10, 0], [-2, 0], [0, 78], [2, 0], [10, 0], [12, 90], [20, 96], [24, 140], [9, 144], [-9, 144], [-24, 140], [-20, 96], [-12, 90]].map((p) => Pt(p[0], p[1])) },
      { t: 'circle', c: Pt(0, 157), r: 12 * k, st: 'body' });
  }
  return out;
}
function paintPersona(P, geom, map, circ, u) {
  const body = { fill: 'rgba(79,107,130,0.18)', stroke: COL.steel, lw: u };
  for (const g of geom) {
    if (g.t === 'poly') P.poly(g.pts.map((p) => map(p[0], p[1])), body);
    else if (g.t === 'line') { const a = map(g.a[0], g.a[1]), b = map(g.b[0], g.b[1]); P.line(a[0], a[1], b[0], b[1], { stroke: COL.steel, lw: (g.lw || 1.4) * u }); }
    else circ(g.c, g.r, g.st === 'body' ? body : g.st === 'hub' ? { fill: COL.steel } : { stroke: COL.steel, lw: (g.st === 'wheel' ? 1.4 : 1.2) * u });
  }
}

// ---------- vista isométrica ----------
// Axonometría con longitudes reales sobre los tres ejes: x a lo largo del muro, y altura, z hacia el visitante.
// a = giro del muro respecto de la horizontal; b = inclinación del eje de profundidad.
function defaultIso() { return { a: 30, b: 30, lado: 'der', piso: 200, gridPiso: true }; }
function isoAxes(iso) {
  const a = num(iso.a, 30) * Math.PI / 180, b = num(iso.b, 30) * Math.PI / 180;
  return iso.lado === 'izq'
    ? { cx: Math.cos(a), dx: -Math.sin(a), cz: Math.cos(b), dz: Math.sin(b), right: false }
    : { cx: Math.cos(a), dx: Math.sin(a), cz: -Math.cos(b), dz: Math.sin(b), right: true };
}
function isoPt(ax, x, y, z) { return [x * ax.cx + z * ax.cz, -y + x * ax.dx + z * ax.dz]; }
function isoCfg(doc) { return Object.assign(defaultIso(), doc.opts.iso || {}); }
function isoExtent(doc, o) {
  const W = doc.wall.w, ps = o.human ? doc.items.filter((i) => i.tipo === 'persona' && !i.oculto) : [];
  let x0 = 0, x1 = W, D = Math.max(20, num(isoCfg(doc).piso, 200));
  for (const p of ps) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x + p.w); D = Math.max(D, num(p.dist, 120) + 40); }
  return { fx0: x0 - 30, fx1: x1 + 30, D, ps };
}
// límites en unidades de pantalla a escala 1 (cm proyectados)
function isoBounds(doc, o) {
  const iso = isoCfg(doc), ax = isoAxes(iso), W = doc.wall.w, H = doc.wall.h, t = Math.max(0, num(doc.wall.grosor, 15));
  const e = isoExtent(doc, o), sh = o.show || {}, pts = [];
  const box = (x0, x1, y0, y1, z0, z1) => { for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) pts.push(isoPt(ax, x, y, z)); };
  box(e.fx0, e.fx1, 0, 0, 0, e.D); box(0, W, 0, H, -t, 0);
  for (const it of doc.items) {
    if (it.oculto || !(it.tipo === 'obra' || (it.tipo === 'vano' && sh.vanos !== false))) continue;
    const r = outer(it); box(r.x, r.x + r.w, H - r.y - r.h, H - r.y, 0, Math.max(0, num(it.prof, 0)));
  }
  for (const p of e.ps) box(p.x, p.x + p.w, 0, p.h + 14, num(p.dist, 120), num(p.dist, 120));
  if (sh.muro) { const pad = isoMuroPad(doc, iso) + 20; box(-pad, W + pad, 0, H + pad, 0, 0); }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const m = Math.max(0, num(o.margen, 40)), w = x1 - x0;
  const pie = (o.escala || o.rotulo) ? Math.max(30, w * 0.08) : 0;
  return { x: x0 - m, y: y0 - m, w: w + 2 * m, h: y1 - y0 + 2 * m + pie };
}
function isoItemsBounds(doc, ids) {
  const ax = isoAxes(isoCfg(doc)), H = doc.wall.h, pts = [];
  const box = (x0, x1, y0, y1, z0, z1) => { for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) pts.push(isoPt(ax, x, y, z)); };
  for (const it of doc.items) {
    if (!ids.has(it.id) || it.oculto) continue;
    if (it.tipo === 'obra' || it.tipo === 'vano') { const r = outer(it); box(r.x, r.x + r.w, H - r.y - r.h, H - r.y, 0, Math.max(0, num(it.prof, 0))); }
    else if (it.tipo === 'persona') { const d = num(it.dist, 120); box(it.x, it.x + it.w, 0, it.h + 14, d, d); box(it.x - 10, it.x + it.w + 10, 0, 0, d - 25, d + 25); }
  }
  if (!pts.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function isoSig(doc) { const c = isoCfg(doc); return c.a + ',' + c.b + ',' + c.lado; }
function isoMuroPad(doc, iso) { return Math.max(0, num(doc.wall.grosor, 15)) * Math.sin(num(iso.b, 30) * Math.PI / 180) + 12; }

// o: { ui, sel, human, ojos, eje, show:{imagenes,vanos,fichas,muro}, escala, rotulo, bounds }
function drawIso(P, doc, v, o) {
  const u = o.ui || 1, s = v.s, iso = isoCfg(doc), ax = isoAxes(iso);
  const W = doc.wall.w, H = doc.wall.h, t = Math.max(0, num(doc.wall.grosor, 15));
  const Q = (x, y, z) => { const p = isoPt(ax, x, y, z); return [v.ox + p[0] * s, v.oy + p[1] * s]; };
  const show = Object.assign({ imagenes: true, vanos: true, fichas: false, muro: false }, o.show || {});
  const sel = o.sel || new Set(), e = isoExtent(doc, o), sg = ax.right ? 1 : -1;
  const line = (a, b, st) => P.line(a[0], a[1], b[0], b[1], st);
  const ellipse = (fn, n) => { const pts = []; for (let i = 0; i < n; i++) { const k = i / n * 2 * Math.PI; pts.push(fn(Math.cos(k), Math.sin(k))); } return pts; };

  if (o.clip) P.clipStart(o.clip.x, o.clip.y, o.clip.w, o.clip.h);
  // piso
  P.poly([Q(e.fx0, 0, 0), Q(e.fx1, 0, 0), Q(e.fx1, 0, e.D), Q(e.fx0, 0, e.D)], { fill: '#e7e5dd', stroke: '#b9b7ae', lw: u });
  if (iso.gridPiso) {
    const gs = { stroke: 'rgba(17,17,17,0.09)', lw: u }, st = 50;
    for (let z = st; z < e.D - EPS; z += st) line(Q(e.fx0, 0, z), Q(e.fx1, 0, z), gs);
    for (let x = Math.ceil(e.fx0 / st) * st; x <= e.fx1 + EPS; x += st) line(Q(x, 0, 0), Q(x, 0, e.D), gs);
  }
  for (const p of e.ps) { // sombra de cada persona sobre el piso
    const cx = p.x + p.w / 2, d = num(p.dist, 120), rx = p.w * 0.55, rz = Math.min(25, p.w * 0.45);
    P.poly(ellipse((c, sn) => Q(cx + rx * c, 0, d + rz * sn), 28), { fill: 'rgba(17,17,17,0.10)' });
  }
  // muro: canto visible, coronación y cara
  const xe = ax.right ? W : 0, wl = { stroke: COL.ink, lw: u };
  if (t > 0) {
    P.poly([Q(xe, 0, -t), Q(xe, 0, 0), Q(xe, H, 0), Q(xe, H, -t)], Object.assign({ fill: '#d6d4cc' }, wl));
    P.poly([Q(0, H, -t), Q(W, H, -t), Q(W, H, 0), Q(0, H, 0)], Object.assign({ fill: '#ebeae4' }, wl));
  }
  P.poly([Q(0, 0, 0), Q(W, 0, 0), Q(W, H, 0), Q(0, H, 0)], Object.assign({ fill: doc.wall.color || '#fff' }, wl));
  if (o.eje) line(Q(0, doc.wall.eje, 0), Q(W, doc.wall.eje, 0), { stroke: COL.mossD, lw: u, dash: [6 * u, 4 * u] });

  function ficha(it, p) { // bajo la cara frontal de la obra; una obra más cercana puede taparla
    const f = it.ficha || {};
    const lines = [f.titulo || '', [f.autor, f.anio].filter(Boolean).join(', '), f.tecnica || ''].filter(Boolean);
    if (!lines.length) return;
    const y0 = p[1] + 6 * u;
    const bw = Math.max(...lines.map((tx, i) => tx.length * (i ? 9.5 : 10.5) * 0.61)) * u + 6 * u, bh = lines.length * 13 * u + 4 * u;
    P.rect(p[0] - 3 * u, y0 - 2 * u, bw, bh, { fill: doc.wall.color || '#fff' });
    lines.forEach((tx, i) => P.text(tx, p[0], y0 + i * 13 * u, { size: (i ? 9.5 : 10.5) * u, fill: i ? '#44443f' : COL.ink, weight: i ? 400 : 600, base: 'top' }));
  }
  // obras y vanos, del más lejano al más cercano
  const boxes = doc.items.filter((it) => !it.oculto && (it.tipo === 'obra' || (it.tipo === 'vano' && show.vanos)))
    .map((it) => ({ it, r: outer(it) }))
    .sort((A, B) => (sg * (A.r.x + A.r.w / 2) + (H - A.r.y)) - (sg * (B.r.x + B.r.w / 2) + (H - B.r.y)));
  for (const { it, r } of boxes) {
    const x0 = r.x, x1 = r.x + r.w, y1 = H - r.y, y0 = H - r.y - r.h, dp = Math.max(0, num(it.prof, 0));
    const obra = it.tipo === 'obra', m = obra ? Math.max(0, num(it.marco, 0)) : 0, pp = obra ? Math.max(0, num(it.pp, 0)) : 0;
    const out = { stroke: 'rgba(17,17,17,0.55)', lw: u };
    if (dp > 0) {
      const side = obra ? (m > 0 ? '#1d1c19' : '#a9a79f') : '#b3b1a9', top = obra ? (m > 0 ? '#44433e' : '#cfcdc5') : '#d2d0c8';
      const xs = ax.right ? x1 : x0;
      P.poly([Q(xs, y0, 0), Q(xs, y0, dp), Q(xs, y1, dp), Q(xs, y1, 0)], Object.assign({ fill: side }, out));
      P.poly([Q(x0, y1, 0), Q(x1, y1, 0), Q(x1, y1, dp), Q(x0, y1, dp)], Object.assign({ fill: top }, out));
    }
    const face = (a0, a1, b0, b1) => [Q(a0, b0, dp), Q(a1, b0, dp), Q(a1, b1, dp), Q(a0, b1, dp)];
    if (!obra) {
      P.poly(face(x0, x1, y0, y1), { fill: COL.vano });
      for (const g of hatch(x0, -y1, r.w, r.h, (9 * u) / s)) line(Q(g[0], -g[1], dp), Q(g[2], -g[3], dp), { stroke: COL.hatch, lw: u });
      P.poly(face(x0, x1, y0, y1), { stroke: '#8a8a84', lw: u, dash: [4 * u, 3 * u] });
      const c = Q((x0 + x1) / 2, (y0 + y1) / 2, dp);
      P.text(it.nombre || 'Vano', c[0], c[1], { size: 10 * u, fill: '#55554f', align: 'center', base: 'middle', halo: true, haloColor: COL.vano });
      continue;
    }
    if (m > 0) P.poly(face(x0, x1, y0, y1), { fill: COL.marco });
    if (pp > 0) P.poly(face(x0 + m, x1 - m, y0 + m, y1 - m), { fill: COL.pp });
    const ix = it.x + m + pp, itop = H - (it.y + m + pp), org = Q(ix, itop, dp);
    const drawn = it.imgId && show.imagenes ? P.imageM(it.imgId, [ax.cx * s, ax.dx * s, 0, s, org[0], org[1]], it.w, it.h, it.rot) : false;
    if (!drawn) {
      const f = face(ix, ix + it.w, itop - it.h, itop);
      P.poly(f, { fill: COL.ph }); line(f[0], f[2], { stroke: '#cfcdc5', lw: u }); line(f[1], f[3], { stroke: '#cfcdc5', lw: u });
    }
    P.poly(face(x0, x1, y0, y1), out);
    if (show.fichas) { const a = Q(x0, y0, dp), b = Q(x1, y0, dp); ficha(it, [a[0], Math.max(a[1], b[1])]); }
  }
  // selección
  for (const it of doc.items) {
    if (!sel.has(it.id) || it.oculto) continue;
    const st = { stroke: COL.mossD, lw: 2 };
    if (it.tipo === 'obra' || (it.tipo === 'vano' && show.vanos)) {
      const r = outer(it), dp = Math.max(0, num(it.prof, 0));
      P.poly([Q(r.x, H - r.y - r.h, dp), Q(r.x + r.w, H - r.y - r.h, dp), Q(r.x + r.w, H - r.y, dp), Q(r.x, H - r.y, dp)], st);
    } else if (it.tipo === 'persona' && o.human) {
      const d = num(it.dist, 120);
      P.poly([Q(it.x, 0, d), Q(it.x + it.w, 0, d), Q(it.x + it.w, it.h, d), Q(it.x, it.h, d)], Object.assign({ dash: [4, 3] }, st));
    }
  }
  if (o.eje) { const p = Q(0, doc.wall.eje, 0); P.text('eje ' + fmt(doc.wall.eje), p[0] + 5 * u, p[1] - 3 * u, { size: 10 * u, fill: COL.mossD, base: 'bottom', halo: true }); }
  // personas, de la más lejana a la más cercana
  for (const p of e.ps.slice().sort((A, B) => num(A.dist, 120) - num(B.dist, 120) || sg * (A.x - B.x))) {
    const d = num(p.dist, 120), cx = p.x + p.w / 2;
    paintPersona(P, personaGeom(p), (x, h) => Q(x, h, d),
      (c, rr, st) => P.poly(ellipse((cs, sn) => Q(c[0] + rr * cs, c[1] + rr * sn, d), 28), st), u);
    const top = Q(cx, p.h, d);
    P.text(fmt(p.h), top[0], top[1] - 4 * u, { size: 9 * u, fill: COL.steel, align: 'center', base: 'bottom', halo: true });
    if (o.ojos) { // línea de mirada horizontal hasta el muro
      const eh = ojos(p), a = Q(cx, eh, d);
      if (cx >= 0 && cx <= W) { // frente al muro: mirada perpendicular hasta la pared
        const b = Q(cx, eh, 0);
        line(a, b, { stroke: COL.steel, lw: u, dash: [3 * u, 3 * u] });
        P.circle(b[0], b[1], 2.5 * u, { fill: COL.steel });
        P.text('ojos ' + fmt(eh), b[0] + 5 * u, b[1] - 3 * u, { size: 9 * u, fill: COL.steel, base: 'bottom', halo: true });
      } else { // fuera del ancho del muro: solo la marca a la altura de los ojos
        const r = Q(p.x + p.w + 6, eh, d), l = Q(p.x - 6, eh, d);
        line(l, r, { stroke: COL.steel, lw: u, dash: [2 * u, 2 * u] });
        P.text('ojos ' + fmt(eh), r[0] + 4 * u, r[1], { size: 9 * u, fill: COL.steel, base: 'middle', halo: true });
      }
    }
  }
  // tamaño del muro
  if (show.muro) {
    const pad = isoMuroPad(doc, iso) + (6 * u) / s, col = { stroke: COL.ink, lw: u };
    const dim = (a, b, label, vertical, outDir) => {
      line(a, b, col);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len, tk = 4 * u;
      line([a[0] - nx * tk, a[1] - ny * tk], [a[0] + nx * tk, a[1] + ny * tk], col); line([b[0] - nx * tk, b[1] - ny * tk], [b[0] + nx * tk, b[1] + ny * tk], col);
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, txt = { size: 11 * u, fill: COL.ink, weight: 600, halo: true };
      if (vertical) P.text(label, mx + outDir * 4 * u, my, Object.assign(txt, { align: 'center', base: outDir > 0 ? 'top' : 'bottom', rot: -90 }));
      else P.text(label, mx, my - 4 * u, Object.assign(txt, { align: 'center', base: 'bottom' }));
    };
    dim(Q(0, H + pad, 0), Q(W, H + pad, 0), fmt(W) + ' cm', false);
    const xh = ax.right ? -((14 * u) / s) : W + (14 * u) / s;
    dim(Q(xh, 0, 0), Q(xh, H, 0), fmt(H) + ' cm', true, ax.right ? -1 : 1);
  }
  if (o.clip) P.clipEnd();
  // pie: escala sobre el eje del muro y rótulo
  if ((o.escala || o.rotulo) && o.bounds) {
    const b = o.bounds, bx = v.ox + b.x * s, by = v.oy + (b.y + b.h) * s, bw = b.w * s;
    if (o.escala) {
      const len = niceLen(Math.min(W, b.w) * 0.3), segs = 4, ux = ax.cx * s, uy = ax.dx * s, x0 = bx + 14 * u;
      const y0 = by - 34 * u - Math.max(0, uy * len);
      const nl = Math.hypot(ux, uy), nx = -uy / nl * 6 * u, ny = ux / nl * 6 * u;
      for (let i = 0; i < segs; i++) {
        const a = [x0 + ux * len * i / segs, y0 + uy * len * i / segs], c = [x0 + ux * len * (i + 1) / segs, y0 + uy * len * (i + 1) / segs];
        P.poly([a, c, [c[0] + nx, c[1] + ny], [a[0] + nx, a[1] + ny]], { fill: i % 2 ? '#fff' : COL.ink, stroke: COL.ink, lw: u });
      }
      P.text('0', x0, y0 - 4 * u, { size: 10 * u, align: 'center', base: 'bottom' });
      P.text(fmt(len) + ' cm', x0 + ux * len, y0 + uy * len - 4 * u, { size: 10 * u, align: 'center', base: 'bottom' });
      P.text('medidas reales a lo largo de los tres ejes', x0, y0 + Math.max(0, uy * len) + 12 * u, { size: 9 * u, fill: '#55554f', base: 'top' });
    }
    if (o.rotulo) {
      const tit = (doc.titulo || 'Muro') + ' — ' + fmt(W) + ' × ' + fmt(H) + ' cm, vista isométrica';
      P.text(tit, bx + bw - 14 * u, by - 14 * u, { size: 11 * u, align: 'right', base: 'bottom', weight: 600 });
    }
  }
}
function corners(r) { return [[r.x, r.y, 'nw'], [r.x + r.w, r.y, 'ne'], [r.x, r.y + r.h, 'sw'], [r.x + r.w, r.y + r.h, 'se']]; }

return {
  VERSION: 2, COL, FONT, EPS, fmt, uid, clone, num, defaultExp, EXP_PRESETS,
  newDoc, makeObra, makeVano, makeMedida, makeNota, notaGeom, markEst, makePersona, groundPersonas, setPersona, personaW, ojos,
  frameW, outer, bbox, wallRect, normRect, intersects, distSeg, corners,
  moveItem, applyDeltas, info, setPos, setObraDim, setFrame, rotate90, imgAspect,
  align, distribute, centerOnEye, centerGroupH,
  neighbors, cotasFull, cotasRow, planCotas, cotaGeom, textBox, annotU,
  snapContext, snapRect, snapPoint,
  hitTest, idsInRect, resizeRect, reorder,
  snapshot, restore, serialize, normalize, migrateV1, parseProject, toCSV,
  MAX_AREA, MAX_SIDE, exportBounds, maxPxCm, exportFrame,
  canvasPainter, svgPainter, hatch, drawScene,
  defaultIso, isoAxes, isoPt, isoBounds, drawIso, personaGeom, isoItemsBounds, isoSig, areaFrame,
};
})();
export default MD;
