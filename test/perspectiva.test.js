import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/core/modelo.js';
import * as V from '../src/core/perspectiva.js';
import { muebleDesde, catalogoPorId } from '../src/core/biblioteca.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const sala = () => {
  const p = M.nuevoProyecto('pov');
  const s = M.nuevaSala({ nombre: 'S' }); p.salas.push(s);
  s.entidades.push({ id: 'L', tipo: 'linea', pts: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 5 }, { x: 0, y: 5 }], cerrada: true, altura: 3, espesor: 0.15, cara: 'fuera' });
  const o = M.nuevaObra({ nombre: 'A', ancho: 1.2, alto: 0.8, estimado: { ancho: false, alto: false }, imagenId: 'img1' }); p.obras.push(o); p.imagenes.img1 = PNG;
  s.entidades.push({ id: 'C', tipo: 'cuadro', a: { x: 3.4, y: 0 }, b: { x: 4.6, y: 0 }, lado: 1, obraId: o.id, num: '1' }); // centrado en x = 4, muro norte (y = 0)
  const per = muebleDesde(catalogoPorId('persona'), 4, 4, 'PER'); per.mira = -90; // mirando hacia −y: al muro del cuadro
  s.entidades.push(per);
  return { p, s, per, o };
};

test('proyector: lo que está delante queda delante, el centro de la mirada en el centro, y la izquierda a la izquierda', () => {
  const P = V.proyectorPov({ x: 0, y: 0, ojos: 1.6, mira: 0, cabeceo: 0, fov: 90 });
  const c = P(5, 0, 1.6); assert.ok(Math.abs(c.X) < 1e-9 && Math.abs(c.Y) < 1e-9, 'el punto al frente a la altura del ojo cae en el centro');
  assert.ok(P(5, 0, 3).Y < 0, 'más alto que el ojo: arriba en pantalla');
  // la planta tiene y hacia abajo en pantalla: quien mira a +x (derecha) tiene +y (abajo) a su derecha
  assert.ok(P(5, 2, 1.6).X > 0 && P(5, -2, 1.6).X < 0);
  assert.ok(Math.abs(P(5, 5, 1.6).X - 1) < 1e-9, 'con fov 90, el borde del campo es X = 1');
  assert.ok(P(10, 0, 0).d < P(5, 0, 0).d, 'más lejos = profundidad menor (se pinta antes)');
  assert.ok(P.visible({ x: -1, y: 0 }, { x: 5, y: 0 }), 'una cara cuya normal apunta al ojo es visible');
  assert.ok(!P.visible({ x: 1, y: 0 }, { x: 5, y: 0 }));
});

test('recorte contra el plano cercano: lo de detrás del ojo desaparece, lo que lo cruza se corta', () => {
  const tri = [{ a: 0, b: 0, c: -1 }, { a: 1, b: 0, c: 1 }, { a: -1, b: 0, c: 1 }];
  const r = V.recortarCerca(tri, 0.25);
  assert.equal(r.length, 4); assert.ok(r.every((q) => q.c >= 0.25 - 1e-12));
  assert.equal(V.recortarCerca([{ a: 0, b: 0, c: -2 }, { a: 1, b: 0, c: -1 }, { a: 0, b: 1, c: -1 }]).length, 0);
});

test('escena en perspectiva desde dentro: ningún muro es «de frente», las caras interiores miran al ojo y las tapas no se ven', () => {
  const { p, s, per } = sala();
  const pov = V.povDe(per); assert.equal(pov.ojos, 1.6); assert.equal(pov.mira, -90); assert.equal(pov.fov, 60);
  const piezas = V.escenaPov(p, s, pov);
  const muros = piezas.filter((z) => z.tipo === 'muro');
  assert.ok(muros.length > 0); assert.ok(muros.every((m) => !m.frente), 'desde dentro todos los muros están enteros');
  for (const m of muros) for (const c of m.caras) if (!c.linea && c.pts3.length === 4 && c.pts3.every(([, , z]) => z === 3)) assert.fail('tapa de muro visible desde abajo');
  const cuadro = piezas.find((z) => z.tipo === 'cuadro'); assert.ok(cuadro, 'el cuadro del muro norte está en la escena');
  assert.ok(cuadro.imagenes[0].o3 && cuadro.imagenes[0].ejeU, 'la imagen lleva su rectángulo 3D');
});

test('svgDePov: el cuadro queda centrado y por encima del horizonte de los ojos; sin imagen tras el ojo', () => {
  const { p, s, per } = sala();
  const r = V.svgDePov(p, s, per, 1200);
  assert.equal(r.w, 1200); assert.ok(r.svg.includes('<image'), 'imagen de la obra pintada en celdas');
  assert.ok(r.svg.includes('clipPath'), 'cada celda va recortada');
  // el cuadro: ancho 1,2 m a 4 m de distancia con fov 60 → ocupa 1.2/(2·4·tan30°) del ancho ≈ 26 % → unos 312 px centrados en 600
  const P = V.proyectorPov(V.povDe(per));
  const izq = P(3.4, 0, 1.5), der = P(4.6, 0, 1.5);
  assert.ok(Math.abs((izq.X + der.X) / 2) < 1e-9, 'centrado'); assert.ok(Math.abs((der.X - izq.X) * 600 - 312) < 2, 'ancho en px: ' + (der.X - izq.X) * 600);
  assert.ok(P(4, 0, 1.9).Y < 0 && P(4, 0, 1.1).Y > 0, 'el eje a 1,50 queda bajo la línea de ojos a 1,60');
  // mirando al revés (hacia +y) el cuadro queda detrás: no hay imagen
  per.mira = 90; const r2 = V.svgDePov(p, s, per, 600); assert.ok(!r2.svg.includes('<image'));
});

test('cono de visión y figuras', () => {
  const pts = V.conoVision({ x: 1, y: 1, mira: 0, fov: 60 }, 2, 4);
  assert.equal(pts.length, 6); assert.deepEqual(pts[0], { x: 1, y: 1 });
  assert.ok(Math.abs(pts[3].x - 3) < 1e-9 && Math.abs(pts[3].y - 1) < 1e-9, 'el centro del abanico sigue la mirada');
  assert.ok(V.esFigura(muebleDesde(catalogoPorId('silla-r'), 0, 0, 'x'))); assert.ok(!V.esFigura(muebleDesde(catalogoPorId('banca'), 0, 0, 'x')));
  assert.equal(V.povDe(muebleDesde(catalogoPorId('silla-r'), 0, 0, 'x')).ojos, 1.2);
});
