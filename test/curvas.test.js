import { test } from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/core/planta.js';
import * as M from '../src/core/modelo.js';
import * as I from '../src/core/isometrica.js';

const cerca = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
const p = (x, y) => ({ x, y });
const arcoLinea = (f = 1) => ({ id: 'L', tipo: 'linea', pts: [p(0, 0), p(4, 0)], curvas: { 0: f } });

test('arco: medio círculo con flecha igual a media cuerda', () => {
  const g = G.arco(p(0, 0), p(4, 0), 2);
  cerca(g.R, 2); cerca(g.L, 2 * Math.PI); cerca(g.c.x, 2); cerca(g.c.y, 0);
  const m = G.enArco(g, 0.5); cerca(m.x, 2); cerca(m.y, 2); // perp((1,0)) = (0,1)
  const f = G.enArco(g, 1); cerca(f.x, 4); cerca(f.y, 0);
});

test('arco: la flecha negativa se curva al otro lado; más de media cuerda da el arco largo', () => {
  const m = G.enArco(G.arco(p(0, 0), p(4, 0), -1), 0.5); cerca(m.x, 2); cerca(m.y, -1);
  const g = G.arco(p(0, 0), p(4, 0), 3); assert.ok(g.phi > Math.PI / 2 && g.L > 2 * Math.PI);
  const a = G.enArco(g, 0.5); cerca(a.y, 3);
});

test('sin curvas, todo sigue igual: mismos puntos, tramos y medidas', () => {
  const e = { tipo: 'linea', pts: [p(0, 0), p(4, 0), p(4, 3), p(0, 3)], cerrada: true };
  assert.equal(G.polilinea(e), e.pts);
  assert.deepEqual(G.finos(e), G.segmentos(e));
  cerca(G.longitudLinea(e), 14); cerca(G.areaLinea(e), 12);
  assert.equal(G.contornoDe(e), e.pts);
});

test('longitud y área: un círculo hecho de cuatro arcos', () => {
  const e = G.circuloAMuro({ c: p(10, -5), r: 3 });
  cerca(G.longitudLinea(e), 2 * Math.PI * 3, 1e-3);
  cerca(G.areaLinea(e), Math.PI * 9, 1e-3);
  assert.ok(G.contornoDe(e).length > 40, 'el contorno sigue el arco');
  const bb = G.caja([e], 0); cerca(bb.w, 6, 0.01); cerca(bb.h, 6, 0.01);
  const f = G.lineaFina(e); assert.ok(f.cerrada); assert.deepEqual(new Set(f.orig), new Set([0, 1, 2, 3]));
  cerca(f.u1[f.u1.length - 1], Math.PI * 3 / 2, 1e-6);
  for (const q of f.pts) cerca(G.dist(q, e.pts[0]) >= 0 ? Math.hypot(q.x - 10, q.y + 5) : 0, 3, 1e-3);
});

test('un arco hacia dentro resta área al polígono', () => {
  const r = { tipo: 'linea', pts: [p(0, 0), p(4, 0), p(4, 4), p(0, 4)], cerrada: true };
  const fuera = { ...r, curvas: { 0: -1 } }, dentro = { ...r, curvas: { 0: 1 } }; // en este sentido, perp(1,0) apunta adentro
  const seg = (() => { const g = G.arco(p(0, 0), p(4, 0), 1); return g.R * g.R / 2 * (2 * g.phi - Math.sin(2 * g.phi)); })();
  cerca(G.areaLinea(fuera), 16 + seg); cerca(G.areaLinea(dentro), 16 - seg);
});

test('cercaTramo: distancia y posición sobre el arco, también fuera de él', () => {
  const e = arcoLinea(2); const seg = G.segmentos(e)[0];
  const r = G.cercaTramo(e, seg, p(2, 3)); cerca(r.d, 1); cerca(r.t, 0.5); cerca(r.u, Math.PI); cerca(r.q.y, 2);
  const c = G.cercaTramo(e, seg, p(2 + 2 * Math.SQRT1_2, 2 * Math.SQRT1_2)); cerca(c.d, 0); cerca(c.t, 0.75);
  const fuera = G.cercaTramo(e, seg, p(5, -1)); assert.equal(fuera.t, 1); cerca(fuera.d, Math.SQRT2);
  const n = G.normalEn(e, seg, p(2, 3)); cerca(n.x, 0); cerca(n.y, 1);
});

test('tocar e imán siguen la curva, no la cuerda', () => {
  const e = arcoLinea(1);
  assert.equal(G.tocar([e], p(2, 1), 0.05), 'L');
  assert.equal(G.tocar([e], p(2, 0), 0.05), null);
  const m = G.imanar(p(2.02, 1.01), { entidades: [e], tol: 0.1 }); assert.equal(m.tipo, 'medio'); cerca(m.p.y, 1);
  const l = G.imanar(p(1, 0.8), { entidades: [e], tol: 0.2 }); assert.equal(l.tipo, 'linea');
  assert.ok(Math.abs(Math.hypot(l.p.x - 2, l.p.y - G.arco(p(0, 0), p(4, 0), 1).c.y) - G.arco(p(0, 0), p(4, 0), 1).R) < 0.01, 'el punto cae sobre el arco');
});

test('insertar un punto parte el arco en dos del mismo círculo y renumera los tramos siguientes', () => {
  const e = { id: 'L', tipo: 'linea', pts: [p(0, 0), p(4, 0), p(4, 4)], curvas: { 0: 1, 1: 0.5 } };
  const L0 = G.longitudLinea(e);
  const g = G.arco(p(0, 0), p(4, 0), 1), q = G.enArco(g, 0.25);
  const i = G.insertarVertice(e, q, 0.05);
  assert.equal(i, 1); assert.equal(e.pts.length, 4);
  cerca(G.longitudLinea(e), L0, 1e-3);
  cerca(e.curvas[2], 0.5);
  assert.equal(Math.sign(e.curvas[0]), 1); assert.equal(Math.sign(e.curvas[1]), 1);
  cerca(G.arco(e.pts[0], e.pts[1], e.curvas[0]).R, g.R, 1e-3); cerca(G.arco(e.pts[1], e.pts[2], e.curvas[1]).R, g.R, 1e-3);
});

test('borrar un punto funde sus dos tramos en uno recto y conserva las demás curvas', () => {
  const e = { tipo: 'linea', pts: [p(0, 0), p(2, 0), p(4, 0), p(6, 0), p(8, 0)], curvas: { 0: 0.3, 1: 0.5, 3: 0.2 } };
  G.borrarVertice(e, 1); assert.deepEqual(e.curvas, { 2: 0.2 });
  const c = { tipo: 'linea', pts: [p(0, 0), p(4, 0), p(4, 4), p(0, 4)], cerrada: true, curvas: { 0: 1, 1: 1, 3: 1 } };
  G.borrarVertice(c, 0); assert.deepEqual(c.curvas, { 0: 1 }, 'el tramo 1 pasa a ser el 0; los que tocaban el punto 0 se funden');
  const s = { tipo: 'linea', pts: [p(0, 0), p(2, 0), p(4, 0)], curvas: { 0: 1 } };
  G.borrarVertice(s, 1); assert.equal(s.curvas, undefined);
});

test('mover un vértice conserva la forma del arco; estirar lo escala a la medida pedida sobre el arco', () => {
  const e = { tipo: 'linea', pts: [p(0, 0), p(4, 0)], curvas: { 0: 2 } };
  G.fijarAsa(e, 1, p(8, 0)); cerca(e.curvas[0], 4); cerca(G.longitudLinea(e), 4 * Math.PI);
  assert.ok(G.estirarLinea(e, 0, 2 * Math.PI)); cerca(G.longitudLinea(e), 2 * Math.PI, 1e-4); cerca(e.curvas[0], 2, 1e-4);
  const r = { tipo: 'linea', pts: [p(0, 0), p(3, 0), p(3, 3)] }; assert.ok(G.estirarLinea(r, 0, 5)); assert.deepEqual(r.pts, [p(0, 0), p(5, 0), p(5, 3)]);
});

test('fijarCurva: cero la quita; flechaDeRadio', () => {
  const e = arcoLinea(1); G.fijarCurva(e, 0, 0); assert.equal(e.curvas, undefined);
  cerca(G.flechaDeRadio(4, 2), 2); cerca(G.flechaDeRadio(4, 2.5), 1); cerca(G.flechaDeRadio(4, 2.5, true), 4);
  assert.equal(G.flechaDeRadio(4, 1.9), null);
  const g = G.arco(p(0, 0), p(4, 0), G.flechaDeRadio(4, 3)); cerca(g.R, 3);
});

test('muro con espesor: la banda corre paralela al arco, sin pliegues', () => {
  const e = { id: 'L', tipo: 'linea', pts: [p(0, 0), p(8, 0)], curvas: { 0: 2 }, espesor: 0.2, cara: 'fuera' };
  const g = G.arco(p(0, 0), p(8, 0), 2), cb = G.contornoBanda(e);
  const extDe = (P) => Math.max(...P.map((q) => Math.abs(Math.hypot(q.x - g.c.x, q.y - g.c.y) - g.R)));
  cerca(extDe(cb.A), 0.2, 2e-3); cerca(extDe(cb.B), 0, 2e-3);
  const svg = G.svgDibujo({ entidades: [e], rotulo: 0.2 }, { k: 0.01 }).cuerpo;
  assert.ok((svg.match(/ L/g) || []).length > 20, 'dibujado como curva');
});

test('rótulo de un tramo curvo: su longitud de arco, junto al arco', () => {
  const e = { ...arcoLinea(2), medidas: true };
  const [t] = G.etiquetasTramos(e, 0.2); cerca(t.L, 2 * Math.PI); assert.ok(Math.abs(t.y - 2) < 0.5, 'junto al arco, no en la cuerda');
});

test('las curvas sobreviven a abrir el proyecto; las inválidas se descartan', () => {
  const pr = M.nuevoProyecto('c'); const s = M.nuevaSala({ nombre: 'S' }); pr.salas = [s];
  s.entidades.push({ id: 'L', tipo: 'linea', pts: [p(0, 0), p(4, 0), p(4, 4)], curvas: { 0: 1.5, 1: 'x', 9: 2 } });
  s.entidades.push({ id: 'R', tipo: 'linea', pts: [p(0, 0), p(4, 0)] });
  const { proyecto: q } = M.parsear(JSON.stringify(pr));
  const [l, r] = q.salas[0].entidades; assert.deepEqual(l.curvas, { 0: 1.5 }); assert.equal(r.curvas, undefined);
});

test('3D: un arco se levanta en caras cortas con el número y la altura de su tramo, sin aristas entre ellas', () => {
  const pr = M.nuevoProyecto('c'); const s = M.nuevaSala({ nombre: 'S' }); pr.salas = [s];
  s.entidades.push({ id: 'L', tipo: 'linea', pts: [p(0, 0), p(8, 0), p(8, 5), p(0, 5)], cerrada: true, altura: 3, alturas: { 1: 4 }, espesor: 0.2, cara: 'fuera', curvas: { 1: -2 } });
  const muros = I.escena(pr, s, { ...I.camDefecto(), muros: 'completos', giro: 200 }).filter((z) => z.tipo === 'muro');
  const delArco = muros.filter((z) => z.tramo === 'L:1'), rectos = muros.filter((z) => z.tramo === 'L:0');
  assert.ok(delArco.length > 15, 'muchas caras'); assert.ok(rectos.length > 0);
  assert.deepEqual([...new Set(muros.map((z) => z.tramo))].sort(), ['L:0', 'L:1', 'L:2', 'L:3'], 'los tramos conservan su número');
  const alto = (z) => Math.max(...z.caras.flatMap((c) => (c.pts3 || []).map((q) => q[2])));
  for (const z of delArco) assert.equal(alto(z), 4); for (const z of rectos) assert.equal(alto(z), 3);
  const verticales = (z) => z.caras.filter((c) => c.linea && c.pts3[0][0] === c.pts3[1][0] && c.pts3[0][1] === c.pts3[1][1]).length;
  assert.ok(delArco.slice(1, -1).every((z) => verticales(z) === 0), 'sin aristas verticales dentro del arco');
});

test('3D: el piso sigue el arco', () => {
  const pr = M.nuevoProyecto('c'); const s = M.nuevaSala({ nombre: 'S' }); pr.salas = [s];
  s.entidades.push({ id: 'L', tipo: 'linea', pts: [p(0, 0), p(8, 0), p(8, 5), p(0, 5)], cerrada: true, curvas: { 1: -2 } });
  const piso = I.escena(pr, s, { ...I.camDefecto(), inclinacion: 90, giro: 0 }).find((z) => z.tipo === 'piso');
  const xs = piso.caras[0].pts.map((q) => q[0]); cerca(Math.max(...xs), 10, 1e-2);
});
