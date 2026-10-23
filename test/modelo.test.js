import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/core/modelo.js';
import { cmAm, mAcm, fmtNum, parseNum, fmtCm } from '../src/core/unidades.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo='; // no hace falta que sea una imagen real

// ---------- fixtures en los tres formatos anteriores ----------
const fixPlanoSala = () => ({
  version: 1, app: 'plano-sala', nombre: 'Sala norte', rotulo: 0.2, rejilla: 0.05, imanes: true,
  entidades: [
    { id: 'e1', tipo: 'linea', pts: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 5 }, { x: 0, y: 5 }], cerrada: true, altura: 3.2, grosor: 'grueso', estilo: 'continua', medidas: true },
    { id: 'e2', tipo: 'cuadro', a: { x: 1, y: 0 }, b: { x: 2.2, y: 0 }, lado: 1, num: '1', titulo: 'Paisaje', artista: 'A. Pérez', anio: '1990', tecnica: 'óleo', dims: '120 × 80 cm', medidas: true },
    { id: 'e3', tipo: 'obra', pts: [{ x: 3, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 3 }], num: '2', titulo: 'Totem', artista: 'B. Cruz' },
    { id: 'e4', tipo: 'puerta', a: { x: 8, y: 1 }, b: { x: 8, y: 2 }, lado: 1, bisagra: 'a' },
    { id: 'malo', tipo: 'linea', pts: [{ x: 0 }] },
  ],
  calco: { src: PNG, w: 100, h: 50, mpp: 0.1, x: 0, y: 0, rot: 0, opacidad: 0.5, visible: true, calibrado: { metros: 10 } },
});
const fixMuseoDraft = () => ({
  version: 2, titulo: 'Muro A', wall: { w: 500, h: 300, color: '#ffffff', eje: 150, grosor: 15 },
  images: { i1: PNG },
  guides: { v: [250], h: [] }, opts: { cotas: 'sel' },
  items: [
    { id: 'p1', tipo: 'persona', nombre: 'Persona 170', figura: 'pie', x: -75, y: 130, h: 170, w: 49.3, dist: 120 },
    { id: 'o1', tipo: 'obra', nombre: 'Paisaje', x: 100, y: 110, w: 120, h: 80, marco: 3, pp: 0, prof: 4, caida: 5, rot: 0, lock: true, imgId: 'i1', imgRatio: 1.5, est: { w: false, h: false }, ficha: { titulo: 'Paisaje', autor: 'A. Pérez', anio: '1990', tecnica: 'óleo', inv: 'INV-1' } },
    { id: 'o2', tipo: 'obra', nombre: 'Sin medir', x: 300, y: 120, w: 60, h: 40, est: { w: true, h: true } },
    { id: 'v1', tipo: 'vano', nombre: 'Puerta', x: 20, y: 90, w: 90, h: 210, prof: 0 },
    { id: 'n1', tipo: 'nota', texto: 'Revisar', x: 50, y: 20, tam: 4, apunta: 'o1' },
    { id: 'm1', tipo: 'medida', x1: 0, y1: 0, x2: 100, y2: 0 },
  ],
});
const fixAnotador = () => ({
  version: 1, nombre: 'Montaje', planoActivo: 'pl1',
  planos: [{
    id: 'pl1', nombre: 'planta', imagen: { dataURL: PNG, w: 1000, h: 600 },
    escala: { pxPorMetro: 100, ref: { x1: 0, y1: 0, x2: 100, y2: 0, metros: 1 } },
    capas: [{ id: 'c1', nombre: 'base', visible: true }], capaActiva: 'c1',
    items: [
      { id: 'i1', tipo: 'marcador', capa: 'c1', x: 10, y: 10, num: 1, label: 'entrada', href: 'https://ejemplo.pe' },
      { id: 'i2', tipo: 'imagen', capa: 'c1', x: 50, y: 50, w: 100, h: 60, src: PNG },
      { id: 'i3', tipo: 'dimension', capa: 'otra', puntos: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
    ],
  }],
});

// ---------- unidades ----------
test('unidades: conversión y formato', () => {
  assert.equal(cmAm(150), 1.5);
  assert.equal(mAcm(1.5), 150);
  assert.equal(fmtNum(1.5), '1,50');
  assert.equal(fmtNum(0.3, 2, true), '0,3');
  assert.equal(fmtNum(-0.001), '0,00');
  assert.equal(parseNum('3,18'), 3.18);
  assert.ok(Number.isNaN(parseNum('3,1,8')));
  assert.equal(fmtCm(1.205), '120,5 cm');
});

// ---------- proyecto nuevo ----------
test('nuevoProyecto valida y sobrevive ida y vuelta', () => {
  const p = M.nuevoProyecto('Prueba');
  const o = M.nuevaObra({ nombre: 'X', ancho: 1.2, alto: 0.8, estimado: { ancho: false, alto: false } });
  p.obras.push(o);
  const s = M.nuevaSala({ nombre: 'S' }); p.salas.push(s);
  const m = M.nuevoMuro({ salaId: s.id, ancho: 6, alto: 3 });
  m.colgado.push(M.nuevoColgado({ obraId: o.id, x: 1, y: 1 }));
  p.muros.push(m);
  const { proyecto: q, origen } = M.parsear(M.serializar(p));
  assert.equal(origen, 'proyecto');
  assert.equal(q.obras.length, 1);
  assert.equal(q.muros[0].colgado[0].obraId, o.id);
  assert.equal(q.muros[0].salaId, s.id);
});

test('validar descarta referencias rotas sin perder el resto', () => {
  const p = M.nuevoProyecto();
  const o = M.nuevaObra({ nombre: 'A' }); p.obras.push(o);
  const m = M.nuevoMuro({ salaId: 'no-existe', tramo: { entidadId: 'e9', i: 0 } });
  m.colgado.push(M.nuevoColgado({ obraId: o.id, x: 0, y: 0 }), M.nuevoColgado({ obraId: 'fantasma', x: 0, y: 0 }));
  p.muros.push(m);
  const s = M.nuevaSala(); s.entidades.push({ id: 'e1', tipo: 'cuadro', a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, obraId: 'fantasma' }); p.salas.push(s);
  const q = M.validar(p);
  assert.equal(q.muros[0].colgado.length, 1);
  assert.equal(q.muros[0].salaId, null);
  assert.equal(q.muros[0].tramo, null);
  assert.equal(q.salas[0].entidades[0].obraId, null);
});

test('validar rechaza lo que no es un proyecto', () => {
  assert.throws(() => M.validar({ hola: 1 }), M.ErrorProyecto);
  assert.throws(() => M.parsear('{no json'), M.ErrorProyecto);
  assert.throws(() => M.parsear('{"a":1}'), M.ErrorProyecto);
});

// ---------- detección ----------
test('detectar reconoce los cuatro formatos', () => {
  assert.equal(M.detectar(fixPlanoSala()), 'plano-sala');
  assert.equal(M.detectar(fixMuseoDraft()), 'museodraft');
  assert.equal(M.detectar(fixAnotador()), 'anotador');
  assert.equal(M.detectar(M.nuevoProyecto()), 'proyecto');
  assert.equal(M.detectar({ wall: { width: 500 }, items: [] }), 'museodraft-v1');
  assert.equal(M.detectar({}), null);
});

// ---------- migradores ----------
test('plano-sala: cada cuadro y obra en planta genera una obra referenciada', () => {
  const { proyecto: p, origen } = M.importar(fixPlanoSala());
  assert.equal(origen, 'plano-sala');
  assert.equal(p.salas.length, 1);
  assert.equal(p.salas[0].entidades.length, 4, 'la entidad dañada se descarta');
  assert.equal(p.obras.length, 2);
  const cuadro = p.salas[0].entidades.find((e) => e.tipo === 'cuadro');
  const obra = M.obraDe(p, cuadro.obraId);
  assert.equal(obra.nombre, 'Paisaje');
  assert.equal(obra.autor, 'A. Pérez');
  assert.ok(Math.abs(obra.ancho - 1.2) < 1e-9, 'el ancho sale del tramo del cuadro');
  assert.equal(obra.alto, null);
  assert.deepEqual(obra.estimado, { ancho: false, alto: true });
  assert.match(obra.nota, /120 × 80 cm/);
  assert.ok(p.salas[0].calco.imagenId && p.imagenes[p.salas[0].calco.imagenId] === PNG, 'el calco pasa al almacén de imágenes');
  assert.equal(p.salas[0].calco.src, undefined);
});

test('MuseoDraft v2: cm → m, obras separadas del colgado, otros elementos conservados', () => {
  const { proyecto: p, origen } = M.importar(fixMuseoDraft());
  assert.equal(origen, 'museodraft');
  assert.equal(p.muros.length, 1);
  const m = p.muros[0];
  assert.equal(m.ancho, 5); assert.equal(m.alto, 3); assert.equal(m.eje, 1.5); assert.equal(m.grosor, 0.15);
  assert.deepEqual(m.guias, { v: [2.5], h: [] });
  assert.equal(p.obras.length, 2);
  assert.equal(m.colgado.length, 2);
  const c = m.colgado[0], o = M.obraDe(p, c.obraId);
  assert.equal(o.nombre, 'Paisaje'); assert.equal(o.inv, 'INV-1');
  assert.equal(o.ancho, 1.2); assert.equal(o.alto, 0.8);
  assert.deepEqual(o.estimado, { ancho: false, alto: false });
  assert.equal(c.x, 1); assert.equal(c.y, 1.1); assert.equal(c.marco, 0.03); assert.equal(c.prof, 0.04); assert.equal(c.caida, 0.05);
  assert.ok(o.imagenId && p.imagenes[o.imagenId] === PNG);
  assert.deepEqual(M.obraDe(p, m.colgado[1].obraId).estimado, { ancho: true, alto: true });
  const tipos = m.otros.map((x) => x.tipo).sort();
  assert.deepEqual(tipos, ['medida', 'nota', 'persona', 'vano']);
  const persona = m.otros.find((x) => x.tipo === 'persona');
  assert.equal(persona.h, 1.7); assert.equal(persona.dist, 1.2);
  const nota = m.otros.find((x) => x.tipo === 'nota');
  assert.equal(nota.tam, 0.04);
  const med = m.otros.find((x) => x.tipo === 'medida');
  assert.equal(med.x2, 1);
});

test('MuseoDraft v1 se rechaza con mensaje claro', () => {
  assert.throws(() => M.importar({ wall: { width: 500, height: 300 }, items: [] }), /MuseoDraft 1/);
});

test('anotador-planos: una anotación por plano, imágenes al almacén, capas saneadas', () => {
  const { proyecto: p, origen } = M.importar(fixAnotador());
  assert.equal(origen, 'anotador');
  assert.equal(p.anotaciones.length, 1);
  const a = p.anotaciones[0];
  assert.equal(a.base.tipo, 'imagen'); assert.equal(a.base.w, 1000);
  assert.equal(p.imagenes[a.base.imagenId], PNG);
  assert.equal(a.escala.pxPorMetro, 100);
  assert.equal(a.items.length, 3);
  const img = a.items.find((i) => i.tipo === 'imagen');
  assert.equal(img.src, undefined); assert.equal(p.imagenes[img.imagenId], PNG);
  assert.equal(a.items.find((i) => i.tipo === 'dimension').capa, 'c1', 'la capa inexistente cae a la primera');
  assert.equal(Object.keys(p.imagenes).length, 2);
});

// ---------- incorporar y consultas ----------
test('incorporar funde dos archivos antiguos en un proyecto sin colisiones de id', () => {
  const p = M.importar(fixPlanoSala()).proyecto;
  const idsAntes = new Set(p.obras.map((o) => o.id));
  const r = M.incorporar(p, fixMuseoDraft());
  assert.equal(r.origen, 'museodraft');
  assert.deepEqual(r.añadido, { obras: 2, salas: 0, muros: 1, anotaciones: 0 });
  assert.equal(p.obras.length, 4);
  assert.equal(new Set(p.obras.map((o) => o.id)).size, 4);
  for (const o of p.obras.slice(2)) assert.ok(!idsAntes.has(o.id));
  const m = p.muros[0];
  for (const c of m.colgado) assert.ok(M.obraDe(p, c.obraId), 'el colgado apunta a obras reales tras reasignar ids');
  const q = M.validar(p);
  assert.equal(q.muros[0].colgado.length, 2);
  // y tras incorporar también el anotador, las imágenes se conservan
  M.incorporar(p, fixAnotador());
  assert.equal(p.anotaciones.length, 1);
  assert.equal(p.imagenes[p.anotaciones[0].base.imagenId], PNG);
});

test('consultas: usos, sin colocar, limpieza de imágenes', () => {
  const p = M.importar(fixMuseoDraft()).proyecto;
  const o = p.obras[0];
  assert.deepEqual(M.usosDeObra(p, o.id), { salas: [], muros: [p.muros[0].id] });
  const suelta = M.nuevaObra({ nombre: 'suelta', imagenId: 'img_x' }); p.obras.push(suelta); p.imagenes.img_x = PNG; p.imagenes.basura = PNG;
  assert.deepEqual(M.obrasSinColocar(p).map((x) => x.id), [suelta.id]);
  M.limpiarImagenes(p);
  assert.ok(p.imagenes.img_x && !p.imagenes.basura);
  M.borrarObra(p, o.id);
  assert.equal(p.muros[0].colgado.length, 1);
  assert.equal(M.obraDe(p, o.id), null);
});
