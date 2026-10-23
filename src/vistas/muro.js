
// Vista Muro. Extraída de MuseoDraft: trabaja sobre un documento en cm (lo que el núcleo MD espera)
// construido desde un muro del proyecto, y vuelca cada cambio al proyecto (obras y colgado en m).
import { MD } from '../core/muro.js';
import * as M from '../core/modelo.js';
import { cmAm, mAcm, r6 } from '../core/unidades.js';
import { MARKUP } from './muro-markup.js';
import { docDeMuro } from '../core/puente.js';

// env: { root, proyecto, muro (puede ser null), onCambio(), onGuardar(), onObraCambiada(id), onArchivoJson(f), mensaje }
export function montarMuro(env) {
'use strict';
const root = env.root;
root.innerHTML = MARKUP;
const $ = (id) => root.querySelector('#' + id);
const cv = $('cv'), ctx = cv.getContext('2d'), work = $('md-work');
let muro = env.muro;
let activa = false;

// ---------- puente proyecto ↔ documento ----------
const P = () => env.proyecto;
const construir = (mu) => (mu ? docDeMuro(P(), mu) : MD.newDoc());
// doc → muro + obras del proyecto
const volcar = () => {
  if (!muro) return;
  muro.nombre = doc.titulo;
  muro.ancho = r6(cmAm(doc.wall.w)); muro.alto = r6(cmAm(doc.wall.h)); muro.eje = r6(cmAm(doc.wall.eje)); muro.grosor = r6(cmAm(doc.wall.grosor)); muro.color = doc.wall.color;
  muro.guias = { v: doc.guides.v.map((v) => r6(cmAm(v))), h: doc.guides.h.map((v) => r6(cmAm(v))) };
  muro.opts = doc.opts;
  const vistos = new Set(); const colgado = [];
  const CM = { vano: ['x', 'y', 'w', 'h', 'prof'], persona: ['x', 'y', 'h', 'w', 'dist'], medida: ['x1', 'y1', 'x2', 'y2'], nota: ['x', 'y', 'tam'] };
  const otros = [];
  for (const it of doc.items) {
    if (it.tipo !== 'obra') { const n = { ...it }; for (const k of CM[it.tipo] || []) if (Number.isFinite(n[k])) n[k] = r6(cmAm(n[k])); otros.push(n); continue; }
    let c = muro.colgado.find((x) => x.id === it.id), o = c ? M.obraDe(P(), c.obraId) : null;
    if (!o) { o = M.nuevaObra({ nombre: it.nombre || (it.ficha && it.ficha.titulo) || 'Obra' }); P().obras.push(o); c = M.nuevoColgado({ id: it.id, obraId: o.id }); }
    // imagen nueva o reemplazada desde esta vista: pasa al almacén del proyecto con el mismo id
    if (it.imgId && doc.images[it.imgId] && !P().imagenes[it.imgId]) P().imagenes[it.imgId] = doc.images[it.imgId];
    o.imagenId = it.imgId && P().imagenes[it.imgId] ? it.imgId : null; if (it.imgRatio > 0) o.imgRatio = r6(it.imgRatio);
    const f = it.ficha || {};
    const nombre = f.titulo !== o.nombre ? f.titulo : it.nombre !== o.nombre ? it.nombre : o.nombre;
    o.nombre = nombre; it.nombre = nombre; it.ficha = { ...f, titulo: nombre };
    o.autor = f.autor || ''; o.anio = f.anio || ''; o.tecnica = f.tecnica || ''; o.inv = f.inv || '';
    o.ancho = r6(cmAm(it.w)); o.alto = r6(cmAm(it.h)); o.estimado = { ancho: !!(it.est && it.est.w), alto: !!(it.est && it.est.h) };
    Object.assign(c, { x: r6(cmAm(it.x)), y: r6(cmAm(it.y)), marco: r6(cmAm(it.marco || 0)), pp: r6(cmAm(it.pp || 0)), prof: r6(cmAm(it.prof || 0)), caida: r6(cmAm(it.caida || 0)), rot: it.rot || 0, lock: !!it.lock, bloqueado: !!it.bloqueado, oculto: !!it.oculto });
    colgado.push(c); vistos.add(o.id);
  }
  muro.colgado = colgado; muro.otros = otros;
  M.limpiarImagenes(P());
  if (env.onCambio) env.onCambio();
  if (env.onObraCambiada) env.onObraCambiada(null);
};
const RULER = 20;
const fmt = MD.fmt;

// ---------- estado ----------
let doc = construir(muro);
const viewAlz = { s: 1, ox: 0, oy: 0 }, viewIso = { s: 1, ox: 0, oy: 0, fitted: false };
let view = viewAlz;
const isIso = () => doc.opts.vista === 'iso';
let sel = new Set();
let tool = 'select', space = false;
let drag = null, snapVis = null, marquee = null, tempMed = null, hover = null;
let areaMode = false, areaRect = null; // herramienta temporal para marcar el área a exportar
let dirty = false;
const imgCache = new Map();
const pointers = new Map();
const DEF_CALIB = 96 / 2.54;
let calib = DEF_CALIB;
try { const c = parseFloat(localStorage.getItem('museodraft.calib')); if (c > 5 && c < 200) calib = c; } catch (e) {}

// ---------- historial ----------
const hist = { undo: [], redo: [], last: MD.snapshot(doc) };
let commitT = 0;
function commit() {
  clearTimeout(commitT); commitT = 0;
  const s = MD.snapshot(doc);
  if (s === hist.last) return;
  hist.undo.push(hist.last); if (hist.undo.length > 200) hist.undo.shift();
  hist.last = s; hist.redo = []; dirty = true; syncUndo(); volcar();
}
function commitSoon() { clearTimeout(commitT); commitT = setTimeout(commit, 400); }
function undo() {
  if (commitT) commit();
  if (!hist.undo.length) return;
  hist.redo.push(hist.last); hist.last = hist.undo.pop();
  doc = MD.restore(hist.last, doc); dirty = true; afterDocChange(); volcar(); msg('Deshecho.');
}
function redo() {
  if (!hist.redo.length) return;
  hist.undo.push(hist.last); hist.last = hist.redo.pop();
  doc = MD.restore(hist.last, doc); dirty = true; afterDocChange(); volcar(); msg('Rehecho.');
}
function syncUndo() { $('b-undo').disabled = !hist.undo.length && !commitT; $('b-redo').disabled = !hist.redo.length; }
function resetHistory() { hist.undo = []; hist.redo = []; hist.last = MD.snapshot(doc); syncUndo(); }

// ---------- utilidades ----------
const getItem = (id) => doc.items.find((i) => i.id === id);
const selItems = () => doc.items.filter((i) => sel.has(i.id));
const solidSel = () => selItems().filter((i) => (i.tipo === 'obra' || i.tipo === 'vano') && !i.bloqueado);
const X = (x) => view.ox + x * view.s, Y = (y) => view.oy + y * view.s;
const toCm = (px, py) => ({ x: (px - view.ox) / view.s, y: (py - view.oy) / view.s });
function evPos(e) { const r = cv.getBoundingClientRect(); return { px: e.clientX - r.left, py: e.clientY - r.top }; }
const clampS = (s) => Math.max(0.03, Math.min(400, s));
let msgT = 0;
function msg(t) { $('st-msg').textContent = t || ''; clearTimeout(msgT); if (t) msgT = setTimeout(() => { $('st-msg').textContent = ''; }, 6000); }
function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
const slug = (s) => (s || 'muro').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'muro';

// ---------- imágenes ----------
function getImage(id) {
  if (!id) return null;
  let e = imgCache.get(id);
  if (!e) {
    const src = doc.images[id]; if (!src) return null;
    const img = new Image(); e = { img, ok: false, bad: false };
    img.onload = () => { e.ok = true; requestRender(); };
    img.onerror = () => { e.bad = true; };
    img.src = src; imgCache.set(id, e);
  }
  return e.ok ? e.img : null;
}
function preloadImages() {
  const ids = [...new Set(doc.items.filter((i) => i.imgId && !i.oculto).map((i) => i.imgId))];
  return Promise.all(ids.map((id) => new Promise((res) => {
    getImage(id); const e = imgCache.get(id);
    if (!e || e.ok || e.bad) return res();
    e.img.addEventListener('load', res, { once: true }); e.img.addEventListener('error', res, { once: true });
  })));
}
function readImage(file, max) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) return rej(new Error('vacía'));
      const k = Math.min(1, max / Math.max(w, h)), cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
      const c = document.createElement('canvas'); c.width = cw; c.height = ch;
      const g = c.getContext('2d'), alpha = /png|gif|webp|svg/.test(file.type);
      if (!alpha) { g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch); }
      g.drawImage(img, 0, 0, cw, ch);
      try { res({ dataURL: c.toDataURL(alpha ? 'image/png' : 'image/jpeg', 0.9), w, h }); } catch (err) { rej(err); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('formato')); };
    img.src = url;
  });
}

// ---------- vista ----------
function workSize() { return { w: work.clientWidth, h: work.clientHeight }; }
function fitRect(b) {
  const { w, h } = workSize(), m = 44;
  const aw = Math.max(40, w - RULER - 2 * m), ah = Math.max(40, h - RULER - 2 * m);
  const s = clampS(Math.min(aw / b.w, ah / b.h));
  view.s = s; view.ox = RULER + m + (aw - b.w * s) / 2 - b.x * s; view.oy = RULER + m + (ah - b.h * s) / 2 - b.y * s;
  afterView();
}
function fitView() {
  if (isIso()) { fitRect(MD.isoBounds(doc, { margen: 0, human: doc.opts.showHuman, show: { muro: !!doc.opts.showMuro } })); viewIso.fitted = true; return; }
  const rects = [MD.wallRect(doc)];
  for (const it of doc.items) if (!it.oculto && (it.tipo !== 'persona' || doc.opts.showHuman)) rects.push(MD.outer(it));
  const b = MD.bbox(rects); b.y -= 12; b.h += 22; // aire para rótulos y piso
  fitRect(b);
}
function zoomAt(f, px, py) {
  const ns = clampS(view.s * f); if (ns === view.s) return;
  view.ox = px - (px - view.ox) * ns / view.s; view.oy = py - (py - view.oy) * ns / view.s; view.s = ns; afterView();
}
function zoomCenter(f) { const { w, h } = workSize(); zoomAt(f, (w + RULER) / 2, (h + RULER) / 2); }
function zoomTo(s) { zoomCenter(clampS(s) / view.s); }
function centerOn(b) {
  const { w, h } = workSize();
  view.ox = (w + RULER) / 2 - (b.x + b.w / 2) * view.s; view.oy = (h + RULER) / 2 - (b.y + b.h / 2) * view.s; afterView();
}
function centerView() {
  if (isIso()) return fitView();
  const ss = selItems();
  centerOn(ss.length ? MD.bbox(ss.map(MD.outer)) : MD.wallRect(doc));
}
function afterView() { $('zoomv').value = fmt(view.s / calib * 100, view.s / calib < 0.1 ? 1 : 0) + ' %'; requestRender(); }

// ---------- dibujo ----------
let raf = 0;
let lastHits = []; // cotas de tamaño dibujadas en pantalla: { id, dim: 'w'|'h'|'wh', box (px) }
function requestRender() { if (!raf) raf = requestAnimationFrame(draw); }
function draw() {
  raf = 0;
  const dpr = window.devicePixelRatio || 1, { w, h } = workSize();
  const bw = Math.max(1, Math.round(w * dpr)), bh = Math.max(1, Math.round(h * dpr));
  if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = MD.COL.paste; ctx.fillRect(0, 0, w, h);
  const P = MD.canvasPainter(ctx, getImage);
  if (isIso()) {
    MD.drawIso(P, doc, view, { ui: 1, sel, human: doc.opts.showHuman, ojos: doc.opts.showOjos, eje: doc.opts.showEje,
      show: { fichas: !!doc.opts.showFichas, muro: !!doc.opts.showMuro } });
  } else MD.drawScene(P, doc, view, {
    hits: (lastHits = []), ui: 1, sel, handles: tool === 'select', cotas: doc.opts.cotas, eje: doc.opts.showEje, human: doc.opts.showHuman,
    ojos: doc.opts.showOjos, show: { fichas: !!doc.opts.showFichas, muro: !!doc.opts.showMuro },
    grid: doc.opts.showGrid, guides: doc.opts.showGuides ? doc.guides : null, snap: snapVis, marquee, tempMed,
    floorRange: [(0 - view.ox) / view.s, (w - view.ox) / view.s], vw: w, vh: h,
  });
  const showArea = areaMode ? areaRect : (doc.opts.exp && doc.opts.exp.encuadre === 'area' ? storedArea() : null);
  if (showArea) {
    const ax = X(showArea.x), ay = Y(showArea.y), aw = showArea.w * view.s, ah = showArea.h * view.s;
    ctx.save();
    if (areaMode) { // oscurece lo que queda fuera
      ctx.fillStyle = 'rgba(17,17,17,0.18)'; ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.rect(ax, ay, aw, ah); ctx.fill('evenodd');
    }
    ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = MD.COL.orange; ctx.strokeRect(ax, ay, aw, ah);
    ctx.setLineDash([]); ctx.font = '11px ' + MD.FONT; ctx.fillStyle = MD.COL.orange; ctx.textBaseline = 'bottom';
    ctx.fillText('Área de exportación' + (isIso() ? '' : ': ' + fmt(showArea.w) + ' × ' + fmt(showArea.h) + ' cm'), ax + 2, ay - 3);
    ctx.restore();
  } else if (areaMode) {
    ctx.save(); ctx.fillStyle = 'rgba(17,17,17,0.10)'; ctx.fillRect(0, 0, w, h); ctx.restore();
  }
  if (!isIso()) drawRulers(w, h);
  if (panelDirty) { panelDirty = false; renderPanel(); }
  if (layersDirty) renderLayers();
  $('empty').style.display = doc.items.some((i) => i.tipo !== 'persona') ? 'none' : '';
}
function niceStep(s) { for (const v of [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]) if (v * s >= 56) return v; return 10000; }
function drawRulers(w, h) {
  const s = view.s, H = doc.wall.h, step = niceStep(s);
  const minor = step * s / 10 >= 5 ? step / 10 : step / 5 * s >= 5 ? step / 5 : step / 2;
  ctx.setLineDash([]);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, RULER); ctx.fillRect(0, 0, RULER, h);
  // extensión del muro en las reglas
  ctx.fillStyle = 'rgba(143,166,118,0.22)';
  ctx.fillRect(Math.max(RULER, X(0)), 0, Math.max(0, Math.min(w, X(doc.wall.w)) - Math.max(RULER, X(0))), RULER);
  ctx.fillRect(0, Math.max(RULER, Y(0)), RULER, Math.max(0, Math.min(h, Y(H)) - Math.max(RULER, Y(0))));
  ctx.strokeStyle = MD.COL.line; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, RULER + 0.5); ctx.lineTo(w, RULER + 0.5); ctx.moveTo(RULER + 0.5, 0); ctx.lineTo(RULER + 0.5, h); ctx.stroke();
  ctx.font = '9px ' + MD.FONT; ctx.fillStyle = '#6b6b64'; ctx.strokeStyle = '#9a9a92';
  // horizontal: cm desde la izquierda del muro
  const x0 = (RULER - view.ox) / s, x1 = (w - view.ox) / s;
  ctx.beginPath(); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  for (let v = Math.floor(x0 / minor) * minor; v <= x1; v += minor) {
    const px = Math.round(X(v)) + 0.5; if (px < RULER) continue;
    const major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
    ctx.moveTo(px, RULER); ctx.lineTo(px, major ? 4 : RULER - 5);
    if (major) ctx.fillText(fmt(v), px + 2, 2);
  }
  ctx.stroke();
  // vertical: altura desde el piso
  const hA = H - (h - view.oy) / s, hB = H - (RULER - view.oy) / s;
  ctx.beginPath();
  for (let v = Math.floor(hA / minor) * minor; v <= hB; v += minor) {
    const py = Math.round(Y(H - v)) + 0.5; if (py < RULER) continue;
    const major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
    ctx.moveTo(RULER, py); ctx.lineTo(major ? 4 : RULER - 5, py);
    if (major) { ctx.save(); ctx.translate(2, py - 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = 'top'; ctx.fillText(fmt(v), 0, 0); ctx.restore(); }
  }
  ctx.stroke();
  // cursor
  if (hover) {
    ctx.strokeStyle = MD.COL.orange; ctx.beginPath();
    const hx = Math.round(X(hover.x)) + 0.5, hy = Math.round(Y(hover.y)) + 0.5;
    if (hx > RULER) { ctx.moveTo(hx, 0); ctx.lineTo(hx, RULER); }
    if (hy > RULER) { ctx.moveTo(0, hy); ctx.lineTo(RULER, hy); }
    ctx.stroke();
  }
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, RULER, RULER);
  ctx.fillStyle = '#6b6b64'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('cm', RULER / 2, RULER / 2);
}

// ---------- detección ----------
function handleAt(px, py) {
  if (tool !== 'select' || sel.size !== 1) return null;
  const it = getItem([...sel][0]);
  if (!it || it.tipo === 'medida' || it.tipo === 'nota' || it.bloqueado || it.oculto) return null;
  for (const c of MD.corners(MD.outer(it))) if ((it.tipo !== 'persona' || c[2][0] === 'n') && Math.abs(X(c[0]) - px) <= 7 && Math.abs(Y(c[1]) - py) <= 7) return { id: it.id, corner: c[2] };
  return null;
}
function guideAt(px, py) {
  if (!doc.opts.showGuides || px < RULER || py < RULER) return null;
  for (let i = doc.guides.v.length - 1; i >= 0; i--) if (Math.abs(X(doc.guides.v[i]) - px) <= 4) return { axis: 'v', idx: i };
  for (let i = doc.guides.h.length - 1; i >= 0; i--) if (Math.abs(Y(doc.guides.h[i]) - py) <= 4) return { axis: 'h', idx: i };
  return null;
}
function snapCtx(exclude) {
  return MD.snapContext(doc, exclude || new Set(), { obj: doc.opts.snapObj, guides: doc.opts.snapGuides, grid: doc.opts.snapGrid });
}
function updateCursor(px, py) {
  let c = 'default';
  if (drag && drag.kind === 'pan') c = 'grabbing';
  else if (areaMode) c = 'crosshair';
  else if (space || tool === 'hand' || isIso()) c = 'grab';
  else if (px < RULER || py < RULER) c = px < RULER && py < RULER ? 'default' : (py < RULER ? 'row-resize' : 'col-resize');
  else if (tool === 'measure') c = 'crosshair';
  else if (px != null) {
    const hd = handleAt(px, py);
    if (hd) c = (hd.corner === 'nw' || hd.corner === 'se') ? 'nwse-resize' : 'nesw-resize';
    else { const g = guideAt(px, py); if (g) c = g.axis === 'v' ? 'col-resize' : 'row-resize';
      else { const p = toCm(px, py); if (MD.hitTest(doc, p.x, p.y, 6 / view.s)) c = 'move'; else if (cotaAt(px, py)) c = 'text'; } }
  }
  cv.style.cursor = c;
}
let lastPx = null, lastPy = null;

// ---------- interacción con puntero ----------
// ---------- editar una medida desde su cota (doble clic) ----------
function cotaAt(px, py) {
  if (tool !== 'select' || isIso()) return null;
  for (let i = lastHits.length - 1; i >= 0; i--) {
    const b = lastHits[i].box;
    if (px >= b.x - 3 && px <= b.x + b.w + 3 && py >= b.y - 3 && py <= b.y + b.h + 3) return lastHits[i];
  }
  return null;
}
function closeCotaEditor() { const ed = $('cota-ed'); if (!ed.hidden) { ed.hidden = true; ed.innerHTML = ''; cv.focus({ preventScroll: true }); } }
function openCotaEditor(it, dim, px, py) {
  const ed = $('cota-ed'), f = MD.frameW(it), obra = it.tipo === 'obra';
  const campos = dim === 'wh' ? ['w', 'h'] : [dim];
  const nom = { w: obra ? 'Ancho obra' : 'Ancho', h: obra ? 'Alto obra' : 'Alto' };
  ed.innerHTML = '<div class="t">' + esc(it.nombre || 'Obra') + '</div>'
    + campos.map((k) => '<label class="f">' + nom[k] + ' (cm)' + (obra && it.est && it.est[k] ? ' <span class="warn">≈ estimado</span>' : '')
      + '<input type="text" inputmode="decimal" data-k="' + k + '" value="' + fmt(it[k], 2) + '"></label>').join('')
    + (f > 0 ? '<p class="note">Sin marco ni paspartú. La cota muestra el exterior (+' + fmt(2 * f) + ' cm).</p>' : '')
    + '<p class="note">Enter guarda como medida confirmada · Esc cancela</p>'
    + '<div class="g2"><button class="pbtn" data-c="no">Cancelar</button><button class="pbtn main" data-c="ok">Guardar</button></div>';
  ed.hidden = false;
  const W = work.clientWidth, H = work.clientHeight;
  ed.style.left = Math.max(4, Math.min(W - ed.offsetWidth - 4, px + 10)) + 'px';
  ed.style.top = Math.max(4, Math.min(H - ed.offsetHeight - 4, py + 10)) + 'px';
  const save = () => {
    const vals = {};
    for (const el of ed.querySelectorAll('input[data-k]')) {
      const v = parseFloat(String(el.value).replace(',', '.'));
      if (!(v > 0)) { el.focus(); el.select(); msg('Escribe una medida mayor que 0.'); return; }
      vals[el.dataset.k] = v;
    }
    const c = MD.outer(it), cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    for (const k of campos) MD.setObraDim(it, k, vals[k]); // en ese orden: el último escrito manda
    const n = MD.outer(it); it.x = cx - n.w / 2; it.y = cy - n.h / 2;
    closeCotaEditor(); layersDirty = true; commit(); selChanged();
    msg('Medida confirmada: ' + (it.nombre || 'obra') + ', ' + fmt(it.w) + ' × ' + fmt(it.h) + ' cm.');
  };
  ed.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeCotaEditor(); }
  };
  ed.onclick = (e) => { const b = e.target.closest('[data-c]'); if (b) b.dataset.c === 'ok' ? save() : closeCotaEditor(); };
  const first = ed.querySelector('input'); first.focus(); first.select();
}
cv.addEventListener('dblclick', (e) => {
  if (tool !== 'select' || isIso()) return;
  const { px, py } = evPos(e), h = cotaAt(px, py);
  if (h) {
    const it = h.id === '__sel' ? (sel.size === 1 ? getItem([...sel][0]) : null) : getItem(h.id);
    if (!it) { msg('Esa cota es del conjunto: selecciona una sola obra para editar su medida.'); return; }
    if (it.tipo !== 'obra' && it.tipo !== 'vano') return;
    if (it.bloqueado) { msg('Está bloqueada: desbloquéala en Capas para cambiar su medida.'); return; }
    openCotaEditor(it, h.dim, px, py); return;
  }
  const p = toCm(px, py), it = MD.hitTest(doc, p.x, p.y, 6 / view.s);
  if (it && it.tipo === 'nota') {
    sel = new Set([it.id]); selChanged();
    const ta = $('sel-body').querySelector('textarea'); if (ta) { ta.focus(); ta.select(); }
  }
});
cv.addEventListener('pointerdown', () => closeCotaEditor(), true);
cv.addEventListener('pointerdown', (e) => {
  cv.focus({ preventScroll: true });
  const { px, py } = evPos(e);
  pointers.set(e.pointerId, { px, py });
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  if (pointers.size === 2) {
    if (drag && drag.kind !== 'pinch') endDrag(e);
    const [a, b] = [...pointers.values()];
    drag = { kind: 'pinch', d0: Math.hypot(b.px - a.px, b.py - a.py) || 1, s0: view.s, m0: { px: (a.px + b.px) / 2, py: (a.py + b.py) / 2 }, ox0: view.ox, oy0: view.oy };
    tempMed = null; marquee = null; return;
  }
  if (pointers.size > 2 || drag) return;
  const p = toCm(px, py);
  if (areaMode && e.button === 0 && !space) {
    drag = { kind: 'area', p0: p }; areaRect = { x: p.x, y: p.y, w: 0, h: 0 }; return;
  }
  if (e.button === 1 || tool === 'hand' || space || isIso()) {
    drag = { kind: 'pan', px0: px, py0: py, ox0: view.ox, oy0: view.oy }; updateCursor(px, py); e.preventDefault(); return;
  }
  if (e.button !== 0) return;
  if (px < RULER || py < RULER) {
    if (px < RULER && py < RULER) return;
    const axis = py < RULER ? 'h' : 'v';
    doc.guides[axis].push(axis === 'h' ? p.y : p.x);
    if (!doc.opts.showGuides) { doc.opts.showGuides = true; syncOpts(); }
    drag = { kind: 'guide', axis, idx: doc.guides[axis].length - 1, remove: true };
    return;
  }
  if (tool === 'measure') {
    const q = e.ctrlKey || e.metaKey ? p : MD.snapPoint(p, snapCtx(), 7 / view.s);
    tempMed = { x1: q.x, y1: q.y, x2: q.x, y2: q.y }; drag = { kind: 'measure' }; requestRender(); return;
  }
  const hd = handleAt(px, py);
  if (hd) { const it = getItem(hd.id); drag = { kind: 'resize', id: it.id, corner: hd.corner, orig: MD.outer(it) }; return; }
  const gh = guideAt(px, py);
  if (gh) { drag = { kind: 'guide', axis: gh.axis, idx: gh.idx, remove: false }; return; }
  const hit = MD.hitTest(doc, p.x, p.y, 6 / view.s);
  if (hit) {
    if (e.shiftKey && sel.has(hit.id)) { sel.delete(hit.id); selChanged(); return; }
    if (e.shiftKey) sel.add(hit.id);
    else if (!sel.has(hit.id)) sel = new Set([hit.id]);
    if (e.altKey) { sel = new Set(duplicate([...sel], 0, 0)); }
    const movable = selItems().filter((i) => !i.bloqueado);
    drag = { kind: 'move', p0: p, orig: new Map(movable.map((i) => [i.id, MD.clone(i)])), moved: false, dup: e.altKey };
    selChanged(); return;
  }
  if (!e.shiftKey && cotaAt(px, py)) return; // clic sobre una cota: se conserva la selección
  if (!e.shiftKey) sel.clear();
  drag = { kind: 'marquee', p0: p, base: new Set(sel) }; marquee = { x: p.x, y: p.y, w: 0, h: 0 };
  selChanged();
});

cv.addEventListener('pointermove', (e) => {
  const { px, py } = evPos(e);
  lastPx = px; lastPy = py;
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { px, py });
  const p = toCm(px, py);
  hover = isIso() ? null : p; if (!isIso()) showPos(p);
  if (!drag) { updateCursor(px, py); requestRender(); return; }
  const noSnap = e.ctrlKey || e.metaKey;
  switch (drag.kind) {
    case 'pinch': {
      if (pointers.size < 2) return;
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(b.px - a.px, b.py - a.py) || 1, m = { px: (a.px + b.px) / 2, py: (a.py + b.py) / 2 };
      const ns = clampS(drag.s0 * d / drag.d0);
      const cx = (drag.m0.px - drag.ox0) / drag.s0, cy = (drag.m0.py - drag.oy0) / drag.s0;
      view.s = ns; view.ox = m.px - cx * ns; view.oy = m.py - cy * ns; afterView(); break;
    }
    case 'pan': view.ox = drag.ox0 + px - drag.px0; view.oy = drag.oy0 + py - drag.py0; afterView(); break;
    case 'guide': {
      let v = drag.axis === 'h' ? p.y : p.x;
      if (!noSnap) {
        const c = snapCtx(), q = MD.snapPoint(p, { rects: c.rects, v: c.v, h: c.h, grid: c.grid }, 6 / view.s);
        v = drag.axis === 'h' ? q.y : q.x;
      }
      doc.guides[drag.axis][drag.idx] = v;
      drag.remove = drag.axis === 'h' ? py < RULER : px < RULER;
      showPos(p, (drag.axis === 'h' ? 'guía a ' + fmt(doc.wall.h - v) + ' del piso' : 'guía a ' + fmt(v) + ' de la izquierda'));
      requestRender(); break;
    }
    case 'measure': {
      let q = noSnap ? p : MD.snapPoint(p, snapCtx(), 7 / view.s);
      if (e.shiftKey) { if (Math.abs(q.x - tempMed.x1) >= Math.abs(q.y - tempMed.y1)) q = { x: q.x, y: tempMed.y1 }; else q = { x: tempMed.x1, y: q.y }; }
      tempMed.x2 = q.x; tempMed.y2 = q.y;
      snapVis = q.gx ? { gx: q.gx, gy: q.gy } : null;
      showPos(p, 'medida ' + fmt(Math.hypot(tempMed.x2 - tempMed.x1, tempMed.y2 - tempMed.y1)) + ' cm');
      requestRender(); break;
    }
    case 'resize': {
      const it = getItem(drag.id); if (!it) return;
      let q = p; snapVis = null;
      if (!noSnap) { q = MD.snapPoint(p, snapCtx(new Set([it.id])), 7 / view.s); snapVis = { gx: [], gy: q.gy }; }
      if (it.tipo === 'persona') {
        MD.setPersona(doc, it, 'h', Math.round((doc.wall.h - q.y) * 10) / 10);
        showPos(p, 'estatura ' + fmt(it.h) + ' cm, ojos a ' + fmt(MD.ojos(it))); panelDirty = true; requestRender(); break;
      }
      if (!noSnap) snapVis.gx = q.gx;
      const f = MD.frameW(it), keep = (it.tipo === 'obra' ? !!it.lock : false) !== e.shiftKey;
      const r = MD.resizeRect(drag.orig, drag.corner, q.x, q.y, keep, f, 1);
      it.x = r.x; it.y = r.y; it.w = r.w - 2 * f; it.h = r.h - 2 * f;
      MD.markEst(it, Math.abs(r.w - drag.orig.w) > 1e-6, Math.abs(r.h - drag.orig.h) > 1e-6);
      showPos(p, fmt(it.w) + ' × ' + fmt(it.h) + ' cm'); panelDirty = true; requestRender(); break;
    }
    case 'move': {
      let dx = p.x - drag.p0.x, dy = p.y - drag.p0.y;
      if (!drag.moved && Math.hypot(dx, dy) * view.s < 3) return;
      drag.moved = true;
      const axis = e.shiftKey ? (Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v') : null;
      if (axis === 'h') dy = 0; else if (axis === 'v') dx = 0;
      snapVis = null;
      const origs = [...drag.orig.values()];
      if (!noSnap && origs.length) {
        const rb = MD.bbox(origs.map(MD.outer));
        const sn = MD.snapRect({ x: rb.x + dx, y: rb.y + dy, w: rb.w, h: rb.h }, snapCtx(new Set(drag.orig.keys())), 7 / view.s);
        if (axis !== 'v') dx += sn.dx;
        if (axis !== 'h') dy += sn.dy;
        snapVis = { gx: axis === 'v' ? [] : sn.gx, gy: axis === 'h' ? [] : sn.gy };
      }
      for (const [id, o] of drag.orig) {
        const it = getItem(id); if (!it) continue;
        if (it.tipo === 'medida') { it.x1 = o.x1; it.y1 = o.y1; it.x2 = o.x2; it.y2 = o.y2; } else { it.x = o.x; it.y = o.y; }
        MD.moveItem(it, dx, dy);
      }
      if (origs.length === 1 && origs[0].tipo !== 'medida') {
        const n = MD.info(doc, getItem(origs[0].id));
        showPos(p, 'izq ' + fmt(n.izq) + ', piso a centro ' + fmt(n.centro));
      }
      panelDirty = true; requestRender(); break;
    }
    case 'area': {
      areaRect = MD.normRect(drag.p0, p);
      if (!isIso()) showPos(p, 'área ' + fmt(areaRect.w) + ' × ' + fmt(areaRect.h) + ' cm');
      requestRender(); break;
    }
    case 'marquee': {
      marquee = MD.normRect(drag.p0, p);
      sel = new Set([...drag.base, ...MD.idsInRect(doc, marquee)]);
      panelDirty = true; layersDirty = true; requestRender(); break;
    }
  }
});

function endDrag() {
  if (!drag) return;
  const d = drag; drag = null; snapVis = null;
  switch (d.kind) {
    case 'move': if (d.moved || d.dup) commit(); break;
    case 'resize': commit(); break;
    case 'guide': if (d.remove) doc.guides[d.axis].splice(d.idx, 1); commit(); break;
    case 'measure': {
      const m = tempMed; tempMed = null;
      if (m && Math.hypot(m.x2 - m.x1, m.y2 - m.y1) * view.s >= 4) {
        const len = Math.hypot(m.x2 - m.x1, m.y2 - m.y1);
        const it = MD.makeMedida(Object.assign({}, m, { nombre: 'Medida ' + fmt(len) + ' cm' }));
        doc.items.push(it); sel = new Set([it.id]); commit();
        msg('Medida de ' + fmt(len) + ' cm añadida. Supr la elimina.');
      }
      break;
    }
    case 'marquee': marquee = null; break;
    case 'area': {
      const r = areaRect;
      if (r && r.w * view.s >= 8 && r.h * view.s >= 8) { endArea(r); return; }
      areaRect = null; msg('El área es demasiado pequeña: vuelve a arrastrar, o Esc para cancelar.'); requestRender(); return;
    }
  }
  selChanged();
}
function pointerEnd(e) {
  pointers.delete(e.pointerId);
  if (drag && drag.kind === 'pinch') { if (pointers.size < 2) drag = null; return; }
  if (pointers.size === 0) endDrag();
  const { px, py } = evPos(e); updateCursor(px, py);
}
cv.addEventListener('pointerup', pointerEnd);
cv.addEventListener('pointercancel', pointerEnd);
cv.addEventListener('pointerleave', () => { if (!drag) { hover = null; showPos(null); requestRender(); } });
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('wheel', (e) => {
  e.preventDefault();
  const { px, py } = evPos(e), k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
  if (e.ctrlKey || e.metaKey || e.altKey) zoomAt(Math.max(0.5, Math.min(2, Math.exp(-e.deltaY * k * 0.0025))), px, py);
  else {
    let dx = e.deltaX * k, dy = e.deltaY * k;
    if (e.shiftKey && !dx) { dx = dy; dy = 0; }
    view.ox -= dx; view.oy -= dy; afterView();
  }
}, { passive: false });

function showPos(p, extra) {
  $('st-pos').textContent = p ? 'x ' + fmt(p.x) + '   piso ' + fmt(doc.wall.h - p.y) + (extra ? '   ' + extra : '') : '';
}

// ---------- teclado ----------
window.addEventListener('keydown', (e) => {
  if (!activa || (document.activeElement && document.activeElement !== document.body && !root.contains(document.activeElement))) return;
  if (root.querySelector('dialog[open]')) return;
  const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  const mod = e.ctrlKey || e.metaKey, k = e.key;
  if (mod && (k === 'z' || k === 'Z')) { if (typing) return; e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && (k === 'y' || k === 'Y')) { if (typing) return; e.preventDefault(); redo(); return; }
  if (mod && (k === 'e' || k === 'E')) { e.preventDefault(); openExport(); return; }
  if (mod && k === '0') { e.preventDefault(); fitView(); return; }
  if (mod && (k === '=' || k === '+')) { e.preventDefault(); zoomCenter(1.25); return; }
  if (mod && (k === '-' || k === '_')) { e.preventDefault(); zoomCenter(0.8); return; }
  if (typing) return;
  if (e.code === 'Space') { e.preventDefault(); if (!space) { space = true; updateCursor(lastPx, lastPy); } return; }
  if (mod && (k === 'a' || k === 'A')) { e.preventDefault(); sel = new Set(doc.items.filter((i) => !i.oculto && !i.bloqueado).map((i) => i.id)); selChanged(); return; }
  if (mod && (k === 'd' || k === 'D')) { e.preventDefault(); dupSel(); return; }
  if (mod && (e.code === 'BracketRight' || k === ']' || k === '}')) { e.preventDefault(); reorderSel(e.shiftKey ? 'front' : 'up'); return; }
  if (mod && (e.code === 'BracketLeft' || k === '[' || k === '{')) { e.preventDefault(); reorderSel(e.shiftKey ? 'back' : 'down'); return; }
  if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); deleteSel(); return; }
  if (k === 'Escape' && areaMode) { areaMode = false; areaRect = null; drag = null; msg('Dibujo de área cancelado.'); updateCursor(lastPx, lastPy); requestRender(); e.preventDefault(); setTimeout(openExport, 0); return; }
  if (k === 'Escape') { if (drag && drag.kind === 'measure') { tempMed = null; drag = null; snapVis = null; } sel.clear(); selChanged(); return; }
  if (k.startsWith('Arrow')) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
    const dx = k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0, dy = k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0;
    const its = selItems().filter((i) => !i.bloqueado);
    if (!its.length) return;
    its.forEach((i) => MD.moveItem(i, dx, dy)); commitSoon(); syncUndo(); panelDirty = true; requestRender(); return;
  }
  if (e.shiftKey && !mod && e.code === 'Digit1') { e.preventDefault(); fitView(); return; }
  if (e.shiftKey && !mod && e.code === 'Digit0') { e.preventDefault(); zoomTo(calib); return; }
  if (e.shiftKey && !mod && e.code === 'Digit2') { e.preventDefault(); centerView(); return; }
  if (k === '?') { openHelp(); return; }
  if (e.shiftKey && !mod && e.code === 'KeyA') { e.preventDefault(); setVista('alzado'); return; }
  if (e.shiftKey && !mod && e.code === 'KeyI') { e.preventDefault(); setVista('iso'); return; }
  if (isIso() && !mod && ['v', 'h', 'm'].includes(k.toLowerCase())) return;
  if (!mod && !e.altKey) {
    const l = k.toLowerCase();
    if (l === 'v') setTool('select'); else if (l === 'h') setTool('hand'); else if (l === 'm') setTool('measure');
  }
});
window.addEventListener('keyup', (e) => { if (!activa) return; if (e.code === 'Space') { space = false; updateCursor(lastPx, lastPy); } });
window.addEventListener('blur', () => { space = false; });

function setVista(m, silent) {
  doc.opts.vista = m === 'iso' ? 'iso' : 'alzado';
  const iso = isIso();
  view = iso ? viewIso : viewAlz;
  $('v-alz').setAttribute('aria-pressed', !iso); $('v-iso').setAttribute('aria-pressed', iso);
  ['t-select', 't-hand', 't-measure'].forEach((id) => { $(id).disabled = iso; });
  $('iso-sec').hidden = !iso;
  drag = null; snapVis = null; marquee = null; tempMed = null; hover = null; showPos(null);
  if (iso) syncIso();
  if (iso && !viewIso.fitted) fitView(); else afterView();
  if (!silent) msg(iso ? 'Vista isométrica de solo lectura. Arrastra para desplazar; edita las obras en Alzado.' : 'Vista en alzado.');
  updateCursor(lastPx, lastPy);
}
$('v-alz').onclick = () => setVista('alzado');
$('v-iso').onclick = () => setVista('iso');
function syncIso() {
  const c = doc.opts.iso = Object.assign(MD.defaultIso(), doc.opts.iso || {});
  $('iso-lado').value = c.lado; $('iso-a').value = c.a; $('iso-b').value = c.b;
  $('iso-a-v').textContent = c.a + '°'; $('iso-b-v').textContent = c.b + '°';
  $('iso-piso').value = fmt(c.piso); $('iso-grosor').value = fmt(MD.num(doc.wall.grosor, 15)); $('iso-grid').checked = !!c.gridPiso;
}
function isoSet(k, v) { doc.opts.iso[k] = v; dirty = true; syncIso(); requestRender(); }
$('iso-lado').addEventListener('change', (e) => { isoSet('lado', e.target.value); fitView(); });
$('iso-a').addEventListener('input', (e) => isoSet('a', +e.target.value));
$('iso-b').addEventListener('input', (e) => isoSet('b', +e.target.value));
$('iso-a').addEventListener('change', fitView); $('iso-b').addEventListener('change', fitView);
root.querySelectorAll('[data-iso]').forEach((b) => b.addEventListener('click', () => {
  const [a, bb] = b.dataset.iso.split(',').map(Number); doc.opts.iso.a = a; doc.opts.iso.b = bb; dirty = true; syncIso(); fitView();
}));
$('iso-piso').addEventListener('input', (e) => { const v = parseFloat(e.target.value); if (v >= 20) isoSet('piso', v); });
$('iso-grid').addEventListener('change', (e) => isoSet('gridPiso', e.target.checked));
$('iso-grosor').addEventListener('input', (e) => { const v = parseFloat(e.target.value); if (v >= 0) { doc.wall.grosor = v; commitSoon(); syncUndo(); requestRender(); } });
$('iso-grosor').addEventListener('change', commit);

function setTool(t) {
  tool = t;
  $('t-select').setAttribute('aria-pressed', t === 'select');
  $('t-hand').setAttribute('aria-pressed', t === 'hand');
  $('t-measure').setAttribute('aria-pressed', t === 'measure');
  if (t === 'measure') msg('Arrastra entre dos puntos. Los extremos se ajustan a bordes; Shift fija horizontal o vertical.');
  updateCursor(lastPx, lastPy); requestRender();
}
$('t-select').onclick = () => setTool('select');
$('t-hand').onclick = () => setTool('hand');
$('t-measure').onclick = () => setTool('measure');

// ---------- acciones sobre la selección ----------
function duplicate(ids, dx, dy) {
  const out = [], set = new Set(ids);
  for (const it of doc.items.slice()) {
    if (!set.has(it.id)) continue;
    const c = MD.clone(it);
    c.id = MD.uid(it.tipo[0]); c.nombre = (it.nombre || '') + ' copia'; c.bloqueado = false;
    MD.moveItem(c, dx, dy); doc.items.push(c); out.push(c.id);
  }
  return out;
}
function dupSel() {
  if (!sel.size) return;
  sel = new Set(duplicate([...sel], 5, 5)); commit(); selChanged(); msg('Duplicado.');
}
function deleteSel() {
  const del = selItems().filter((i) => !i.bloqueado);
  if (!del.length) { if (sel.size) msg('Los elementos bloqueados no se eliminan. Desbloquéalos en Capas.'); return; }
  const ids = new Set(del.map((i) => i.id));
  doc.items = doc.items.filter((i) => !ids.has(i.id));
  sel = new Set([...sel].filter((id) => !ids.has(id))); commit(); selChanged();
  msg(del.length === 1 ? 'Elemento eliminado. Ctrl/⌘ Z lo recupera.' : del.length + ' elementos eliminados. Ctrl/⌘ Z los recupera.');
}
function reorderSel(mode) { if (!sel.size) return; doc.items = MD.reorder(doc.items, sel, mode); commit(); selChanged(); }
function applyAndCommit(deltas, note) { MD.applyDeltas(doc, deltas); commit(); selChanged(); if (note) msg(note); }

root.querySelectorAll('[data-al]').forEach((b) => b.addEventListener('click', () => {
  const its = solidSel();
  if (!its.length) { msg('Selecciona una o más obras para alinear.'); return; }
  const toWall = $('al-ref').value === 'wall' || its.length === 1;
  const ref = toWall ? MD.wallRect(doc) : MD.bbox(its.map(MD.outer));
  applyAndCommit(MD.align(its, b.dataset.al, ref), toWall && $('al-ref').value !== 'wall' ? 'Con un solo elemento se alinea respecto al muro.' : '');
}));
function dist(axis, fixed) {
  const its = solidSel();
  let gap = null;
  if (fixed) { gap = parseFloat($('d-gap').value); if (!isFinite(gap) || gap < 0) { msg('Escribe una separación válida en cm.'); return; } }
  if (its.length < (fixed ? 2 : 3)) { msg(fixed ? 'Selecciona al menos 2 obras.' : 'Selecciona al menos 3 obras para igualar separaciones.'); return; }
  const r = MD.distribute(its, axis, gap);
  applyAndCommit(r.deltas, 'Separación entre obras: ' + fmt(r.gap) + ' cm.');
}
$('d-eqh').onclick = () => dist('h', false);
$('d-eqv').onclick = () => dist('v', false);
$('d-gaph').onclick = () => dist('h', true);
$('d-gapv').onclick = () => dist('v', true);
$('c-eye').onclick = () => { const its = solidSel(); if (!its.length) return msg('Selecciona obras para centrarlas en el eje.'); applyAndCommit(MD.centerOnEye(doc, its), 'Centro en el eje visual (' + fmt(doc.wall.eje) + ' cm).'); };
$('c-wall').onclick = () => { const its = solidSel(); if (!its.length) return msg('Selecciona obras para centrar el conjunto.'); applyAndCommit(MD.centerGroupH(doc, its), 'Conjunto centrado en el muro.'); };
$('o-front').onclick = () => reorderSel('front');
$('o-back').onclick = () => reorderSel('back');

// ---------- añadir ----------
function placeNew(it, at) {
  const o = MD.outer(it);
  if (at) it.x = at.x - o.w / 2;
  else {
    const obras = doc.items.filter((i) => i.tipo === 'obra' && !i.oculto);
    it.x = obras.length ? (MD.bbox(obras.map(MD.outer)).x + MD.bbox(obras.map(MD.outer)).w + 10) : (doc.wall.w - o.w) / 2;
  }
  it.y = doc.wall.h - doc.wall.eje - o.h / 2;
}
async function addImageFiles(files, at) {
  if (!muro) { msg('Primero crea un muro (o abre un alzado desde la planta).'); return; }
  const list = [...files].filter((f) => /^image\//.test(f.type));
  if (!list.length) { msg('Ninguno de los archivos es una imagen.'); return; }
  const added = [], fails = [];
  msg('Cargando ' + list.length + (list.length === 1 ? ' imagen…' : ' imágenes…'));
  let nextX = at ? at.x : null;
  for (const f of list) {
    try {
      const r = await readImage(f, 1600);
      const imgId = MD.uid('i'); doc.images[imgId] = r.dataURL;
      const ratio = r.w / r.h, big = 60;
      const it = MD.makeObra({ nombre: f.name.replace(/\.[^.]+$/, ''), w: ratio >= 1 ? big : big * ratio, h: ratio >= 1 ? big / ratio : big, imgId, imgRatio: ratio, est: { w: true, h: true } });
      placeNew(it, null);
      if (at) { const o = MD.outer(it); it.x = added.length ? nextX : at.x - o.w / 2; nextX = it.x + o.w + 10; }
      doc.items.push(it); added.push(it.id);
    } catch (err) { fails.push(f.name); }
  }
  if (added.length) {
    sel = new Set(added); commit(); selChanged();
    msg((added.length === 1 ? 'Obra añadida con 60 cm en su lado mayor: escribe sus medidas reales en Selección.' : added.length + ' obras añadidas.')
      + (fails.length ? ' No se pudo leer: ' + fails.join(', ') + ' (prueba con JPG o PNG).' : ''));
  } else msg('No se pudo leer ' + fails.join(', ') + '. Prueba con JPG o PNG.');
}
$('a-img').onclick = () => $('file-img').click();
$('file-img').addEventListener('change', (e) => { addImageFiles(e.target.files); e.target.value = ''; });
$('a-lista').onclick = () => {
  if (!muro) return;
  const en = new Set(muro.colgado.map((c) => c.obraId));
  const libres = P().obras.filter((o) => !en.has(o.id));
  if (!libres.length) return msg('Todas las obras de la lista ya están en este muro.');
  const dlg = $('dlg-lista'); const ul = dlg.querySelector('ul');
  ul.innerHTML = libres.map((o) => `<li data-id="${o.id}"><b>${esc(o.nombre || 'sin título')}</b> <span class="muted">${esc(o.autor || '')}${o.ancho > 0 || o.alto > 0 ? ' · ' + (o.ancho > 0 ? fmt(o.ancho * 100) : '?') + ' × ' + (o.alto > 0 ? fmt(o.alto * 100) : '?') + ' cm' : ''}</span></li>`).join('');
  ul.onclick = (e) => { const li = e.target.closest('li[data-id]'); if (!li) return; dlg.close(); colocarObra(li.dataset.id); };
  dlg.showModal();
};
$('lista-cancel').onclick = () => $('dlg-lista').close();
// coloca una obra del proyecto en este muro (centro en el eje visual, a la derecha de las demás)
function colocarObra(obraId) {
  const o = M.obraDe(P(), obraId); if (!o || !muro) return;
  if (muro.colgado.some((c) => c.obraId === obraId)) return msg('Esa obra ya está en este muro.');
  const w = o.ancho > 0 ? o.ancho : 0.5, h = o.alto > 0 ? o.alto : (o.imgRatio > 0 ? w / o.imgRatio : 0.7);
  const c = M.nuevoColgado({ obraId }); muro.colgado.push(c);
  if (o.imagenId && P().imagenes[o.imagenId]) doc.images[o.imagenId] = P().imagenes[o.imagenId];
  const it = MD.makeObra({ id: c.id, nombre: o.nombre, w: mAcm(w), h: mAcm(h), imgId: o.imagenId, imgRatio: o.imgRatio, est: { w: !(o.ancho > 0) || o.estimado.ancho, h: !(o.alto > 0) || o.estimado.alto },
    ficha: { titulo: o.nombre, autor: o.autor, anio: o.anio, tecnica: o.tecnica, inv: o.inv } });
  placeNew(it); doc.items.push(it); sel = new Set([it.id]); commit(); selChanged();
  msg('«' + (o.nombre || 'obra') + '» colocada en el muro.');
}
$('a-blank').onclick = () => {
  const n = doc.items.filter((i) => i.tipo === 'obra').length + 1;
  const it = MD.makeObra({ nombre: 'Obra ' + n, w: 50, h: 70, est: { w: true, h: true } }); placeNew(it);
  doc.items.push(it); sel = new Set([it.id]); commit(); selChanged(); msg('Obra sin imagen añadida.');
};
$('a-nota').onclick = () => {
  const ss = selItems(), one = ss.length === 1 && ss[0].tipo === 'obra' ? ss[0] : null;
  const it = MD.makeNota({ texto: 'Nota', tam: +(doc.opts.exp && doc.opts.exp.cotaCm) || 4 });
  // encima de la obra, dejando libre la franja donde suelen ir las cotas (y espacio para una segunda línea)
  if (one) { const r = MD.outer(one), c = it.tam, h2 = MD.notaGeom({ texto: 'a\nb', tam: c }).h; it.x = r.x; it.y = r.y - h2 - (3 * c + 8); it.apunta = one.id; }
  else { const c = toCm((work.clientWidth + RULER) / 2, (work.clientHeight + RULER) / 2); it.x = c.x; it.y = c.y; }
  doc.items.push(it); sel = new Set([it.id]); commit(); selChanged();
  const ta = $('sel-body').querySelector('textarea'); if (ta) { ta.focus(); ta.select(); }
  msg(one ? 'Nota añadida señalando «' + (one.nombre || 'obra') + '». Escribe el texto en Selección.' : 'Nota añadida. Escribe el texto en Selección.');
};
$('a-vano').onclick = () => {
  const it = MD.makeVano({ nombre: 'Puerta', x: 20, y: doc.wall.h - 210 });
  doc.items.push(it); sel = new Set([it.id]); commit(); selChanged(); msg('Vano añadido: cambia su nombre y medidas en Selección.');
};
$('a-persona').onclick = () => {
  const ps = doc.items.filter((i) => i.tipo === 'persona' && !i.oculto);
  const x = ps.length ? MD.bbox(ps.map(MD.outer)).x - 15 - MD.personaW(170, 'pie') : -75;
  const it = MD.makePersona({ nombre: 'Persona 170', h: 170, x }, doc.wall.h);
  doc.items.push(it);
  if (!doc.opts.showHuman) { doc.opts.showHuman = true; syncOpts(); }
  sel = new Set([it.id]); commit(); selChanged();
  msg('Persona añadida. Cambia su estatura o figura en Selección; arrástrala a lo largo del piso.');
};
$('file-replace').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  const it = getItem([...sel][0]); if (!f || !it || it.tipo !== 'obra') return;
  try {
    const r = await readImage(f, 1600), id = MD.uid('i');
    doc.images[id] = r.dataURL; it.imgId = id; it.imgRatio = r.w / r.h; it.rot = 0;
    const c = MD.outer(it), cy = c.y + c.h / 2; it.h = it.w / it.imgRatio; MD.markEst(it, false, true); const n = MD.outer(it); it.y = cy - n.h / 2;
    commit(); selChanged(); msg('Imagen reemplazada; se conservó el ancho.');
  } catch (err) { msg('No se pudo leer esa imagen.'); }
});

// arrastrar y soltar
let dragDepth = 0;
work.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; work.classList.add('drop'); });
work.addEventListener('dragover', (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
work.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; work.classList.remove('drop'); } });
work.addEventListener('drop', (e) => {
  e.preventDefault(); dragDepth = 0; work.classList.remove('drop');
  const files = [...(e.dataTransfer ? e.dataTransfer.files : [])];
  const json = files.find((f) => /\.json$/i.test(f.name) || f.type === 'application/json');
  if (json) { if (env.onArchivoJson) env.onArchivoJson(json); return; }
  const { px, py } = evPos(e);
  addImageFiles(files, toCm(px, py));
});

// ---------- panel de selección ----------
let panelSig = '', panelDirty = false, layersDirty = false;
function selChanged() { panelDirty = true; layersDirty = true; renderPanel(); renderLayers(); requestRender(); syncUndo(); }
const NUM = (key, label, extra) => '<label class="f">' + label + '<input type="number" step="0.1" data-b="' + key + '"' + (extra || '') + '></label>';
const TXT = (key, label) => '<label class="f">' + label + '<input type="text" data-b="' + key + '"></label>';
function renderPanel() {
  const box = $('sel-body'), its = selItems();
  const sig = its.map((i) => i.id + ':' + i.tipo).join(',');
  if (sig !== panelSig) {
    panelSig = sig;
    if (!its.length) box.innerHTML = '<p class="muted" style="margin:4px 0">Nada seleccionado. Haz clic en una obra, o arrastra en un área vacía para seleccionar varias.</p>';
    else if (its.length > 1) box.innerHTML =
      '<div class="kv"><span>Elementos</span><b data-o="n"></b></div><div class="kv"><span>Conjunto (ext.)</span><b class="out" data-o="bb"></b></div>'
      + '<div class="kv"><span>Desde la izquierda</span><b class="out" data-o="bx"></b></div><div class="kv"><span>Piso a centro del conjunto</span><b class="out" data-o="bc"></b></div>'
      + '<p class="note">Alinea y distribuye desde Disposición. Las flechas mueven el conjunto.</p>'
      + '<div class="g2" style="margin-top:8px"><button class="pbtn" data-act="dup">Duplicar</button><button class="pbtn danger" data-act="del">Eliminar</button></div>';
    else {
      const it = its[0];
      if (it.tipo === 'obra') box.innerHTML =
        TXT('nombre', 'Nombre en capas')
        + '<h4>Ficha</h4><div class="stack">' + TXT('f.titulo', 'Título') + '<div class="g2">' + TXT('f.autor', 'Autor') + TXT('f.anio', 'Año') + TXT('f.tecnica', 'Técnica') + TXT('f.inv', 'N.º de inventario') + '</div></div>'
        + '<h4>Medidas (cm)</h4><div class="g2">' + NUM('w', 'Ancho obra', ' min="0.1"') + NUM('h', 'Alto obra', ' min="0.1"') + NUM('marco', 'Marco', ' min="0"') + NUM('pp', 'Paspartú', ' min="0"') + NUM('prof', 'Profundidad', ' min="0" title="Cuánto sobresale del muro: marco, bastidor o caja. Se ve en la vista isométrica."') + '</div>'
        + '<div class="g2"><label class="c" title="Calculada, arrastrada o tomada de la imagen: sale con ≈ y línea punteada"><input type="checkbox" data-b="est.w"> Ancho estimado</label><label class="c" title="Calculada, arrastrada o tomada de la imagen: sale con ≈ y línea punteada"><input type="checkbox" data-b="est.h"> Alto estimado</label></div>'
        + '<label class="c" title="Al escribir una medida, la otra se recalcula solo si está estimada"><input type="checkbox" data-b="lock"> Mantener proporción</label>'
        + '<div class="kv"><span>Exterior</span><b class="out" data-o="ext"></b></div>'
        + '<h4>Posición (cm)</h4><div class="g2">' + NUM('izq', 'Desde la izquierda') + NUM('centro', 'Piso a centro') + NUM('inf', 'Piso a borde inf.') + NUM('sup', 'Piso a borde sup.') + '</div>'
        + '<h4>Colgado (cm)</h4><div class="g2">' + NUM('caida', 'Caída del gancho', ' min="0" title="Del borde superior del marco al punto de apoyo del alambre tenso o la argolla"') + NUM('clavo', 'Altura del clavo', ' title="Desde el piso. Editarla mueve la obra."') + '</div>'
        + '<p class="note">Caída: distancia del borde superior al punto donde apoya el alambre tenso o la argolla.</p>'
        + '<div class="g2" style="margin-top:10px"><button class="pbtn" data-act="eye">Centrar en el eje</button><button class="pbtn" data-act="rot">Girar 90°</button>'
        + '<button class="pbtn" data-act="img">' + (it.imgId ? 'Cambiar imagen' : 'Poner imagen') + '</button><button class="pbtn" data-act="ratio"' + (it.imgRatio ? '' : ' disabled') + ' title="Ajusta el alto a la proporción de la imagen">Proporción imagen</button>'
        + '<button class="pbtn" data-act="dup">Duplicar</button><button class="pbtn danger" data-act="del">Eliminar</button></div>';
      else if (it.tipo === 'persona') box.innerHTML =
        TXT('nombre', 'Nombre')
        + '<label class="f" style="margin-top:6px">Figura<select data-b="figura"><option value="pie">De pie</option><option value="silla">En silla de ruedas</option></select></label>'
        + '<div class="g2" style="margin-top:6px">' + NUM('ph', it.figura === 'silla' ? 'Altura total (cm)' : 'Estatura (cm)', ' min="30" max="260" step="1"') + NUM('pcx', 'Centro desde la izq.') + NUM('pdist', 'Distancia al muro', ' min="0" step="5" title="Se ve en la vista isométrica"') + '</div>'
        + '<div class="kv" style="margin-top:6px"><span>Altura de ojos</span><b class="out" data-o="ojos"></b></div>'
        + '<h4>Preajustes</h4><div class="g3">'
        + [['185', 185, 'pie'], ['170', 170, 'pie'], ['155', 155, 'pie'], ['Infancia 115', 115, 'pie'], ['Silla 130', 130, 'silla']]
          .map((pp) => '<button class="pbtn" data-act="pp" data-h="' + pp[1] + '" data-f="' + pp[2] + '">' + pp[0] + '</button>').join('') + '</div>'
        + '<p class="note">Las personas se apoyan siempre en el piso. La altura de ojos es una estimación proporcional.</p>'
        + '<div class="g2" style="margin-top:10px"><button class="pbtn" data-act="dup">Duplicar</button><button class="pbtn danger" data-act="del">Eliminar</button></div>';
      else if (it.tipo === 'nota') box.innerHTML =
        '<label class="f">Texto<textarea data-b="texto" rows="3"></textarea></label>'
        + '<div class="g2" style="margin-top:6px">' + NUM('tam', 'Letra (cm)', ' min="0.5" max="50" step="0.5"')
        + '<label class="f">Señala a<select data-b="apunta"><option value="">(ninguna obra)</option>'
        + doc.items.filter((q) => q.tipo === 'obra').map((q) => '<option value="' + q.id + '">' + esc(q.nombre || 'Obra') + '</option>').join('') + '</select></label></div>'
        + '<p class="note">Sale en la exportación (opción «Notas»). La línea guía sigue a la obra si la mueves.</p>'
        + '<div class="g2" style="margin-top:10px"><button class="pbtn" data-act="dup">Duplicar</button><button class="pbtn danger" data-act="del">Eliminar</button></div>';
      else if (it.tipo === 'vano') box.innerHTML =
        TXT('nombre', 'Nombre') + '<h4>Medidas (cm)</h4><div class="g2">' + NUM('w', 'Ancho', ' min="0.1"') + NUM('h', 'Alto', ' min="0.1"') + NUM('prof', 'Profundidad', ' min="0" title="0 = superficie plana; más para extintores, tableros o cajas"') + '</div>'
        + '<h4>Posición (cm)</h4><div class="g2">' + NUM('izq', 'Desde la izquierda') + NUM('inf', 'Piso a borde inf.') + '</div>'
        + '<p class="note">Úsalo para puertas, ventanas, enchufes, extintores, rejillas o señalética.</p>'
        + '<div class="g2" style="margin-top:10px"><button class="pbtn" data-act="dup">Duplicar</button><button class="pbtn danger" data-act="del">Eliminar</button></div>';
      else box.innerHTML =
        TXT('nombre', 'Nombre') + '<div class="kv" style="margin-top:8px"><span>Longitud</span><b class="out" data-o="len"></b></div>'
        + '<div class="kv"><span>Horizontal · vertical</span><b class="out" data-o="dxy"></b></div>'
        + '<div class="g2" style="margin-top:10px"><button class="pbtn" data-act="dup">Duplicar</button><button class="pbtn danger" data-act="del">Eliminar</button></div>';
    }
  }
  fillPanel();
}
function getB(it, k) {
  if (k === 'nombre') return it.nombre;
  if (it.tipo === 'nota') return k === 'texto' ? it.texto : k === 'tam' ? it.tam : k === 'apunta' ? (it.apunta || '') : undefined;
  if (k.startsWith('est.')) return !!(it.est && it.est[k.slice(4)]);
  if (it.tipo === 'persona') return k === 'figura' ? it.figura : k === 'ph' ? it.h : k === 'pcx' ? it.x + it.w / 2 : k === 'pdist' ? MD.num(it.dist, 120) : undefined;
  if (k.startsWith('f.')) return (it.ficha || {})[k.slice(2)];
  if (k === 'prof') return MD.num(it.prof, 0);
  if (['w', 'h', 'marco', 'pp', 'caida', 'lock'].includes(k)) return it[k];
  return MD.info(doc, it)[k];
}
function fillPanel() {
  const box = $('sel-body'), its = selItems();
  if (!its.length) return;
  if (its.length === 1) {
    const it = its[0], n = MD.info(doc, it);
    box.querySelectorAll('[data-b]').forEach((el) => {
      if (el === document.activeElement) return;
      const v = getB(it, el.dataset.b);
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = typeof v === 'number' ? fmt(v, 2) : (v == null ? '' : v);
    });
    box.querySelectorAll('[data-o]').forEach((el) => {
      const k = el.dataset.o;
      el.textContent = k === 'ojos' ? fmt(n.ojos) + ' cm' : k === 'ext' ? fmt(n.extW) + ' × ' + fmt(n.extH) + ' cm' : k === 'len' ? fmt(n.len) + ' cm'
        : k === 'dxy' ? fmt(Math.abs(it.x2 - it.x1)) + ' · ' + fmt(Math.abs(it.y2 - it.y1)) + ' cm' : '';
    });
  } else {
    const b = MD.bbox(its.map(MD.outer));
    const o = { n: String(its.length), bb: fmt(b.w) + ' × ' + fmt(b.h) + ' cm', bx: fmt(b.x) + ' cm', bc: fmt(doc.wall.h - (b.y + b.h / 2)) + ' cm' };
    box.querySelectorAll('[data-o]').forEach((el) => { el.textContent = o[el.dataset.o] || ''; });
  }
}
function setB(it, k, el) {
  if (el.type === 'checkbox' && k.startsWith('est.')) { it.est = Object.assign({ w: false, h: false }, it.est); it.est[k.slice(4)] = el.checked; layersDirty = true; return true; }
  if (el.type === 'checkbox') { it[k] = el.checked; return true; }
  if (it.tipo === 'nota') {
    if (k === 'texto') { it.texto = el.value; layersDirty = true; return true; }
    if (k === 'apunta') { it.apunta = el.value || null; return true; }
    const nv = parseFloat(String(el.value).replace(',', '.')); if (!(nv > 0)) return false;
    if (k === 'tam') it.tam = Math.max(0.5, Math.min(50, nv));
    return true;
  }
  if (k === 'nombre') { it.nombre = el.value; layersDirty = true; return true; }
  if (k.startsWith('f.')) { it.ficha = it.ficha || {}; it.ficha[k.slice(2)] = el.value; return true; }
  if (it.tipo === 'persona') {
    if (k === 'figura') { MD.setPersona(doc, it, 'figura', el.value); panelSig = ''; renderPanel(); return true; }
    const pv = parseFloat(String(el.value).replace(',', '.')); if (!isFinite(pv)) return false;
    if (k === 'ph') { if (pv < 30) return false; MD.setPersona(doc, it, 'h', pv); }
    else if (k === 'pcx') MD.setPersona(doc, it, 'cx', pv);
    else if (k === 'pdist') { if (pv < 0) return false; it.dist = pv; }
    return true;
  }
  const v = parseFloat(String(el.value).replace(',', '.'));
  if (!isFinite(v)) return false;
  if (k === 'w' || k === 'h') {
    if (v <= 0) return false;
    const c = MD.outer(it), cx = c.x + c.w / 2, cy = c.y + c.h / 2; // cambia el tamaño alrededor del centro
    MD.setObraDim(it, k, v); layersDirty = true;
    const n = MD.outer(it); it.x = cx - n.w / 2; it.y = cy - n.h / 2;
  } else if (k === 'marco' || k === 'pp') MD.setFrame(it, k, Math.max(0, v));
  else if (k === 'caida') it.caida = Math.max(0, v);
  else if (k === 'prof') it.prof = Math.max(0, v);
  else MD.setPos(doc, it, k, v);
  return true;
}
$('sel-body').addEventListener('input', (e) => {
  const el = e.target; if (!el.dataset || !el.dataset.b) return;
  const it = selItems()[0]; if (!it) return;
  if (setB(it, el.dataset.b, el)) { fillPanel(); if (layersDirty) renderLayers(); requestRender(); commitSoon(); syncUndo(); }
});
$('sel-body').addEventListener('change', (e) => { if (e.target.dataset && e.target.dataset.b) { commit(); fillPanel(); } });
$('sel-body').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act, it = selItems()[0];
  if (act === 'dup') return dupSel();
  if (act === 'del') return deleteSel();
  if (!it) return;
  if (act === 'pp' && it.tipo === 'persona') {
    MD.setPersona(doc, it, 'figura', b.dataset.f); MD.setPersona(doc, it, 'h', +b.dataset.h);
    if (/^(Persona|Silla|Infancia)/.test(it.nombre || '')) it.nombre = b.dataset.f === 'silla' ? 'Silla de ruedas ' + b.dataset.h : (+b.dataset.h < 140 ? 'Infancia ' : 'Persona ') + b.dataset.h;
    panelSig = ''; commit(); selChanged(); return;
  }
  if (act === 'eye') { applyAndCommit(MD.centerOnEye(doc, [it]), 'Centro en el eje visual.'); }
  else if (act === 'rot') { MD.rotate90(it); commit(); selChanged(); }
  else if (act === 'img') $('file-replace').click();
  else if (act === 'ratio') {
    const a = MD.imgAspect(it); if (!a) return;
    const c = MD.outer(it), cy = c.y + c.h / 2; it.h = it.w / a; MD.markEst(it, false, true); const n = MD.outer(it); it.y = cy - n.h / 2;
    commit(); selChanged(); msg('Alto ajustado a la proporción de la imagen.');
  }
});

// ---------- capas ----------
const ICON = {
  eye: '<svg viewBox="0 0 16 16"><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>',
  eyeOff: '<svg viewBox="0 0 16 16"><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".45"/><path d="M2 14L14 2" stroke="currentColor" stroke-width="1.3"/></svg>',
  lock: '<svg viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7" fill="currentColor"/><path d="M5 7V5a3 3 0 016 0v2" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
  unlock: '<svg viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5 7V5a3 3 0 016 0" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
  up: '<svg viewBox="0 0 16 16"><path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  down: '<svg viewBox="0 0 16 16"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
};
const TYPE = { obra: '▭', vano: '▨', medida: '↔', persona: '▯', nota: '✎' };
const layerName = (it) => it.tipo === 'nota' ? (String(it.texto || '').split('\n')[0] || 'Nota')
  : (it.nombre || it.tipo) + (it.tipo === 'obra' && it.est && (it.est.w || it.est.h) ? ' ≈' : '');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function renderLayers() {
  layersDirty = false;
  const ul = $('layers');
  if (!doc.items.length) { ul.innerHTML = '<li class="muted" style="cursor:default">Sin elementos todavía.</li>'; return; }
  ul.innerHTML = doc.items.slice().reverse().map((it) =>
    '<li data-id="' + it.id + '" class="' + (sel.has(it.id) ? 'on ' : '') + (it.oculto ? 'hid' : '') + '">'
    + '<button data-l="vis" title="' + (it.oculto ? 'Mostrar' : 'Ocultar') + '" class="' + (it.oculto ? '' : 'act') + '">' + (it.oculto ? ICON.eyeOff : ICON.eye) + '</button>'
    + '<button data-l="lock" title="' + (it.bloqueado ? 'Desbloquear' : 'Bloquear') + '" class="' + (it.bloqueado ? 'act' : '') + '">' + (it.bloqueado ? ICON.lock : ICON.unlock) + '</button>'
    + '<span class="ty">' + TYPE[it.tipo] + '</span><span class="nm">' + esc(layerName(it)) + '</span>'
    + '<button data-l="up" title="Subir">' + ICON.up + '</button><button data-l="down" title="Bajar">' + ICON.down + '</button></li>').join('');
}
$('layers').addEventListener('click', (e) => {
  const li = e.target.closest('li[data-id]'); if (!li) return;
  const id = li.dataset.id, it = getItem(id); if (!it) return;
  const b = e.target.closest('[data-l]');
  if (b) {
    const l = b.dataset.l;
    if (l === 'vis') { it.oculto = !it.oculto; if (it.oculto) sel.delete(id); }
    else if (l === 'lock') it.bloqueado = !it.bloqueado;
    else doc.items = MD.reorder(doc.items, new Set([id]), l);
    commit(); selChanged(); return;
  }
  if (e.shiftKey) { sel.has(id) ? sel.delete(id) : sel.add(id); }
  else sel = new Set([id]);
  if (it.oculto) sel.delete(id);
  selChanged();
});
$('layers').addEventListener('dblclick', (e) => {
  const li = e.target.closest('li[data-id]'); if (!li || e.target.closest('[data-l]')) return;
  sel = new Set([li.dataset.id]); selChanged(); centerView();
});

// ---------- muro y opciones ----------
function syncWall() {
  $('w-title').value = doc.titulo || ''; $('w-w').value = fmt(doc.wall.w, 2); $('w-h').value = fmt(doc.wall.h, 2);
  $('w-eje').value = fmt(doc.wall.eje, 2); $('w-color').value = doc.wall.color || '#ffffff';
}
function wallNum(id, key, min) {
  $(id).addEventListener('input', (e) => { const v = parseFloat(e.target.value); if (isFinite(v) && v >= min) { doc.wall[key] = v; MD.groundPersonas(doc); panelDirty = true; requestRender(); commitSoon(); syncUndo(); } });
  $(id).addEventListener('change', () => { commit(); syncWall(); });
}
wallNum('w-w', 'w', 1); wallNum('w-h', 'h', 1); wallNum('w-eje', 'eje', 0);
$('w-title').addEventListener('input', (e) => { doc.titulo = e.target.value; commitSoon(); });
$('w-title').addEventListener('change', commit);
$('w-color').addEventListener('input', (e) => { doc.wall.color = e.target.value; requestRender(); commitSoon(); });
$('w-color').addEventListener('change', commit);

const OPT = [['o-eje', 'showEje'], ['o-muro', 'showMuro'], ['o-human', 'showHuman'], ['o-ojos', 'showOjos'], ['o-fichas', 'showFichas'], ['o-grid', 'showGrid'], ['o-guides', 'showGuides'], ['s-obj', 'snapObj'], ['s-guides', 'snapGuides'], ['s-grid', 'snapGrid']];
function syncOpts() {
  const o = doc.opts;
  $('o-cotas').value = o.cotas; OPT.forEach(([id, k]) => { $(id).checked = !!o[k]; });
  $('o-gridstep').value = fmt(o.grid, 2);
  $('o-ancho').value = o.anchoAbajo === false ? 'arriba' : 'abajo';
}
OPT.forEach(([id, k]) => $(id).addEventListener('change', (e) => {
  doc.opts[k] = e.target.checked;
  if (k === 'showHuman' && !e.target.checked) { sel = new Set([...sel].filter((id2) => { const i = getItem(id2); return i && i.tipo !== 'persona'; })); selChanged(); }
  requestRender();
}));
function setAncho(v) { doc.opts.anchoAbajo = v !== 'arriba'; dirty = true; syncOpts(); if ($('dlg-export').open) { $('ex-ancho').value = v; exInfo(); } requestRender(); }
$('o-ancho').addEventListener('change', (e) => setAncho(e.target.value));
$('ex-ancho').addEventListener('change', (e) => setAncho(e.target.value));
$('o-cotas').addEventListener('change', (e) => { doc.opts.cotas = e.target.value; requestRender(); });
[['o-gridstep', 'grid', 0.5]].forEach(([id, k, min]) =>
  $(id).addEventListener('input', (e) => { const v = parseFloat(e.target.value); if (isFinite(v) && v >= min) { doc.opts[k] = v; requestRender(); } }));
$('o-clearguides').onclick = () => { if (!doc.guides.v.length && !doc.guides.h.length) return msg('No hay guías.'); doc.guides = { v: [], h: [] }; commit(); requestRender(); msg('Guías borradas.'); };

// ---------- archivo ----------
function afterDocChange() {
  if (doc.opts.vista === 'iso' && !$('v-iso').getAttribute('aria-pressed').includes('true')) setVista('iso', true);
  else if (doc.opts.vista !== 'iso' && view === viewIso) setVista('alzado', true);
  viewIso.fitted = false;
  sel = new Set([...sel].filter((id) => getItem(id)));
  panelSig = ''; syncWall(); syncOpts(); selChanged();
}
$('f-csv').onclick = () => {
  if (!doc.items.some((i) => i.tipo !== 'medida')) return msg('No hay obras para la hoja de montaje.');
  download(new Blob(['\ufeff' + MD.toCSV(doc)], { type: 'text/csv;charset=utf-8' }), slug(doc.titulo) + '-montaje.csv'); msg('Hoja de montaje exportada.');
};

// ---------- exportar ----------
function storedArea() {
  const e = doc.opts.exp || {};
  if (isIso()) return e.areaIso && e.areaIsoSig === MD.isoSig(doc) ? e.areaIso : null;
  return e.area || null;
}
// rectángulo a exportar según el encuadre (null = todo el muro)
function exArea() {
  const e = doc.opts.exp || {}, m = Math.max(0, +e.margen || 0);
  if (e.encuadre === 'area') return storedArea();
  if (e.encuadre === 'sel') {
    const its = selItems().filter((i) => !i.oculto && (i.tipo !== 'persona' || e.human));
    if (!its.length) return null;
    const b = isIso() ? MD.isoItemsBounds(doc, new Set(its.map((i) => i.id))) : MD.bbox(its.map(MD.outer));
    return b ? { x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.h + 2 * m } : null;
  }
  return null;
}
function exOpts() {
  const e = doc.opts.exp || MD.defaultExp();
  return { iso: isIso(), area: exArea(), encuadre: e.encuadre, fmt: e.fmt, pxcm: +e.pxcm || 10, margen: +e.margen || 0, cotaCm: +e.cotaCm || 4, scope: e.scope, human: e.human, ojos: e.ojos, eje: e.eje, grid: e.grid, guias: e.guias,
    escala: e.escala, rotulo: e.rotulo, show: { notas: e.notas !== false, imagenes: e.imagenes, vanos: e.vanos, dims: e.dims, gaps: e.gaps, bordes: e.bordes, centro: e.centro, lineas: e.lineas, medidas: e.medidas, muro: e.muro, fichas: e.fichas } };
}
function syncExport() {
  const e = doc.opts.exp;
  $('ex-encuadre').value = e.encuadre || 'todo';
  $('ex-ancho').value = doc.opts.anchoAbajo === false ? 'arriba' : 'abajo'; $('ex-ancho').disabled = isIso();
  $('ex-fmt').value = e.fmt; $('ex-pxcm').value = e.pxcm; $('ex-margin').value = e.margen; $('ex-cota').value = e.cotaCm; $('ex-cota').disabled = isIso(); $('ex-scope').value = e.scope;
  root.querySelectorAll('[data-ex]').forEach((el) => { el.checked = !!e[el.dataset.ex]; });
  document.querySelector('[data-ex="ojos"]').disabled = !e.human;
  // en isométrica no aplican las cotas finas, guías ni cuadrícula
  const NOISO = ['notas', 'dims', 'gaps', 'bordes', 'centro', 'lineas', 'medidas', 'guias', 'grid'];
  NOISO.forEach((k) => { document.querySelector('[data-ex="' + k + '"]').disabled = isIso(); });
  $('ex-scope').disabled = isIso();
  $('dlg-export').querySelector('.dh').textContent = isIso() ? 'Exportar vista isométrica' : 'Exportar imagen';
  exInfo();
}
// opciones de escena comunes a la exportación y su vista previa
function exFrame(o) { return MD.exportFrame(doc, o.fmt === 'svg' ? Object.assign({}, o, { pxcm: 10 }) : o); }
function exScene(o, fr) {
  if (o.iso) return { ui: fr.u, sel: new Set(), human: o.human, ojos: o.human && o.ojos, eje: o.eje, show: o.show, escala: o.escala, rotulo: o.rotulo, bounds: fr.bounds, clip: fr.clip };
  return { ui: fr.u, sel: o.scope === 'sel' ? sel : new Set(), cotas: o.scope === 'sel' ? 'sel' : 'all', show: o.show,
    eje: o.eje, human: o.human, ojos: o.human && o.ojos, grid: o.grid, guides: o.guias ? doc.guides : null, vw: fr.W, vh: fr.H,
    escala: o.escala, rotulo: o.rotulo, bounds: fr.bounds, clip: fr.clip, floorRange: [fr.bounds.x - 1e4, fr.bounds.x + fr.bounds.w + 1e4] };
}
let prevRaf = 0;
function renderPreview() {
  prevRaf = 0;
  const dlg = $('dlg-export'); if (!dlg.open) return;
  const o = exOpts(), fr = exFrame(o), c = $('ex-prev'), wrap = $('ex-prevwrap');
  const big = dlg.classList.contains('big');
  const maxW = Math.max(100, wrap.clientWidth - 22), maxH = big ? Math.max(200, window.innerHeight - 300) : Math.min(340, Math.max(160, window.innerHeight * 0.34));
  const k = Math.min(maxW / fr.W, maxH / fr.H), w = Math.max(1, Math.round(fr.W * k)), h = Math.max(1, Math.round(fr.H * k));
  const dpr = window.devicePixelRatio || 1;
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = w + 'px'; c.style.height = h + 'px';
  const g = c.getContext('2d');
  g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0); // mismas coordenadas que el archivo final, reducidas
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, fr.W, fr.H);
  (o.iso ? MD.drawIso : MD.drawScene)(MD.canvasPainter(g, getImage), doc, fr.view, exScene(o, fr));
}
function schedulePreview() { if (!prevRaf) prevRaf = requestAnimationFrame(renderPreview); }
function exInfo() {
  schedulePreview();
  const o = exOpts(), f = exFrame(o);
  $('ex-pxcm').disabled = o.fmt === 'svg';
  let noSel = o.scope === 'sel' && !sel.size && !o.iso ? ' <span class="warn">No hay nada seleccionado: no saldrán cotas.</span>' : '';
  const e = doc.opts.exp;
  if (e.encuadre === 'sel' && !o.area) noSel += ' <span class="warn">No hay elementos seleccionados: se exporta todo el muro.</span>';
  if (e.encuadre === 'area' && !o.area) noSel += isIso() && e.areaIso ? ' <span class="warn">El área se dibujó con otro ángulo o lado de la isométrica: vuelve a dibujarla. Mientras, se exporta todo.</span>'
    : ' <span class="warn">Todavía no hay área: usa «Dibujar área…». Mientras, se exporta todo.</span>';
  if (o.area) noSel = (isIso() ? ' Recorte de la vista isométrica.' : ' Recorte de ' + fmt(o.area.w) + ' × ' + fmt(o.area.h) + ' cm.') + noSel;
  const nEst = o.iso || !o.show.dims ? 0 : doc.items.filter((i) => i.tipo === 'obra' && !i.oculto && i.est && (i.est.w || i.est.h)).length;
  if (nEst) noSel += ' <span class="warn">' + nEst + (nEst === 1 ? ' obra tiene medidas estimadas' : ' obras tienen medidas estimadas') + ': salen con ≈ y línea punteada.</span>';
  if (o.fmt === 'svg') { $('ex-info').innerHTML = 'SVG vectorial de ' + fmt(f.bounds.w) + ' × ' + fmt(f.bounds.h) + ' cm; las imágenes se incrustan con la resolución cargada (máx. 1600 px por lado).' + noSel; return; }
  $('ex-info').innerHTML = f.W.toLocaleString('es') + ' × ' + f.H.toLocaleString('es') + ' px (' + fmt(f.W * f.H / 1e6) + ' Mpx).'
    + (f.capped ? ' <span class="warn">Se reduce a ' + fmt(f.s) + ' px/cm para no superar el límite de los navegadores.</span>' : '')
    + (o.iso ? '' : ' Cotas de ' + fmt(10 * f.u, 0) + ' px.' + (10 * f.u < 9 ? ' <span class="warn">Pueden ser difíciles de leer: sube la resolución o el texto.</span>' : '')) + noSel;
}
function openExport() {
  doc.opts.exp = Object.assign(MD.defaultExp(), doc.opts.exp || {});
  if (doc.opts.exp.scope === 'sel' && !sel.size) doc.opts.exp.scope = 'all';
  syncExport(); $('dlg-export').showModal(); schedulePreview();
  preloadImages().then(schedulePreview);
}
$('ex-encuadre').addEventListener('change', (e) => {
  doc.opts.exp.encuadre = e.target.value; dirty = true;
  if (e.target.value === 'area' && !storedArea()) { startArea(); return; }
  exInfo(); requestRender();
});
$('ex-drawarea').onclick = startArea;
function startArea() {
  $('dlg-export').close(); areaMode = true; areaRect = null; drag = null;
  msg('Arrastra un rectángulo sobre el lienzo con la zona a exportar. Esc cancela.');
  updateCursor(lastPx, lastPy); requestRender();
}
function endArea(r) {
  areaMode = false; areaRect = null;
  const e = doc.opts.exp;
  if (isIso()) { e.areaIso = r; e.areaIsoSig = MD.isoSig(doc); } else e.area = r;
  e.encuadre = 'area'; dirty = true; requestRender(); openExport();
  msg('Área marcada. Queda indicada en el lienzo mientras el encuadre sea «Área dibujada».');
}
function togglePreviewSize() { const d = $('dlg-export'); d.classList.toggle('big'); $('ex-zoom').textContent = d.classList.contains('big') ? 'Reducir' : 'Ampliar'; schedulePreview(); }
$('ex-zoom').onclick = togglePreviewSize;
$('ex-prev').onclick = togglePreviewSize;
window.addEventListener('resize', () => { if ($('dlg-export').open) schedulePreview(); });
$('ex-fmt').addEventListener('change', (e) => { doc.opts.exp.fmt = e.target.value; exInfo(); });
$('ex-scope').addEventListener('change', (e) => { doc.opts.exp.scope = e.target.value; exInfo(); });
$('ex-cota').addEventListener('input', (e) => { const v = parseFloat(e.target.value); if (v > 0) { doc.opts.exp.cotaCm = v; exInfo(); } });
$('ex-pxcm').addEventListener('input', (e) => { const v = parseFloat(e.target.value); if (v > 0) { doc.opts.exp.pxcm = v; exInfo(); } });
$('ex-margin').addEventListener('input', (e) => { const v = parseFloat(e.target.value); if (v >= 0) { doc.opts.exp.margen = v; exInfo(); } });
root.querySelectorAll('[data-ex]').forEach((el) => el.addEventListener('change', () => { doc.opts.exp[el.dataset.ex] = el.checked; dirty = true; syncExport(); }));
root.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
  Object.assign(doc.opts.exp, MD.EXP_PRESETS[b.dataset.preset]); dirty = true; syncExport();
}));
$('f-export').onclick = openExport;
$('ex-cancel').onclick = () => $('dlg-export').close();
$('ex-go').onclick = async () => {
  const o = exOpts(); $('dlg-export').close();
  msg('Exportando…');
  await preloadImages();
  const fr = exFrame(o), so = exScene(o, fr);
  const name = slug(doc.titulo) + (o.iso ? '-isometrica' : '') + (o.area ? (o.encuadre === 'sel' ? '-seleccion' : '-area') : '');
  if (o.fmt === 'svg') {
    const P = MD.svgPainter(doc.images); (o.iso ? MD.drawIso : MD.drawScene)(P, doc, fr.view, so);
    download(new Blob([P.toString(fr.W, fr.H, '#ffffff')], { type: 'image/svg+xml' }), name + '.svg'); msg('SVG exportado.'); return;
  }
  const c = document.createElement('canvas'); c.width = fr.W; c.height = fr.H;
  const g = c.getContext('2d');
  if (!g) { msg('El navegador no pudo crear un lienzo de ese tamaño. Baja la resolución.'); return; }
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, fr.W, fr.H);
  (o.iso ? MD.drawIso : MD.drawScene)(MD.canvasPainter(g, getImage), doc, fr.view, so);
  c.toBlob((b) => {
    if (!b) { msg('El navegador no pudo generar el PNG. Baja la resolución.'); return; }
    download(b, name + '-' + fmt(fr.s) + 'pxcm.png'); msg('PNG exportado: ' + fr.W + ' × ' + fr.H + ' px.');
  }, 'image/png');
};

// ---------- calibración ----------
function calibShow(v) { $('calib-box').style.width = (v * 8.56) + 'px'; $('calib-box').style.height = (v * 5.398) + 'px'; $('calib-v').textContent = fmt(v, 1) + ' px de pantalla por cm'; }
$('o-calib').onclick = () => { $('calib-r').value = calib; calibShow(calib); $('dlg-calib').showModal(); };
$('calib-r').addEventListener('input', (e) => calibShow(+e.target.value));
$('calib-reset').onclick = () => { $('calib-r').value = DEF_CALIB; calibShow(DEF_CALIB); };
$('calib-cancel').onclick = () => $('dlg-calib').close();
$('calib-ok').onclick = () => {
  calib = +$('calib-r').value; try { localStorage.setItem('museodraft.calib', String(calib)); } catch (e) {}
  $('dlg-calib').close(); afterView(); msg('Calibración guardada en este navegador.');
};

// ---------- ayuda y barra ----------
function openHelp() { $('dlg-help').showModal(); }
$('b-help').onclick = openHelp;
$('help-ok').onclick = () => $('dlg-help').close();
$('b-undo').onclick = undo; $('b-redo').onclick = redo;
$('b-zin').onclick = () => zoomCenter(1.25); $('b-zout').onclick = () => zoomCenter(0.8);
$('b-fit').onclick = fitView; $('b-100').onclick = () => zoomTo(calib); $('b-center').onclick = centerView;
$('zoomv').addEventListener('change', (e) => { const v = parseFloat(String(e.target.value).replace(',', '.')); if (isFinite(v) && v > 0) zoomTo(calib * v / 100); else afterView(); });
$('zoomv').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });

if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => requestRender()).observe(work);

// ---------- inicio y API para el cascarón ----------
const cargar = (mu) => {
  muro = mu; doc = construir(muro); imgCache.clear(); sel.clear(); resetHistory(); dirty = false;
  syncWall(); syncOpts(); selChanged(); setVista(doc.opts.vista, true); viewIso.fitted = false;
  renderMuros(); if (activa) fitView();
};
const renderMuros = () => {
  const s = $('selMuro'); const ms = P().muros;
  s.innerHTML = ms.length ? ms.map((m) => `<option value="${m.id}" ${m === muro ? 'selected' : ''}>${esc(m.nombre || 'Muro')}</option>`).join('') : '<option value="">— sin muros —</option>';
  const sala = muro && muro.salaId ? M.salaDe(P(), muro.salaId) : null;
  $('m-origen').textContent = muro ? (sala && muro.tramo ? 'de la planta: ' + (sala.nombre || 'sala') + ', tramo ' + (muro.tramo.i + 1) : 'muro suelto') : 'abre un alzado desde la planta o añade un muro';
  const vacio = !muro;
  ['t-select', 't-hand', 't-measure', 'a-img', 'a-blank', 'a-lista', 'a-vano', 'a-persona', 'a-nota', 'f-export', 'f-csv', 'm-nombre', 'm-borrar'].forEach((id) => { $(id).disabled = vacio || (id.startsWith('t-') && isIso()); });
};
$('selMuro').addEventListener('change', (e) => { const m = M.muroDe(P(), e.target.value); if (m && m !== muro) { volcar(); cargar(m); } });
$('m-nuevo').onclick = () => {
  const n = prompt('Nombre del muro', 'Muro ' + (P().muros.length + 1)); if (!n) return;
  const m = M.nuevoMuro({ nombre: n.trim() || 'Muro' }); P().muros.push(m); volcar(); cargar(m); if (env.onCambio) env.onCambio();
};
$('m-nombre').onclick = () => { if (!muro) return; const n = prompt('Nombre del muro', muro.nombre); if (n) { doc.titulo = n.trim() || doc.titulo; $('w-title').value = doc.titulo; commit(); renderMuros(); } };
$('m-borrar').onclick = () => {
  if (!muro) return; if (!confirm(`¿Borrar el muro «${muro.nombre}»? Las obras siguen en la lista del proyecto.`)) return;
  const i = P().muros.indexOf(muro); P().muros.splice(i, 1); M.limpiarImagenes(P()); const sig = P().muros[Math.max(0, i - 1)] || null;
  muro = null; cargar(sig); if (env.onCambio) env.onCambio(); if (env.onObraCambiada) env.onObraCambiada(null);
};
cargar(muro);
return {
  activar(on) { const antes = activa; activa = !!on; if (on) { renderMuros(); if (!antes || !cv.width) fitView(); requestRender(); } else volcar(); },
  abrir(mu) { if (mu !== muro) { volcar(); cargar(mu); } else renderMuros(); },
  colocar(obraId) { colocarObra(obraId); },
  refrescar() { if (muro) { const m = muro; muro = null; cargar(m); } else renderMuros(); },
  get muro() { return muro; },
  _doc: () => doc, _sel: () => sel, _commit: commit,
};
}
