// Vista Lectura. Extraída de anotador-planos: anota planos (imágenes, o plantas y muros del
// propio proyecto redibujados a escala) con marcadores, textos, cotas y enlaces.
import { A as G } from '../core/anotacion.js';
import * as M from '../core/modelo.js';
import { svgDeSala, svgDeMuro } from '../core/puente.js';
import * as I from '../core/isometrica.js';
import { MARKUP } from './lectura-markup.js';

// env: { root, proyecto, modo: 'editor'|'lectura', onCambio(), onGuardar(), onExportarHtml(), onEditar(), onArchivoJson(f), mensaje }
export function montarLectura(env) {
'use strict';
const root = env.root;
root.innerHTML = MARKUP;
const AP = root.querySelector('#ap');
const MAX_LADO_PLANO = 2400, MAX_LADO_IMG = 1200, MAX_DESHACER = 40;
const COLORES = ['#4f6b82', '#586a45', '#b06a36', '#b03a2e', '#6b4f82', '#111111'];
const $ = (s, el = root) => el.querySelector(s);
const $$ = (s, el = root) => Array.from(el.querySelectorAll(s));
// El proyecto de la vista es una ventana sobre el del cascarón: «planos» son las anotaciones
const vistaProyecto = { get planos() { return env.proyecto.anotaciones; }, get nombre() { return env.proyecto.nombre; }, planoActivo: null };
// Fuente de cada plano: la imagen del almacén, o la planta / el alzado redibujados a escala (con caché por firma)
const cacheFuente = new Map();
const fuente = (pl) => {
  const b = pl.base;
  if (b.tipo === 'imagen') { const href = env.proyecto.imagenes[b.imagenId] || ''; return { href, w: b.w, h: b.h, perdida: !href }; }
  const obj = b.tipo === 'muro' ? M.muroDe(env.proyecto, b.muroId) : M.salaDe(env.proyecto, b.salaId);
  if (!obj) return { href: '', w: b.w || 100, h: b.h || 100, perdida: true };
  const firma = JSON.stringify(b.tipo === 'muro' ? [obj, env.proyecto.obras.filter((o) => obj.colgado.some((c) => c.obraId === o.id))] : [obj, env.proyecto.obras, env.proyecto.muros, b.cam]);
  const c = cacheFuente.get(pl.id);
  if (c && c.firma === firma) return c;
  const r = b.tipo === 'sala' ? svgDeSala(env.proyecto, obj) : b.tipo === 'muro' ? svgDeMuro(env.proyecto, obj) : I.svgDeIso(env.proyecto, obj, { ...I.camDefecto(), ...(b.cam || obj.iso || {}) }, 120);
  if (!r) return { href: '', w: b.w || 100, h: b.h || 100 };
  const f = { firma, href: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(r.svg), w: r.w, h: r.h };
  cacheFuente.set(pl.id, f);
  b.w = r.w; b.h = r.h; pl.escala = b.tipo === 'iso' ? null : { pxPorMetro: r.pxPorMetro, ref: null, automatica: true };
  return f;
};
const SVGNS = 'http://www.w3.org/2000/svg';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ── estado
const S = {
  proyecto: vistaProyecto, planoId: null, tool: 'select', sel: null, modo: env.modo === 'lectura' ? 'lectura' : 'editor', activa: false,
  view: { vx: 0, vy: 0, zoom: 1 }, draft: null, cursor: null, medida: null,
  undo: [], redo: [], arrastre: null, lsFallo: false,
};
const el = {
  lienzo: $('#ap-lienzo'), svg: $('#ap-svg'), vacio: $('#ap-vacioLienzo'), barra: $('#ap-barraEscala'), medida: $('#ap-medida'),
  tabs: $('#ap-tabsPlanos'), listaPlanos: $('#ap-listaPlanos'), listaCapas: $('#ap-listaCapas'), listaItems: $('#ap-listaItems'),
  props: $('#ap-props'), coords: $('#ap-coords'), zoomInfo: $('#ap-zoomInfo'), msg: $('#ap-msg'), infoEscala: $('#ap-infoEscala'),
  filePlano: $('#ap-filePlano'), fileImagen: $('#ap-fileImagen'), ayuda: $('#ap-ayuda'),
};

const plano = () => S.proyecto.planos.find(p => p.id === S.planoId) || null;
const capaVisible = (pl, id) => { const c = pl.capas.find(c => c.id === id); return c ? c.visible : true; };
const ppmActual = () => { const pl = plano(); return pl && pl.escala ? pl.escala.pxPorMetro : null; };
const itemsVisibles = (pl) => pl.items.filter(it => capaVisible(pl, it.capa));
const buscarItem = (id) => { for (const pl of S.proyecto.planos) { const it = pl.items.find(i => i.id === id); if (it) return { pl, it }; } return null; };

// ── mensajes
let msgTimer = null;
const mensaje = (t, error = false) => {
  el.msg.textContent = t; el.msg.classList.toggle('error', error);
  clearTimeout(msgTimer); msgTimer = setTimeout(() => { el.msg.textContent = ''; }, error ? 8000 : 4000);
};

// ── deshacer: instantánea del plano activo (items + capas + escala)
const instantanea = () => { const pl = plano(); return pl ? JSON.stringify({ id: pl.id, items: pl.items, capas: pl.capas, escala: pl.escala }) : null; };
const snap = () => { const s = instantanea(); if (s == null) return; S.undo.push(s); if (S.undo.length > MAX_DESHACER) S.undo.shift(); S.redo.length = 0; };
const restaurar = (s) => {
  const d = JSON.parse(s); const pl = S.proyecto.planos.find(p => p.id === d.id); if (!pl) return;
  pl.items = d.items; pl.capas = d.capas; pl.escala = d.escala; S.sel = null; S.planoId = pl.id;
};
const deshacer = () => { if (!S.undo.length) return; const s = S.undo.pop(); S.redo.push(instantanea()); restaurar(s); cambio(); };
const rehacer = () => { if (!S.redo.length) return; const s = S.redo.pop(); S.undo.push(instantanea()); restaurar(s); cambio(); };

// ── persistencia local
const autosave = () => { if (S.modo === 'editor' && env.onCambio) env.onCambio(); };
const cambio = () => { render(); autosave(); };

// ── imágenes: lectura y reducción
const leerImagen = (file, maxLado) => new Promise((res, rej) => {
  if (!file || !file.type.startsWith('image/')) return rej(new Error('El archivo no es una imagen'));
  const fr = new FileReader();
  fr.onerror = () => rej(new Error('No se pudo leer el archivo'));
  fr.onload = () => {
    const img = new Image();
    img.onerror = () => rej(new Error('Formato de imagen no soportado'));
    img.onload = () => {
      const { w, h, escala } = G.encajar(img.naturalWidth, img.naturalHeight, maxLado);
      if (escala === 1 && file.size < 1.5e6) return res({ dataURL: fr.result, w, h });
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      const png = file.type === 'image/png' || file.type === 'image/svg+xml';
      res({ dataURL: png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.85), w, h });
    };
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
});

// ── vista
const tam = () => { const r = el.lienzo.getBoundingClientRect(); return { w: Math.max(1, r.width), h: Math.max(1, r.height), rect: r }; };
const aplicarVista = () => {
  const { w, h } = tam();
  el.svg.setAttribute('viewBox', G.viewBoxStr(S.view, w, h));
  el.zoomInfo.textContent = plano() ? 'zoom ' + G.fmtNum(S.view.zoom * 100, 0) + ' %' : '';
  renderBarra();
};
const ajustarVista = () => { const pl = plano(); if (!pl) return; const { w, h } = tam(); S.view = G.ajustar(fuente(pl).w, fuente(pl).h, w, h); renderSvg(); };
const zoomPaso = (factor, cx, cy) => {
  const { rect } = tam();
  S.view = G.zoomEn(S.view, cx ?? rect.left + rect.width / 2, cy ?? rect.top + rect.height / 2, rect, factor);
  renderSvg();
};
const centrarItem = (it) => {
  const c = G.centroide(G.puntosDe(it)); const { w, h } = tam();
  S.view = G.centrarEn(c, w, h, Math.max(S.view.zoom, 0.6)); renderSvg();
  const g = el.svg.querySelector(`[data-id="${it.id}"]`); if (g) { g.classList.remove('pulso'); void g.getBoundingClientRect(); g.classList.add('pulso'); }
};

// ── render SVG
const svgEl = (tag, attrs = {}, txt) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  if (txt != null) n.textContent = txt;
  return n;
};
const textoMultilinea = (x, y, texto, attrs) => {
  const t = svgEl('text', { x, y, ...attrs });
  String(texto).split('\n').forEach((lin, i) => t.appendChild(svgEl('tspan', { x, dy: i ? '1.2em' : 0 }, lin || ' ')));
  return t;
};
const renderItem = (it, pl, z) => {
  const g = svgEl('g', { class: 'item' + (it.id === S.sel ? ' sel' : '') + (it.href || it.destino ? ' enlazado' : ''), 'data-id': it.id });
  const col = it.color || COLORES[0];
  const sw = 1.5 / z, fs = (it.tam || 14) ; // fs: px de imagen
  const ppm = pl.escala ? pl.escala.pxPorMetro : null;
  const halo = { 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': 4 / z, 'stroke-linejoin': 'round' };
  switch (it.tipo) {
    case 'marcador': {
      const r = 11 / z;
      g.appendChild(svgEl('circle', { cx: it.x, cy: it.y, r, fill: col, stroke: '#fff', 'stroke-width': sw }));
      g.appendChild(svgEl('text', { x: it.x, y: it.y, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#fff', 'font-size': 12 / z, 'font-weight': 700 }, it.num));
      if (it.label) g.appendChild(svgEl('text', { x: it.x + r + 4 / z, y: it.y, 'dominant-baseline': 'central', 'font-size': 12 / z, fill: '#111', ...halo }, it.label));
      g.appendChild(svgEl('circle', { class: 'halo', cx: it.x, cy: it.y, r: r + 4 / z }));
      break;
    }
    case 'texto': {
      g.appendChild(textoMultilinea(it.x, it.y, it.label || '…', { 'font-size': fs, fill: col, 'dominant-baseline': 'hanging', ...halo }));
      const lineas = String(it.label || '…').split('\n').length;
      const anchoTxt = Math.max(...String(it.label || '…').split('\n').map(l => l.length)) * fs * 0.62;
      g.appendChild(svgEl('rect', { class: 'hit', x: it.x - 2 / z, y: it.y - 2 / z, width: anchoTxt + 4 / z, height: lineas * fs * 1.2 + 4 / z }));
      g.appendChild(svgEl('rect', { class: 'halo', x: it.x - 2 / z, y: it.y - 2 / z, width: anchoTxt + 4 / z, height: lineas * fs * 1.2 + 4 / z }));
      break;
    }
    case 'imagen': {
      g.appendChild(svgEl('image', { href: env.proyecto.imagenes[it.imagenId] || '', x: it.x, y: it.y, width: it.w, height: it.h, preserveAspectRatio: 'none' }));
      if (it.label) g.appendChild(svgEl('text', { x: it.x, y: it.y + it.h + 3 / z, 'dominant-baseline': 'hanging', 'font-size': 11 / z, fill: '#111', ...halo }, it.label));
      g.appendChild(svgEl('rect', { class: 'halo', x: it.x, y: it.y, width: it.w, height: it.h }));
      break;
    }
    case 'dimension': {
      const [a, b] = it.puntos; const n = G.normal(a, b); const t = 6 / z;
      g.appendChild(svgEl('line', { class: 'cota', x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: col, 'stroke-width': 1.5 }));
      for (const p of [a, b]) g.appendChild(svgEl('line', { class: 'cota', x1: p.x - n.x * t, y1: p.y - n.y * t, x2: p.x + n.x * t, y2: p.y + n.y * t, stroke: col, 'stroke-width': 1.5 }));
      const m = G.puntoMedio(a, b), ang = G.anguloGrados(a, b);
      const metros = G.aMetros(G.dist(a, b), ppm);
      const texto = (it.label ? it.label + ' ' : '') + (metros == null ? G.fmtNum(G.dist(a, b), 0) + ' px' : G.fmtM(metros));
      g.appendChild(svgEl('text', { x: m.x, y: m.y, 'text-anchor': 'middle', 'font-size': 12 / z, fill: '#111', transform: `rotate(${ang} ${m.x} ${m.y}) translate(0 ${-5 / z})`, ...halo }, texto));
      g.appendChild(svgEl('line', { class: 'halo', x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
      g.insertBefore(svgEl('line', { class: 'hit', x1: a.x, y1: a.y, x2: b.x, y2: b.y, 'stroke-width': 12 / z }), g.firstChild);
      break;
    }
    case 'poligono': case 'zona': {
      const pts = G.puntosRect(it);
      g.appendChild(svgEl('polygon', { points: pts.map(p => p.x + ',' + p.y).join(' '), fill: col, 'fill-opacity': .18, stroke: col, 'stroke-width': sw }));
      const c = G.centroide(pts); const a = G.areaM2(pts, ppm);
      const lab = [it.label, a == null ? null : G.fmtM2(a)].filter(Boolean).join('\n');
      if (lab) g.appendChild(textoMultilinea(c.x, c.y, lab, { 'text-anchor': 'middle', 'font-size': 12 / z, fill: '#111', ...halo }));
      g.appendChild(svgEl('polygon', { class: 'halo', points: pts.map(p => p.x + ',' + p.y).join(' ') }));
      break;
    }
  }
  if ((it.tipo === 'imagen' || it.tipo === 'zona') && it.id === S.sel && S.modo === 'editor') {
    const a = 12 / z;
    g.appendChild(svgEl('rect', { class: 'asa', x: it.x + it.w - a / 2, y: it.y + it.h - a / 2, width: a, height: a, fill: '#b06a36', stroke: '#fff', 'stroke-width': 1.5 / z }));
  }
  if (S.modo === 'lectura' && it.href) { // enlace nativo en el visor
    const a = svgEl('a', { href: it.href, target: '_blank', rel: 'noopener' }); a.appendChild(g); const t = svgEl('title', {}, it.href); a.appendChild(t); return a;
  }
  if (it.nota && S.modo === 'lectura') g.appendChild(svgEl('title', {}, it.nota));
  return g;
};
const renderDraft = (z) => {
  const d = S.draft; if (!d || !d.puntos.length) return null;
  const g = svgEl('g', { class: 'draft', 'pointer-events': 'none' });
  const pts = S.cursor ? [...d.puntos, S.cursor] : d.puntos;
  const col = d.tool === 'calibrar' ? '#b03a2e' : d.tool === 'medir' ? '#111' : COLORES[0];
  if (d.tool === 'zona') {
    const b = G.bbox(pts); g.appendChild(svgEl('rect', { x: b.x, y: b.y, width: b.w, height: b.h, fill: col, 'fill-opacity': .15, stroke: col, 'stroke-width': 1.5 / z, 'stroke-dasharray': `${4 / z} ${3 / z}` }));
  } else {
    g.appendChild(svgEl('polyline', { points: pts.map(p => p.x + ',' + p.y).join(' '), fill: d.tool === 'poligono' ? col : 'none', 'fill-opacity': .12, stroke: col, 'stroke-width': 1.5 / z, 'stroke-dasharray': `${4 / z} ${3 / z}` }));
  }
  for (const p of d.puntos) g.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: 3 / z, fill: col }));
  if ((d.tool === 'dimension' || d.tool === 'medir' || d.tool === 'calibrar') && pts.length === 2) {
    const m = G.aMetros(G.dist(pts[0], pts[1]), ppmActual());
    const mid = G.puntoMedio(pts[0], pts[1]);
    g.appendChild(svgEl('text', { x: mid.x, y: mid.y - 6 / z, 'text-anchor': 'middle', 'font-size': 12 / z, fill: col, 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': 4 / z }, m == null ? G.fmtNum(G.dist(pts[0], pts[1]), 0) + ' px' : G.fmtM(m)));
  }
  return g;
};
const renderSvg = () => {
  const pl = plano();
  el.svg.replaceChildren();
  el.vacio.style.display = pl ? 'none' : '';
  if (!pl) { aplicarVista(); return; }
  const f = fuente(pl);
  el.svg.appendChild(svgEl('image', { href: f.href, x: 0, y: 0, width: f.w, height: f.h, 'data-fondo': '1' }));
  if (f.perdida) { // la sala, el muro o la imagen de base ya no existen: las anotaciones se conservan sobre un fondo vacío
    el.svg.appendChild(svgEl('rect', { x: 0, y: 0, width: f.w, height: f.h, fill: '#f6f5f0', stroke: '#c9c5b8', 'stroke-dasharray': '8 6', 'pointer-events': 'none' }));
    el.svg.appendChild(svgEl('text', { x: f.w / 2, y: 24, 'text-anchor': 'middle', 'font-size': 14, fill: '#8a8677', 'pointer-events': 'none' }, 'El fondo de este plano (' + (pl.base.tipo === 'imagen' ? 'imagen' : pl.base.tipo === 'muro' ? 'alzado' : 'sala') + ') ya no existe en el proyecto; las anotaciones se conservan'));
  }
  const z = S.view.zoom;
  for (const it of pl.items) { if (!capaVisible(pl, it.capa)) continue; el.svg.appendChild(renderItem(it, pl, z)); }
  if (pl.escala && pl.escala.ref && S.modo === 'editor' && S.tool === 'calibrar') {
    const r = pl.escala.ref; el.svg.appendChild(svgEl('line', { x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2, stroke: '#b03a2e', 'stroke-width': 2 / z, 'stroke-dasharray': `${6 / z} ${3 / z}`, 'pointer-events': 'none' }));
  }
  const d = renderDraft(z); if (d) el.svg.appendChild(d);
  aplicarVista();
};
const renderBarra = () => {
  const b = G.barraEscala(ppmActual(), S.view.zoom);
  el.barra.style.display = b ? '' : 'none';
  if (b) { $('.texto', el.barra).textContent = b.metros >= 1 ? G.fmtNum(b.metros, 0) + ' m' : G.fmtNum(b.metros * 100, 0) + ' cm'; $('.linea', el.barra).style.width = b.px + 'px'; }
};

// ── render paneles
const iconos = { marcador: '●', texto: 'T', imagen: '▣', dimension: '⟷', poligono: '⬠', zona: '▭' };
const etiquetaItem = (it) => it.label || (it.tipo === 'marcador' ? 'marcador ' + it.num : it.tipo);
const renderPaneles = () => {
  const pl = plano(); const pr = S.proyecto;
  // planos (lista y tabs)
  el.listaPlanos.replaceChildren(); el.tabs.replaceChildren();
  if (!pr.planos.length) el.listaPlanos.innerHTML = '<li class="vacio">ninguno</li>';
  pr.planos.forEach((p, i) => {
    const li = document.createElement('li'); li.className = p.id === S.planoId ? 'activo' : '';
    li.innerHTML = `<span class="nombre">${esc(p.nombre)}</span><button class="mini" data-acc="renombrar" title="Renombrar">✎</button><button class="mini" data-acc="subir" title="Subir" ${i === 0 ? 'disabled' : ''}>↑</button><button class="mini peligro" data-acc="borrar" title="Borrar plano">×</button>`;
    li.addEventListener('click', (e) => {
      const acc = e.target.dataset.acc;
      if (acc === 'renombrar') { const n = prompt('Nombre del plano', p.nombre); if (n) { p.nombre = n.trim() || p.nombre; cambio(); } }
      else if (acc === 'subir') { pr.planos.splice(i, 1); pr.planos.splice(i - 1, 0, p); cambio(); }
      else if (acc === 'borrar') { if (confirm(`¿Borrar el plano «${p.nombre}» con sus ${p.items.length} anotaciones?`)) { pr.planos.splice(i, 1); cacheFuente.delete(p.id); if (S.planoId === p.id) { S.planoId = pr.planos[0]?.id || null; S.undo.length = 0; S.redo.length = 0; } cambio(); ajustarVista(); } }
      else activarPlano(p.id);
    });
    el.listaPlanos.appendChild(li);
    if (pr.planos.length > 1) { const b = document.createElement('button'); b.textContent = p.nombre; b.className = p.id === S.planoId ? 'activo' : ''; b.addEventListener('click', () => activarPlano(p.id)); el.tabs.appendChild(b); }
  });
  // capas
  el.listaCapas.replaceChildren();
  if (pl) pl.capas.forEach((c) => {
    const li = document.createElement('li'); li.className = c.id === pl.capaActiva ? 'activo' : '';
    const n = pl.items.filter(it => it.capa === c.id).length;
    li.innerHTML = `<input type="checkbox" ${c.visible ? 'checked' : ''} title="Visible"><span class="nombre">${esc(c.nombre)} <span style="color:var(--ink2)">${n}</span></span><button class="mini" data-acc="renombrar" title="Renombrar">✎</button><button class="mini peligro" data-acc="borrar" title="Borrar capa" ${pl.capas.length === 1 ? 'disabled' : ''}>×</button>`;
    li.addEventListener('click', (e) => {
      const acc = e.target.dataset.acc;
      if (e.target.type === 'checkbox') { c.visible = e.target.checked; if (!c.visible && S.sel && pl.items.find(i => i.id === S.sel)?.capa === c.id) S.sel = null; cambio(); return; }
      if (acc === 'renombrar') { const nn = prompt('Nombre de la capa', c.nombre); if (nn) { snap(); c.nombre = nn.trim() || c.nombre; cambio(); } }
      else if (acc === 'borrar') { if (confirm(`¿Borrar la capa «${c.nombre}»? Sus ${n} anotaciones pasan a la primera capa.`)) { snap(); const dest = pl.capas.find(x => x.id !== c.id); pl.items.forEach(it => { if (it.capa === c.id) it.capa = dest.id; }); pl.capas = pl.capas.filter(x => x !== c); if (pl.capaActiva === c.id) pl.capaActiva = dest.id; cambio(); } }
      else { pl.capaActiva = c.id; renderPaneles(); }
    });
    el.listaCapas.appendChild(li);
  });
  // escala
  if (!pl) el.infoEscala.textContent = '';
  else if (pl.escala && pl.escala.automatica) el.infoEscala.innerHTML = `1 m = <b>${G.fmtNum(pl.escala.pxPorMetro, 1)} px</b><br>a escala del proyecto`;
  else if (pl.escala) el.infoEscala.innerHTML = `1 m = <b>${G.fmtNum(pl.escala.pxPorMetro, 1)} px</b><br>referencia: ${G.fmtM(pl.escala.ref.metros)}`;
  else el.infoEscala.innerHTML = 'sin calibrar — herramienta <b>C</b>';
  renderListaItems(pl);
  renderProps();
  $('#ap-btnDeshacer').disabled = !S.undo.length; $('#ap-btnRehacer').disabled = !S.redo.length;
  $$('#ap-herramientas button').forEach(b => b.classList.toggle('activo', b.dataset.tool === S.tool));
  el.lienzo.dataset.tool = S.tool;
};
const renderListaItems = (pl) => {
  el.listaItems.replaceChildren();
  if (!pl || !pl.items.length) el.listaItems.innerHTML = '<li class="vacio">ninguna</li>';
  else pl.items.forEach((it) => {
    const li = document.createElement('li'); li.className = (it.id === S.sel ? 'activo' : '') + (capaVisible(pl, it.capa) ? '' : ' oculto');
    if (!capaVisible(pl, it.capa)) li.style.opacity = '.4';
    const icono = it.tipo === 'marcador' ? `<span class="num" style="background:${esc(it.color || COLORES[0])}">${it.num}</span>` : `<span style="color:${esc(it.color || COLORES[0])}">${iconos[it.tipo] || '•'}</span>`;
    const enlace = it.href ? ' <span title="enlace externo">↗</span>' : it.destino ? ' <span title="enlace interno">→</span>' : '';
    li.innerHTML = `${icono}<span class="nombre">${esc(etiquetaItem(it))}${enlace}</span>`;
    li.addEventListener('click', () => { S.sel = it.id; render(); centrarItem(it); });
    el.listaItems.appendChild(li);
  });
};
const campo = (k, tipo, label, extra = '') => `<label>${label}</label><${tipo === 'textarea' ? 'textarea' : 'input type="' + tipo + '"'} data-k="${k}" ${extra}${tipo === 'textarea' ? '></textarea>' : '>'}`;
const renderProps = () => {
  const pl = plano(); const it = pl && pl.items.find(i => i.id === S.sel);
  if (!it) { el.props.innerHTML = pl ? '<div class="vacio">nada seleccionado</div>' : ''; return; }
  const ppm = ppmActual();
  let h = `<div class="dato">${iconos[it.tipo]} <b>${it.tipo}${it.tipo === 'marcador' ? ' ' + it.num : ''}</b></div>`;
  if (S.modo === 'editor') {
    h += campo('label', it.tipo === 'texto' ? 'textarea' : 'text', 'etiqueta');
    h += campo('nota', 'textarea', 'nota');
    if (it.tipo === 'texto') h += campo('tam', 'number', 'tamaño (px de imagen)', 'min="4" step="any"');
    if (it.tipo === 'imagen' || it.tipo === 'zona') h += `<div class="fila">${campo('w', 'number', 'ancho (px)', 'min="1" step="any"')}${campo('h', 'number', 'alto (px)', 'min="1" step="any"')}</div>${it.tipo === 'imagen' ? '<div class="dato">proporción fija; arrastra la esquina naranja (Shift = libre)</div>' : ''}`;
    h += `<label>color</label><div class="swatches">${COLORES.map(c => `<span data-color="${c}" class="${(it.color || COLORES[0]) === c ? 'activo' : ''}" style="background:${c}"></span>`).join('')}</div>`;
    h += `<label>capa</label><select data-k="capa">${pl.capas.map(c => `<option value="${c.id}" ${c.id === it.capa ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select>`;
    h += campo('href', 'url', 'enlace externo', 'placeholder="https://…"');
    h += `<label>enlace interno</label><select data-k="destinoPlano"><option value="">— ninguno —</option>${S.proyecto.planos.map(p => `<option value="${p.id}" ${it.destino && it.destino.plano === p.id ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select>`;
    if (it.destino) { const dp = S.proyecto.planos.find(p => p.id === it.destino.plano); if (dp) h += `<select data-k="destinoItem" style="margin-top:4px"><option value="">(solo abrir el plano)</option>${dp.items.filter(x => x.id !== it.id).map(x => `<option value="${x.id}" ${it.destino.item === x.id ? 'selected' : ''}>${esc(etiquetaItem(x))}</option>`).join('')}</select>`; }
  } else {
    if (it.label) h += `<div class="dato"><b>${esc(it.label)}</b></div>`;
    if (it.nota) h += `<div class="dato" style="white-space:pre-wrap">${esc(it.nota)}</div>`;
    if (it.href) h += `<a class="enlace-ext" href="${esc(it.href)}" target="_blank" rel="noopener">${esc(it.href)} ↗</a>`;
    if (it.destino) h += `<div class="btns"><button data-acc="ir">→ ir al enlace interno</button></div>`;
  }
  if (it.tipo === 'dimension') h += `<div class="dato">longitud: <b>${ppm ? G.fmtM(G.aMetros(G.dist(it.puntos[0], it.puntos[1]), ppm)) : G.fmtNum(G.dist(it.puntos[0], it.puntos[1]), 0) + ' px'}</b></div>`;
  if (it.tipo === 'poligono' || it.tipo === 'zona') { const pts = G.puntosRect(it); h += `<div class="dato">área: <b>${G.fmtM2(G.areaM2(pts, ppm))}</b> · perímetro: <b>${G.fmtM(G.aMetros(G.perimetroPx(pts), ppm))}</b></div>`; }
  if (S.modo === 'editor') h += `<div class="btns"><button data-acc="duplicar">duplicar</button><button data-acc="centrar">centrar</button>${it.destino ? '<button data-acc="ir">→ probar enlace</button>' : ''}<button data-acc="borrar" class="peligro">borrar</button></div>`;
  el.props.innerHTML = h;
  // valores (sin inyectar en el HTML)
  $$('[data-k]', el.props).forEach(inp => { const k = inp.dataset.k; if (k in it) inp.value = typeof it[k] === 'number' ? Math.round(it[k] * 10) / 10 : (it[k] ?? ''); });
  $$('[data-k]', el.props).forEach(inp => {
    const k = inp.dataset.k;
    let snapHecho = false;
    inp.addEventListener('focus', () => { snapHecho = false; });
    inp.addEventListener('input', () => {
      if (!snapHecho) { snap(); snapHecho = true; }
      if (k === 'destinoPlano') { it.destino = inp.value ? { plano: inp.value, item: null } : null; renderPaneles(); }
      else if (k === 'destinoItem') { if (it.destino) it.destino.item = inp.value || null; }
      else if (k === 'tam' || k === 'w' || k === 'h') {
        const v = parseFloat(inp.value); if (!(v > 0)) return;
        if (it.tipo === 'imagen' && (k === 'w' || k === 'h')) {
          const otro = k === 'w' ? 'h' : 'w'; const ratio = it[otro] / it[k];
          it[k] = v; it[otro] = v * ratio;
          const inpOtro = $(`[data-k="${otro}"]`, el.props); if (inpOtro) inpOtro.value = Math.round(it[otro] * 10) / 10;
        } else it[k] = v;
      }
      else if (k === 'href') { it.href = inp.value.trim() || null; }
      else it[k] = inp.value;
      renderSvg(); autosave();
      if (k === 'label' || k === 'href' || k === 'destinoItem') renderListaItems(pl);
    });
  });
  $$('.swatches span', el.props).forEach(sp => sp.addEventListener('click', () => { snap(); it.color = sp.dataset.color; cambio(); }));
  $$('[data-acc]', el.props).forEach(b => b.addEventListener('click', () => {
    const acc = b.dataset.acc;
    if (acc === 'borrar') borrarSel();
    else if (acc === 'centrar') centrarItem(it);
    else if (acc === 'ir') irA(it.destino);
    else if (acc === 'duplicar') { snap(); const c = JSON.parse(JSON.stringify(it)); c.id = G.nuevoId(); if (c.tipo === 'marcador') c.num = siguienteNum(pl); G.mover(c, 20 / S.view.zoom, 20 / S.view.zoom); pl.items.push(c); S.sel = c.id; cambio(); }
  }));
};
const render = () => { renderSvg(); renderPaneles(); };

// ── acciones sobre ítems
const siguienteNum = (pl) => pl.items.filter(i => i.tipo === 'marcador').reduce((m, i) => Math.max(m, i.num || 0), 0) + 1;
const agregarItem = (base) => {
  const pl = plano(); if (!pl) return null;
  snap();
  const it = { id: G.nuevoId(), capa: pl.capaActiva, color: COLORES[0], label: '', nota: '', href: null, destino: null, ...base };
  if (it.tipo === 'marcador') it.num = siguienteNum(pl);
  pl.items.push(it); S.sel = it.id; cambio();
  if (S.modo === 'editor' && it.tipo === 'texto') { const inp = $('[data-k="label"]', el.props); if (inp) { inp.focus(); inp.select(); } }
  return it;
};
const borrarSel = () => { const pl = plano(); if (!pl || !S.sel) return; snap(); pl.items = pl.items.filter(i => i.id !== S.sel); S.sel = null; cambio(); };
const activarPlano = (id) => { if (id === S.planoId) return; S.planoId = id; S.proyecto.planoActivo = id; S.sel = null; S.draft = null; S.undo.length = 0; S.redo.length = 0; render(); if (S.activa) ajustarVista(); renderPaneles(); autosave(); };
const irA = (destino) => {
  if (!destino) return;
  const pl = S.proyecto.planos.find(p => p.id === destino.plano);
  if (!pl) return mensaje('El plano enlazado ya no existe', true);
  activarPlano(pl.id);
  if (destino.item) { const it = pl.items.find(i => i.id === destino.item); if (it) { S.sel = it.id; render(); centrarItem(it); } else mensaje('La anotación enlazada ya no existe', true); }
};
const agregarPlano = async (file) => {
  try {
    const imagen = await leerImagen(file, MAX_LADO_PLANO);
    const imagenId = M.nuevoId('img'); env.proyecto.imagenes[imagenId] = imagen.dataURL;
    const pl = M.nuevaAnotacion({ nombre: file.name.replace(/\.[^.]+$/, ''), base: { tipo: 'imagen', imagenId, w: imagen.w, h: imagen.h } });
    S.proyecto.planos.push(pl); activarPlano(pl.id); mensaje(`Plano «${pl.nombre}» (${imagen.w}×${imagen.h})`);
  } catch (e) { mensaje(e.message, true); }
};
const agregarPlanoDe = (tipo, obj) => {
  if (!obj) return;
  const base = tipo === 'sala' ? { tipo: 'sala', salaId: obj.id, w: 0, h: 0 } : tipo === 'muro' ? { tipo: 'muro', muroId: obj.id, w: 0, h: 0 } : { tipo: 'iso', salaId: obj.id, cam: { ...I.camDefecto(), ...(obj.iso || {}) }, w: 0, h: 0 };
  const pl = M.nuevaAnotacion({ nombre: (obj.nombre || (tipo === 'muro' ? 'Muro' : 'Planta')) + (tipo === 'iso' ? ' · 3D' : ''), base });
  S.proyecto.planos.push(pl); activarPlano(pl.id);
  mensaje(tipo === 'sala' ? `Planta «${pl.nombre}» añadida, a escala` : tipo === 'muro' ? `Alzado «${pl.nombre}» añadido, a escala` : `Vista 3D «${pl.nombre}» añadida con el giro guardado en la planta`);
};
const elegir = (titulo, lista) => {
  if (!lista.length) { mensaje('El proyecto no tiene ' + (titulo === 'sala' ? 'salas' : 'muros') + ' todavía', true); return null; }
  if (lista.length === 1) return lista[0];
  const r = prompt(lista.map((x, i) => (i + 1) + '. ' + (x.nombre || titulo)).join('\n') + '\n\nNúmero de ' + titulo + ':', '1');
  if (r == null) return null; const i = parseInt(r, 10) - 1; return lista[i] || null;
};
const agregarImagenEn = async (file, p) => {
  try {
    const img = await leerImagen(file, MAX_LADO_IMG);
    const pl = plano(); const ancho = Math.min(img.w, fuente(pl).w * 0.2);
    const imagenId = M.nuevoId('img'); env.proyecto.imagenes[imagenId] = img.dataURL;
    agregarItem({ tipo: 'imagen', imagenId, x: p.x - ancho / 2, y: p.y - (ancho * img.h / img.w) / 2, w: ancho, h: ancho * img.h / img.w, label: '' });
  } catch (e) { mensaje(e.message, true); }
};

// ── herramientas
const setTool = (t) => { if (S.modo === 'lectura') return; S.tool = t; S.draft = null; S.medida = null; el.medida.style.display = 'none'; render(); };
const cancelar = () => { S.draft = null; S.sel = null; S.medida = null; el.medida.style.display = 'none'; render(); };
const terminarPoligono = () => {
  if (!S.draft || S.draft.tool !== 'poligono') return;
  if (S.draft.puntos.length < 3) { mensaje('Un polígono necesita al menos tres puntos', true); return; }
  const pts = S.draft.puntos; S.draft = null; agregarItem({ tipo: 'poligono', puntos: pts });
};
const clicHerramienta = (p, e) => {
  const pl = plano(); if (!pl) return;
  const t = S.tool;
  if (t === 'marcador') agregarItem({ tipo: 'marcador', x: p.x, y: p.y });
  else if (t === 'texto') agregarItem({ tipo: 'texto', x: p.x, y: p.y, label: 'texto', tam: Math.max(10, Math.round(fuente(pl).w / 70)) });
  else if (t === 'imagen') { S.pendienteImagen = p; el.fileImagen.value = ''; el.fileImagen.click(); }
  else if (t === 'dimension' || t === 'medir' || t === 'calibrar') {
    if (!S.draft || S.draft.fijo) { S.draft = { tool: t, puntos: [p] }; el.medida.style.display = 'none'; }
    else {
      const [a] = S.draft.puntos; S.draft = null;
      if (G.dist(a, p) < 1) return mensaje('Los dos puntos coinciden', true);
      if (t === 'dimension') agregarItem({ tipo: 'dimension', puntos: [a, p] });
      else if (t === 'medir') { const m = G.aMetros(G.dist(a, p), ppmActual()); S.medida = m; el.medida.textContent = m == null ? G.fmtNum(G.dist(a, p), 0) + ' px (sin calibrar)' : G.fmtM(m); el.medida.style.display = ''; S.draft = { tool: 'medir', puntos: [a, p], fijo: true }; renderSvg(); }
      else { // calibrar
        const r = prompt('Longitud real de ese segmento, en metros (por ejemplo 4,49):'); if (r == null) { renderSvg(); return; }
        const metros = parseFloat(String(r).replace(',', '.'));
        const ppm = G.pxPorMetro(a, p, metros);
        if (!ppm) return mensaje('Valor no válido', true);
        snap(); pl.escala = { pxPorMetro: ppm, ref: { x1: a.x, y1: a.y, x2: p.x, y2: p.y, metros } };
        mensaje(`Calibrado: 1 m = ${G.fmtNum(ppm, 1)} px`); cambio();
      }
    }
    renderSvg();
  } else if (t === 'poligono') {
    if (!S.draft) S.draft = { tool: t, puntos: [p] };
    else { const p0 = S.draft.puntos[0]; if (S.draft.puntos.length >= 3 && G.dist(p0, p) < 10 / S.view.zoom) return terminarPoligono(); S.draft.puntos.push(p); }
    renderSvg();
  }
};

// ── puntero
const posImagen = (e) => { const { rect } = tam(); return G.clientToImage(e.clientX, e.clientY, rect, S.view); };
el.lienzo.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 && e.button !== 1) return;
  if (e.target.closest && (e.target.closest('#ap-tabsPlanos') || e.target.closest('#ap-ayuda'))) return;
  el.lienzo.setPointerCapture(e.pointerId);
  const p = posImagen(e);
  const gItem = e.target.closest ? e.target.closest('.item') : null;
  const id = gItem && gItem.dataset.id;
  const esSelect = S.tool === 'select' || S.modo === 'lectura';
  const mueve = esSelect && id && S.modo === 'editor' && e.button === 0;
  S.arrastre = { x0: e.clientX, y0: e.clientY, p0: p, view0: { ...S.view }, movido: false, id: esSelect ? id : null, pan: !mueve, snap: false };
  if (mueve && e.target.classList && e.target.classList.contains('asa')) {
    const it = plano().items.find(i => i.id === id);
    if (it) { snap(); S.arrastre.redim = { it, w0: it.w, h0: it.h }; S.arrastre.pan = false; }
  }
  if (S.tool === 'zona' && S.modo === 'editor' && plano()) { S.draft = { tool: 'zona', puntos: [p] }; S.arrastre.zona = true; }
  if (esSelect && id && S.modo === 'editor') { S.sel = id; renderPaneles(); renderSvg(); }
});
el.lienzo.addEventListener('pointermove', (e) => {
  const p = posImagen(e); S.cursor = p;
  el.coords.textContent = plano() ? `${G.fmtNum(p.x, 0)}, ${G.fmtNum(p.y, 0)} px` + (ppmActual() ? ` · ${G.fmtM(p.x / ppmActual())}, ${G.fmtM(p.y / ppmActual())}` : '') : '';
  const a = S.arrastre;
  if (a) {
    if (!a.movido && Math.hypot(e.clientX - a.x0, e.clientY - a.y0) > 3) a.movido = true;
    if (!a.movido) return;
    if (a.zona) { S.draft.puntos = [a.p0]; renderSvg(); return; }
    if (a.redim) {
      const it = a.redim.it; const min = 4 / S.view.zoom;
      let nw = Math.max(min, p.x - it.x), nh = Math.max(min, p.y - it.y);
      if (it.tipo === 'imagen' && !e.shiftKey) nh = nw * a.redim.h0 / a.redim.w0;
      it.w = nw; it.h = nh; renderSvg(); return;
    }
    if (a.pan) { S.view = { ...a.view0, vx: a.view0.vx - (e.clientX - a.x0) / a.view0.zoom, vy: a.view0.vy - (e.clientY - a.y0) / a.view0.zoom }; el.lienzo.classList.add('arrastrando'); aplicarVista(); return; }
    if (a.id && S.modo === 'editor') {
      const pl = plano(); const it = pl.items.find(i => i.id === a.id); if (!it) return;
      if (!a.snap) { snap(); a.snap = true; a.prev = a.p0; }
      G.mover(it, p.x - a.prev.x, p.y - a.prev.y); a.prev = p; renderSvg(); return;
    }
  }
  if (S.draft && !S.draft.fijo) renderSvg();
});
const finPuntero = (e) => {
  const a = S.arrastre; if (!a) return; S.arrastre = null; el.lienzo.classList.remove('arrastrando');
  try { el.lienzo.releasePointerCapture(e.pointerId); } catch (err) {}
  const p = posImagen(e);
  if (a.zona) { const pts = [a.p0, p]; S.draft = null; if (a.movido && Math.abs(p.x - a.p0.x) > 2 && Math.abs(p.y - a.p0.y) > 2) { const b = G.bbox(pts); agregarItem({ tipo: 'zona', x: b.x, y: b.y, w: b.w, h: b.h }); } else renderSvg(); return; }
  if (a.redim) { autosave(); renderPaneles(); return; }
  if (a.movido) { if (a.snap) { autosave(); renderPaneles(); } return; }
  if (e.button === 1) return;
  // clic sin movimiento
  if (S.modo === 'lectura') {
    const id = a.id;
    if (id) { const f = buscarItem(id); S.sel = id; renderPaneles(); renderSvg(); if (f && f.it.destino && !f.it.href) irA(f.it.destino); }
    else { S.sel = null; renderPaneles(); renderSvg(); }
    return;
  }
  if (S.tool === 'select') { if (!a.id) { S.sel = null; render(); } return; }
  clicHerramienta(p, e);
};
el.lienzo.addEventListener('pointerup', finPuntero);
el.lienzo.addEventListener('pointercancel', () => { S.arrastre = null; el.lienzo.classList.remove('arrastrando'); });
el.lienzo.addEventListener('dblclick', (e) => { if (S.tool === 'poligono' && S.draft) { e.preventDefault(); S.draft.puntos.pop(); terminarPoligono(); } });
el.lienzo.addEventListener('wheel', (e) => { if (!plano()) return; e.preventDefault(); zoomPaso(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY); }, { passive: false });
el.lienzo.addEventListener('contextmenu', (e) => e.preventDefault());

// arrastrar y soltar archivos
el.lienzo.addEventListener('dragover', (e) => { if (S.modo === 'editor') e.preventDefault(); });
el.lienzo.addEventListener('drop', async (e) => {
  if (S.modo !== 'editor') return; // el visor exportado no edita nada
  e.preventDefault(); const files = Array.from(e.dataTransfer.files || []); if (!files.length) return;
  for (const f of files) {
    if (f.name.endsWith('.json') || f.type === 'application/json') { if (env.onArchivoJson) env.onArchivoJson(f); continue; }
    if (!f.type.startsWith('image/')) { mensaje(`«${f.name}» no es imagen ni .json`, true); continue; }
    if (!plano() || S.modo === 'lectura') await agregarPlano(f);
    else await agregarImagenEn(f, posImagen(e));
  }
});
el.filePlano.addEventListener('change', async () => { for (const f of el.filePlano.files) await agregarPlano(f); el.filePlano.value = ''; });
el.fileImagen.addEventListener('change', async () => { const f = el.fileImagen.files[0]; if (f && S.pendienteImagen) await agregarImagenEn(f, S.pendienteImagen); S.pendienteImagen = null; el.fileImagen.value = ''; });

// ── teclado
const alTeclado = (e) => {
  if (!S.activa || (document.activeElement && document.activeElement !== document.body && !root.contains(document.activeElement))) return;
  const enCampo = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if (e.key === 'Escape') { if (enCampo) { document.activeElement.blur(); return; } if (el.ayuda.classList.contains('visible')) { el.ayuda.classList.remove('visible'); return; } cancelar(); return; }
  if (enCampo) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? rehacer() : deshacer(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); rehacer(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tools = { v: 'select', m: 'marcador', t: 'texto', i: 'imagen', d: 'dimension', p: 'poligono', z: 'zona', x: 'medir', c: 'calibrar' };
  if (tools[k] && S.modo === 'editor') { setTool(tools[k]); return; }
  if (k === 'delete' || k === 'backspace') { if (S.modo === 'editor') { e.preventDefault(); borrarSel(); } return; }
  if (k === 'enter' && S.draft && S.draft.tool === 'poligono') { terminarPoligono(); return; }
  if (k === '0') ajustarVista(); else if (k === '+' || k === '=') zoomPaso(1.25); else if (k === '-') zoomPaso(0.8);
  else if (k === '?') el.ayuda.classList.toggle('visible');
};
document.addEventListener('keydown', alTeclado);

// ── barra superior
$$('#ap-herramientas button').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
$('#ap-btnDeshacer').addEventListener('click', deshacer); $('#ap-btnRehacer').addEventListener('click', rehacer);
$('#ap-btnAjustar').addEventListener('click', ajustarVista);
$('#ap-btnAyuda').addEventListener('click', () => el.ayuda.classList.toggle('visible'));
$('#ap-btnCerrarAyuda').addEventListener('click', () => el.ayuda.classList.remove('visible'));
$('#ap-btnPlano').addEventListener('click', () => { el.filePlano.value = ''; el.filePlano.click(); });
$('#ap-btnPlanoSala').addEventListener('click', () => agregarPlanoDe('sala', elegir('sala', env.proyecto.salas)));
$('#ap-btnPlanoMuro').addEventListener('click', () => agregarPlanoDe('muro', elegir('muro', env.proyecto.muros)));
$('#ap-btnPlanoIso').addEventListener('click', () => agregarPlanoDe('iso', elegir('sala', env.proyecto.salas)));
$('#ap-btnCapa').addEventListener('click', () => { const pl = plano(); if (!pl) return mensaje('Primero añade un plano', true); const n = prompt('Nombre de la capa'); if (!n) return; snap(); const c = { id: G.nuevoId('c'), nombre: n.trim(), visible: true }; pl.capas.push(c); pl.capaActiva = c.id; cambio(); });
$('#ap-btnExportHtml').addEventListener('click', () => { if (!S.proyecto.planos.length) return mensaje('No hay planos que exportar', true); if (env.onExportarHtml) env.onExportarHtml(); });
$('#ap-btnExportPng').addEventListener('click', () => exportarPng());
$('#ap-btnExportCsv').addEventListener('click', () => descargar(new Blob(['﻿' + G.csvMedidas(S.proyecto)], { type: 'text/csv;charset=utf-8' }), nombreArchivo() + '-medidas.csv'));
$('#ap-btnEditar').addEventListener('click', () => { if (env.onEditar) env.onEditar(); });
const alRedimensionar = () => { if (S.activa) aplicarVista(); };
window.addEventListener('resize', alRedimensionar);

// ── archivos
const nombreArchivo = () => (env.proyecto.nombre || 'proyecto').replace(/[^\w\-áéíóúñü ]+/gi, '').trim().replace(/\s+/g, '-') || 'proyecto';
const descargar = (blob, nombre) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
const exportarPng = () => {
  const pl = plano(); if (!pl) return mensaje('No hay plano activo', true);
  const sel = S.sel, draft = S.draft, view = { ...S.view }; S.sel = null; S.draft = null; S.view = { vx: 0, vy: 0, zoom: 1 };
  renderSvg();
  const clon = el.svg.cloneNode(true);
  clon.setAttribute('viewBox', `0 0 ${fuente(pl).w} ${fuente(pl).h}`); clon.setAttribute('width', fuente(pl).w); clon.setAttribute('height', fuente(pl).h);
  clon.removeAttribute('style'); clon.removeAttribute('id');
  // fuera de la página no hay CSS: los halos y las zonas de clic (sin fill) saldrían negros
  clon.querySelectorAll('.halo,.hit,.asa').forEach((n) => n.remove());
  clon.querySelectorAll('[data-fondo]').forEach((n) => n.removeAttribute('data-fondo'));
  const estilo = document.createElementNS(SVGNS, 'style'); estilo.textContent = 'text{font-family:"Fira Code",ui-monospace,Menlo,monospace} .cota{vector-effect:non-scaling-stroke}'; clon.insertBefore(estilo, clon.firstChild);
  S.sel = sel; S.draft = draft; S.view = view; renderSvg();
  const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clon));
  const img = new Image();
  img.onload = () => { const c = document.createElement('canvas'); c.width = fuente(pl).w; c.height = fuente(pl).h; const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0); c.toBlob(b => { if (b) { descargar(b, nombreArchivo() + '-' + pl.nombre.replace(/\s+/g, '-') + '.png'); mensaje('PNG exportado'); } else mensaje('No se pudo generar el PNG', true); }, 'image/png'); };
  img.onerror = () => mensaje('No se pudo rasterizar el plano', true);
  img.src = src;
};

// ── arranque y API para el cascarón
const setModo = (modo) => {
  S.modo = modo === 'lectura' ? 'lectura' : 'editor';
  AP.classList.toggle('lectura', S.modo === 'lectura');
  if (S.modo === 'lectura') { S.tool = 'select'; S.draft = null; }
  render();
};
const cargar = () => {
  cacheFuente.clear(); S.sel = null; S.draft = null; S.undo.length = 0; S.redo.length = 0;
  const pls = S.proyecto.planos;
  S.planoId = pls.find((p) => p.id === S.proyecto.planoActivo)?.id || pls[0]?.id || null;
  setModo(S.modo);
};
cargar();
return {
  activar(on) { S.activa = !!on; if (on) { cacheFuente.clear(); render(); if (!S.vistoTodo) { S.vistoTodo = true; ajustarVista(); } } },
  setModo, refrescar() { cacheFuente.clear(); cargar(); },
  destruir() { S.activa = false; document.removeEventListener('keydown', alTeclado); window.removeEventListener('resize', alRedimensionar); },
  agregarPlanoDe,
  _S: S, _clic: (p) => clicHerramienta(p, null), _setTool: setTool,
};
}
