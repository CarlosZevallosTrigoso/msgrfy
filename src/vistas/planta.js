
// Vista Planta. Extraída de plano-sala y adaptada al proyecto unificado:
// trabaja sobre una sala del proyecto (ctx.sala) y las obras viven en ctx.proyecto.obras.
import { G } from '../core/planta.js';
import * as M from '../core/modelo.js';
import { MARKUP } from './planta-markup.js';
import { montarIso } from './isometrica.js';
import { CATALOGO, CATEGORIAS, muebleDesde, entradaDesde, csvMobiliario } from '../core/biblioteca.js';

// ctx: { root, proyecto, sala, onCambio(), onGuardar(), onObraCambiada(obraId) }
export function montarPlanta(ctx) {
'use strict';
const root = ctx.root;
root.innerHTML = MARKUP;
const MAX_UNDO = 60, MAX_LADO_CALCO = 3000;
const $ = (s, r = root) => r.querySelector(s);
const $$ = (s, r = root) => Array.from(r.querySelectorAll(s));
const esc = G.esc, C = G.C;
const DIBUJO = ['linea', 'rect', 'circulo', 'puerta', 'ventana', 'texto', 'cota', 'calibrar', 'cuadro', 'obra', 'region', 'proyeccion', 'mueble'];
const POLI = ['linea', 'obra', 'region'];
const esPoli = (t) => POLI.includes(t);
const COLORES_REGION = ['#4f6b82', '#586a45', '#b06a36', '#b03a2e', '#8a8a8a'];
const DEF = {
  linea: { grosor: 'medio', estilo: 'continua', medidas: true, relleno: 'ninguno', flecha: false },
  rect: { grosor: 'medio', estilo: 'continua', medidas: true, relleno: 'ninguno' },
  circulo: { grosor: 'medio', estilo: 'continua', medidas: false, relleno: 'ninguno' },
};

const el = {
  lienzo: $('#lienzo'), svg: $('#svg'), defsRej: $('#defsRejilla'), capaRej: $('#capaRejilla'), capaCalco: $('#capaCalco'),
  capaDib: $('#capaDibujo'), capaSel: $('#capaSel'), capaDraft: $('#capaDraft'), flot: $('#flotante'), guia: $('#guia'),
  barra: $('#barraEscala'), inicio: $('#inicio'), panel: $('#panel'), pista: $('#pista'), pistaBtns: $('#pistaBtns'),
  msg: $('#msg'), coords: $('#coords'), zoomInfo: $('#zoomInfo'), fCalco: $('#fCalco'),
  exportar: $('#exportar'), ayuda: $('#ayuda'), selSala: $('#selSala'),
};

let iso = null; // modo 3D, se monta más abajo
const S = {
  doc: ctx.sala, tool: 'select', sel: null, vsel: null, tramo: null, activa: false, obraPendiente: null, muebleTpl: null, bibCat: 'soportes',
  view: { vx: -1, vy: -1, zoom: 60 }, draft: null, cursor: null, iman: null, raw: null, buffer: '',
  undo: [], redo: [], arr: null, alt: false, espacio: false, lsFallo: false, inicioOculto: false, guiaPaso: null, raf: 0,
};
// rótulo movible bajo el puntero (los de encima primero)
const rotuloEn = (p) => { const pad = 3 / S.view.zoom; for (let i = (S.rotulos || []).length - 1; i >= 0; i--) { const r = S.rotulos[i]; if (r.movible && p.x >= r.caja.x0 - pad && p.x <= r.caja.x1 + pad && p.y >= r.caja.y0 - pad && p.y <= r.caja.y1 + pad) return r; } return null; };
const ent = (id = S.sel) => S.doc.entidades.find((e) => e.id === id) || null;
const obraDe = (e) => (e && e.obraId ? M.obraDe(ctx.proyecto, e.obraId) : null);
const dimsTexto = (o) => (o && (o.ancho > 0 || o.alto > 0) ? [o.ancho > 0 ? (o.estimado.ancho ? '≈' : '') + G.fmtNum(o.ancho) : '?', o.alto > 0 ? (o.estimado.alto ? '≈' : '') + G.fmtNum(o.alto) : '?'].join(' × ') + ' m' : '');
// Las entidades no guardan la ficha: la toman de la obra al dibujar y exportar
const decorar = (e) => {
  if (!G.esObra(e)) return e;
  const o = obraDe(e);
  return o ? { ...e, titulo: o.nombre, artista: o.autor, anio: o.anio, tecnica: o.tecnica, dims: dimsTexto(o), nota: o.nota } : { ...e, titulo: '', artista: '', anio: '', tecnica: '', dims: '', nota: '' };
};
const calcoRender = () => { const c = S.doc.calco; return c ? { ...c, src: ctx.proyecto.imagenes[c.imagenId] || '' } : null; };
const D = () => ({ ...S.doc, calco: calcoRender(), entidades: S.doc.entidades.map(decorar) });
// Obra para una entidad nueva: la pendiente (desde el panel de obras) o una nueva en el proyecto
const asignarObra = (e) => {
  let o = S.obraPendiente ? M.obraDe(ctx.proyecto, S.obraPendiente) : null;
  S.obraPendiente = null;
  if (!o) {
    const ancho = e.tipo === 'cuadro' ? G.r6(G.dist(e.a, e.b)) : null;
    o = M.nuevaObra({ nombre: '', ancho, alto: null, estimado: { ancho: !ancho, alto: true } });
    ctx.proyecto.obras.push(o);
  } else if (e.tipo === 'cuadro' && o.ancho > 0) { const d = G.unit(G.sub(e.b, e.a)); e.b = { x: G.r6(e.a.x + d.x * o.ancho), y: G.r6(e.a.y + d.y * o.ancho) }; }
  else if (e.tipo === 'cuadro') { o.ancho = G.r6(G.dist(e.a, e.b)); o.estimado.ancho = false; }
  e.obraId = o.id;
  if (ctx.onObraCambiada) ctx.onObraCambiada(o.id);
  return o;
};

// ── mensajes y guía
let msgT = null;
const mensaje = (t, error = false) => { el.msg.textContent = t; el.msg.classList.toggle('error', error); clearTimeout(msgT); msgT = setTimeout(() => { el.msg.textContent = ''; }, error ? 8000 : 4500); };
const guia = (paso, texto) => {
  S.guiaPaso = paso;
  if (!paso) { el.guia.classList.remove('visible'); return; }
  $('.paso', el.guia).textContent = paso; $('.txt', el.guia).textContent = texto; el.guia.classList.add('visible');
};

// ── deshacer (la imagen del calco no entra en la instantánea: solo sus parámetros)
// Las obras del proyecto NO entran: son compartidas con el panel y los muros, y deshacer aquí las revertiría.
// Si una entidad vuelve con un obraId que ya no existe, se recrea una obra vacía para que no quede sin ficha.
const instantanea = () => JSON.stringify({ entidades: S.doc.entidades, calco: S.doc.calco, rotulo: S.doc.rotulo });
const snap = () => { S.undo.push(instantanea()); if (S.undo.length > MAX_UNDO) S.undo.shift(); S.redo.length = 0; };
const restaurar = (s) => {
  const d = JSON.parse(s); S.doc.entidades = d.entidades; S.doc.calco = d.calco; if (d.rotulo > 0) S.doc.rotulo = d.rotulo;
  let obrasNuevas = false;
  for (const e of S.doc.entidades) if (G.esObra(e) && e.obraId && !M.obraDe(ctx.proyecto, e.obraId)) { const o = M.nuevaObra({ id: e.obraId, nombre: '' }); ctx.proyecto.obras.push(o); obrasNuevas = true; }
  if (!ent()) S.sel = null; S.vsel = null;
  S.inicioOculto = !!(S.doc.entidades.length || S.doc.calco) || S.inicioOculto;
  if (ctx.onObraCambiada && (obrasNuevas || S.doc.entidades.some(G.esObra))) ctx.onObraCambiada(null);
};
const deshacer = () => { if (!S.undo.length) return; S.redo.push(instantanea()); restaurar(S.undo.pop()); cambio(); };
const rehacer = () => { if (!S.redo.length) return; S.undo.push(instantanea()); restaurar(S.redo.pop()); cambio(); };

// ── persistencia
const autosave = () => { if (ctx.onCambio) ctx.onCambio(); };
const cambio = () => { render(); autosave(); };

// ── vista
const tam = () => { const r = el.lienzo.getBoundingClientRect(); return { w: Math.max(1, r.width), h: Math.max(1, r.height), rect: r }; };
const aMundo = (cx, cy) => { const { rect } = tam(); return { x: S.view.vx + (cx - rect.left) / S.view.zoom, y: S.view.vy + (cy - rect.top) / S.view.zoom }; };
const aPantalla = (p) => ({ x: (p.x - S.view.vx) * S.view.zoom, y: (p.y - S.view.vy) * S.view.zoom });
const zoomEn = (cx, cy, f) => {
  const p = aMundo(cx, cy); const z = G.clamp(S.view.zoom * f, 2, 3000); const { rect } = tam();
  S.view = { zoom: z, vx: p.x - (cx - rect.left) / z, vy: p.y - (cy - rect.top) / z }; pedirRender();
};
const cajaTodo = () => {
  let bb = G.caja(S.doc.entidades, S.doc.rotulo);
  if (S.doc.calco) bb = G.unirCajas(bb, G.cajaPuntos(G.esquinasCalco(S.doc.calco)));
  return bb;
};
const verTodo = () => {
  const bb = cajaTodo() || { x: 0, y: 0, w: 10, h: 6 };
  const { w, h } = tam(); const m = 0.08;
  const z = G.clamp(Math.min(w / Math.max(bb.w, 0.5), h / Math.max(bb.h, 0.5)) * (1 - m * 2), 2, 3000);
  S.view = { zoom: z, vx: bb.x + bb.w / 2 - w / z / 2, vy: bb.y + bb.h / 2 - h / z / 2 }; pedirRender();
};
const tolM = (px = 10) => px / S.view.zoom;

// ── render del lienzo
const pedirRender = () => { if (S.raf) return; S.raf = (window.requestAnimationFrame || ((f) => setTimeout(f, 16)))(() => { S.raf = 0; renderSvg(); }); };
const PASOS_REJ = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50];
const renderRejilla = (w, h) => {
  const z = S.view.zoom;
  const menor = PASOS_REJ.find((s) => s * z >= 12) || 50;
  const mayor = [1, 5, 10, 50, 100].find((s) => s >= menor * 4) || 100;
  const px = C(1 / z);
  const pat = (id, s, color) => `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${C(s)}" height="${C(s)}"><path d="M${C(s)} 0 L0 0 0 ${C(s)}" fill="none" stroke="${color}" stroke-width="${px}"/></pattern>`;
  el.defsRej.innerHTML = pat('rjMenor', menor, '#efefec') + pat('rjMayor', mayor, '#dcdcd6');
  const r = `x="${C(S.view.vx)}" y="${C(S.view.vy)}" width="${C(w / z)}" height="${C(h / z)}"`;
  const o = `<line x1="${C(S.view.vx)}" y1="0" x2="${C(S.view.vx + w / z)}" y2="0" stroke="#c9c9c2" stroke-width="${px}"/><line x1="0" y1="${C(S.view.vy)}" x2="0" y2="${C(S.view.vy + h / z)}" stroke="#c9c9c2" stroke-width="${px}"/>`;
  el.capaRej.innerHTML = `<rect ${r} fill="url(#rjMenor)"/><rect ${r} fill="url(#rjMayor)"/>${o}`;
};
const asaSvg = (p, activa, z) => { const a = 9 / z; return `<rect x="${C(p.x - a / 2)}" y="${C(p.y - a / 2)}" width="${C(a)}" height="${C(a)}" fill="${activa ? '#b06a36' : '#ffffff'}" stroke="#b06a36" stroke-width="${C(1.5 / z)}"/>`; };
const renderSel = (z) => {
  const e = ent(); if (!e) return '';
  const ra = S.rsel && S.rsel.id === e.id ? (S.rotulos || []).find((r) => r.id === S.rsel.id && r.key === S.rsel.key) : null;
  const marcoRotulo = ra ? `<rect x="${C(ra.caja.x0 - 3 / z)}" y="${C(ra.caja.y0 - 3 / z)}" width="${C(ra.caja.x1 - ra.caja.x0 + 6 / z)}" height="${C(ra.caja.y1 - ra.caja.y0 + 6 / z)}" fill="none" stroke="#b06a36" stroke-width="${C(1.5 / z)}" stroke-dasharray="${C(4 / z)} ${C(2 / z)}"/>` : '';
  return marcoRotulo + renderSelPieza(e, z);
};
const renderSelPieza = (e, z) => {
  const st = `fill="none" stroke="#b06a36" stroke-width="${C(1.5 / z)}" stroke-dasharray="${C(5 / z)} ${C(3 / z)}"`;
  let s = '';
  if ((e.tipo === 'linea' || G.esPoligono(e)) && e.pts.length > 1) {
    s += `<path d="M${e.pts.map((p) => C(p.x) + ' ' + C(p.y)).join(' L')}${(e.cerrada || G.esPoligono(e)) && e.pts.length > 2 ? ' Z' : ''}" ${st}/>`;
    if (S.tramo != null) { const sg = G.segmentos(e).find((x) => x[2] === S.tramo); if (sg) s += `<line x1="${C(sg[0].x)}" y1="${C(sg[0].y)}" x2="${C(sg[1].x)}" y2="${C(sg[1].y)}" stroke="#b06a36" stroke-width="${C(5 / z)}" stroke-opacity=".45"/>`; }
  } else if (e.tipo === 'circulo') s += `<circle cx="${C(e.c.x)}" cy="${C(e.c.y)}" r="${C(e.r)}" ${st}/>`;
  else if (e.tipo === 'texto') { const c = G.textoCaja(e); const p = 3 / z; s += `<rect x="${C(e.x - c.w / 2 - p)}" y="${C(e.y - c.h / 2 - p)}" width="${C(c.w + 2 * p)}" height="${C(c.h + 2 * p)}" ${st}${e.rot ? ` transform="rotate(${e.rot} ${C(e.x)} ${C(e.y)})"` : ''}/>`; }
  else if (e.tipo === 'cota') { const g = G.cotaGeom(e); s += `<line x1="${C(g.qmin.x)}" y1="${C(g.qmin.y)}" x2="${C(g.qmax.x)}" y2="${C(g.qmax.y)}" ${st}/>`; }
  else if (e.tipo === 'puerta' || e.tipo === 'ventana' || e.tipo === 'cuadro') s += `<line x1="${C(e.a.x)}" y1="${C(e.a.y)}" x2="${C(e.b.x)}" y2="${C(e.b.y)}" ${st}/>`;
  else if (G.esMueble(e)) { const pts = G.mueblePts(e); s += `<path d="M${pts.map((p) => C(p.x) + ' ' + C(p.y)).join(' L')} Z" ${st}/>`; }
  G.asas(e).forEach((p, i) => { s += asaSvg(p, i === S.vsel, z); });
  return s;
};
const renderDraft = (z) => {
  let s = '';
  const d = S.draft, cur = S.cursor;
  const st = (col = '#b06a36') => `fill="none" stroke="${col}" stroke-width="${C(1.5 / z)}" stroke-dasharray="${C(5 / z)} ${C(3 / z)}"`;
  let etiqueta = null;
  if (d && cur) {
    const p0 = d.puntos[0];
    if (esPoli(d.tool)) {
      const pts = [...d.puntos, cur];
      const colD = d.tool === 'obra' ? '#b06a36' : d.tool === 'region' ? '#4f6b82' : '#111111';
      if (d.tool !== 'linea') s += `<path d="M${pts.map((p) => C(p.x) + ' ' + C(p.y)).join(' L')} Z" fill="${colD}" fill-opacity="0.08" stroke="none"/>`;
      s += `<path d="M${pts.map((p) => C(p.x) + ' ' + C(p.y)).join(' L')}${d.tool !== 'linea' ? ' Z' : ''}" ${st(colD)}/>`;
      d.puntos.forEach((p, i) => { s += `<circle cx="${C(p.x)}" cy="${C(p.y)}" r="${C((i === 0 && d.puntos.length >= 3 ? 6 : 3) / z)}" fill="${i === 0 ? '#ffffff' : '#111111'}" stroke="#111111" stroke-width="${C(1.5 / z)}"/>`; });
      etiqueta = G.fmtM(G.dist(d.puntos[d.puntos.length - 1], cur));
    } else if (d.tool === 'rect') {
      const pts = G.rectPts(p0, cur); s += `<path d="M${pts.map((p) => C(p.x) + ' ' + C(p.y)).join(' L')} Z" ${st('#111111')}/>`;
      etiqueta = G.fmtNum(Math.abs(cur.x - p0.x)) + ' × ' + G.fmtNum(Math.abs(cur.y - p0.y)) + ' m';
    } else if (d.tool === 'circulo') {
      const r = G.dist(p0, cur); s += `<circle cx="${C(p0.x)}" cy="${C(p0.y)}" r="${C(r)}" ${st('#111111')}/><circle cx="${C(p0.x)}" cy="${C(p0.y)}" r="${C(2.5 / z)}" fill="#111"/>`;
      etiqueta = 'Ø ' + G.fmtM(r * 2);
    } else if (d.tool === 'cota' && d.cadena) {
      const e = ent(d.cadena);
      if (e) {
        const tmp = { ...e, pts: [...G.cotaPts(e), cur], color: '#b06a36', total: false };
        s += G.svgDibujo({ entidades: [tmp], rotulo: S.doc.rotulo }, { k: 1 / z }).cuerpo;
        const g = G.cotaGeom(tmp); etiqueta = G.fmtM(g.tramos[g.tramos.length - 1].L);
      }
    } else if (d.tool === 'cuadro' && G.dist(p0, cur) > 0) {
      const tmp = { tipo: 'cuadro', a: p0, b: cur, lado: G.ladoCuadro(S.doc.entidades, p0, cur) };
      const g = G.cuadroGeom(tmp, S.doc.entidades, 1 / z);
      s += `<polygon points="${g.esquinas.map((q) => C(q.x) + ',' + C(q.y)).join(' ')}" fill="#b06a36" fill-opacity="0.7"/>`;
      s += `<line x1="${C(p0.x)}" y1="${C(p0.y)}" x2="${C(cur.x)}" y2="${C(cur.y)}" ${st('#b06a36')}/>`;
      etiqueta = G.fmtM(G.dist(p0, cur));
    } else if (d.tool === 'puerta' || d.tool === 'ventana' || d.tool === 'calibrar' || (d.tool === 'proyeccion' && d.puntos.length === 1) || (d.tool === 'cota' && d.puntos.length === 1)) {
      const col = d.tool === 'calibrar' ? '#b03a2e' : '#111111';
      s += `<line x1="${C(p0.x)}" y1="${C(p0.y)}" x2="${C(cur.x)}" y2="${C(cur.y)}" ${st(col)}/>`;
      for (const p of [p0, cur]) s += `<circle cx="${C(p.x)}" cy="${C(p.y)}" r="${C(3.5 / z)}" fill="${col}"/>`;
      if (d.tool === 'ventana' && G.dist(p0, cur) > 0) { const g = G.ventanaGeom({ a: p0, b: cur, esp: 0.15 }); s += `<polygon points="${g.esquinas.map((q) => C(q.x) + ',' + C(q.y)).join(' ')}" ${st('#8a8a8a')}/>`; }
      if (d.tool === 'puerta' && G.dist(p0, cur) > 0) { const g = G.puertaGeom({ a: p0, b: cur, lado: 1, bisagra: 'a' }); s += `<path d="M${C(g.hoja.x)} ${C(g.hoja.y)} A${C(g.w)} ${C(g.w)} 0 0 ${g.sweep} ${C(g.otro.x)} ${C(g.otro.y)}" ${st('#8a8a8a')}/>`; }
      etiqueta = d.tool === 'calibrar' && !S.doc.calco?.calibrado ? 'mide sobre la imagen' : G.fmtM(G.dist(p0, cur));
    } else if (d.tool === 'proyeccion' && d.puntos.length === 2) {
      const tmp = { id: '_p', tipo: 'proyeccion', a: d.puntos[0], b: d.puntos[1], p: cur, nombre: '', formato: '16:9', color: '#b06a36', verHaz: true, verDatos: false };
      s += G.svgDibujo({ entidades: [...S.doc.entidades.filter((x) => x.tipo === 'linea'), tmp], rotulo: S.doc.rotulo }, { k: 1 / z }).cuerpo.replace(/<text[\s\S]*?<\/text>/g, '');
      const g = G.proyGeom(tmp); etiqueta = G.fmtM(g.dist) + ' · tiro ' + G.fmtNum(g.tiro);
    } else if (d.tool === 'cota' && d.puntos.length === 2) {
      const tmp = { tipo: 'cota', pts: [d.puntos[0], d.puntos[1]], desp: d.desp || 0, color: '#b06a36' };
      s += G.svgDibujo({ entidades: [tmp], rotulo: S.doc.rotulo }, { k: 1 / z }).cuerpo;
    }
  }
  if (S.tool === 'mueble' && S.muebleTpl && cur) {
    const tmp = muebleDesde(S.muebleTpl, cur.x, cur.y, '_m'); tmp.rot = S.muebleRot || 0;
    const pts = G.mueblePts(tmp);
    s += `<path d="M${pts.map((p) => C(p.x) + ' ' + C(p.y)).join(' L')} Z" fill="#b06a36" fill-opacity="0.15" ${st('#b06a36')}/>`;
    etiqueta = S.muebleTpl.nombre;
  }
  // indicador de imán
  if (cur && (DIBUJO.includes(S.tool) || (S.arr && S.arr.tipo === 'asa')) && S.iman) {
    const a = 6 / z, p = cur, col = '#b06a36', w = C(1.5 / z);
    if (S.iman === 'vertice') s += `<rect x="${C(p.x - a)}" y="${C(p.y - a)}" width="${C(2 * a)}" height="${C(2 * a)}" fill="none" stroke="${col}" stroke-width="${w}"/>`;
    else if (S.iman === 'medio') s += `<path d="M${C(p.x)} ${C(p.y - a)} L${C(p.x + a)} ${C(p.y + a)} L${C(p.x - a)} ${C(p.y + a)} Z" fill="none" stroke="${col}" stroke-width="${w}"/>`;
    else if (S.iman === 'linea') s += `<path d="M${C(p.x - a)} ${C(p.y - a)} L${C(p.x + a)} ${C(p.y + a)} M${C(p.x + a)} ${C(p.y - a)} L${C(p.x - a)} ${C(p.y + a)}" stroke="${col}" stroke-width="${w}"/>`;
    else if (S.iman === 'angulo') s += `<circle cx="${C(p.x)}" cy="${C(p.y)}" r="${C(a)}" fill="none" stroke="${col}" stroke-width="${w}"/>`;
    else s += `<circle cx="${C(p.x)}" cy="${C(p.y)}" r="${C(2 / z)}" fill="${col}"/>`;
  }
  // etiqueta flotante
  if (cur && (etiqueta || S.buffer)) {
    const sp = aPantalla(cur);
    el.flot.innerHTML = S.buffer ? `<span class="buf">${esc(S.buffer)}▌</span> m ⏎` : esc(etiqueta);
    el.flot.style.left = sp.x + 'px'; el.flot.style.top = sp.y + 'px'; el.flot.style.display = 'block';
  } else el.flot.style.display = 'none';
  return s;
};
const renderSvg = () => {
  const { w, h } = tam(); const z = S.view.zoom;
  el.svg.setAttribute('viewBox', `${C(S.view.vx)} ${C(S.view.vy)} ${C(w / z)} ${C(h / z)}`);
  renderRejilla(w, h);
  const c = S.doc.calco;
  el.capaCalco.innerHTML = c && c.visible ? G.svgCalco(calcoRender()) : '';
  const dib = G.svgDibujo(D(), { k: 1 / z });
  S.rotulos = dib.rotulos;
  el.capaDib.innerHTML = (dib.defs ? `<defs>${dib.defs}</defs>` : '') + dib.cuerpo;
  el.capaSel.innerHTML = renderSel(z);
  el.capaDraft.innerHTML = renderDraft(z);
  el.zoomInfo.textContent = '1 m = ' + G.fmtNum(z, 0) + ' px';
  const L = G.longitudBonita(160 / z);
  if (L) { $('.t', el.barra).textContent = L >= 1 ? G.fmtNum(L, L % 1 ? 1 : 0) + ' m' : G.fmtNum(L * 100, 0) + ' cm'; $('.l', el.barra).style.width = L * z + 'px'; el.barra.style.display = ''; }
  else el.barra.style.display = 'none';
  const vacio = !S.doc.entidades.length && !S.doc.calco;
  el.inicio.classList.toggle('visible', vacio && !S.inicioOculto);
};

// ── paneles
const COLORES = G.COLORES;
const segBtns = (k, opciones, actual) => `<div class="seg" data-seg="${k}">${opciones.map(([v, t]) => `<button data-v="${v}" class="${v === actual ? 'activo' : ''}">${t}</button>`).join('')}</div>`;
const swatches = (actual) => `<div class="swatches">${COLORES.map((c) => `<span data-color="${c}" class="${c === actual ? 'activo' : ''}" style="background:${c}" title="${c}"></span>`).join('')}</div>`;
const check = (k, texto, v) => `<label class="check"><input type="checkbox" data-k="${k}" ${v ? 'checked' : ''}> ${texto}</label>`;
const estiloHtml = (e) => `<label>peso de línea</label>${segBtns('grosor', [['fino', 'fino'], ['medio', 'medio'], ['grueso', 'grueso']], e.grosor)}
  <label>tipo de línea</label>${segBtns('estilo', [['continua', '———'], ['discontinua', '– – –'], ['punteada', '· · · ·']], e.estilo)}
  <label>color</label>${swatches(e.color)}`;
const rellenoHtml = (e) => `<label>relleno</label>${segBtns('relleno', [['ninguno', 'ninguno'], ['tenue', 'tenue'], ['rayado', 'rayado']], e.relleno || 'ninguno')}`;
// botones de giro de un rótulo concreto (clave) de la pieza elegida
const tamBotones = (key) => `<label>tamaño</label><div class="fila" style="align-items:center"><div class="seg" data-tamr="${key}" style="flex:0 0 auto"><button data-t="-" title="más chico">−</button><button data-t="1" title="tamaño de la sala">100 %</button><button data-t="+" title="más grande">+</button></div><div><input type="text" inputmode="decimal" data-tamexacto="${key}" aria-label="tamaño en porcentaje"></div><span style="flex:0 0 auto">%</span></div>`;
const giroBotones = (key, titulo, auto = 'como su muro') => `<label>${titulo}</label><div class="seg" data-giro="${key}"><button data-g="-90">⟲ 90°</button><button data-g="0">horizontal</button><button data-g="v">vertical</button><button data-g="auto">${auto}</button></div>`;
const panelRotulo = (e, key, ra) => {
  const ov = e.etiq && e.etiq[key];
  let h = `<h3>rótulo · ${esc(ra.texto)}</h3>`;
  h += giroBotones(key, 'giro') + tamBotones(key);
  h += `<div class="fila"><div><label>giro exacto (°)</label><input type="text" inputmode="decimal" data-giroexacto="${key}" value="${G.fmtNum(ra.ang || 0, 0)}"></div></div>`;
  h += `<div class="nota">Arrástralo para moverlo. Doble clic lo devuelve a su sitio, giro y tamaño automáticos.</div>`;
  if (ov) h += `<div class="btns"><button data-acc="etqUna" data-key="${key}">todo automático</button></div>`;
  return h;
};
const NOMBRES = { mueble: 'mobiliario', proyeccion: 'proyección', linea: 'muro / línea', circulo: 'círculo', puerta: 'puerta', ventana: 'ventana', texto: 'texto', cota: 'cota', cuadro: 'cuadro en muro', obra: 'obra en planta', region: 'región' };

const renderPanel = () => {
  const e = ent(); let h = '';
  if (e) {
    const ra = S.rsel && S.rsel.id === e.id ? (S.rotulos || []).find((r) => r.id === e.id && r.key === S.rsel.key) : null;
    if (ra) h += panelRotulo(e, ra.key, ra);
    h += `<h3>${NOMBRES[e.tipo]}</h3>`;
    if (e.tipo === 'linea') {
      const segs = G.segmentos(e);
      h += check('cerrada', 'figura cerrada', e.cerrada) + check('medidas', 'mostrar medidas de cada tramo', e.medidas);
      if (!e.cerrada) h += check('flecha', 'flecha al final (acceso, recorrido)', e.flecha);
      h += `<label>altura del muro (m)</label><input type="text" inputmode="decimal" data-num="altura" value="${e.altura > 0 ? G.fmtNum(e.altura) : ''}" placeholder="sin indicar">`;
      const ph = e.altura > 0 ? G.fmtNum(e.altura) : '—';
      const tieneMuro = (i) => ctx.proyecto.muros.some((m) => m.salaId === S.doc.id && m.tramo && m.tramo.entidadId === e.id && m.tramo.i === i);
      h += `<label>tramos: largo · alto (m) · alzado</label><table class="tramos">${segs.map(([a, b, i]) => `<tr><td>tramo ${i + 1}</td><td><input type="text" inputmode="decimal" data-tramo="${i}" value="${G.fmtNum(G.dist(a, b))}" aria-label="largo del tramo ${i + 1}"></td><td class="alto"><input type="text" inputmode="decimal" data-alto="${i}" value="${e.alturas && e.alturas[i] > 0 ? G.fmtNum(e.alturas[i]) : ''}" placeholder="${ph}" aria-label="alto del tramo ${i + 1}"></td><td class="u"><button data-alzado="${i}" class="${tieneMuro(i) ? 'activo' : ''}" title="${tieneMuro(i) ? 'Abrir el alzado de este tramo' : 'Crear el alzado de este tramo con sus cuadros'}">▭</button></td></tr>`).join('')}</table>`;
      h += `<div class="nota">▭ abre el alzado del tramo en la vista Muro, con sus cuadros ya colocados.</div>`;
      h += `<div class="nota">El alto de un tramo solo hace falta si difiere de la altura del muro.</div>`;
      h += `<div class="nota">Cambiar una medida estira la figura desde el final de ese tramo.</div>`;
      h += `<div class="dato">largo total: <b>${G.fmtM(G.longitudLinea(e))}</b>${e.cerrada && e.pts.length > 2 ? ` · área: <b>${G.fmtM2(G.area(e.pts))}</b>` : ''}</div>`;
      h += `<label>espesor del muro (m)</label><input type="text" inputmode="decimal" data-num="espesor" value="${G.fmtNum(e.espesor > 0 ? e.espesor : 0)}">`;
      if (e.espesor > 0) {
        const cont = !!G.contornoDe(e);
        h += `<label>la línea dibujada es</label>${segBtns('cara', cont ? [['fuera', 'cara interior'], ['centro', 'eje'], ['dentro', 'cara exterior']] : [['fuera', 'una cara'], ['centro', 'eje'], ['dentro', 'la otra cara']], e.cara || 'fuera')}`;
        h += `<div class="nota">${cont ? 'Con «cara interior» el espesor crece hacia fuera: las medidas siguen siendo las de dentro de la sala.' : 'Elige hacia qué lado crece el espesor.'}</div>`;
        h += `<label>relleno del muro</label>${segBtns('muroRelleno', [['gris', 'gris'], ['negro', 'negro'], ['rayado', 'rayado'], ['blanco', 'vacío']], e.muroRelleno || 'gris')}`;
      } else h += `<div class="nota">0 = línea simple. Para una hendidura, dibuja el quiebre del muro (por ejemplo, escribe 0,05 y ⏎) y dale espesor.</div>`;
      h += estiloHtml(e) + (e.cerrada ? rellenoHtml(e) : '');
    } else if (e.tipo === 'circulo') {
      h += `<div class="fila"><div><label>diámetro (m)</label><input type="text" inputmode="decimal" data-num="diametro" value="${G.fmtNum(e.r * 2)}"></div><div><label>alto en 3D (m)</label><input type="text" inputmode="decimal" data-num="alto" value="${e.alto > 0 ? G.fmtNum(e.alto) : ''}" placeholder="muro"></div></div>`;
      h += check('medidas', 'mostrar el diámetro', e.medidas) + estiloHtml(e) + rellenoHtml(e);
    } else if (e.tipo === 'puerta') {
      h += `<label>ancho del vano (m)</label><input type="text" inputmode="decimal" data-num="ancho" value="${G.fmtNum(G.dist(e.a, e.b))}">`;
      h += `<div class="btns"><button data-acc="giro">↻ cambiar giro</button></div>`;
      h += check('medidas', 'mostrar el ancho', e.medidas) + `<label>color</label>${swatches(e.color)}`;
    } else if (e.tipo === 'ventana') {
      h += `<div class="fila"><div><label>ancho (m)</label><input type="text" inputmode="decimal" data-num="ancho" value="${G.fmtNum(G.dist(e.a, e.b))}"></div><div><label>espesor (m)</label><input type="text" inputmode="decimal" data-num="esp" value="${G.fmtNum(e.esp > 0 ? e.esp : 0.15)}"></div></div>`;
      h += `<div class="nota">El espesor es el del muro donde va la ventana.</div>`;
      h += check('medidas', 'mostrar el ancho', e.medidas) + `<label>color</label>${swatches(e.color)}`;
    } else if (e.tipo === 'mueble') {
      h += `<label>nombre</label><input type="text" data-k="nombre" value="${esc(e.nombre || '')}">`;
      h += `<label>categoría</label><select data-mcat>${CATEGORIAS.map(([v, t]) => `<option value="${v}" ${v === e.cat ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
      const num = (k, label, v) => `<div><label>${label}</label><input type="text" inputmode="decimal" data-num="${k}" value="${G.fmtNum(v)}"></div>`;
      h += e.forma === 'cilindro' ? `<div class="fila">${num('ml', 'diámetro (m)', e.l)}${num('mh', 'alto (m)', e.h)}</div>` : `<div class="fila">${num('ml', 'largo (m)', e.l)}${num('ma', 'ancho (m)', e.a)}${num('mh', 'alto (m)', e.h)}</div>`;
      h += `<div class="fila"><div><label>giro (°)</label><input type="text" inputmode="decimal" data-num="mrot" value="${G.fmtNum(e.rot || 0, 0)}"></div><div><label>elevación (m)</label><input type="text" inputmode="decimal" data-num="mdz" value="${G.fmtNum(e.dz || 0)}" title="Altura de la base sobre el piso (0 = apoyado)"></div></div>`;
      h += `<div class="btns"><button data-acc="rot90">⟲ 90°</button><button data-acc="rot0">sin giro</button></div>`;
      if (e.partes) h += `<div class="nota">Objeto compuesto (${e.partes.length} piezas): las medidas escalan el conjunto.</div>`;
      h += `<label>color</label>${swatches(e.color)}`;
      h += `<div class="btns"><button data-acc="bibGuardar" title="Guardar este objeto con sus medidas en «Mi biblioteca»">guardar en mi biblioteca</button></div>`;
    } else if (e.tipo === 'texto') {
      h += `<label>texto</label><textarea data-k="texto" rows="3">${esc(e.texto)}</textarea>`;
      h += `<div class="fila"><div><label>tamaño (m)</label><input type="text" inputmode="decimal" data-num="tam" value="${G.fmtNum(e.tam)}"></div><div><label>giro (°)</label><input type="text" inputmode="decimal" data-num="rot" value="${G.fmtNum(e.rot || 0, 0)}"></div></div>`;
      h += `<div class="btns"><button data-acc="rot90">⟲ 90°</button><button data-acc="rot0">horizontal</button></div><label>color</label>${swatches(e.color)}`;
    } else if (G.esObra(e)) {
      const o = obraDe(e);
      if (!o) h += `<div class="nota">Este ${e.tipo === 'cuadro' ? 'cuadro' : 'elemento'} no tiene obra asociada (se borró de la lista). <button data-acc="crearObra">crear ficha</button> o elige una de la lista más abajo.</div>`;
      const txt = (k, label, ph = '') => `<label>${label}</label><input type="text" data-ok="${k}" value="${esc(o ? o[k] || '' : '')}" placeholder="${ph}"${o ? '' : ' disabled'}>`;
      h += `<div class="fila"><div style="flex:0 0 64px"><label>nº</label><input type="text" data-k="num" value="${esc(e.num ?? '')}"></div><div>${txt('nombre', 'título', 'sin título')}</div></div>`;
      h += txt('autor', 'autor') + `<div class="fila"><div style="flex:0 0 64px">${txt('anio', 'año')}</div><div>${txt('tecnica', 'técnica')}</div></div>`;
      const dim = (k, label) => `<div><label>${label}</label><input type="text" inputmode="decimal" data-odim="${k}" value="${o && o[k] > 0 ? G.fmtNum(o[k]) : ''}" placeholder="?"${o ? '' : ' disabled'}></div>`;
      h += `<div class="fila">${dim('ancho', 'ancho (m)')}${dim('alto', 'alto (m)')}</div>`;
      if (o && (o.estimado.ancho || o.estimado.alto)) h += `<div class="nota">≈ medida estimada: escribe la real para confirmarla.</div>`;
      h += `<label>nota</label><textarea data-ok="nota" rows="2">${esc(o ? o.nota || '' : '')}</textarea>`;
      const otras = ctx.proyecto.obras.filter((x) => x !== o);
      if (otras.length) h += `<label>es otra obra de la lista</label><select data-cambiar-obra><option value="">— mantener —</option>${otras.map((x) => `<option value="${x.id}">${esc(x.nombre || 'sin título')}${x.autor ? ' · ' + esc(x.autor) : ''}</option>`).join('')}</select>`;
      h += check('verTitulo', 'mostrar el título en el plano', e.verTitulo);
      if (e.tipo === 'cuadro') {
        h += `<label>ancho en el muro (m)</label><input type="text" inputmode="decimal" data-num="ancho" value="${G.fmtNum(G.dist(e.a, e.b))}">`;
        h += check('medidas', 'mostrar el ancho', e.medidas) + `<div class="btns"><button data-acc="cara">⇄ cambiar de cara del muro</button></div>`;
      } else h += `<div class="fila"><div><label>alto en 3D (m)</label><input type="text" inputmode="decimal" data-num="alto" value="${e.alto > 0 ? G.fmtNum(e.alto) : ''}" placeholder="1,00"></div><div class="dato" style="margin-top:22px">ocupa <b>${G.fmtM2(G.area(e.pts))}</b></div></div>` + giroBotones('N', 'giro del número', 'sin giro') + tamBotones('N');
      const r = G.regionDe(D(), e); h += `<div class="dato">región: <b>${r ? esc(r.nombre) : '—'}</b></div>`;
      h += `<label>color</label>${swatches(e.color)}`;
    } else if (e.tipo === 'proyeccion') {
      const g = G.proyGeom(e, S.doc.entidades);
      const num = (k, label, v, dec = 2) => `<div><label>${label}</label><input type="text" inputmode="decimal" data-num="${k}" value="${G.fmtNum(v, dec)}"></div>`;
      h += `<label>nombre</label><input type="text" data-k="nombre" value="${esc(e.nombre || '')}">`;
      h += `<label>formato de imagen</label>${segBtns('formato', [['16:9', '16:9'], ['16:10', '16:10'], ['4:3', '4:3'], ['1:1', '1:1'], ['libre', 'libre']], e.formato || '16:9')}`;
      h += `<div class="fila">${num('pAncho', 'ancho imagen (m)', g.w)}${num('pAlto', 'alto imagen (m)', g.alto)}</div>`;
      h += `<div class="fila">${num('pDist', 'distancia (m)', g.dist)}${num('pTiro', 'relación de tiro', g.tiro)}</div>`;
      h += `<div class="nota">Tiro = distancia ÷ ancho de imagen. Escribe el de tu proyector y se coloca a la distancia justa para este ancho.</div>`;
      h += `<label>cuerpo del proyector</label><div class="fila">${num('pLargo', 'largo (m)', e.largo > 0 ? e.largo : 0.4)}${num('pCuerpo', 'ancho (m)', e.anchoCuerpo > 0 ? e.anchoCuerpo : 0.3)}</div>`;
      h += check('verHaz', 'mostrar el haz', e.verHaz !== false) + check('verDatos', 'mostrar medidas y tiro', e.verDatos !== false);
      h += `<label>nota</label><textarea data-k="nota" rows="2" placeholder="modelo, altura de montaje…">${esc(e.nota || '')}</textarea>`;
      h += `<label>color</label>${swatches(e.color)}`;
    } else if (e.tipo === 'region') {
      h += `<label>nombre</label><input type="text" data-k="nombre" value="${esc(e.nombre || '')}">`;
      h += giroBotones('R', 'giro del nombre', 'sin giro') + tamBotones('R');
      h += check('conteo', 'mostrar el número de obras', e.conteo !== false) + check('verArea', 'mostrar el área', e.verArea);
      if (e.etq) h += `<div class="btns"><button data-acc="etqCentro">centrar el nombre</button></div>`; else h += `<div class="nota">Arrastra el nombre en el plano para moverlo a un lugar libre.</div>`;
      const os = G.obrasEn(D(), e).sort(G.ordenNatural);
      h += `<div class="dato">área: <b>${G.fmtM2(G.area(e.pts))}</b> · ${os.length} obra${os.length === 1 ? '' : 's'}</div>`;
      if (os.length) h += `<div class="nota">${os.map((o) => `${esc(o.num)}${o.titulo ? ' · ' + esc(o.titulo) : ''}`).join('<br>')}</div>`;
      h += `<label>color</label>${swatches(e.color)}`;
    } else if (e.tipo === 'cota') {
      const g = G.cotaGeom(e);
      h += `<label>${g.tramos.length > 1 ? 'tramos encadenados (m)' : 'medida (m)'}</label><table class="tramos">${g.tramos.map((t, i) => `<tr><td>tramo ${i + 1}</td><td><input type="text" inputmode="decimal" data-ctramo="${i}" value="${G.fmtNum(t.L)}"></td><td class="u">m</td></tr>`).join('')}</table>`;
      if (g.tramos.length > 1) h += `<div class="dato">total: <b>${G.fmtM(g.total)}</b></div>` + check('total', 'mostrar también la cota total', e.total);
      h += `<div class="nota">Para seguir la cadena, elige la herramienta Cota y haz clic en el último punto.</div>`;
      h += `<label>separación del muro (m)</label><input type="text" inputmode="decimal" data-num="desp" value="${G.fmtNum(e.desp || 0)}">`;
      h += `<label>prefijo (opcional)</label><input type="text" data-k="texto" value="${esc(e.texto || '')}" placeholder="p. ej. vano">`;
      h += `<label>color</label>${swatches(e.color)}`;
    }
    if (e.etiq && Object.keys(e.etiq).length) h += `<div class="btns"><button data-acc="etqAuto">rótulos en posición automática</button></div>`;
    h += `<div class="btns"><button data-acc="duplicar">duplicar</button><button data-acc="frente">al frente</button><button data-acc="borrar" class="peligro">borrar</button></div>`;
  } else {
    const d = D();
    h += `<h3>sala</h3>`;
    h += `<label>tamaño de los rótulos (m)</label><input type="text" inputmode="decimal" data-doc="rotulo" value="${G.fmtNum(d.rotulo)}">`;
    h += `<div class="nota">Altura de las medidas y cotas. Con 0,20 m se leen bien en salas de 5 a 15 m.</div>`;
    h += `<label>ajuste a la rejilla</label><select data-doc="rejilla">${[[0, 'sin ajuste'], [0.01, '1 cm'], [0.05, '5 cm'], [0.1, '10 cm'], [0.25, '25 cm'], [0.5, '50 cm']].map(([v, t]) => `<option value="${v}" ${v === d.rejilla ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
    h += `<label class="check"><input type="checkbox" data-doc="imanes" ${d.imanes ? 'checked' : ''}> imán a puntos y muros</label>`;
    h += `<div class="nota">Las medidas se colocan solas evitando choques. Para mover una, arrástrala con «Elegir»; doble clic la devuelve.</div>`;
    if (d.entidades.some((x) => x.etiq && Object.keys(x.etiq).length)) h += `<div class="btns"><button data-acc="etqTodas">recolocar todos los rótulos</button></div>`;
    const cerradas = d.entidades.filter((x) => x.tipo === 'linea' && x.cerrada && x.pts.length > 2);
    if (cerradas.length) { const mayor = cerradas.reduce((a, b) => (G.area(b.pts) > G.area(a.pts) ? b : a)); h += `<div class="dato">figura mayor: <b>${G.fmtM2(G.area(mayor.pts))}</b> · perímetro <b>${G.fmtM(G.longitudLinea(mayor))}</b></div>`; }
    h += `<div class="dato">${d.entidades.length} elemento${d.entidades.length === 1 ? '' : 's'}</div>`;
    // biblioteca de objetos
    h += `<h3>biblioteca</h3><select data-bibcat>${CATEGORIAS.map(([v, t]) => `<option value="${v}" ${v === S.bibCat ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
    const items = S.bibCat === 'propios' ? ctx.proyecto.biblioteca : CATALOGO.filter((c) => c.cat === S.bibCat);
    if (!items.length) h += `<div class="nota">${S.bibCat === 'propios' ? 'Vacía. Selecciona un mueble colocado y pulsa «guardar en mi biblioteca».' : 'Nada en esta categoría.'}</div>`;
    else h += `<ul class="obras bib">${items.map((it) => `<li data-bib="${esc(it.id)}" title="Clic y luego clic en la planta donde va"><span>${esc(it.nombre)}</span>${S.bibCat === 'propios' ? `<button class="mini peligro" data-bibdel="${esc(it.id)}" title="Quitar de mi biblioteca">×</button>` : ''}</li>`).join('')}</ul>`;
    h += `<div class="btns"><button data-acc="csvMob" title="Lista de mobiliario por sala con cantidades">Materiales (CSV)</button><button data-acc="bibExportar" title="Descargar mi biblioteca como .json">exportar biblioteca</button><button data-acc="bibImportar" title="Añadir objetos desde un .json de biblioteca">importar</button></div>`;
    const nMuebles = d.entidades.filter(G.esMueble).length; if (nMuebles) h += `<div class="dato">${nMuebles} objeto${nMuebles === 1 ? '' : 's'} de mobiliario en esta sala</div>`;
    const obras = d.entidades.filter(G.esObra).sort(G.ordenNatural);
    const sueltas = M.obrasSinColocar(ctx.proyecto).length;
    h += `<h3>obras en esta sala · ${obras.length}</h3>`;
    if (sueltas) h += `<div class="nota">${sueltas} obra${sueltas === 1 ? '' : 's'} de la lista sin colocar: elígela en «Obras» y pulsa «colocar en planta».</div>`;
    if (!obras.length) h += `<div class="nota">Usa «Cuadro» para obras colgadas y «Obra» para esculturas, instalaciones o vitrinas.</div>`;
    else {
      h += `<ul class="obras">${obras.map((o) => { const r = G.regionDe(d, o); return `<li data-obra="${o.id}"><b>${esc(o.num)}</b> <span>${esc(o.titulo || 'sin título')}${o.artista ? ' · ' + esc(o.artista) : ''}</span>${r ? `<i>${esc(r.nombre)}</i>` : ''}</li>`; }).join('')}</ul>`;
      h += `<div class="btns"><button data-acc="csvObras">Lista de obras (CSV)</button></div>`;
    }
  }
  // calco
  const c = S.doc.calco;
  h += `<h3>calco · papel de cebolla</h3>`;
  if (!c) h += `<div class="nota">Sube un plano, croquis o foto y dibuja encima a escala.</div><div class="btns"><button data-acc="calcoSubir" class="primario">Subir imagen…</button></div>`;
  else {
    h += `<label>opacidad <span id="opVal">${Math.round(c.opacidad * 100)} %</span></label><input type="range" min="5" max="100" step="1" data-calco="opacidad" value="${Math.round(c.opacidad * 100)}">`;
    h += `<label class="check"><input type="checkbox" data-calco="visible" ${c.visible ? 'checked' : ''}> visible</label>`;
    h += c.calibrado ? `<div class="dato">escala: <b>1 m = ${G.fmtNum(1 / c.mpp, 1)} px</b> de la imagen</div>` : `<div class="dato" style="color:var(--rojo)">sin calibrar: sus medidas aún no son reales</div>`;
    h += `<div class="btns"><button data-acc="calibrar" class="${c.calibrado ? '' : 'primario'}">⊢ calibrar medida</button><button data-acc="calcoMover" class="${S.tool === 'calco' ? 'activo' : ''}">✥ mover</button></div>`;
    h += `<label>giro de la imagen (°)</label><input type="text" inputmode="decimal" data-calco="rot" value="${G.fmtNum(c.rot || 0, 1)}">`;
    h += `<div class="btns"><button data-acc="calcoQuitar" class="peligro">quitar calco</button></div>`;
  }
  el.panel.innerHTML = h;
  enlazarPanel(e);
};
const enlazarPanel = (e) => {
  const P = el.panel; let snapCampo = false;
  const unaVez = () => { if (!snapCampo) { snap(); snapCampo = true; } };
  $$('input,textarea,select', P).forEach((i) => i.addEventListener('focus', () => { snapCampo = false; }));
  // estilo
  $$('[data-seg]', P).forEach((g) => $$('button', g).forEach((b) => b.addEventListener('click', () => {
    if (!e) return; snap();
    if (g.dataset.seg === 'formato' && b.dataset.v === 'libre' && e.tipo === 'proyeccion') e.alto = G.r6(G.proyGeom(e).alto);
    e[g.dataset.seg] = b.dataset.v; cambio();
  })));
  $$('.swatches span', P).forEach((s) => s.addEventListener('click', () => { if (!e) return; snap(); e.color = s.dataset.color; cambio(); }));
  $$('input[type=checkbox][data-k]', P).forEach((i) => i.addEventListener('change', () => {
    snap(); const k = i.dataset.k; e[k] = i.checked;
    if (k === 'cerrada' && e.cerrada && e.pts.length < 3) { e.cerrada = false; mensaje('Una figura cerrada necesita al menos tres puntos', true); }
    cambio();
  }));
  $$('textarea[data-k],input[type=text][data-k]', P).forEach((i) => i.addEventListener('input', () => { unaVez(); e[i.dataset.k] = i.value; pedirRender(); autosave(); }));
  // ficha de la obra (vive en el proyecto, no en la entidad)
  $$('[data-ok]', P).forEach((i) => i.addEventListener('input', () => {
    const o = obraDe(e); if (!o) return; unaVez(); o[i.dataset.ok] = i.value; pedirRender(); autosave(); if (ctx.onObraCambiada) ctx.onObraCambiada(o.id);
  }));
  $$('[data-odim]', P).forEach((i) => {
    const aplicar = () => {
      const o = obraDe(e); if (!o) return; const k = i.dataset.odim; const txt = String(i.value).trim(); const v = G.parseNum(txt);
      if (txt && !(v > 0)) { mensaje('Medida no válida', true); renderPanel(); return; }
      snap(); o[k] = txt ? G.r6(v) : null; o.estimado[k] = !txt;
      if (k === 'ancho' && e.tipo === 'cuadro' && v > 0) { const d = G.unit(G.sub(e.b, e.a)); e.b = { x: G.r6(e.a.x + d.x * v), y: G.r6(e.a.y + d.y * v) }; }
      cambio(); if (ctx.onObraCambiada) ctx.onObraCambiada(o.id);
    };
    i.addEventListener('change', aplicar);
    i.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); i.blur(); } });
  });
  $$('[data-cambiar-obra]', P).forEach((s) => s.addEventListener('change', () => {
    const o = M.obraDe(ctx.proyecto, s.value); if (!o) return;
    snap(); e.obraId = o.id;
    if (e.tipo === 'cuadro' && o.ancho > 0) { const d = G.unit(G.sub(e.b, e.a)); e.b = { x: G.r6(e.a.x + d.x * o.ancho), y: G.r6(e.a.y + d.y * o.ancho) }; }
    cambio(); if (ctx.onObraCambiada) ctx.onObraCambiada(o.id);
  }));
  // tramos
  $$('[data-ctramo]', P).forEach((i) => {
    const t = +i.dataset.ctramo;
    const aplicar = () => {
      const v = G.parseNum(i.value); if (!(v > 0)) { mensaje('Medida no válida', true); renderPanel(); return; }
      const g = G.cotaGeom(e); if (Math.abs(g.tramos[t].L - v) < 1e-9) return;
      const nuevos = G.estirarCota(e, t, v); if (!nuevos) return;
      snap(); e.pts = nuevos; delete e.a; delete e.b; cambio();
    };
    i.addEventListener('change', aplicar);
    i.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); i.blur(); } });
  });
  $$('[data-alzado]', P).forEach((b) => {
    b.addEventListener('mouseenter', () => { S.tramo = +b.dataset.alzado; pedirRender(); });
    b.addEventListener('mouseleave', () => { S.tramo = null; pedirRender(); });
    b.addEventListener('click', () => { S.tramo = null; pedirRender(); if (ctx.onAbrirAlzado) ctx.onAbrirAlzado(S.doc, e, +b.dataset.alzado); });
  });
  $$('[data-alto]', P).forEach((i) => {
    const t = +i.dataset.alto;
    i.addEventListener('focus', () => { S.tramo = t; pedirRender(); });
    i.addEventListener('blur', () => { S.tramo = null; pedirRender(); });
    i.addEventListener('change', () => {
      const txt = String(i.value).trim(); const v = G.parseNum(txt);
      if (txt && !(v > 0)) { mensaje('Altura no válida', true); renderPanel(); return; }
      snap(); e.alturas = { ...(e.alturas || {}) };
      if (txt && !(e.altura > 0 && Math.abs(v - e.altura) < 1e-9)) e.alturas[t] = v; else delete e.alturas[t];
      if (!Object.keys(e.alturas).length) delete e.alturas;
      cambio();
    });
    i.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); i.blur(); } });
  });
  $$('[data-tramo]', P).forEach((i) => {
    const t = +i.dataset.tramo;
    i.addEventListener('focus', () => { S.tramo = t; pedirRender(); });
    i.addEventListener('blur', () => { S.tramo = null; aplicarTramo(i, e, t); });
    i.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); aplicarTramo(i, e, t); i.select(); } });
  });
  // números de pieza
  $$('[data-num]', P).forEach((i) => {
    const aplicar = () => {
      const v = G.parseNum(i.value); const k = i.dataset.num;
      if (k === 'altura' && String(i.value).trim() === '') { snap(); delete e.altura; cambio(); return; }
      if (k === 'alto') { const txt = String(i.value).trim(); if (txt && !(v > 0)) { mensaje('Medida no válida', true); renderPanel(); return; } snap(); if (txt) e.alto = v; else delete e.alto; cambio(); return; }
      if (k === 'mrot') { if (!Number.isFinite(v)) { renderPanel(); return; } snap(); e.rot = ((v % 360) + 360) % 360; cambio(); return; }
      if (k === 'mdz') { if (!(v >= 0)) { mensaje('Medida no válida', true); renderPanel(); return; } snap(); e.dz = G.r6(v); cambio(); return; }
      if (k === 'ml' || k === 'ma' || k === 'mh') {
        if (!(v > 0)) { mensaje('Medida no válida', true); renderPanel(); return; }
        snap(); const prop = k === 'ml' ? 'l' : k === 'ma' ? 'a' : 'h'; const f = v / e[prop];
        if (e.partes) for (const pz of e.partes) { pz[prop] *= f; if (prop === 'l') pz.dx *= f; if (prop === 'a') pz.dy *= f; if (prop === 'h') pz.dz = (pz.dz || 0) * f; }
        e[prop] = G.r6(v); if (e.forma === 'cilindro' && prop === 'l') e.a = e.l; cambio(); return;
      }
      if (!Number.isFinite(v) || (k === 'altura' && v < 0) || ((k === 'diametro' || k === 'ancho' || k === 'tam' || k === 'largo' || k === 'esp' || /^p[A-Z]/.test(k)) && !(v > 0)) || (k === 'espesor' && v < 0)) { mensaje('Medida no válida', true); renderPanel(); return; }
      snap();
      if (k === 'diametro') e.r = v / 2;
      else if (k === 'ancho' || k === 'largo') { const d = G.unit(G.sub(e.b, e.a)); e.b = { x: G.r6(e.a.x + d.x * v), y: G.r6(e.a.y + d.y * v) }; const o = e.tipo === 'cuadro' ? obraDe(e) : null; if (o) { o.ancho = G.r6(v); o.estimado.ancho = false; if (ctx.onObraCambiada) ctx.onObraCambiada(o.id); } }
      else if (k === 'tam') e.tam = v;
      else if (k === 'rot') e.rot = v;
      else if (k === 'desp') e.desp = v;
      else if (k === 'esp') e.esp = v;
      else if (k === 'pAncho') Object.assign(e, G.proyConAncho(e, v));
      else if (k === 'pAlto') { const g = G.proyGeom(e); if (e.formato === 'libre') e.alto = v; else Object.assign(e, G.proyConAncho(e, v * g.asp)); }
      else if (k === 'pDist') e.p = G.proyConDistancia(e, v);
      else if (k === 'pTiro') e.p = G.proyConDistancia(e, v * G.proyGeom(e).w);
      else if (k === 'pLargo') e.largo = v;
      else if (k === 'pCuerpo') e.anchoCuerpo = v;
      else if (k === 'altura') { if (v > 0) e.altura = v; else delete e.altura; }
      else if (k === 'espesor') { e.espesor = v; if (v > 0) { e.cara ||= 'fuera'; e.muroRelleno ||= 'gris'; } }
      cambio();
    };
    i.addEventListener('change', aplicar);
    i.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); i.blur(); } });
  });
  // sala
  $$('[data-doc]', P).forEach((i) => i.addEventListener('change', () => {
    const k = i.dataset.doc;
    if (k === 'imanes') S.doc.imanes = i.checked;
    else if (k === 'rejilla') S.doc.rejilla = parseFloat(i.value) || 0;
    else if (k === 'rotulo') { const v = G.parseNum(i.value); if (!(v > 0)) { mensaje('Tamaño no válido', true); renderPanel(); return; } snap(); S.doc.rotulo = v; }
    cambio();
  }));
  // calco
  const c = S.doc.calco;
  $$('[data-calco]', P).forEach((i) => {
    const k = i.dataset.calco;
    if (k === 'opacidad') i.addEventListener('input', () => { c.opacidad = (+i.value) / 100; $('#opVal').textContent = i.value + ' %'; const img = el.capaCalco.querySelector('image'); if (img) img.setAttribute('opacity', c.opacidad); });
    if (k === 'opacidad') i.addEventListener('change', autosave);
    if (k === 'visible') i.addEventListener('change', () => { c.visible = i.checked; cambio(); });
    if (k === 'rot') i.addEventListener('change', () => { const v = G.parseNum(i.value); if (!Number.isFinite(v)) { renderPanel(); return; } snap(); c.rot = v; cambio(); });
  });
  $$('[data-acc]', P).forEach((b) => b.addEventListener('click', () => accion(b.dataset.acc, e, b)));
  // giro de rótulos
  const fijarGiro = (key, ang) => {
    snap(); e.etiq = { ...(e.etiq || {}) }; const prev = e.etiq[key] || {};
    if (ang === null) { const { ang: _, ...resto } = prev; if (Number.isFinite(resto.u)) e.etiq[key] = resto; else delete e.etiq[key]; }
    else e.etiq[key] = { ...prev, ang: ((ang % 360) + 540) % 360 - 180 };
    if (!Object.keys(e.etiq).length) delete e.etiq; cambio();
  };
  const giroActual = (key) => { const r = (S.rotulos || []).find((x) => x.id === e.id && x.key === key); return r ? r.ang || 0 : 0; };
  $$('[data-giro]', P).forEach((g) => $$('button', g).forEach((b) => b.addEventListener('click', () => {
    const key = g.dataset.giro; const v = b.dataset.g;
    if (v === 'auto') fijarGiro(key, null); else if (v === 'v') fijarGiro(key, -90); else if (v === '0') fijarGiro(key, 0); else fijarGiro(key, giroActual(key) - 90);
  })));
  // tamaño por rótulo
  const PASOS_T = [0.5, 0.6, 0.75, 0.9, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  const escActual = (key) => { const v = e.etiq && e.etiq[key] && e.etiq[key].esc; return v > 0 ? v : 1; };
  const fijarEsc = (key, v) => {
    snap(); e.etiq = { ...(e.etiq || {}) }; const prev = { ...(e.etiq[key] || {}) };
    if (!(v > 0) || Math.abs(v - 1) < 1e-9) delete prev.esc; else prev.esc = G.clamp(v, 0.3, 5);
    if (Object.keys(prev).length) e.etiq[key] = prev; else delete e.etiq[key];
    if (!Object.keys(e.etiq).length) delete e.etiq; cambio();
  };
  $$('[data-tamr]', P).forEach((g) => $$('button', g).forEach((b) => b.addEventListener('click', () => {
    const key = g.dataset.tamr; const t = b.dataset.t; const v = escActual(key);
    if (t === '1') fijarEsc(key, 1);
    else if (t === '+') fijarEsc(key, PASOS_T.find((x) => x > v + 1e-9) || v * 1.25);
    else fijarEsc(key, [...PASOS_T].reverse().find((x) => x < v - 1e-9) || v / 1.25);
  })));
  $$('[data-tamexacto]', P).forEach((i) => {
    i.value = G.fmtNum(escActual(i.dataset.tamexacto) * 100, 0);
    i.addEventListener('change', () => { const v = G.parseNum(i.value); if (!(v > 0)) { renderPanel(); return; } fijarEsc(i.dataset.tamexacto, v / 100); });
  });
  $$('[data-giroexacto]', P).forEach((i) => i.addEventListener('change', () => { const v = G.parseNum(i.value); if (!Number.isFinite(v)) { renderPanel(); return; } fijarGiro(i.dataset.giroexacto, v); }));
  $$('[data-obra]', P).forEach((li) => li.addEventListener('click', () => { S.sel = li.dataset.obra; S.vsel = null; render(); }));
  // biblioteca
  $$('[data-bibcat]', P).forEach((sel) => sel.addEventListener('change', () => { S.bibCat = sel.value; renderPanel(); }));
  $$('[data-bib]', P).forEach((li) => li.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-bibdel]')) return;
    const id = li.dataset.bib; const tpl = (S.bibCat === 'propios' ? ctx.proyecto.biblioteca : CATALOGO).find((x) => x.id === id); if (!tpl) return;
    S.muebleTpl = tpl; S.muebleRot = 0; setTool('mueble');
  }));
  $$('[data-bibdel]', P).forEach((b) => b.addEventListener('click', () => {
    const i = ctx.proyecto.biblioteca.findIndex((x) => x.id === b.dataset.bibdel); if (i < 0) return;
    if (!confirm(`¿Quitar «${ctx.proyecto.biblioteca[i].nombre}» de tu biblioteca?`)) return;
    ctx.proyecto.biblioteca.splice(i, 1); autosave(); renderPanel();
  }));
  $$('[data-mcat]', P).forEach((sel) => sel.addEventListener('change', () => { if (!e) return; snap(); e.cat = sel.value; cambio(); }));
};
const aplicarTramo = (i, e, t) => {
  if (!e || !ent(e.id)) return;
  const v = G.parseNum(i.value); const sg = G.segmentos(e).find((x) => x[2] === t); if (!sg) return;
  const actual = G.dist(sg[0], sg[1]);
  if (!(v > 0)) { i.value = G.fmtNum(actual); mensaje('Medida no válida', true); return; }
  if (Math.abs(v - actual) < 1e-9) return;
  const nuevos = G.estirarTramo(e.pts, t, e.cerrada, v); if (!nuevos) return;
  snap(); e.pts = nuevos; autosave(); renderSvg();
  $$('[data-tramo]', el.panel).forEach((inp) => { const s = G.segmentos(e).find((x) => x[2] === +inp.dataset.tramo); if (s && inp !== document.activeElement) inp.value = G.fmtNum(G.dist(s[0], s[1])); });
  i.value = G.fmtNum(v);
  const d = $('.dato', el.panel); if (d) d.innerHTML = `largo total: <b>${G.fmtM(G.longitudLinea(e))}</b>${e.cerrada && e.pts.length > 2 ? ` · área: <b>${G.fmtM2(G.area(e.pts))}</b>` : ''}`;
};
const accion = (acc, e, btn = null) => {
  if (acc === 'borrar') borrarSel();
  else if (acc === 'duplicar') duplicar();
  else if (acc === 'frente') { snap(); S.doc.entidades = S.doc.entidades.filter((x) => x !== e).concat(e); cambio(); }
  else if (acc === 'giro') { snap(); Object.assign(e, G.siguienteGiro(e)); cambio(); }
  else if (acc === 'rot90') { snap(); e.rot = (((e.rot || 0) - 90) % 360 + 360) % 360; if (e.rot > 180) e.rot -= 360; cambio(); }
  else if (acc === 'rot0') { snap(); e.rot = 0; cambio(); }
  else if (acc === 'etqUna') { const key = btn ? btn.dataset.key : null; if (key && e.etiq) { snap(); delete e.etiq[key]; if (!Object.keys(e.etiq).length) delete e.etiq; cambio(); } }
  else if (acc === 'etqAuto') { snap(); delete e.etiq; cambio(); }
  else if (acc === 'etqTodas') { snap(); S.doc.entidades.forEach((x) => { delete x.etiq; }); cambio(); mensaje('Rótulos recolocados automáticamente'); }
  else if (acc === 'etqCentro') { snap(); delete e.etq; cambio(); }
  else if (acc === 'cara') { snap(); e.lado = e.lado === -1 ? 1 : -1; cambio(); }
  else if (acc === 'crearObra') { if (!e || !G.esObra(e) || obraDe(e)) return; snap(); S.obraPendiente = null; asignarObra(e); cambio(); }
  else if (acc === 'csvObras') exportarCsvObras();
  else if (acc === 'csvMob') { if (!ctx.proyecto.salas.some((x) => x.entidades.some(G.esMueble))) return mensaje('Todavía no hay mobiliario', true); descargar(new Blob(['\ufeff' + csvMobiliario(ctx.proyecto)], { type: 'text/csv;charset=utf-8' }), nombreArchivo() + '-materiales.csv'); mensaje('Lista de materiales exportada'); }
  else if (acc === 'bibGuardar') { if (!e || e.tipo !== 'mueble') return; const n = prompt('Nombre en tu biblioteca', e.nombre); if (!n) return; ctx.proyecto.biblioteca.push({ ...entradaDesde(e, M.nuevoId('b')), nombre: n.trim() || e.nombre }); autosave(); mensaje(`«${n}» guardado en tu biblioteca`); }
  else if (acc === 'bibExportar') { if (!ctx.proyecto.biblioteca.length) return mensaje('Tu biblioteca está vacía', true); descargar(new Blob([JSON.stringify({ app: 'museodraft-biblioteca', version: 1, objetos: ctx.proyecto.biblioteca })], { type: 'application/json' }), 'biblioteca.json'); mensaje('Biblioteca exportada'); }
  else if (acc === 'bibImportar') { const f = document.createElement('input'); f.type = 'file'; f.accept = 'application/json,.json'; f.addEventListener('change', () => { const file = f.files[0]; if (!file) return; const fr = new FileReader(); fr.onload = () => { try { const d = JSON.parse(fr.result); const lista = Array.isArray(d) ? d : Array.isArray(d.objetos) ? d.objetos : null; if (!lista) throw new Error('El archivo no es una biblioteca'); let n = 0; for (const it of lista) if (it && it.l > 0 && it.a > 0 && it.h > 0 && it.nombre) { ctx.proyecto.biblioteca.push({ ...it, id: M.nuevoId('b'), cat: 'propios' }); n++; } autosave(); S.bibCat = 'propios'; renderPanel(); mensaje(`${n} objeto${n === 1 ? '' : 's'} añadido${n === 1 ? '' : 's'} a tu biblioteca`); } catch (err) { mensaje(err.message, true); } }; fr.readAsText(file); }); f.click(); }
  else if (acc === 'calcoSubir') abrirCalco();
  else if (acc === 'calibrar') { setTool('calibrar'); guia('Calibrar', 'Haz clic en dos puntos de la imagen cuya distancia real conozcas (por ejemplo, los extremos de una pared acotada) y escribe cuántos metros mide.'); }
  else if (acc === 'calcoMover') setTool(S.tool === 'calco' ? 'select' : 'calco');
  else if (acc === 'calcoQuitar') { if (confirm('¿Quitar la imagen de calco? Lo que dibujaste se queda.')) { snap(); S.doc.calco = null; if (S.tool === 'calco' || S.tool === 'calibrar') S.tool = 'select'; guia(null); cambio(); } }
};

// ── barra inferior: pistas por herramienta
const pistaTexto = () => {
  const d = S.draft, t = S.tool;
  if (t === 'select') {
    const e = ent();
    if (!e) return 'Clic en un elemento para elegirlo · arrastra un número para moverlo (doble clic lo devuelve) · arrastra el fondo para desplazarte';
    if (e.tipo === 'region') return 'Arrastra el nombre para moverlo solo · arrastra el borde para mover la región · puntos naranjas: contorno · Supr borra';
    if (e.tipo === 'obra' || e.tipo === 'region') return 'Arrastra para mover · los puntos naranjas ajustan el contorno · doble clic en un borde añade un punto · Supr borra';
    if (e.tipo === 'linea') return 'Arrastra los puntos naranjas · doble clic sobre un tramo añade un punto · Supr borra el punto marcado · flechas mueven';
    return 'Arrastra para mover · los puntos naranjas ajustan la forma · Supr borra';
  }
  if (t === 'linea') return d ? 'Clic: siguiente punto · escribe una medida y ⏎ · Shift: 15° · clic en el primer punto cierra · doble clic o ⏎ termina' : 'Clic donde empieza el muro';
  if (t === 'rect') return d ? 'Clic en la esquina opuesta · o escribe «3x2» y ⏎' : 'Clic en una esquina (o arrastra)';
  if (t === 'circulo') return d ? 'Clic en el borde · o escribe el diámetro y ⏎' : 'Clic en el centro';
  if (t === 'proyeccion') return !d ? 'Clic en un extremo de la imagen, sobre el muro o la pantalla' : d.puntos.length === 1 ? 'Clic en el otro extremo de la imagen · o escribe su ancho y ⏎' : 'Clic donde va el proyector (la lente) · o escribe la distancia y ⏎';
  if (t === 'cuadro') return d ? 'Clic en el otro extremo del cuadro · o escribe su ancho y ⏎' : 'Clic en un extremo del cuadro, sobre el muro o panel donde cuelga';
  if (t === 'obra' || t === 'region') return d ? 'Clic: siguiente punto · escribe una medida y ⏎ · Shift: 15° · clic en el primer punto, doble clic o ⏎ cierra' : (t === 'obra' ? 'Clic en el primer punto del contorno de la obra' : 'Clic en el primer punto de la región');
  if (t === 'puerta') return d ? 'Clic en el otro extremo del vano · o escribe el ancho y ⏎' : 'Clic en un extremo del vano, sobre el muro';
  if (t === 'ventana') return d ? 'Clic en el otro extremo de la ventana · o escribe el ancho y ⏎' : 'Clic en un extremo de la ventana, sobre el muro';
  if (t === 'texto') return 'Clic donde va el texto; escribe en el panel derecho';
  if (t === 'mueble') return S.muebleTpl ? 'Clic donde va «' + S.muebleTpl.nombre + '» · R gira 90° · Esc cancela' : 'Elige un objeto en la biblioteca';
  if (t === 'cota' && d && d.cadena) return 'Clic en el siguiente punto para encadenar otra medida · escribe una medida y ⏎ · ⏎ o Esc termina';
  if (t === 'cota') return !d ? 'Clic en el primer punto a medir' : d.puntos.length === 1 ? 'Clic en el segundo punto · o escribe la medida y ⏎' : 'Aleja el cursor para separar la cota del muro y haz clic';
  if (t === 'calibrar') return d ? 'Clic en el segundo punto de la medida conocida' : 'Clic en el primer punto de una medida que conozcas, sobre la imagen';
  if (t === 'calco') return 'Arrastra para mover la imagen de calco · Esc para terminar';
  return '';
};
const renderPista = () => {
  el.pista.textContent = pistaTexto();
  let b = '';
  if (S.draft && esPoli(S.draft.tool)) {
    if (S.draft.tool === 'linea' && S.draft.puntos.length >= 2) b += '<button data-p="terminar">terminar</button>';
    if (S.draft.puntos.length >= 3) b += `<button data-p="cerrar">${S.draft.tool === 'linea' ? 'cerrar figura' : 'cerrar ' + (S.draft.tool === 'obra' ? 'obra' : 'región')}</button>`;
    b += '<button data-p="quitar">quitar punto</button>';
  }
  if (S.draft && S.draft.cadena) b += '<button data-p="cancelar">terminar cadena</button>';
  else if (S.draft) b += '<button data-p="cancelar">cancelar</button>';
  el.pistaBtns.innerHTML = b;
  $$('button', el.pistaBtns).forEach((x) => x.addEventListener('click', () => {
    const p = x.dataset.p;
    if (p === 'terminar') terminarLinea(false); else if (p === 'cerrar') terminarLinea(true);
    else if (p === 'quitar') quitarPunto(); else cancelarDraft();
  }));
};
const render = () => {
  renderSvg(); renderPanel(); renderPista();
  if (iso && iso.visible) iso.refrescar();
  $$('#herramientas button[data-tool]').forEach((b) => b.classList.toggle('activo', b.dataset.tool === S.tool));
  el.lienzo.classList.toggle('dibujo', DIBUJO.includes(S.tool));
  el.lienzo.classList.toggle('pan', S.tool === 'calco');
  $('#bDeshacer').disabled = !S.undo.length; $('#bRehacer').disabled = !S.redo.length;
};

// ── piezas
const agregar = (base) => {
  snap();
  const e = { id: G.nuevoId(), color: COLORES[0], ...base };
  S.doc.entidades.push(e); S.sel = e.id; S.vsel = null; S.inicioOculto = true; cambio(); return e;
};
const borrarSel = () => {
  const e = ent(); if (!e) return;
  snap();
  if (S.vsel != null && ((e.tipo === 'linea' && e.pts.length > 2) || (G.esPoligono(e) && e.pts.length > 3))) { G.borrarVertice(e, S.vsel); S.vsel = null; cambio(); return; }
  if (G.esObra(e)) { if (ctx.onObraCambiada) setTimeout(() => ctx.onObraCambiada(e.obraId), 0); mensaje('Quitada de la planta; la obra sigue en la lista (panel Obras)'); }
  S.doc.entidades = S.doc.entidades.filter((x) => x !== e); S.sel = null; S.vsel = null; cambio();
};
const duplicar = () => {
  const e = ent(); if (!e) return; snap(); const c = G.mover(JSON.parse(JSON.stringify(e)), S.doc.rotulo * 2, S.doc.rotulo * 2); c.id = G.nuevoId();
  if (G.esObra(c)) { c.num = String(G.numSiguiente(S.doc.entidades)); const o = obraDe(e); const { id: _id, ...resto } = o || {}; const n = M.nuevaObra(o ? { ...resto, nombre: (o.nombre ? o.nombre + ' copia' : ''), estimado: { ...o.estimado } } : {}); ctx.proyecto.obras.push(n); c.obraId = n.id; if (ctx.onObraCambiada) ctx.onObraCambiada(n.id); }
  S.doc.entidades.push(c); S.sel = c.id; S.vsel = null; cambio();
};

// ── herramientas
const setTool = (t) => {
  if (S.draft && esPoli(S.draft.tool) && t !== S.draft.tool && S.draft.puntos.length >= (S.draft.tool === 'linea' ? 2 : 3)) terminarLinea(false);
  S.tool = t; S.draft = null; S.buffer = ''; if (t !== 'select') { S.vsel = null; }
  if (t !== 'cuadro' && t !== 'obra' && S.obraPendiente) { S.obraPendiente = null; mensaje('Colocación cancelada: la obra sigue en la lista'); }
  if (t === 'calibrar' && !S.doc.calco) { S.tool = 'select'; mensaje('Primero sube una imagen de calco', true); }
  if (t !== 'calibrar' && S.guiaPaso === 'Calibrar') guia(null);
  render();
};
const cancelarDraft = () => { S.draft = null; S.buffer = ''; render(); };
const quitarPunto = () => { const d = S.draft; if (!d || !esPoli(d.tool)) return; d.puntos.pop(); if (!d.puntos.length) S.draft = null; render(); };
const terminarLinea = (cerrar) => {
  const d = S.draft; if (!d || !esPoli(d.tool)) return;
  const tol = tolM(3); const pts = [];
  for (const p of d.puntos) if (!pts.length || G.dist(pts[pts.length - 1], p) > tol) pts.push(p);
  if (cerrar && pts.length > 2 && G.dist(pts[0], pts[pts.length - 1]) <= tol) pts.pop();
  S.draft = null; S.buffer = '';
  if (d.tool !== 'linea') {
    if (pts.length < 3) { mensaje('Una obra o región necesita al menos tres puntos', true); render(); return; }
    if (d.tool === 'obra') { const e = agregar({ tipo: 'obra', pts, num: String(G.numSiguiente(S.doc.entidades)), color: '#b06a36', verTitulo: false }); asignarObra(e); render(); enfocarObra(); }
    else { const n = S.doc.entidades.filter((x) => x.tipo === 'region').length; agregar({ tipo: 'region', pts, nombre: 'Región ' + String.fromCharCode(65 + (n % 26)), color: COLORES_REGION[n % COLORES_REGION.length], conteo: true, verArea: false }); enfocar('nombre'); }
    return;
  }
  if (pts.length < 2) { render(); return; }
  agregar({ tipo: 'linea', pts, cerrada: !!cerrar && pts.length >= 3, ...DEF.linea });
};
const enfocar = (k) => { const i = $(`#panel [data-k="${k}"]`); if (i) { i.focus(); i.select(); } };
const enfocarObra = () => { const i = $('#panel [data-ok="nombre"]'); if (i && !i.value) { i.focus(); i.select(); } };
const ultimo = () => (S.draft ? S.draft.puntos[S.draft.puntos.length - 1] : null);
// Cursor con imán, ángulo o libre según el estado
const calcularCursor = (raw, ev) => {
  const base = S.draft && !S.draft.cadena && ['linea', 'obra', 'region', 'puerta', 'ventana', 'cuadro', 'proyeccion', 'cota', 'calibrar'].includes(S.draft.tool) && !((S.draft.tool === 'cota' || S.draft.tool === 'proyeccion') && S.draft.puntos.length === 2) ? ultimo() : null;
  if (S.draft && S.draft.tool === 'cota' && S.draft.puntos.length === 2) { S.iman = 'libre'; return raw; }
  if (S.tool === 'calibrar') { S.iman = 'libre'; return raw; }
  if (ev && ev.shiftKey && base) { S.iman = 'angulo'; return G.snapAngulo(base, raw, 15, S.doc.imanes ? S.doc.rejilla : 0); }
  if ((ev && ev.altKey) || !S.doc.imanes) { S.iman = 'libre'; return raw; }
  const ents = S.doc.entidades.slice();
  if (S.draft && esPoli(S.draft.tool)) ents.push({ id: '_draft', tipo: 'linea', pts: S.draft.puntos, cerrada: false });
  const r = G.imanar(raw, { entidades: ents, tol: tolM(10), rejilla: S.doc.rejilla, excluir: S.arr && S.arr.tipo === 'asa' ? { id: S.sel, idx: S.arr.idx } : null });
  S.iman = r.tipo; return r.p;
};
// Clic de herramienta (en coordenadas ya ajustadas)
const clicDibujo = (p, arr) => {
  const t = S.tool, d = S.draft;
  if (esPoli(t)) {
    if (!d) { S.draft = { tool: t, puntos: [p] }; }
    else {
      const u = ultimo(); if (G.dist(u, p) < 1e-6) return render();
      if (d.puntos.length >= 3 && G.dist(d.puntos[0], p) <= tolM(8)) return terminarLinea(true);
      d.puntos.push(p);
    }
    S.buffer = ''; return render();
  }
  if (t === 'mueble') {
    if (!S.muebleTpl) { setTool('select'); return; }
    const m = muebleDesde(S.muebleTpl, p.x, p.y, G.nuevoId()); m.rot = S.muebleRot || 0;
    agregar(m); S.sel = null; mensaje(`«${m.nombre}» colocado · otro clic coloca otro igual · R gira · Esc termina`); render(); return;
  }
  if (t === 'texto') {
    const e = agregar({ tipo: 'texto', x: p.x, y: p.y, texto: 'Texto', tam: G.r6(S.doc.rotulo * 1.4), rot: 0 });
    const ta = $('textarea[data-k=texto]', el.panel); if (ta) { ta.focus(); ta.select(); }
    return e;
  }
  // herramientas de dos (o tres) puntos
  if (!d) { if (arr && arr.creado) return render(); S.draft = { tool: t, puntos: [p] }; return render(); }
  if (arr && arr.creado && !arr.movido) return render();
  terminarDosPuntos(p);
};
const terminarDosPuntos = (p) => {
  const d = S.draft; const t = d.tool;
  if (t === 'cota' && d.cadena) {
    const e = ent(d.cadena); S.buffer = '';
    if (!e) { S.draft = null; return render(); }
    const pts = G.cotaPts(e); if (G.dist(pts[pts.length - 1], p) < 1e-4) return render();
    snap(); e.pts = [...pts, p]; delete e.a; delete e.b; S.sel = e.id; cambio(); return;
  }
  const a = d.puntos[0];
  if (t === 'proyeccion' && d.puntos.length === 2) {
    const [pa, pb] = d.puntos; S.draft = null; S.buffer = '';
    if (G.dist(G.medio(pa, pb), p) < 0.05) { mensaje('Coloca el proyector a cierta distancia de la imagen', true); S.draft = { tool: t, puntos: [pa, pb] }; return render(); }
    const n = S.doc.entidades.filter((x) => x.tipo === 'proyeccion').length;
    agregar({ tipo: 'proyeccion', a: pa, b: pb, p, nombre: 'P' + (n + 1), formato: '16:9', color: '#4f6b82', verHaz: true, verDatos: true }); enfocar('nombre'); return;
  }
  if (t === 'cota' && d.puntos.length === 2) {
    const e = { tipo: 'cota', pts: [d.puntos[0], d.puntos[1]], desp: G.r6(d.desp || 0), texto: '', total: false };
    S.buffer = ''; const nueva = agregar(e); S.draft = { tool: 'cota', cadena: nueva.id, puntos: [] }; render(); return;
  }
  if (G.dist(a, p) < 1e-4) { mensaje('Los dos puntos coinciden', true); return render(); }
  if (t === 'cota') { d.puntos.push(p); d.desp = 0; S.buffer = ''; return render(); }
  if (t === 'proyeccion') { d.puntos.push(p); S.buffer = ''; return render(); }
  S.draft = null; S.buffer = '';
  if (t === 'rect') {
    if (Math.abs(p.x - a.x) < 1e-4 || Math.abs(p.y - a.y) < 1e-4) { mensaje('El rectángulo no tiene área', true); return render(); }
    agregar({ tipo: 'linea', pts: G.rectPts(a, p), cerrada: true, ...DEF.rect });
  } else if (t === 'circulo') agregar({ tipo: 'circulo', c: a, r: G.r6(G.dist(a, p)), ...DEF.circulo });
  else if (t === 'puerta') agregar({ tipo: 'puerta', a, b: p, lado: 1, bisagra: 'a', medidas: false });
  else if (t === 'ventana') agregar({ tipo: 'ventana', a, b: p, esp: 0.15, medidas: false });
  else if (t === 'cuadro') { const e = agregar({ tipo: 'cuadro', a, b: p, lado: G.ladoCuadro(S.doc.entidades, a, p), num: String(G.numSiguiente(S.doc.entidades)), color: '#b06a36', medidas: true, verTitulo: false }); asignarObra(e); render(); enfocarObra(); }
  else if (t === 'calibrar') calibrar(a, p);
};
// Medida tecleada mientras se dibuja
const aplicarBuffer = () => {
  const d = S.draft; const txt = S.buffer.trim(); S.buffer = '';
  if (!d || !txt) return render();
  if (d.cadena) {
    const e = ent(d.cadena); const L = G.parseNum(txt); if (!e || !(L > 0)) { mensaje('Medida no válida', true); return render(); }
    const g = G.cotaGeom(e); const base = g.pts[g.pts.length - 1]; const cur = S.cursor || base;
    const sg = Math.sign(G.dot(G.sub(cur, base), g.d)) || Math.sign(g.ts[g.ts.length - 1] - g.ts[0]) || 1;
    return terminarDosPuntos({ x: G.r6(base.x + g.d.x * L * sg), y: G.r6(base.y + g.d.y * L * sg) });
  }
  const base = ultimo(); const cur = S.cursor || { x: base.x + 1, y: base.y };
  if (d.tool === 'rect') {
    const m = txt.replace(/,/g, '.').split(/[x×*]/i).map((s) => parseFloat(s));
    if (m.length !== 2 || !(m[0] > 0) || !(m[1] > 0)) { mensaje('Escribe ancho x alto, por ejemplo 3x2', true); return render(); }
    const sx = Math.sign(cur.x - base.x) || 1, sy = Math.sign(cur.y - base.y) || 1;
    return terminarDosPuntos({ x: G.r6(base.x + sx * m[0]), y: G.r6(base.y + sy * m[1]) });
  }
  const L = G.parseNum(txt);
  if (!(L > 0)) { mensaje('Medida no válida', true); return render(); }
  if (d.tool === 'circulo') return terminarDosPuntos({ x: G.r6(base.x + L / 2), y: base.y });
  if (d.tool === 'cota' && d.puntos.length === 2) { d.desp = L * (Math.sign(d.desp || 1)); return terminarDosPuntos(null); }
  if (d.tool === 'proyeccion' && d.puntos.length === 2) {
    const [pa, pb] = d.puntos; const m = G.medio(pa, pb); const n = G.unit(G.perp(G.sub(pb, pa)));
    const sg = Math.sign(G.dot(G.sub(S.cursor || G.add(m, n), pa), n)) || 1;
    return terminarDosPuntos({ x: G.r6(m.x + n.x * L * sg), y: G.r6(m.y + n.y * L * sg) });
  }
  const dir = G.dist(base, cur) > 1e-9 ? G.unit(G.sub(cur, base)) : { x: 1, y: 0 };
  const p = { x: G.r6(base.x + dir.x * L), y: G.r6(base.y + dir.y * L) };
  if (esPoli(d.tool)) { d.puntos.push(p); return render(); }
  terminarDosPuntos(p);
};

// ── calco
const abrirCalco = () => { el.fCalco.value = ''; el.fCalco.click(); };
const leerImagen = (file) => new Promise((res, rej) => {
  if (!file || !/^image\//.test(file.type)) return rej(new Error('El archivo no es una imagen'));
  const fr = new FileReader();
  fr.onerror = () => rej(new Error('No se pudo leer el archivo'));
  fr.onload = () => {
    const img = new Image();
    img.onerror = () => rej(new Error('Formato de imagen no soportado por el navegador'));
    img.onload = () => {
      const w0 = img.naturalWidth, h0 = img.naturalHeight; if (!(w0 > 0 && h0 > 0)) return rej(new Error('Imagen vacía'));
      const k = Math.min(1, MAX_LADO_CALCO / Math.max(w0, h0));
      if (k === 1 && file.size < 2.5e6) return res({ src: fr.result, w: w0, h: h0 });
      const w = Math.round(w0 * k), h = Math.round(h0 * k);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
      res({ src: file.type === 'image/png' ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.9), w, h });
    };
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
});
const cargarCalco = async (file) => {
  try {
    const im = await leerImagen(file);
    const bb = G.caja(S.doc.entidades, S.doc.rotulo);
    const anchoM = bb ? Math.max(bb.w, 4) : 10;
    const imagenId = M.nuevoId('img'); ctx.proyecto.imagenes[imagenId] = im.src;
    S.doc.calco = { imagenId, w: im.w, h: im.h, mpp: anchoM / im.w, x: bb ? bb.x : 0, y: bb ? bb.y : 0, rot: 0, opacidad: 0.5, visible: true, calibrado: null };
    S.inicioOculto = true; S.undo.length = 0; S.redo.length = 0;
    autosave(); verTodo(); setTool('calibrar');
    guia('Paso 1 de 2', 'Marca dos puntos sobre una medida que conozcas del plano (una pared, una puerta acotada) y escribe cuántos metros mide. Así la imagen queda a escala real.');
  } catch (err) { mensaje(err.message, true); }
};
const calibrar = (a, b, metrosDados) => {
  const c = S.doc.calco; if (!c) return;
  let m = metrosDados;
  if (!(m > 0)) {
    const r = prompt('¿Cuántos metros mide en la realidad la distancia que marcaste? (por ejemplo 3,18)');
    if (r == null) { render(); return; }
    m = G.parseNum(r);
  }
  const nuevo = G.calibrarCalco(c, a, b, m);
  if (!nuevo) { mensaje('Medida no válida', true); render(); return; }
  snap(); Object.assign(c, nuevo);
  const lado = Math.max(c.w, c.h) * c.mpp;
  if (!S.doc.entidades.length) S.doc.rotulo = G.clamp(Math.round(lado / 45 * 100) / 100, 0.06, 0.6);
  S.tool = 'linea'; S.draft = null;
  guia('Paso 2 de 2', `Listo: la imagen está a escala (1 m = ${G.fmtNum(1 / c.mpp, 1)} px). Traza encima con «Muro» haciendo clic en las esquinas. Regula la opacidad del calco en el panel derecho.`);
  autosave(); verTodo(); render();
};

// ── puntero
const enUi = (t) => t && t.closest && (t.closest('#guia') || t.closest('#inicio'));
el.lienzo.addEventListener('pointerdown', (ev) => {
  if (enUi(ev.target)) return;
  if (document.activeElement && document.activeElement !== document.body && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) document.activeElement.blur();
  try { el.lienzo.setPointerCapture(ev.pointerId); } catch (e) {}
  const raw = aMundo(ev.clientX, ev.clientY);
  const base = { x0: ev.clientX, y0: ev.clientY, raw0: raw, view0: { ...S.view }, movido: false };
  if (ev.button === 1 || ev.button === 2 || S.espacio) { S.arr = { ...base, tipo: 'pan' }; el.lienzo.classList.add('panning'); return; }
  if (ev.button !== 0) return;
  if (S.tool === 'select') {
    const e = ent();
    if (e) { const i = G.asas(e).findIndex((p) => G.dist(p, raw) <= tolM(8)); if (i >= 0) { S.vsel = i; S.arr = { ...base, tipo: 'asa', idx: i, hecho: false }; renderSvg(); renderPista(); return; } }
    const id = G.tocar(S.doc.entidades, raw, tolM(7), S.doc.rotulo);
    const rt = rotuloEn(raw);
    if (rt && ent(rt.id)) {
      const cambia = rt.id !== S.sel || !S.rsel || S.rsel.key !== rt.key;
      S.sel = rt.id; S.vsel = null; S.rsel = { id: rt.id, key: rt.key }; if (cambia) renderPanel();
      const c = G.enMarco(rt.f, raw); S.arr = { ...base, tipo: 'rotulo', id: rt.id, key: rt.key, f: rt.f, du: rt.u - c.u, dv: rt.v - c.v, hecho: false }; renderSvg(); renderPista(); return;
    }
    if (S.rsel) { S.rsel = null; if (!id) renderPanel(); }
    const er = id && ent(id);
    if (er && er.tipo === 'region' && G.enEtqRegion(er, raw, S.doc.rotulo)) { if (id !== S.sel) { S.sel = id; S.vsel = null; renderPanel(); } const c = G.etqRegion(er); S.arr = { ...base, tipo: 'etq', id, dx: c.x - raw.x, dy: c.y - raw.y, hecho: false }; renderSvg(); renderPista(); return; }
    if (id) { if (id !== S.sel) { S.sel = id; S.vsel = null; renderPanel(); } S.arr = { ...base, tipo: 'mover', id, ult: S.doc.rejilla > 0 && S.doc.imanes ? G.snapGrid(raw, S.doc.rejilla) : raw, hecho: false }; renderSvg(); renderPista(); return; }
    S.arr = { ...base, tipo: 'fondo' }; return;
  }
  if (S.tool === 'calco') { const c = S.doc.calco; if (c) S.arr = { ...base, tipo: 'calco', cx: c.x, cy: c.y, hecho: false }; return; }
  if (DIBUJO.includes(S.tool)) {
    const p = calcularCursor(raw, ev); S.cursor = p;
    const creado = !S.draft && ['rect', 'circulo', 'puerta', 'ventana', 'cuadro', 'proyeccion', 'cota', 'calibrar'].includes(S.tool);
    if (creado) { S.draft = { tool: S.tool, puntos: [p] }; }
    S.arr = { ...base, tipo: 'dibujo', creado }; renderSvg(); renderPista();
  }
});
el.lienzo.addEventListener('pointermove', (ev) => {
  const raw = aMundo(ev.clientX, ev.clientY); S.raw = raw;
  const a = S.arr;
  if (a && !a.movido && Math.hypot(ev.clientX - a.x0, ev.clientY - a.y0) > 3) a.movido = true;
  if (a && a.movido) {
    if (a.tipo === 'pan' || a.tipo === 'fondo') {
      a.tipo = 'pan'; el.lienzo.classList.add('panning');
      S.view = { ...a.view0, vx: a.view0.vx - (ev.clientX - a.x0) / a.view0.zoom, vy: a.view0.vy - (ev.clientY - a.y0) / a.view0.zoom };
      return pedirRender();
    }
    if (a.tipo === 'mover') {
      const e = ent(a.id); if (!e) return;
      if (!a.hecho) { snap(); a.hecho = true; }
      const t = S.doc.rejilla > 0 && S.doc.imanes && !ev.altKey ? G.snapGrid(raw, S.doc.rejilla) : raw;
      G.mover(e, t.x - a.ult.x, t.y - a.ult.y); a.ult = t; return pedirRender();
    }
    if (a.tipo === 'rotulo') {
      const e = ent(a.id); if (!e) return;
      if (!a.hecho) { snap(); a.hecho = true; }
      const c = G.enMarco(a.f, raw); e.etiq = { ...(e.etiq || {}), [a.key]: { u: G.r6(c.u + a.du), v: G.r6(c.v + a.dv) } }; return pedirRender();
    }
    if (a.tipo === 'etq') {
      const e = ent(a.id); if (!e) return;
      if (!a.hecho) { snap(); a.hecho = true; }
      e.etq = { x: G.r6(raw.x + a.dx), y: G.r6(raw.y + a.dy) }; return pedirRender();
    }
    if (a.tipo === 'asa') {
      const e = ent(); if (!e) return;
      if (!a.hecho) { snap(); a.hecho = true; }
      const p = calcularCursor(raw, ev); S.cursor = p; G.fijarAsa(e, a.idx, p); return pedirRender();
    }
    if (a.tipo === 'calco') {
      const c = S.doc.calco; if (!c) return;
      if (!a.hecho) { snap(); a.hecho = true; }
      c.x = a.cx + (ev.clientX - a.x0) / S.view.zoom; c.y = a.cy + (ev.clientY - a.y0) / S.view.zoom; return pedirRender();
    }
  }
  const p = DIBUJO.includes(S.tool) ? calcularCursor(raw, ev) : raw;
  S.cursor = p;
  if (S.tool === 'select' && !a) el.lienzo.style.cursor = rotuloEn(raw) ? 'move' : '';
  if (S.draft && S.draft.tool === 'cota' && S.draft.puntos.length === 2) { const g = G.cotaGeom({ a: S.draft.puntos[0], b: S.draft.puntos[1], desp: 0 }); S.draft.desp = G.dot(G.sub(raw, S.draft.puntos[0]), g.n); if (S.doc.rejilla > 0 && S.doc.imanes) S.draft.desp = Math.round(S.draft.desp / S.doc.rejilla) * S.doc.rejilla; }
  el.coords.textContent = `x ${G.fmtNum(p.x)} · y ${G.fmtNum(p.y)} m`;
  if (DIBUJO.includes(S.tool) || S.draft) pedirRender();
});
const finPuntero = (ev) => {
  const a = S.arr; if (!a) return; S.arr = null; el.lienzo.classList.remove('panning');
  try { el.lienzo.releasePointerCapture(ev.pointerId); } catch (e) {}
  if (a.tipo === 'pan') return;
  if (a.tipo === 'fondo') { if (S.sel) { S.sel = null; S.vsel = null; S.rsel = null; render(); } return; }
  if (a.tipo === 'mover' || a.tipo === 'asa' || a.tipo === 'calco' || a.tipo === 'etq' || a.tipo === 'rotulo') { if (a.hecho) { autosave(); render(); } return; }
  if (a.tipo === 'dibujo') {
    const raw = aMundo(ev.clientX, ev.clientY);
    const p = calcularCursor(raw, ev); S.cursor = p;
    clicDibujo(p, a);
  }
};
el.lienzo.addEventListener('pointerup', finPuntero);
el.lienzo.addEventListener('pointercancel', () => { S.arr = null; el.lienzo.classList.remove('panning'); });
el.lienzo.addEventListener('pointerleave', () => { if (!S.arr) { el.flot.style.display = 'none'; } });
el.lienzo.addEventListener('dblclick', (ev) => {
  if (enUi(ev.target) || (iso && iso.visible)) return;
  if (esPoli(S.tool) && S.draft) { ev.preventDefault(); terminarLinea(false); return; }
  if (S.tool === 'cota' && S.draft && S.draft.cadena) {
    ev.preventDefault(); const e = ent(S.draft.cadena);
    if (e) { const g = G.cotaGeom(e); const ult = g.tramos[g.tramos.length - 1]; if (g.tramos.length > 1 && ult.L < tolM(4)) { e.pts = g.pts.slice(0, -1); S.undo.pop(); } }
    cancelarDraft(); return;
  }
  if (S.tool === 'select') {
    const e = ent(); const raw = aMundo(ev.clientX, ev.clientY);
    const rt = rotuloEn(raw);
    if (rt && rt.manual) { const er = ent(rt.id); if (er && er.etiq) { snap(); delete er.etiq[rt.key]; if (!Object.keys(er.etiq).length) delete er.etiq; cambio(); mensaje('Rótulo en posición automática'); return; } }
    if (e && (e.tipo === 'linea' || G.esPoligono(e))) { snap(); const i = G.insertarVertice(e, raw, tolM(8)); if (i >= 0) { S.vsel = i; cambio(); mensaje('Punto añadido: arrástralo'); } else S.undo.pop(); return; }
    if (e && e.tipo === 'texto') { const ta = $('textarea[data-k=texto]', el.panel); if (ta) { ta.focus(); ta.select(); } }
  }
});
el.lienzo.addEventListener('wheel', (ev) => { ev.preventDefault(); zoomEn(ev.clientX, ev.clientY, ev.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
el.lienzo.addEventListener('contextmenu', (ev) => ev.preventDefault());
el.lienzo.addEventListener('dragover', (ev) => ev.preventDefault());
el.lienzo.addEventListener('drop', (ev) => {
  ev.preventDefault(); if (iso && iso.visible) return; const f = (ev.dataTransfer && ev.dataTransfer.files || [])[0]; if (!f) return;
  if (/\.json$/i.test(f.name) || f.type === 'application/json') { if (ctx.onArchivoJson) ctx.onArchivoJson(f); else mensaje('Abre los .json desde la barra superior', true); }
  else if (/^image\//.test(f.type)) { if (S.doc.calco && !confirm('¿Reemplazar la imagen de calco actual?')) return; cargarCalco(f); }
  else mensaje('Arrastra una imagen o un proyecto .json', true);
});

// ── teclado
const alTeclado = (ev) => {
  if (!S.activa || (document.activeElement && !root.contains(document.activeElement) && document.activeElement !== document.body)) return;
  const ae = document.activeElement; const enCampo = ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName);
  if (ev.key === 'Escape' && iso && iso.visible) { cerrar3d(); return; }
  if (ev.key === 'Escape') {
    if (el.ayuda.classList.contains('visible')) { el.ayuda.classList.remove('visible'); return; }
    if (el.exportar.classList.contains('visible')) { el.exportar.classList.remove('visible'); return; }
    if (enCampo) { ae.blur(); return; }
    if (S.tool === 'mueble') { S.muebleTpl = null; setTool('select'); return; }
    if (S.buffer) { S.buffer = ''; return render(); }
    if (S.draft) { if (esPoli(S.draft.tool) && S.draft.puntos.length >= 2) terminarLinea(false); else cancelarDraft(); return; }
    if (S.vsel != null) { S.vsel = null; return render(); }
    if (S.sel) { S.sel = null; S.rsel = null; return render(); }
    if (S.tool !== 'select') setTool('select');
    return;
  }
  if (enCampo) return;
  const k = ev.key; const kl = k.toLowerCase(); const mod = ev.ctrlKey || ev.metaKey;
  if (iso && iso.visible) { // en 3D la planta de debajo no se edita con el teclado
    if (k === '3') cerrar3d(); else if (mod && kl === 'z') { ev.preventDefault(); ev.shiftKey ? rehacer() : deshacer(); } else if (mod && kl === 'y') { ev.preventDefault(); rehacer(); }
    return;
  }
  if (mod && kl === 'z') { ev.preventDefault(); ev.shiftKey ? rehacer() : deshacer(); return; }
  if (mod && kl === 'y') { ev.preventDefault(); rehacer(); return; }
  if (mod && kl === 'd') { ev.preventDefault(); duplicar(); return; }
  if (mod || ev.altKey) return;
  if (k === ' ') { ev.preventDefault(); if (!S.espacio) { S.espacio = true; el.lienzo.classList.add('pan'); } return; }
  // medida tecleada durante el dibujo
  if (S.draft && S.draft.tool !== 'calibrar' && (/^[0-9.,]$/.test(k) || (S.draft.tool === 'rect' && /^[x×*]$/i.test(k) && S.buffer))) {
    ev.preventDefault(); S.buffer += k; renderSvg(); return;
  }
  if (k === 'Backspace' || k === 'Delete') {
    ev.preventDefault();
    if (S.buffer) { S.buffer = S.buffer.slice(0, -1); renderSvg(); return; }
    if (S.draft && esPoli(S.draft.tool)) { quitarPunto(); return; }
    borrarSel(); return;
  }
  if (k === 'Enter') { if (S.buffer) { ev.preventDefault(); aplicarBuffer(); return; } if (S.draft && esPoli(S.draft.tool)) { ev.preventDefault(); terminarLinea(false); } else if (S.draft && S.draft.cadena) { ev.preventDefault(); cancelarDraft(); } return; }
  if (k.startsWith('Arrow') && S.sel) {
    ev.preventDefault(); const e = ent(); const paso = (S.doc.rejilla || 0.05) * (ev.shiftKey ? 10 : 1);
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
    snap(); G.mover(e, d[0] * paso, d[1] * paso); cambio(); return;
  }
  if (kl === 'r' && S.tool === 'mueble') { S.muebleRot = ((S.muebleRot || 0) + 90) % 360; pedirRender(); return; }
  const herr = { v: 'select', l: 'linea', r: 'rect', o: 'circulo', p: 'puerta', n: 'ventana', t: 'texto', d: 'cota', c: 'cuadro', b: 'obra', g: 'region', y: 'proyeccion' };
  if (herr[kl]) { setTool(herr[kl]); return; }
  if (k === '3' && !S.draft) { iso.visible ? cerrar3d() : abrir3d(); return; }
  if (k === '0') verTodo(); else if (k === '+' || k === '=') { const { rect } = tam(); zoomEn(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.25); }
  else if (k === '-') { const { rect } = tam(); zoomEn(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.8); }
  else if (k === '?') el.ayuda.classList.add('visible');
};
const alSoltar = (ev) => { if (!S.activa) return; if (ev.key === ' ') { S.espacio = false; el.lienzo.classList.remove('pan'); if (S.tool === 'calco') el.lienzo.classList.add('pan'); } };
const alDesenfocar = () => { S.espacio = false; el.lienzo.classList.remove('pan'); };
const alRedimensionar = () => { if (S.activa) pedirRender(); };
document.addEventListener('keydown', alTeclado); document.addEventListener('keyup', alSoltar); window.addEventListener('blur', alDesenfocar);

// ── inicio
const crearSala = () => {
  const w = G.parseNum($('#iAncho').value), h = G.parseNum($('#iLargo').value);
  if (!(w > 0 && h > 0 && w < 1000 && h < 1000)) { mensaje('Escribe ancho y largo en metros, por ejemplo 8 y 5', true); return; }
  S.doc.rotulo = G.clamp(Math.round(Math.max(w, h) / 45 * 100) / 100, 0.08, 0.6);
  S.inicioOculto = true;
  agregar({ tipo: 'linea', pts: G.rectPts({ x: 0, y: 0 }, { x: w, y: h }), cerrada: true, ...DEF.linea, grosor: 'grueso' });
  S.sel = null; verTodo(); render();
  mensaje('Sala creada. Usa «Muro» para tabiques y paneles, «Puerta» sobre los muros.');
};
$('#bCrearSala').addEventListener('click', crearSala);
$$('#iAncho,#iLargo').forEach((i) => i.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') crearSala(); }));
$('#bCalcoInicio').addEventListener('click', abrirCalco);
$('#bBlanco').addEventListener('click', () => { S.inicioOculto = true; setTool('linea'); });
$('#bGuiaCerrar').addEventListener('click', () => guia(null));

// ── barra superior
$$('#herramientas button[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
$('#bCalcoNav').addEventListener('click', () => { if (S.doc.calco) { S.sel = null; render(); mensaje('El calco se ajusta en el panel derecho'); } else abrirCalco(); });
$('#bDeshacer').addEventListener('click', deshacer); $('#bRehacer').addEventListener('click', rehacer);
$('#bAjustar').addEventListener('click', verTodo);
$('#bAyuda').addEventListener('click', () => el.ayuda.classList.add('visible'));
$('#bCerrarAyuda').addEventListener('click', () => el.ayuda.classList.remove('visible'));
el.fCalco.addEventListener('change', () => { const f = el.fCalco.files[0]; if (f) cargarCalco(f); el.fCalco.value = ''; });
window.addEventListener('resize', alRedimensionar);
root.addEventListener('click', (ev) => { const b = ev.target.closest && ev.target.closest('button'); if (b) b.blur(); });
// salas del proyecto
const renderSalas = () => {
  el.selSala.innerHTML = ctx.proyecto.salas.map((s) => `<option value="${s.id}" ${s === S.doc ? 'selected' : ''}>${esc(s.nombre || 'Sala')}</option>`).join('');
};
const setSala = (sala) => {
  if (!sala || sala === S.doc) return;
  S.doc = sala; S.sel = null; S.vsel = null; S.rsel = null; S.draft = null; S.buffer = ''; S.undo.length = 0; S.redo.length = 0; S.tool = 'select'; guia(null);
  S.inicioOculto = !!(sala.entidades.length || sala.calco); renderSalas(); render(); verTodo(); if (iso) iso.salaCambiada();
};
el.selSala.addEventListener('change', () => setSala(M.salaDe(ctx.proyecto, el.selSala.value)));
$('#bSalaNueva').addEventListener('click', () => {
  const n = prompt('Nombre de la sala nueva', 'Sala ' + (ctx.proyecto.salas.length + 1)); if (!n) return;
  const s = M.nuevaSala({ nombre: n.trim() || 'Sala' }); ctx.proyecto.salas.push(s); autosave(); setSala(s);
});
$('#bSalaNombre').addEventListener('click', () => { const n = prompt('Nombre de la sala', S.doc.nombre); if (n) { S.doc.nombre = n.trim() || S.doc.nombre; renderSalas(); autosave(); } });
$('#bSalaBorrar').addEventListener('click', () => {
  if (ctx.proyecto.salas.length < 2) return mensaje('Es la única sala', true);
  if (!confirm(`¿Borrar la sala «${S.doc.nombre}» con sus ${S.doc.entidades.length} elementos? Las obras siguen en la lista.`)) return;
  const i = ctx.proyecto.salas.indexOf(S.doc); ctx.proyecto.salas.splice(i, 1);
  for (const m of ctx.proyecto.muros) if (m.salaId === S.doc.id) { m.salaId = null; m.tramo = null; }
  const sig = ctx.proyecto.salas[Math.max(0, i - 1)]; S.doc = null; setSala(sig); if (ctx.onObraCambiada) ctx.onObraCambiada(null);
});

// ── archivos
const nombreArchivo = () => ((ctx.proyecto.nombre ? ctx.proyecto.nombre + '-' : '') + (S.doc.nombre || 'sala')).replace(/[^\w\-áéíóúñü ]+/gi, '').trim().replace(/\s+/g, '-') || 'plano';
const descargar = (blob, nombre) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); };
const exportarCsvObras = () => {
  if (!S.doc.entidades.some(G.esObra)) return mensaje('Todavía no hay obras', true);
  descargar(new Blob(['\ufeff' + G.csvObras(D())], { type: 'text/csv;charset=utf-8' }), nombreArchivo() + '-obras.csv'); mensaje('Lista de obras exportada');
};
// ── exportación
const EX = { formato: 'svg' };
const exEscala = $('#exEscala');
exEscala.innerHTML = G.ESCALAS.map((e) => `<option value="${e}" ${e === 50 ? 'selected' : ''}>1:${e}</option>`).join('');
const opcionesEx = () => ({ escala: EX.formato === 'svg' ? +exEscala.value : null, pxAncho: +$('#exAncho').value, titulo: $('#exTitulo').checked, barra: $('#exBarra').checked, calco: $('#exCalco').checked });
const actualizarEx = () => {
  $$('#exFormato button').forEach((b) => b.classList.toggle('activo', b.dataset.v === EX.formato));
  $('#exOpSvg').style.display = EX.formato === 'svg' ? '' : 'none'; $('#exOpPng').style.display = EX.formato === 'png' ? '' : 'none';
  $('#exCalcoFila').style.display = S.doc.calco ? '' : 'none';
  const r = G.construirSVG(D(), { ...opcionesEx(), escala: +exEscala.value });
  if (!r) { $('#exPapel').textContent = 'No hay nada que exportar todavía.'; return; }
  const wmm = r.W * 1000 / +exEscala.value, hmm = r.H * 1000 / +exEscala.value; const p = G.papelPara(wmm, hmm);
  const sug = ['A4', 'A3'].map((hoja) => { const e = G.ESCALAS.find((n) => { const q = G.papelPara(r.W * 1000 / n, r.H * 1000 / n); return q && ['A4', 'A3'].indexOf(q.nombre) <= ['A4', 'A3'].indexOf(hoja); }); return e ? `${hoja}: 1:${e}` : null; }).filter(Boolean);
  $('#exPapel').innerHTML = `ocupa <b>${G.fmtNum(wmm, 0)} × ${G.fmtNum(hmm, 0)} mm</b> → ${p ? `cabe en <b>${p.nombre} ${p.orient}</b>` : 'más grande que A0: prueba una escala menor'}` + (sug.length ? `<br>escala mínima por hoja · ${sug.join(' · ')}` : '');
};
$('#bExportar').addEventListener('click', () => { if (!cajaTodo()) return mensaje('Dibuja algo antes de exportar', true); $('#exCalco').checked = false; actualizarEx(); el.exportar.classList.add('visible'); });
$$('#exFormato button').forEach((b) => b.addEventListener('click', () => { EX.formato = b.dataset.v; actualizarEx(); }));
$$('#exEscala,#exTitulo,#exBarra,#exCalco,#exAncho').forEach((i) => i.addEventListener('change', actualizarEx));
$('#exCancelar').addEventListener('click', () => el.exportar.classList.remove('visible'));
$('#exObras').addEventListener('click', () => exportarCsvObras());
el.exportar.addEventListener('pointerdown', (ev) => { if (ev.target === el.exportar) el.exportar.classList.remove('visible'); });
$('#exDescargar').addEventListener('click', () => {
  const o = opcionesEx(); const r = G.construirSVG(D(), o);
  if (!r) return mensaje('No hay nada que exportar', true);
  const base = nombreArchivo();
  if (EX.formato === 'svg') { descargar(new Blob([r.svg], { type: 'image/svg+xml' }), `${base}-1-${o.escala}.svg`); mensaje(`SVG a escala 1:${o.escala} exportado`); el.exportar.classList.remove('visible'); return; }
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas'); cv.width = r.ancho; cv.height = r.alto;
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0, cv.width, cv.height);
    cv.toBlob((b) => { if (b) { descargar(b, base + '.png'); mensaje('PNG exportado'); } else mensaje('No se pudo generar el PNG (imagen demasiado grande)', true); }, 'image/png');
  };
  img.onerror = () => mensaje('No se pudo dibujar el PNG', true);
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(r.svg);
  el.exportar.classList.remove('visible');
});

// ── modo 3D
iso = montarIso({
  root: $('#psIso'), proyecto: ctx.proyecto, sala: () => S.doc, mensaje, onCambio: autosave, descargar, nombreArchivo,
  onCerrar: () => cerrar3d(),
});
const abrir3d = () => { if (!S.doc.entidades.length) return mensaje('Dibuja la sala antes de verla en 3D', true); S.draft = null; S.buffer = ''; S.muebleTpl = null; if (S.tool !== 'select') setTool('select'); iso.mostrar(); $('#b3d').classList.add('activo'); el.flot.style.display = 'none'; };
const cerrar3d = () => { iso.ocultar(); $('#b3d').classList.remove('activo'); render(); };
$('#b3d').addEventListener('click', () => (iso.visible ? cerrar3d() : abrir3d()));
// ── arranque y API para el cascarón
const activar = (on) => {
  S.activa = !!on; S.espacio = false; el.lienzo.classList.remove('pan');
  if (on) { renderSalas(); render(); if (!S.vistoTodo) { S.vistoTodo = true; verTodo(); } }
};
const destruir = () => { S.activa = false; document.removeEventListener('keydown', alTeclado); document.removeEventListener('keyup', alSoltar); window.removeEventListener('blur', alDesenfocar); window.removeEventListener('resize', alRedimensionar); if (iso && iso.destruir) iso.destruir(); };
S.inicioOculto = !!(S.doc.entidades.length || S.doc.calco);
render();
return {
  activar, destruir, setSala, render, verTodo,
  get sala() { return S.doc; },
  // desde el panel de obras: colocar una obra existente
  colocar(obraId) { S.obraPendiente = obraId; setTool('cuadro'); const o = M.obraDe(ctx.proyecto, obraId); mensaje(o && o.ancho > 0 ? 'Haz clic en el muro donde cuelga la obra; el segundo clic marca hacia qué lado (el ancho es el de la ficha). Esc cancela.' : 'Haz clic en el muro donde cuelga la obra; el segundo clic marca su ancho. Esc cancela.'); },
  irA(obraId) { const e = S.doc.entidades.find((x) => x.obraId === obraId); if (!e) return false; S.sel = e.id; S.vsel = null; render(); return true; },
  refrescar() { render(); },
  // para pruebas y depuración
  _clic: (p) => clicDibujo(p, null), _S: S, _setTool: setTool,
};
}
