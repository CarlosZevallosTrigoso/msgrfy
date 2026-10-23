import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../src/core/biblioteca.js';
import * as M from '../src/core/modelo.js';
import * as I from '../src/core/isometrica.js';
import { G } from '../src/core/planta.js';

test('catálogo: entradas válidas y muebleDesde', () => {
  assert.ok(B.CATALOGO.length > 15);
  for (const c of B.CATALOGO) assert.ok(c.l > 0 && c.a > 0 && c.h > 0 && c.nombre && c.cat, c.id);
  const m = B.muebleDesde(B.catalogoPorId('ped-40-110'), 2, 3, 'm1');
  assert.equal(m.tipo, 'mueble'); assert.equal(m.h, 1.1); assert.equal(m.x, 2); assert.equal(m.catalogoId, 'ped-40-110');
  const c = B.muebleDesde(B.catalogoPorId('poste'), 0, 0, 'm2'); assert.equal(c.forma, 'cilindro'); assert.equal(c.a, c.l);
});

test('huella girada y cajas 3D de un objeto compuesto', () => {
  const m = B.muebleDesde(B.catalogoPorId('panel-240'), 0, 0, 'm'); m.rot = 90;
  const pts = B.mueblePts(m);
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  assert.ok(Math.abs(Math.max(...xs) - 0.05) < 1e-9 && Math.abs(Math.max(...ys) - 1.2) < 1e-9, 'girado 90°, el largo va en y');
  const v = B.muebleDesde(B.catalogoPorId('vit-vert'), 1, 1, 'v');
  const cajas = B.muebleCajas(v); assert.equal(cajas.length, 2); assert.equal(cajas[1].z0, 0.5); assert.equal(cajas[1].h, 1.5);
  assert.equal(B.mueblePts(B.muebleDesde(B.catalogoPorId('poste'), 0, 0, 'p')).length, 24);
});

test('el modelo conserva muebles y la biblioteca propia; el CSV cuenta por sala', () => {
  const p = M.nuevoProyecto('b'); const s = M.nuevaSala({ nombre: 'Sala' }); p.salas.push(s);
  s.entidades.push(B.muebleDesde(B.catalogoPorId('ped-40-110'), 1, 1, 'a'), B.muebleDesde(B.catalogoPorId('ped-40-110'), 2, 1, 'b'), B.muebleDesde(B.catalogoPorId('banca'), 3, 3, 'c'));
  p.biblioteca.push(B.entradaDesde(s.entidades[2], 'bb'));
  const q = M.parsear(M.serializar(p)).proyecto;
  assert.equal(q.salas[0].entidades.filter((e) => e.tipo === 'mueble').length, 3);
  assert.equal(q.biblioteca.length, 1); assert.equal(q.biblioteca[0].cat, 'propios'); assert.equal(q.biblioteca[0].nombre, 'Banca 150×45×45');
  const csv = B.csvMobiliario(q); const lineas = csv.split('\r\n');
  assert.equal(lineas.length, 3);
  assert.ok(lineas.some((l) => l.includes('Pedestal 40×40×110') && l.endsWith('"2"')));
  // planta: selección y caja
  assert.equal(G.tocar(q.salas[0].entidades, { x: 1.1, y: 1.1 }, 0.05), 'a');
  assert.ok(G.caja(q.salas[0].entidades).w > 2);
  const svg = G.svgDibujo(q.salas[0], { k: 0.01 }); assert.ok(svg.cuerpo.includes('Banca'));
  // 3D: tres prismas de mobiliario
  const piezas = I.escena(q, q.salas[0], I.camDefecto());
  assert.equal(piezas.filter((z) => z.tipo === 'prisma').length, 3);
});
