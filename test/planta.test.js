import { test } from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/core/planta.js';

const calco = (mpp) => ({ w: 1600, h: 1100, mpp, x: 0, y: 0, rot: 0 });

test('calcoDudoso: acepta salas normales y marca las escalas absurdas', () => {
  assert.equal(G.calcoDudoso(calco(0.01)), false); // 16 m de lado
  assert.equal(G.calcoDudoso(calco(0.25)), false); // 400 m, un plano de conjunto
  assert.equal(G.calcoDudoso(calco(1 / 0.7)), true); // 1 m = 0,7 px: unos 2.300 m
  assert.equal(G.calcoDudoso(calco(0.0001)), true); // 16 cm
});

test('calibrar con 350 en vez de 3,50 da una imagen dudosa; con 3,50 no', () => {
  const c = calco(10 / 1600);
  const a = { x: 2, y: 2 }, b = { x: 6, y: 2 };
  assert.equal(G.calcoDudoso(G.calibrarCalco(c, a, b, 350)), true);
  assert.equal(G.calcoDudoso(G.calibrarCalco(c, a, b, 3.5)), false);
});

test('zoomMinimo: 2 px/m en lo normal, menos solo si el contenido no cabe', () => {
  assert.equal(G.zoomMinimo(null, 900, 700), 2);
  assert.equal(G.zoomMinimo({ x: 0, y: 0, w: 20, h: 10 }, 900, 700), 2);
  const bb = { x: 0, y: 0, w: 2300, h: 1600 };
  const z = G.zoomMinimo(bb, 900, 700);
  assert.ok(z < 2);
  assert.ok(bb.w * z <= 900 && bb.h * z <= 700, 'con el zoom mínimo todo cabe en el lienzo');
});
