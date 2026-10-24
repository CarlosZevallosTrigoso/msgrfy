import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/core/modelo.js';
import * as I from '../src/core/isometrica.js';

const sala = () => {
  const p = M.nuevoProyecto('iso');
  const s = M.nuevaSala({ nombre: 'S' }); p.salas.push(s);
  s.entidades.push({ id: 'L', tipo: 'linea', pts: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 5 }, { x: 0, y: 5 }], cerrada: true, altura: 3, espesor: 0.15, cara: 'fuera' });
  const o = M.nuevaObra({ nombre: 'A', ancho: 1.2, alto: 0.8, estimado: { ancho: false, alto: false } }); p.obras.push(o);
  s.entidades.push({ id: 'C', tipo: 'cuadro', a: { x: 1, y: 0 }, b: { x: 2.2, y: 0 }, lado: 1, obraId: o.id, num: '1' });
  s.entidades.push({ id: 'P', tipo: 'puerta', a: { x: 8, y: 1 }, b: { x: 8, y: 2 }, lado: 1, bisagra: 'a' });
  s.entidades.push({ id: 'O', tipo: 'obra', pts: [{ x: 3, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 3, y: 3 }], alto: 1.2, obraId: o.id, num: '2' });
  s.entidades.push({ id: 'K', tipo: 'circulo', c: { x: 6, y: 3 }, r: 0.3 });
  return { p, s };
};

test('proyector: cenital conserva la planta; la profundidad crece hacia la cámara', () => {
  const P = I.proyector({ giro: 0, inclinacion: 90 });
  const a = P(2, 3, 0); assert.ok(Math.abs(a.X - 2) < 1e-9 && Math.abs(a.Y - 3) < 1e-9);
  const b = P(2, 3, 5); assert.ok(Math.abs(b.Y - 3) < 1e-9, 'la altura no se ve desde arriba');
  const Q = I.proyector({ giro: 0, inclinacion: 30 });
  assert.ok(Q(0, 0, 1).Y < Q(0, 0, 0).Y, 'z hacia arriba sube en pantalla');
  assert.ok(Q(0, 5, 0).d > Q(0, 0, 0).d, 'y mayor = más cerca de la cámara con giro 0');
  const S = I.proyector({ giro: 90, inclinacion: 30 });
  assert.ok(S(5, 0, 0).d > S(0, 0, 0).d, 'con giro 90 la cámara está hacia +x');
  assert.ok(Math.abs(S.vista.x - 1) < 1e-9, 'vista apunta a +x');
  const R = I.proyector({ giro: 180, inclinacion: 30 });
  assert.ok(R(0, 5, 0).d < R(0, 0, 0).d, 'girando 180° se invierte');
});

test('escena: con giro 0 el muro de arriba es del fondo (completo) y el de abajo de frente (cortado)', () => {
  const { p, s } = sala();
  const cam = { ...I.camDefecto(), giro: 0, inclinacion: 35, muros: 'cortados', zocalo: 0.9 };
  const piezas = I.escena(p, s, cam);
  const muros = piezas.filter((z) => z.tipo === 'muro');
  const tramos = (ms) => new Set(ms.map((m) => m.tramo));
  assert.equal(tramos(muros).size, 4);
  assert.equal(tramos(muros.filter((m) => m.frente)).size, 1, 'con giro 0 exacto solo el muro de abajo da la espalda; los laterales quedan de canto');
  assert.equal(tramos(I.escena(p, s, { ...cam, giro: 35 }).filter((z) => z.tipo === 'muro' && z.frente)).size, 2, 'con giro 35 dan la espalda dos');
  // el muro superior (y=0) tiene su cara interior hacia +y = hacia la cámara → completo
  const sup = muros.find((m) => !m.frente && m.dmin < 0.5); assert.ok(sup, 'muro superior completo');
  const alturaSup = Math.max(...sup.caras.flatMap((c) => c.pts.map((pt) => pt[1]))) - Math.min(...sup.caras.flatMap((c) => c.pts.map((pt) => pt[1])));
  const inf = muros.find((m) => m.frente);
  const alturaInf = Math.max(...inf.caras.flatMap((c) => c.pts.map((pt) => pt[1]))) - Math.min(...inf.caras.flatMap((c) => c.pts.map((pt) => pt[1])));
  assert.ok(alturaInf < alturaSup, 'el muro de frente es más bajo (zócalo)');
  assert.ok(piezas.some((z) => z.tipo === 'cuadro'), 'el cuadro del muro del fondo se dibuja');
  assert.equal(piezas.filter((z) => z.tipo === 'prisma').length, 2, 'obra en planta y columna');
  assert.ok(piezas.some((z) => z.tipo === 'piso'));
  // con muros transparentes el cuadro del frente seguiría oculto, pero el prisma se ve igual
  const t = I.escena(p, s, { ...cam, muros: 'transparentes' });
  assert.equal(tramos(t.filter((z) => z.tipo === 'muro')).size, 4);
});

test('girando 180°, el muro de frente pasa a ser el del fondo', () => {
  const { p, s } = sala();
  const cam = { ...I.camDefecto(), giro: 180 };
  const muros = I.escena(p, s, cam).filter((z) => z.tipo === 'muro');
  // ahora el muro y=0 es de frente: el cuadro, que cuelga de él, no se dibuja
  assert.ok(!I.escena(p, s, cam).some((z) => z.tipo === 'cuadro'));
  assert.equal(new Set(muros.filter((m) => m.frente).map((m) => m.tramo)).size, 1);
  assert.equal(muros.find((m) => m.frente).tramo, 'L:0', 'el de frente es ahora el muro y=0');
});

test('svgDeIso devuelve un SVG con tamaño y las piezas ordenadas de lejos a cerca', () => {
  const { p, s } = sala();
  const r = I.svgDeIso(p, s, I.camDefecto(), 100);
  assert.ok(r.svg.startsWith('<?xml') && r.svg.includes('</svg>'));
  assert.ok(r.w > 0 && r.h > 0);
  assert.ok(r.svg.includes('<polygon'));
  const ds = r.piezas.slice().sort((a, b) => a.d - b.d).map((z) => z.d);
  assert.ok(r.piezas.slice().sort((a, b) => a.d - b.d).slice(0, 4).map((z) => z.tipo).join() === 'suelo,sombra,losa,piso', 'sombra, losa y piso van primero');
});

test('el cuadro toma el colgado del alzado si existe', async () => {
  const { p, s } = sala();
  const P2 = await import('../src/core/puente.js');
  const m = P2.muroDesdeTramo(p, s, s.entidades[0], 0); m.colgado[0].y = 0.2; p.muros.push(m); // cuelga muy arriba
  const cam = { ...I.camDefecto(), giro: 0, inclinacion: 90 };
  const cuadro = I.escena(p, s, cam).find((z) => z.tipo === 'cuadro');
  assert.ok(cuadro);
  // con inclinación 90 no se ve la altura: comprobamos con 30
  const c2 = I.escena(p, s, { ...cam, inclinacion: 30 }).find((z) => z.tipo === 'cuadro');
  const ys = c2.caras[0].pts.map((pt) => pt[1]); const top = Math.min(...ys);
  const P = I.proyector({ giro: 0, inclinacion: 30 });
  // el espesor crece hacia fuera: la cara interior está en y = 0 y el cuadro sobresale 3 cm hacia la sala
  assert.ok(Math.abs(top - P(1, 0.03, 3 - 0.2).Y) < 1e-6, 'borde superior a 2,8 m, como dice el colgado');
});

test('vistas guardadas: el encuadre relativo se reproduce con otra escala de encaje y la cámara no arrastra las vistas', () => {
  const view = { s: 90, ox: 120, oy: -40 }, w = 800, h = 600;
  const enc = I.encuadreDe(view, w, h, 60);
  assert.equal(enc.rel, 1.5);
  const v2 = I.viewDeEncuadre(enc, 1600, 1200, 120); // pantalla doble: misma vista, doble píxel
  assert.equal(v2.s, 180);
  // el punto proyectado del centro es el mismo
  assert.ok(Math.abs((1600 / 2 - v2.ox) / v2.s - enc.X) < 1e-9 && Math.abs((1200 / 2 - v2.oy) / v2.s - enc.Y) < 1e-9);
  const v = I.nuevaVista(' Entrada ', { giro: 120, inclinacion: 40, vistas: [1, 2] }, enc);
  assert.equal(v.nombre, 'Entrada'); assert.equal(v.cam.giro, 120); assert.equal(v.cam.vistas, undefined, 'la cámara de una vista no lleva vistas dentro');
  assert.equal(v.cam.muros, 'cortados', 'completa con los valores por defecto');
  assert.ok(I.vistaValida(v)); assert.ok(!I.vistaValida({ nombre: 'x', cam: {} }));
  assert.equal(I.soloCam({ giro: 1, vistas: [v] }).vistas, undefined);
});
