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

// ---------- fase 2: lo que va sobre el muro ----------
const salaArco = () => { // medio círculo de radio 4, de (0,0) a (8,0), hacia y negativa o positiva según f
  const pr = M.nuevoProyecto('c'); const s = M.nuevaSala({ nombre: 'Norte' }); pr.salas = [s];
  const L = { id: 'L', tipo: 'linea', pts: [p(0, 0), p(8, 0)], curvas: { 0: 4 }, espesor: 0.2, cara: 'fuera', altura: 3 };
  s.entidades.push(L);
  const g = G.arco(p(0, 0), p(8, 0), 4);
  return { pr, s, L, g };
};
const cuadroEn = (pr, s, g, t0, t1, lado) => {
  const o = M.nuevaObra({ nombre: 'A', ancho: 0, alto: 0.8 }); pr.obras.push(o);
  const q = { id: 'C' + s.entidades.length, tipo: 'cuadro', a: G.enArco(g, t0), b: G.enArco(g, t1), lado, obraId: o.id, num: '1', color: '#b06a36' };
  s.entidades.push(q); return { q, o };
};

test('cuadro sobre un arco: reconoce su muro y se apoya en la cara correcta', () => {
  const { pr, s, L, g } = salaArco();
  const { q } = cuadroEn(pr, s, g, 0.45, 0.55, 1);
  const h = G.lineaBajo(s.entidades, q.a, q.b); assert.equal(h.e, L);
  assert.ok(!G.lineaBajo(s.entidades, p(2, 0), p(6, 0)), 'la cuerda ya no está sobre el muro');
  const w = G.dist(q.a, q.b); const n = G.perp(G.unit(G.sub(q.b, q.a)));
  // el espesor crece hacia la normal izquierda (fuera, por ser línea abierta): una cara lleva el espesor y la sagita; la otra, nada
  const gc = G.cuadroGeom(q, s.entidades); const otro = G.cuadroGeom({ ...q, lado: -1 }, s.entidades);
  const conv = [gc, otro].find((x) => x.s0 > 0.1), conc = [gc, otro].find((x) => x.s0 < 0.1);
  assert.ok(conv && conc, `s0 ${gc.s0} / ${otro.s0}`); cerca(conv.s0, 0.2 + G.sagitaCuerda(4, w), 1e-6); cerca(conc.s0, 0); assert.ok(n);
});

test('el ancho de una pieza sobre un arco deja su extremo sobre el arco', () => {
  const { pr, s, L, g } = salaArco(); const { q } = cuadroEn(pr, s, g, 0.2, 0.3, 1);
  q.b = G.finConAncho(q, s.entidades, 1.5);
  cerca(G.dist(q.a, q.b), 1.5, 1e-4); cerca(G.cercaTramo(L, G.segmentos(L)[0], q.b).d, 0, 1e-4);
  assert.ok(G.cercaTramo(L, G.segmentos(L)[0], q.b).t > 0.2, 'avanza hacia donde iba');
  const r = { tipo: 'cuadro', a: p(0, 0), b: p(1, 0) }; assert.deepEqual(G.finConAncho(r, [], 3), p(3, 0));
});

test('alzado de un tramo curvo: desenrollado, con cada cuadro en su posición sobre el arco', async () => {
  const P = await import('../src/core/puente.js');
  const { pr, s, L, g } = salaArco(); const { q, o } = cuadroEn(pr, s, g, 0.25, 0.3, 1);
  const cara = Math.sign(G.dot(G.mul(G.perp(G.unit(G.sub(q.b, q.a))), 1), G.normalEn(L, G.segmentos(L)[0], G.medio(q.a, q.b)))) || 1;
  const m = P.muroDesdeTramo(pr, s, L, 0, cara);
  cerca(m.ancho, g.L, 1e-5); assert.match(m.nombre, /curvo/); assert.equal(m.colgado.length, 1);
  const izqEsA = P.extremoIzquierdo(L.pts[0], L.pts[1], cara) === 'a';
  const esperado = izqEsA ? 0.25 * g.L : (1 - 0.3) * g.L; cerca(m.colgado[0].x, esperado, 1e-3);
  cerca(o.ancho, G.dist(q.a, q.b), 1e-5); cerca(P.largoDelTramo(L, 0), g.L, 1e-6);
});

test('los cuadros en lados opuestos del arco van a alzados distintos, incluso en un arco largo', async () => {
  const P = await import('../src/core/puente.js');
  const { pr, s, L, g } = salaArco();
  cuadroEn(pr, s, g, 0.05, 0.1, 1); cuadroEn(pr, s, g, 0.9, 0.95, 1); cuadroEn(pr, s, g, 0.5, 0.55, -1);
  const r = P.cuadrosDelTramo(s, L, 0); assert.equal(r.length, 3);
  assert.equal(r[0].cara, r[1].cara, 'el mismo lado a ambos extremos del arco'); assert.notEqual(r[0].cara, r[2].cara);
});

test('3D: el cuadro en un arco aparece una vez y el vano corta las caras que le tocan, con jambas solo en sus extremos', () => {
  const { pr, s, L, g } = salaArco(); const { q } = cuadroEn(pr, s, g, 0.2, 0.3, -1);
  s.entidades.push({ id: 'D', tipo: 'puerta', a: G.enArco(g, 0.6), b: G.enArco(g, 0.7), lado: 1, bisagra: 'a' });
  const contar = (giro) => { const z = I.escena(pr, s, { ...I.camDefecto(), muros: 'completos', giro }); return { cuadros: z.filter((x) => x.tipo === 'cuadro').length, huecos: z.flatMap((x) => x.caras).filter((c) => c.fill === '#ffffff' && c.pts3 && c.pts3.some((v) => v[2] === 0) && c.pts3.some((v) => Math.abs(v[2] - 2.1) < 1e-9)).length, jambas: z.flatMap((x) => x.caras).filter((c) => c.linea && c.stroke === '#8a8a84' && c.pts3[0][0] === c.pts3[1][0] && c.pts3[0][1] === c.pts3[1][1]).length }; };
  const vistos = [0, 90, 180, 270].map(contar);
  assert.ok(vistos.some((v) => v.cuadros === 1), 'visible desde algún lado'); assert.ok(vistos.every((v) => v.cuadros <= 1), 'nunca duplicado');
  const con = vistos.find((v) => v.huecos > 1); assert.ok(con, 'el vano recorre varias caras'); assert.equal(con.jambas, 2, 'dos jambas');
  assert.ok(q);
});

test('planta: el vano corta el muro curvo, también sin espesor', () => {
  const { s, g } = salaArco();
  s.entidades.push({ id: 'D', tipo: 'puerta', a: G.enArco(g, 0.4), b: G.enArco(g, 0.6), lado: 1, bisagra: 'a' });
  const an = G.anfitrion(s.entidades, s.entidades[1].a, s.entidades[1].b);
  assert.ok(an && an.ext > 0); const w = G.dist(s.entidades[1].a, s.entidades[1].b); cerca(an.ext, G.sagitaCuerda(4, w));
  assert.ok(G.svgDibujo({ entidades: s.entidades, rotulo: 0.2 }, { k: 0.01 }).cuerpo.includes('fill="#ffffff"'));
  s.entidades[0].espesor = 0;
  const svg = G.svgDibujo({ entidades: s.entidades, rotulo: 0.2 }, { k: 0.01 }).cuerpo;
  assert.match(svg, /<path d="M[^"]+" fill="none" stroke="#ffffff"/, 'borra el arco, no la cuerda');
});
