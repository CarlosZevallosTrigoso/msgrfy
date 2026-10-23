// Modelo del proyecto MuseoDraft (versión 3). Sin DOM: se prueba en Node y se usa en el navegador.
//
// Un proyecto, varias vistas. La obra existe una sola vez (obras[]); la planta (salas[]) y los alzados
// (muros[]) solo la referencian por obraId. Todas las longitudes se guardan en metros.
//
//   proyecto
//     obras[]        id, ficha, ancho/alto en m (null = desconocido), estimado {ancho, alto}, imagenId
//     salas[]        id, nombre, entidades[] en el formato de plano-sala; cuadro/obra llevan obraId
//     muros[]        id, salaId, tramo {entidadId, i} | null, ancho, alto, eje, colgado[] {obraId, x, y, …},
//                    otros[] (vanos, personas, medidas, notas en el formato de MuseoDraft, en m)
//     anotaciones[]  id, base {tipo:'imagen', imagenId, w, h}, escala, capas[], items[] (formato anotador-planos)
//     imagenes{}     id → dataURL (en el .json) — el almacén del navegador puede guardarlas aparte
//
// Importa .json de las tres herramientas anteriores: plano-sala, MuseoDraft v2 y anotador-planos.

import { cmAm, r6 } from './unidades.js';

export const VERSION = 3;
export const APP = 'museodraft';

let _seq = 0;
export const nuevoId = (pref = 'x') =>
  pref + '_' + Date.now().toString(36) + '_' + (_seq++).toString(36) + '_' + Math.floor(Math.random() * 1e9).toString(36);

const num = (v, def = null) => (Number.isFinite(v) ? v : def);
const pos = (v, def = null) => (Number.isFinite(v) && v > 0 ? v : def);
const str = (v, def = '') => (v == null ? def : String(v));
const bool = (v, def = false) => (typeof v === 'boolean' ? v : def);
const esPunto = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const ahora = () => new Date().toISOString();

// ---------- constructores ----------
export const nuevoProyecto = (nombre = 'proyecto') => ({
  app: APP, version: VERSION, nombre, creado: ahora(), modificado: ahora(),
  obras: [], salas: [], muros: [], anotaciones: [], imagenes: {},
});

export const nuevaObra = (o = {}) => ({
  id: nuevoId('o'), nombre: 'Obra', autor: '', anio: '', tecnica: '', inv: '', nota: '',
  ancho: null, alto: null, estimado: { ancho: true, alto: true }, imagenId: null, imgRatio: null,
  ...o,
});

export const nuevaSala = (s = {}) => ({
  id: nuevoId('s'), nombre: 'Sala', rotulo: 0.2, rejilla: 0.05, imanes: true, entidades: [], calco: null, ...s,
});

export const nuevoMuro = (m = {}) => ({
  id: nuevoId('m'), nombre: 'Muro', salaId: null, tramo: null,
  ancho: 5, alto: 3, eje: 1.5, grosor: 0.15, color: '#ffffff',
  colgado: [], otros: [], guias: { v: [], h: [] }, opts: {},
  ...m,
});

// Una obra colgada en un muro. x, y: esquina superior izquierda del exterior (marco incluido), en m,
// con origen arriba-izquierda del muro, como en MuseoDraft.
export const nuevoColgado = (c = {}) => ({
  id: nuevoId('c'), obraId: null, x: 0, y: 0, marco: 0, pp: 0, prof: 0.03, caida: 0, rot: 0,
  lock: true, bloqueado: false, oculto: false, ...c,
});

export const nuevaAnotacion = (a = {}) => {
  const capa = { id: nuevoId('k'), nombre: 'base', visible: true };
  return { id: nuevoId('a'), nombre: 'Plano', base: null, escala: null, capas: [capa], capaActiva: capa.id, items: [], ...a };
};

// ---------- consultas ----------
export const obraDe = (p, id) => p.obras.find((o) => o.id === id) || null;
export const salaDe = (p, id) => p.salas.find((s) => s.id === id) || null;
export const muroDe = (p, id) => p.muros.find((m) => m.id === id) || null;
export const murosDeSala = (p, salaId) => p.muros.filter((m) => m.salaId === salaId);
export const murosDeTramo = (p, salaId, entidadId, i) =>
  p.muros.filter((m) => m.salaId === salaId && m.tramo && m.tramo.entidadId === entidadId && m.tramo.i === i);
// Dónde aparece una obra: en qué salas (como cuadro u obra en planta) y en qué muros
export const usosDeObra = (p, obraId) => ({
  salas: p.salas.filter((s) => s.entidades.some((e) => e.obraId === obraId)).map((s) => s.id),
  muros: p.muros.filter((m) => m.colgado.some((c) => c.obraId === obraId)).map((m) => m.id),
});
export const obrasSinColocar = (p) =>
  p.obras.filter((o) => { const u = usosDeObra(p, o.id); return !u.salas.length && !u.muros.length; });
export const imagenesUsadas = (p) => {
  const ids = new Set();
  for (const o of p.obras) if (o.imagenId) ids.add(o.imagenId);
  for (const a of p.anotaciones) {
    if (a.base && a.base.imagenId) ids.add(a.base.imagenId);
    for (const it of a.items) if (it.imagenId) ids.add(it.imagenId);
  }
  for (const s of p.salas) if (s.calco && s.calco.imagenId) ids.add(s.calco.imagenId);
  return ids;
};

// ---------- mutaciones básicas ----------
export const borrarObra = (p, obraId) => {
  p.obras = p.obras.filter((o) => o.id !== obraId);
  for (const m of p.muros) m.colgado = m.colgado.filter((c) => c.obraId !== obraId);
  for (const s of p.salas) for (const e of s.entidades) if (e.obraId === obraId) e.obraId = null;
  return p;
};
export const limpiarImagenes = (p) => {
  const usadas = imagenesUsadas(p);
  for (const id of Object.keys(p.imagenes)) if (!usadas.has(id)) delete p.imagenes[id];
  return p;
};

// ---------- validación / normalización ----------
export class ErrorProyecto extends Error {}

const validarObra = (o) => {
  const est = o.estimado && typeof o.estimado === 'object' ? o.estimado : {};
  return nuevaObra({
    id: str(o.id) || nuevoId('o'), nombre: str(o.nombre, 'Obra'), autor: str(o.autor), anio: str(o.anio),
    tecnica: str(o.tecnica), inv: str(o.inv), nota: str(o.nota),
    ancho: pos(o.ancho), alto: pos(o.alto),
    estimado: { ancho: bool(est.ancho, !pos(o.ancho)), alto: bool(est.alto, !pos(o.alto)) },
    imagenId: str(o.imagenId, null) || null, imgRatio: pos(o.imgRatio),
  });
};
const TIPOS_ENTIDAD = new Set(['linea', 'circulo', 'puerta', 'ventana', 'cota', 'texto', 'obra', 'region', 'cuadro', 'proyeccion']);
const entidadValida = (e) => e && TIPOS_ENTIDAD.has(e.tipo) && (
  (e.tipo === 'linea' && Array.isArray(e.pts) && e.pts.length >= 2 && e.pts.every(esPunto)) ||
  (e.tipo === 'circulo' && esPunto(e.c) && e.r > 0) ||
  ((e.tipo === 'puerta' || e.tipo === 'ventana' || e.tipo === 'cuadro') && esPunto(e.a) && esPunto(e.b)) ||
  (e.tipo === 'cota' && ((Array.isArray(e.pts) && e.pts.length >= 2 && e.pts.every(esPunto)) || (esPunto(e.a) && esPunto(e.b)))) ||
  (e.tipo === 'texto' && Number.isFinite(e.x) && Number.isFinite(e.y) && e.tam > 0) ||
  ((e.tipo === 'obra' || e.tipo === 'region') && Array.isArray(e.pts) && e.pts.length >= 3 && e.pts.every(esPunto)) ||
  (e.tipo === 'proyeccion' && esPunto(e.a) && esPunto(e.b) && esPunto(e.p)));
const validarSala = (s, obras) => {
  const ents = (Array.isArray(s.entidades) ? s.entidades : []).filter(entidadValida).map((e) => {
    const n = { ...e }; n.id = str(n.id) || nuevoId('e');
    if (n.tipo === 'cota' && !Array.isArray(n.pts)) { n.pts = [n.a, n.b]; delete n.a; delete n.b; }
    if (n.tipo === 'cuadro' || n.tipo === 'obra') n.obraId = n.obraId && obras.has(n.obraId) ? n.obraId : null;
    return n;
  });
  const c = s.calco && typeof s.calco === 'object' && s.calco.w > 0 && s.calco.h > 0 && s.calco.mpp > 0 && (s.calco.imagenId || s.calco.src) ? { ...s.calco } : null;
  return nuevaSala({
    id: str(s.id) || nuevoId('s'), nombre: str(s.nombre, 'Sala'), rotulo: pos(s.rotulo, 0.2),
    rejilla: num(s.rejilla, 0.05), imanes: bool(s.imanes, true), entidades: ents, calco: c,
  });
};
const TIPOS_OTRO = new Set(['vano', 'persona', 'medida', 'nota']);
const otroValido = (o) => o && TIPOS_OTRO.has(o.tipo) && (
  o.tipo === 'medida' ? ['x1', 'y1', 'x2', 'y2'].every((k) => Number.isFinite(o[k]))
    : o.tipo === 'nota' ? Number.isFinite(o.x) && Number.isFinite(o.y)
      : Number.isFinite(o.x) && Number.isFinite(o.y) && o.w > 0 && o.h > 0);
const validarMuro = (m, obras, salas) => {
  const tramo = m.tramo && typeof m.tramo === 'object' && m.tramo.entidadId && Number.isInteger(m.tramo.i) ? { entidadId: str(m.tramo.entidadId), i: m.tramo.i, cara: m.tramo.cara === -1 ? -1 : 1 } : null;
  return nuevoMuro({
    id: str(m.id) || nuevoId('m'), nombre: str(m.nombre, 'Muro'),
    salaId: m.salaId && salas.has(m.salaId) ? m.salaId : null, tramo: salas.has(m.salaId) ? tramo : null,
    ancho: pos(m.ancho, 5), alto: pos(m.alto, 3), eje: num(m.eje, 1.5), grosor: Math.max(0, num(m.grosor, 0.15)),
    color: /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#ffffff',
    colgado: (Array.isArray(m.colgado) ? m.colgado : [])
      .filter((c) => c && obras.has(c.obraId) && Number.isFinite(c.x) && Number.isFinite(c.y))
      .map((c) => nuevoColgado({
        id: str(c.id) || nuevoId('c'), obraId: c.obraId, x: c.x, y: c.y,
        marco: Math.max(0, num(c.marco, 0)), pp: Math.max(0, num(c.pp, 0)), prof: Math.max(0, num(c.prof, 0.03)),
        caida: Math.max(0, num(c.caida, 0)), rot: [0, 90, 180, 270].includes(c.rot) ? c.rot : 0,
        lock: bool(c.lock, true), bloqueado: bool(c.bloqueado), oculto: bool(c.oculto),
      })),
    otros: (Array.isArray(m.otros) ? m.otros : []).filter(otroValido).map((o) => ({ ...o, id: str(o.id) || nuevoId(o.tipo[0]) })),
    guias: { v: (m.guias && Array.isArray(m.guias.v) ? m.guias.v : []).filter(Number.isFinite), h: (m.guias && Array.isArray(m.guias.h) ? m.guias.h : []).filter(Number.isFinite) },
    opts: m.opts && typeof m.opts === 'object' ? { ...m.opts } : {},
  });
};
const validarAnotacion = (a, imagenes) => {
  const base = a.base && a.base.tipo === 'imagen' && imagenes.has(a.base.imagenId) && a.base.w > 0 && a.base.h > 0
    ? { tipo: 'imagen', imagenId: a.base.imagenId, w: a.base.w, h: a.base.h } : null;
  if (!base) throw new ErrorProyecto(`La anotación «${str(a.nombre, '?')}» no tiene imagen de base válida`);
  const capas = (Array.isArray(a.capas) ? a.capas : []).filter((c) => c && c.id).map((c) => ({ id: str(c.id), nombre: str(c.nombre, 'capa'), visible: bool(c.visible, true) }));
  if (!capas.length) capas.push({ id: nuevoId('k'), nombre: 'base', visible: true });
  const capaIds = new Set(capas.map((c) => c.id));
  const items = (Array.isArray(a.items) ? a.items : []).filter((it) => it && it.tipo).map((it) => {
    const n = { ...it }; n.id = str(n.id) || nuevoId('i');
    n.capa = capaIds.has(n.capa) ? n.capa : capas[0].id;
    if (n.tipo === 'imagen' && n.src && !n.imagenId) { n.imagenId = nuevoId('img'); imagenes.set(n.imagenId, n.src); delete n.src; }
    return n;
  });
  const esc = a.escala && a.escala.pxPorMetro > 0 ? { ...a.escala } : null;
  return nuevaAnotacion({
    id: str(a.id) || nuevoId('a'), nombre: str(a.nombre, 'Plano'), base, escala: esc,
    capas, capaActiva: capaIds.has(a.capaActiva) ? a.capaActiva : capas[0].id, items,
  });
};

// Devuelve un proyecto limpio o lanza ErrorProyecto. No muta el argumento.
export const validar = (d) => {
  if (!d || typeof d !== 'object' || d.app !== APP || d.version !== VERSION) throw new ErrorProyecto('No es un proyecto de MuseoDraft (versión 3)');
  const imagenes = new Map(Object.entries(d.imagenes && typeof d.imagenes === 'object' ? d.imagenes : {}).filter(([, v]) => typeof v === 'string' && v.startsWith('data:')));
  const obras = (Array.isArray(d.obras) ? d.obras : []).filter((o) => o && typeof o === 'object').map(validarObra);
  for (const o of obras) if (o.imagenId && !imagenes.has(o.imagenId)) o.imagenId = null;
  const obraIds = new Set(obras.map((o) => o.id));
  const salas = (Array.isArray(d.salas) ? d.salas : []).filter((s) => s && typeof s === 'object').map((s) => validarSala(s, obraIds));
  const salaIds = new Set(salas.map((s) => s.id));
  const muros = (Array.isArray(d.muros) ? d.muros : []).filter((m) => m && typeof m === 'object').map((m) => validarMuro(m, obraIds, salaIds));
  const anotaciones = (Array.isArray(d.anotaciones) ? d.anotaciones : []).filter((a) => a && typeof a === 'object').map((a) => validarAnotacion(a, imagenes));
  return {
    app: APP, version: VERSION, nombre: str(d.nombre, 'proyecto'), creado: str(d.creado, ahora()), modificado: str(d.modificado, ahora()),
    obras, salas, muros, anotaciones, imagenes: Object.fromEntries(imagenes),
  };
};

// ---------- detección e importación de los formatos anteriores ----------
export const detectar = (d) => {
  if (!d || typeof d !== 'object') return null;
  if (d.app === APP && d.version === VERSION) return 'proyecto';
  if (d.version === 2 && d.wall && Array.isArray(d.items)) return 'museodraft';
  if (d.wall && d.wall.width != null && Array.isArray(d.items)) return 'museodraft-v1';
  if (d.app === 'plano-sala' || (Array.isArray(d.entidades) && !Array.isArray(d.planos))) return 'plano-sala';
  if (Array.isArray(d.planos) && d.planos.every((p) => p && p.imagen)) return 'anotador';
  return null;
};

// plano-sala → una sala; cada cuadro u obra en planta genera un registro en obras[]
const desdePlanoSala = (d) => {
  const p = nuevoProyecto(str(d.nombre) || 'proyecto');
  const sala = nuevaSala({ nombre: str(d.nombre) || 'Sala', rotulo: pos(d.rotulo, 0.2), rejilla: num(d.rejilla, 0.05), imanes: bool(d.imanes, true) });
  if (d.calco && d.calco.src) {
    const imagenId = nuevoId('img'); p.imagenes[imagenId] = d.calco.src;
    const { src, ...resto } = d.calco; sala.calco = { ...resto, imagenId };
  }
  for (const e of Array.isArray(d.entidades) ? d.entidades : []) {
    if (!entidadValida(e)) continue;
    const n = { ...e, id: str(e.id) || nuevoId('e') };
    if (e.tipo === 'cuadro' || e.tipo === 'obra') {
      const ancho = e.tipo === 'cuadro' ? Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y) : null;
      const obra = nuevaObra({
        nombre: str(e.titulo) || (e.tipo === 'cuadro' ? 'Cuadro ' : 'Obra ') + str(e.num), autor: str(e.artista), anio: str(e.anio), tecnica: str(e.tecnica),
        nota: [str(e.dims), str(e.nota)].filter(Boolean).join(' · '),
        ancho: ancho ? r6(ancho) : null, alto: null, estimado: { ancho: !ancho, alto: true },
      });
      p.obras.push(obra); n.obraId = obra.id;
    }
    sala.entidades.push(n);
  }
  p.salas.push(sala);
  return p;
};

// Campos de MuseoDraft que son longitudes en cm y pasan a m
const CM_OBRA = ['x', 'y', 'w', 'h', 'marco', 'pp', 'prof', 'caida'];
const CM_OTRO = { vano: ['x', 'y', 'w', 'h', 'prof'], persona: ['x', 'y', 'h', 'w', 'dist'], medida: ['x1', 'y1', 'x2', 'y2'], nota: ['x', 'y', 'tam'] };
const aMetros = (o, campos) => { const n = { ...o }; for (const k of campos) if (Number.isFinite(n[k])) n[k] = r6(cmAm(n[k])); return n; };

// MuseoDraft v2 → un muro suelto (sin sala); cada item obra genera un registro en obras[]
const desdeMuseoDraft = (d) => {
  const p = nuevoProyecto(str(d.titulo) || 'proyecto');
  const w = d.wall || {};
  const muro = nuevoMuro({
    nombre: str(d.titulo) || 'Muro', ancho: r6(cmAm(pos(w.w, 500))), alto: r6(cmAm(pos(w.h, 300))),
    eje: r6(cmAm(num(w.eje, 150))), grosor: r6(cmAm(Math.max(0, num(w.grosor, 15)))), color: /^#[0-9a-f]{6}$/i.test(w.color) ? w.color : '#ffffff',
    guias: { v: ((d.guides && d.guides.v) || []).filter(Number.isFinite).map((v) => r6(cmAm(v))), h: ((d.guides && d.guides.h) || []).filter(Number.isFinite).map((v) => r6(cmAm(v))) },
    opts: d.opts && typeof d.opts === 'object' ? { ...d.opts } : {},
  });
  const imgs = d.images && typeof d.images === 'object' ? d.images : {};
  const mapaImg = new Map();
  for (const it of Array.isArray(d.items) ? d.items : []) {
    if (!it || !it.tipo) continue;
    if (it.tipo === 'obra') {
      if (!(it.w > 0 && it.h > 0) || !Number.isFinite(it.x) || !Number.isFinite(it.y)) continue;
      const m = aMetros(it, CM_OBRA), f = it.ficha || {}, est = it.est || {};
      let imagenId = null;
      if (it.imgId && typeof imgs[it.imgId] === 'string') {
        imagenId = mapaImg.get(it.imgId) || nuevoId('img'); mapaImg.set(it.imgId, imagenId); p.imagenes[imagenId] = imgs[it.imgId];
      }
      const obra = nuevaObra({
        nombre: str(it.nombre) || str(f.titulo) || 'Obra', autor: str(f.autor), anio: str(f.anio), tecnica: str(f.tecnica), inv: str(f.inv),
        ancho: m.w, alto: m.h, estimado: { ancho: !!est.w, alto: !!est.h }, imagenId, imgRatio: pos(it.imgRatio),
      });
      p.obras.push(obra);
      muro.colgado.push(nuevoColgado({
        obraId: obra.id, x: m.x, y: m.y, marco: m.marco, pp: m.pp, prof: m.prof, caida: m.caida,
        rot: num(it.rot, 0) % 360, lock: bool(it.lock, true), bloqueado: bool(it.bloqueado), oculto: bool(it.oculto),
      }));
    } else if (CM_OTRO[it.tipo]) {
      const o = aMetros(it, CM_OTRO[it.tipo]);
      if (otroValido(o)) muro.otros.push({ ...o, id: str(o.id) || nuevoId(it.tipo[0]) });
    }
  }
  p.muros.push(muro);
  return p;
};

// anotador-planos → una anotación por plano; la imagen de fondo y las incrustadas pasan a imagenes{}
const desdeAnotador = (d) => {
  const p = nuevoProyecto(str(d.nombre) || 'proyecto');
  for (const pl of d.planos) {
    if (!pl.imagen || !pl.imagen.dataURL || !(pl.imagen.w > 0) || !(pl.imagen.h > 0)) continue;
    const imagenId = nuevoId('img'); p.imagenes[imagenId] = pl.imagen.dataURL;
    const capas = (Array.isArray(pl.capas) && pl.capas.length ? pl.capas : [{ id: nuevoId('k'), nombre: 'base', visible: true }]).map((c) => ({ id: str(c.id) || nuevoId('k'), nombre: str(c.nombre, 'capa'), visible: bool(c.visible, true) }));
    const items = (Array.isArray(pl.items) ? pl.items : []).map((it) => {
      const n = { ...it, id: str(it.id) || nuevoId('i') };
      if (n.tipo === 'imagen' && n.src) { n.imagenId = nuevoId('img'); p.imagenes[n.imagenId] = n.src; delete n.src; }
      return n;
    });
    p.anotaciones.push(nuevaAnotacion({
      id: str(pl.id) || nuevoId('a'), nombre: str(pl.nombre, 'Plano'), base: { tipo: 'imagen', imagenId, w: pl.imagen.w, h: pl.imagen.h },
      escala: pl.escala && pl.escala.pxPorMetro > 0 ? { ...pl.escala } : null,
      capas, capaActiva: capas.some((c) => c.id === pl.capaActiva) ? pl.capaActiva : capas[0].id, items,
    }));
  }
  return p;
};

// Cualquier .json conocido → proyecto validado. { proyecto, origen }
export const importar = (d) => {
  const origen = detectar(d);
  if (!origen) throw new ErrorProyecto('El archivo no es un proyecto de MuseoDraft, plano-sala ni anotador-planos');
  if (origen === 'museodraft-v1') throw new ErrorProyecto('Es un proyecto de MuseoDraft 1: ábrelo en legacy/museodraft.html, guárdalo y vuelve a importarlo');
  const p = origen === 'proyecto' ? d : origen === 'plano-sala' ? desdePlanoSala(d) : origen === 'museodraft' ? desdeMuseoDraft(d) : desdeAnotador(d);
  return { proyecto: validar(p), origen };
};

// Añade al proyecto todo lo que trae otro (o un .json antiguo). Los ids se regeneran para no chocar.
export const incorporar = (p, d) => {
  const { proyecto: q, origen } = importar(d);
  const idMap = new Map();
  const re = (id, pref) => { if (!id) return id; if (!idMap.has(id)) idMap.set(id, nuevoId(pref)); return idMap.get(id); };
  for (const [id, src] of Object.entries(q.imagenes)) p.imagenes[re(id, 'img')] = src;
  for (const o of q.obras) p.obras.push({ ...o, id: re(o.id, 'o'), imagenId: re(o.imagenId, 'img') });
  for (const s of q.salas) p.salas.push({
    ...s, id: re(s.id, 's'), calco: s.calco ? { ...s.calco, imagenId: re(s.calco.imagenId, 'img') } : null,
    entidades: s.entidades.map((e) => ({ ...e, id: re(e.id, 'e'), ...(e.obraId ? { obraId: re(e.obraId, 'o') } : {}) })),
  });
  for (const m of q.muros) p.muros.push({
    ...m, id: re(m.id, 'm'), salaId: re(m.salaId, 's'), tramo: m.tramo ? { ...m.tramo, entidadId: re(m.tramo.entidadId, 'e') } : null,
    colgado: m.colgado.map((c) => ({ ...c, id: re(c.id, 'c'), obraId: re(c.obraId, 'o') })),
    otros: m.otros.map((o) => ({ ...o, id: re(o.id, o.tipo[0]) })),
  });
  for (const a of q.anotaciones) p.anotaciones.push({
    ...a, id: re(a.id, 'a'), base: { ...a.base, imagenId: re(a.base.imagenId, 'img') },
    capas: a.capas.map((c) => ({ ...c, id: re(c.id, 'k') })), capaActiva: re(a.capaActiva, 'k'),
    items: a.items.map((it) => ({ ...it, id: re(it.id, 'i'), capa: re(it.capa, 'k'), ...(it.imagenId ? { imagenId: re(it.imagenId, 'img') } : {}) })),
  });
  p.modificado = ahora();
  return { proyecto: p, origen, añadido: { obras: q.obras.length, salas: q.salas.length, muros: q.muros.length, anotaciones: q.anotaciones.length } };
};

// ---------- archivo ----------
export const serializar = (p) => { p.modificado = ahora(); return JSON.stringify(limpiarImagenes(p)); };
export const parsear = (texto) => {
  let d;
  try { d = JSON.parse(texto); } catch (e) { throw new ErrorProyecto('El archivo no es JSON válido'); }
  return importar(d);
};
