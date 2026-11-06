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

test('vanos: la ventana usa su alféizar y su alto; sin datos, 0,90–2,10; la puerta, su alto', () => {
  const p = M.nuevoProyecto('vanos');
  const s = M.nuevaSala({ nombre: 'V' }); p.salas.push(s);
  s.entidades.push({ id: 'L', tipo: 'linea', pts: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }], cerrada: true, altura: 2.97, espesor: 0.2, cara: 'fuera' });
  s.entidades.push({ id: 'V1', tipo: 'ventana', a: { x: 1, y: 0 }, b: { x: 2.154, y: 0 }, esp: 0.2, alfeizar: 0.868, alto: 2.11 });
  s.entidades.push({ id: 'V2', tipo: 'ventana', a: { x: 4, y: 0 }, b: { x: 5, y: 0 }, esp: 0.2 });
  s.entidades.push({ id: 'P', tipo: 'puerta', a: { x: 0, y: 1 }, b: { x: 0, y: 2 }, lado: 1, bisagra: 'a', alto: 2.4 });
  const piezas = I.escena(p, s, { ...I.camDefecto(), muros: 'completos' });
  const huecos = piezas.flatMap((pz) => pz.caras).filter((c) => c.pts3 && c.pts3.length === 4 && (c.fill === '#dfe8ee' || c.fill === '#ffffff') && !c.linea);
  const rango = (filtro) => { const zs = huecos.filter(filtro).flatMap((c) => c.pts3.map((q) => q[2])); return [Math.min(...zs), Math.max(...zs)]; };
  const enY0 = (x0, x1) => (c) => c.fill === '#dfe8ee' && c.pts3.every((q) => q[0] >= x0 - 1e-6 && q[0] <= x1 + 1e-6);
  const [a0, a1] = rango(enY0(1, 2.154));
  assert.ok(Math.abs(a0 - 0.868) < 1e-9 && Math.abs(a1 - 2.97) < 1e-9, `ventana con ficha: ${a0}–${a1} (llega al remate del muro, 2,978 > 2,97)`);
  const [b0, b1] = rango(enY0(4, 5));
  assert.ok(Math.abs(b0 - 0.9) < 1e-9 && Math.abs(b1 - 2.1) < 1e-9, `ventana sin datos: ${b0}–${b1}`);
  const [c0, c1] = rango((c) => c.fill === '#ffffff' && c.pts3.every((q) => Math.abs(q[0]) < 0.25 && q[1] >= 1 - 1e-6 && q[1] <= 2 + 1e-6));
  assert.ok(Math.abs(c0) < 1e-9 && Math.abs(c1 - 2.4) < 1e-9, `puerta: ${c0}–${c1}`);
});

const dentro = (p, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const salaCon = (linea) => { const p = M.nuevoProyecto('m'); const s = M.nuevaSala({ nombre: 'M' }); p.salas.push(s); s.entidades.push(linea); return { p, s }; };

test('esquinas: los muros se unen a inglete, sin hueco en la esquina exterior ni testas intermedias', () => {
  const { p, s } = salaCon({ id: 'L', tipo: 'linea', pts: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 5 }, { x: 0, y: 5 }], cerrada: true, altura: 3, espesor: 0.15, cara: 'fuera' });
  for (const giro of [0, 35, 125, 200, 290]) {
    const piezas = I.escena(p, s, { ...I.camDefecto(), giro, muros: 'completos' });
    const caras = piezas.filter((pz) => pz.tipo === 'muro').flatMap((pz) => pz.caras);
    const tapas = caras.filter((c) => !c.linea && c.fill === '#ffffff' && c.pts3.every((q) => Math.abs(q[2] - 3) < 1e-9)).map((c) => c.pts3);
    for (const esq of [[-0.15, -0.15], [8.15, -0.15], [8.15, 5.15], [-0.15, 5.15]].map(([x, y]) => [x * 0.999 + 0.0005 * Math.sign(4 - x), y * 0.999 + 0.0005 * Math.sign(2.5 - y)])) {
      assert.ok(tapas.some((t) => dentro(esq, t)), `giro ${giro}: esquina exterior ${esq} cubierta`);
    }
    assert.equal(caras.filter((c) => c.fill === '#dcdad2').length, 0, `giro ${giro}: una sala cerrada no tiene testas`);
  }
});

test('esquinas: una línea abierta lleva testa entera solo en sus dos extremos', () => {
  const { p, s } = salaCon({ id: 'L', tipo: 'linea', pts: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }], cerrada: false, altura: 2.5, espesor: 0.2, cara: 'fuera' });
  const piezas = I.escena(p, s, { ...I.camDefecto(), giro: 45, inclinacion: 35, muros: 'completos' }); // de frente al vértice intermedio
  const testas = piezas.flatMap((pz) => pz.caras).filter((c) => c.fill === '#dcdad2');
  const enExtremo = (c, x, y) => c.pts3.some((q) => Math.hypot(q[0] - x, q[1] - y) < 1e-9);
  assert.ok(testas.length > 0, 'el extremo visible lleva testa');
  assert.ok(testas.every((c) => enExtremo(c, 0, 0) || enExtremo(c, 4, 3)), 'ninguna testa en el vértice intermedio');
});

test('esquinas: un tramo corto entre tramos largos se corta o no con ellos (sin muescas)', () => {
  // sala con un retranqueo de 10 cm y una mocheta de 15 cm junto a una puerta
  const { p, s } = salaCon({ id: 'L', tipo: 'linea', cerrada: false, altura: 2.97, espesor: 0.26, cara: 'fuera',
    pts: [{ x: 4.664, y: 0.154 }, { x: 4.404, y: 0.154 }, { x: 4.404, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1.994 }, { x: 0.1027, y: 1.994 }, { x: 0.1027, y: 5.213 }, { x: 4.404, y: 5.213 }, { x: 4.404, y: 1.18 }, { x: 4.664, y: 1.18 }] });
  // tramos: 0 jamba, 1 mocheta, 2 muro del baño, 3 y 5 muro con retranqueo (4), 6 ventana, 7 muro derecho, 8 jamba
  const largos = { 0: [2], 1: [2], 4: [3, 5], 8: [7] }; // tramo corto → tramos largos de los que depende
  for (let giro = 0; giro < 360; giro += 15) {
    const frente = {};
    for (const pz of I.escena(p, s, { ...I.camDefecto(), giro, muros: 'cortados' })) if (pz.tipo === 'muro') frente[pz.tramo.split(':')[1]] = pz.frente;
    for (const [corto, deps] of Object.entries(largos)) {
      const ds = deps.map((j) => frente[j]);
      if (ds.every((v) => v === ds[0])) assert.equal(frente[corto], ds[0], `giro ${giro}: el tramo ${corto} sigue a ${deps}`);
    }
  }
});

test('centro de giro: por defecto el medio de lo dibujado; un centro elegido manda', () => {
  const { s } = sala();
  const c = I.centroGiro(s, I.camDefecto());
  assert.ok(Math.abs(c.x - 4) < 0.2 && Math.abs(c.y - 2.5) < 0.2, 'medio de la sala de 8 × 5');
  assert.deepEqual(I.centroGiro(s, { centro: { x: 1, y: 2 } }), { x: 1, y: 2 });
  assert.deepEqual(I.centroGiro({ entidades: [] }, I.camDefecto()), { x: 0, y: 0 });
  assert.notEqual(I.centroGiro(s, { centro: { x: NaN, y: 2 } }).x, NaN);
  assert.equal(I.soloCam({ centro: { x: 1, y: 2 } }).centro.x, 1, 'la cámara guarda el centro');
  assert.equal(I.camDefecto().centro, null);
});

test('al orbitar, el centro no se mueve de la pantalla aunque la sala esté lejos del origen', () => {
  const centro = { x: -224, y: -50 }; let view = { s: 40, ox: 300, oy: 200 };
  const pantalla = (v, cam) => { const p = I.proyector(cam)(centro.x, centro.y, 0); return { x: v.ox + p.X * v.s, y: v.oy + p.Y * v.s }; };
  let cam = { giro: 35, inclinacion: 35 }; const inicio = pantalla(view, cam);
  for (const giro of [0, 90, 123, 359]) for (const inclinacion of [15, 60, 90]) {
    const nueva = { giro, inclinacion }; view = I.viewOrbitado(view, cam, nueva, centro); cam = nueva;
    const p = pantalla(view, cam); assert.ok(Math.hypot(p.x - inicio.x, p.y - inicio.y) < 1e-6);
  }
  assert.equal(view.s, 40, 'no cambia el zoom');
});

test('viewCentrado lleva el punto al medio del lienzo; desproyectar invierte la proyección', () => {
  const cam = { giro: 217, inclinacion: 28 }, q = { x: 12.5, y: -7.25 };
  const v = I.viewCentrado({ s: 50, ox: 0, oy: 0 }, cam, q, 800, 600);
  const p = I.proyector(cam)(q.x, q.y, 0);
  assert.ok(Math.abs(v.ox + p.X * 50 - 400) < 1e-9 && Math.abs(v.oy + p.Y * 50 - 300) < 1e-9);
  const r = I.desproyectar(cam, p.X, p.Y, 0); assert.ok(Math.hypot(r.x - q.x, r.y - q.y) < 1e-9);
  const a = I.proyector(cam)(q.x, q.y, 2); const r2 = I.desproyectar(cam, a.X, a.Y, 2); assert.ok(Math.hypot(r2.x - q.x, r2.y - q.y) < 1e-9);
});
