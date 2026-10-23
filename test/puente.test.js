import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/core/modelo.js';
import * as P from '../src/core/puente.js';

// sala rectangular 8 × 5 (y hacia abajo), dibujada en sentido horario: 0,0 → 8,0 → 8,5 → 0,5
const salaBase = () => {
  const p = M.nuevoProyecto('t');
  const s = M.nuevaSala({ nombre: 'Norte' }); p.salas.push(s);
  const linea = { id: 'L', tipo: 'linea', pts: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 5 }, { x: 0, y: 5 }], cerrada: true, altura: 3.2, alturas: { 1: 2.8 } };
  s.entidades.push(linea);
  return { p, s, linea };
};
const cuadro = (p, s, a, b, lado, obra) => { const o = M.nuevaObra(obra); p.obras.push(o); const e = { id: M.nuevoId('e'), tipo: 'cuadro', a, b, lado, obraId: o.id, num: '1' }; s.entidades.push(e); return { e, o }; };

test('la cara por defecto de un contorno es la interior', () => {
  const { linea } = salaBase();
  const cara = P.caraPorDefecto(linea);
  // tramo 0 va de (0,0) a (8,0); la normal izquierda (perp) es (0,1) = hacia dentro de la sala
  assert.equal(cara, 1);
});

test('extremo izquierdo visto desde dentro de la sala', () => {
  // muro superior, mirado desde abajo (dentro): la izquierda del observador es x negativa → extremo a
  assert.equal(P.extremoIzquierdo({ x: 0, y: 0 }, { x: 8, y: 0 }, 1), 'a');
  // el mismo muro mirado desde fuera (arriba): la izquierda es x positiva → extremo b
  assert.equal(P.extremoIzquierdo({ x: 0, y: 0 }, { x: 8, y: 0 }, -1), 'b');
  // muro derecho (8,0)→(8,5), desde dentro (cara +1 con perp = (-1,0)… perp(d=(0,1)) = (-1,0): hacia dentro)
  assert.equal(P.extremoIzquierdo({ x: 8, y: 0 }, { x: 8, y: 5 }, 1), 'a');
});

test('muroDesdeTramo: ancho, alto por tramo, y obras colocadas desde la izquierda', () => {
  const { p, s, linea } = salaBase();
  // dos cuadros en el muro superior, hacia dentro (lado 1 con a→b en el mismo sentido que el tramo)
  const c1 = cuadro(p, s, { x: 1, y: 0 }, { x: 2.2, y: 0 }, 1, { nombre: 'A', ancho: 1.2, alto: 0.8, estimado: { ancho: false, alto: false } });
  const c2 = cuadro(p, s, { x: 6, y: 0 }, { x: 5, y: 0 }, -1, { nombre: 'B', ancho: 1, alto: null, imgRatio: 2, estimado: { ancho: false, alto: true } });
  // uno en el muro derecho: no entra
  cuadro(p, s, { x: 8, y: 1 }, { x: 8, y: 2 }, 1, { nombre: 'C' });
  const m = P.muroDesdeTramo(p, s, linea, 0);
  assert.equal(m.ancho, 8); assert.equal(m.alto, 3.2); assert.equal(m.tramo.cara, 1);
  assert.equal(m.colgado.length, 2);
  assert.equal(m.colgado[0].obraId, c1.o.id); assert.equal(m.colgado[0].x, 1);
  assert.equal(m.colgado[1].obraId, c2.o.id); assert.equal(m.colgado[1].x, 5);
  assert.equal(c2.o.alto, 0.5, 'alto estimado desde la proporción de la imagen'); assert.equal(c2.o.estimado.alto, true);
  // centrada en el eje visual: y = alto - eje - h/2
  assert.ok(Math.abs(m.colgado[0].y - (3.2 - 1.5 - 0.4)) < 1e-9);
  // tramo 1 tiene altura propia 2,8 y ningún cuadro hacia dentro
  const m1 = P.muroDesdeTramo(p, s, linea, 1);
  assert.equal(m1.alto, 2.8); assert.equal(m1.ancho, 5); assert.equal(m1.colgado.length, 1);
  assert.equal(m1.nombre, 'Norte · tramo 2');
});

test('un cuadro al otro lado del muro no entra; mirado desde fuera, la izquierda se invierte', () => {
  const { p, s, linea } = salaBase();
  const c = cuadro(p, s, { x: 1, y: 0 }, { x: 2, y: 0 }, -1, { nombre: 'fuera', ancho: 1, alto: 1, estimado: { ancho: false, alto: false } });
  assert.equal(P.muroDesdeTramo(p, s, linea, 0).colgado.length, 0);
  const m = P.muroDesdeTramo(p, s, linea, 0, -1);
  assert.equal(m.colgado.length, 1);
  assert.equal(m.colgado[0].obraId, c.o.id);
  assert.equal(m.colgado[0].x, 6, 'desde fuera, el cuadro en x∈[1,2] queda a 6 m del extremo izquierdo (8)');
});

test('muroDelTramo encuentra el muro ya creado y el proyecto valida con cara', () => {
  const { p, s, linea } = salaBase();
  const m = P.muroDesdeTramo(p, s, linea, 0); p.muros.push(m);
  assert.equal(P.muroDelTramo(p, s, linea, 0), m);
  assert.equal(P.muroDelTramo(p, s, linea, 0, -1), null);
  const q = M.validar(p); assert.deepEqual(q.muros[0].tramo, { entidadId: 'L', i: 0, cara: 1 });
});

test('svgDeSala y svgDeMuro producen SVG a escala con px por metro', async () => {
  const P2 = await import('../src/core/puente.js');
  const { p, s, linea } = salaBase();
  cuadro(p, s, { x: 1, y: 0 }, { x: 2.2, y: 0 }, 1, { nombre: 'A', autor: 'X', ancho: 1.2, alto: 0.8, estimado: { ancho: false, alto: false } });
  const r = P2.svgDeSala(p, s, 2000);
  assert.ok(r.svg.startsWith('<svg')); assert.equal(r.w, 2000); assert.ok(r.h > 0);
  assert.ok(r.svg.includes('1 · A') || r.svg.includes('>1<'), 'el cuadro lleva su número');
  const m = P2.muroDesdeTramo(p, s, linea, 0); p.muros.push(m);
  const rm = P2.svgDeMuro(p, m, 5);
  assert.ok(rm.svg.includes('<svg') && rm.svg.includes('</svg>'));
  assert.equal(rm.pxPorMetro, 500);
  assert.ok(rm.svg.includes('A'), 'la ficha de la obra aparece');
  assert.ok(rm.w > 8 * 500, 'el ancho incluye el muro de 8 m más márgenes');
  const doc = P2.docDeMuro(p, m);
  assert.equal(doc.wall.w, 800); assert.equal(doc.items.filter((i) => i.tipo === 'obra').length, 1);
});
