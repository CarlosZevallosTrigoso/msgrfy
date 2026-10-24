// Perspectiva desde los ojos de una persona colocada en la planta («punto de vista»). Sin DOM.
//
// Reutiliza la escena del modo 3D (isometrica.escena) con otro proyector: ojo en (x, y, ojos), mirada
// `mira` (grados en planta, 0 = +x, sentido horario en pantalla como el resto de la planta), cabeceo
// vertical y campo visual `fov`. Cada cara conserva su geometría 3D (pts3): aquí se recorta contra el
// plano cercano antes de proyectar, y se pinta de lejos a cerca por distancia al ojo.
//
// Límites, a propósito: orden de pintor (sin oclusión exacta cuando dos piezas se cruzan cerca del ojo),
// sin iluminación, imágenes de las obras por celdas afines (no hay transform proyectivo en canvas/SVG).
import { G } from './planta.js';
import { MD } from './muro.js';
import { escena, soloCam } from './isometrica.js';

const rad = (g) => g * Math.PI / 180;
export const CERCA = 0.25; // plano cercano, m
export const OJOS = { persona: 1.6, 'silla-r': 1.2, nino: 1.1 }; // altura de ojos por figura del catálogo

// Parámetros de mirada de una figura (persona, silla, niño): se guardan en la propia entidad
export const povDe = (e) => ({
  x: e.x, y: e.y,
  ojos: e.ojos > 0 ? e.ojos : (OJOS[e.catalogoId] || Math.max(0.9, (e.h || 1.7) - 0.1)),
  mira: Number.isFinite(e.mira) ? e.mira : 0,
  cabeceo: Number.isFinite(e.cabeceo) ? Math.max(-45, Math.min(45, e.cabeceo)) : 0,
  fov: e.fov >= 25 && e.fov <= 110 ? e.fov : 60,
});
export const esFigura = (e) => e && e.tipo === 'mueble' && (e.cat === 'referencia' || e.catalogoId in OJOS);

// Proyector de perspectiva. P(x,y,z) → { X, Y (unidades focales: X = ±1 en el borde del fov), d (−profundidad) }.
// También expone las coordenadas de cámara (cam(x,y,z) → { a (derecha), b (arriba), c (profundidad)}).
export const proyectorPov = (pov) => {
  // la planta tiene y hacia abajo (pantalla): quien mira a +x tiene su derecha en +y
  const t = rad(pov.mira), f = { x: Math.cos(t), y: Math.sin(t) }, r = { x: -Math.sin(t), y: Math.cos(t) };
  const cp = Math.cos(rad(pov.cabeceo || 0)), sp = Math.sin(rad(pov.cabeceo || 0));
  const F = 1 / Math.tan(rad(pov.fov) / 2);
  const ojo = [pov.x, pov.y, pov.ojos];
  const cam = (x, y, z) => {
    const dx = x - ojo[0], dy = y - ojo[1], dz = z - ojo[2];
    const dep = dx * f.x + dy * f.y, up = dz;
    return { a: dx * r.x + dy * r.y, b: up * cp - dep * sp, c: dep * cp + up * sp };
  };
  const P = (x, y, z = 0) => { const q = cam(x, y, z); const c = Math.max(q.c, 1e-6); return { X: F * q.a / c, Y: -F * q.b / c, d: -q.c }; };
  P.cam = cam; P.F = F; P.ojo = ojo; P.pov = pov;
  P.vista = { x: -f.x, y: -f.y }; // en planta, hacia el ojo
  P.visible = (nn, pt) => (ojo[0] - pt.x) * nn.x + (ojo[1] - pt.y) * nn.y > 1e-9; // el ojo está del lado exterior de la cara
  return P;
};

// Cámara para la escena: lo que no es proyección (muros de frente, zócalo, alto por defecto, rejilla, terreno)
export const escenaPov = (proyecto, sala, pov, opciones = {}) => {
  const base = soloCam({ ...(sala.iso || {}), ...opciones });
  const P = proyectorPov(pov);
  return escena(proyecto, sala, { ...base, muros: opciones.muros || 'completos', P });
};

// Recorte de un polígono en coordenadas de cámara contra c >= CERCA (Sutherland–Hodgman con un solo plano)
export const recortarCerca = (pts, cerca = CERCA) => {
  const out = []; const n = pts.length; if (!n) return out;
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n]; const pin = p.c >= cerca, qin = q.c >= cerca;
    if (pin) out.push(p);
    if (pin !== qin) { const t = (cerca - p.c) / (q.c - p.c); out.push({ a: p.a + (q.a - p.a) * t, b: p.b + (q.b - p.b) * t, c: cerca }); }
  }
  return out;
};
const proyectarCam = (q, F) => [F * q.a / q.c, -F * q.b / q.c];

// Pinta la escena en perspectiva. view: { s (px por unidad focal), ox, oy } — con s = ancho/2 y ox = ancho/2 el fov llena el lienzo.
export const pintarPov = (Pt, piezas, P, view, o = {}) => {
  const s = view.s, X = (x) => view.ox + x * s, Y = (y) => view.oy + y * s, F = P.F;
  const orden = piezas.filter((pz) => pz.tipo !== 'sombra').slice().sort((a, b) => a.d - b.d);
  for (const pz of orden) {
    for (const c of pz.caras) {
      if (!c.pts3) continue;
      const q = c.pts3.map(([x, y, z]) => P.cam(x, y, z));
      if (c.linea) {
        const seg = recortarSegmento(q[0], q[1]); if (!seg) continue;
        const a = proyectarCam(seg[0], F), b = proyectarCam(seg[1], F);
        Pt.line(X(a[0]), Y(a[1]), X(b[0]), Y(b[1]), { stroke: c.stroke, lw: c.lw }); continue;
      }
      const rec = recortarCerca(q); if (rec.length < 3) continue;
      const pts = rec.map((p) => { const [x, y] = proyectarCam(p, F); return [X(x), Y(y)]; });
      const fill = c.fill && c.lateral ? oscurecer(c.fill) : c.fill;
      Pt.poly(pts, { fill: fill || 'none', stroke: c.stroke || null, lw: c.lw || 1, dash: c.dash || null });
    }
    if (pz.imagenes && o.imagenes !== false) for (const im of pz.imagenes) if (im.o3) pintarImagen(Pt, im, P, view);
  }
};
const recortarSegmento = (p, q, cerca = CERCA) => {
  const pin = p.c >= cerca, qin = q.c >= cerca; if (!pin && !qin) return null; if (pin && qin) return [p, q];
  const t = (cerca - p.c) / (q.c - p.c); const m = { a: p.a + (q.a - p.a) * t, b: p.b + (q.b - p.b) * t, c: cerca };
  return pin ? [p, m] : [m, q];
};
// Imagen de una obra: el rectángulo 3D se parte en celdas y cada celda se dibuja con una afín recortada a su cuadrilátero
const pintarImagen = (Pt, im, P, view, celdas = 6) => {
  const s = view.s, X = (x) => view.ox + x * s, Y = (y) => view.oy + y * s, F = P.F;
  const [ox, oy, oz] = im.o3, [ux, uy, uz] = im.ejeU, [vx, vy, vz] = im.ejeV;
  const pt3 = (u, v) => [ox + ux * u + vx * v, oy + uy * u + vy * v, oz + uz * u + vz * v];
  const proy = (u, v) => { const q = P.cam(...pt3(u, v)); if (q.c < CERCA) return null; const [x, y] = proyectarCam(q, F); return [X(x), Y(y)]; };
  const nu = Math.max(1, Math.round(celdas * Math.max(1, im.w / im.h))), nv = Math.max(1, Math.round(celdas * Math.max(1, im.h / im.w)));
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const u0 = im.w * i / nu, u1 = im.w * (i + 1) / nu, v0 = im.h * j / nv, v1 = im.h * (j + 1) / nv;
    const A = proy(u0, v0), B = proy(u1, v0), C = proy(u0, v1), D = proy(u1, v1); if (!A || !B || !C || !D) continue;
    const a = (B[0] - A[0]) / (u1 - u0), b = (B[1] - A[1]) / (u1 - u0), c = (C[0] - A[0]) / (v1 - v0), d = (C[1] - A[1]) / (v1 - v0);
    const e = A[0] - a * u0 - c * v0, f = A[1] - b * u0 - d * v0;
    // el recorte se ensancha medio píxel para que no se vean las costuras entre celdas
    Pt.imagePoly(im.id, [a, b, c, d, e, f], im.w, im.h, ensanchar([A, B, D, C], 0.6));
  }
};
const ensanchar = (poly, px) => {
  const cx = poly.reduce((k, p) => k + p[0], 0) / poly.length, cy = poly.reduce((k, p) => k + p[1], 0) / poly.length;
  return poly.map(([x, y]) => { const dx = x - cx, dy = y - cy, L = Math.hypot(dx, dy) || 1; return [x + dx / L * px, y + dy / L * px]; });
};
const oscurecer = (c) => {
  const h = /^#([0-9a-f]{6})$/i.exec(c);
  if (h) { const n = parseInt(h[1], 16); const f = (v) => Math.max(0, Math.round(v * 0.86)).toString(16).padStart(2, '0'); return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255); }
  const r = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(c);
  if (r) return `rgba(${Math.round(r[1] * 0.86)},${Math.round(r[2] * 0.86)},${Math.round(r[3] * 0.86)},${r[4]})`;
  return c;
};

// Encuadre que llena el lienzo con el campo visual horizontal
export const viewPov = (w, h) => ({ s: w / 2, ox: w / 2, oy: h / 2 });

// Cono de visión en planta (para dibujar sobre la persona): triángulo-abanico de radio r
export const conoVision = (pov, r = 1.5, pasos = 8) => {
  const a0 = rad(pov.mira - pov.fov / 2), a1 = rad(pov.mira + pov.fov / 2); const pts = [{ x: pov.x, y: pov.y }];
  for (let k = 0; k <= pasos; k++) { const a = a0 + (a1 - a0) * k / pasos; pts.push({ x: pov.x + Math.cos(a) * r, y: pov.y + Math.sin(a) * r }); }
  return pts;
};

// SVG completo de la vista desde una persona
export const svgDePov = (proyecto, sala, persona, W = 1600, opciones = {}) => {
  const pov = povDe(persona); const H = Math.round(W * (opciones.aspecto || 0.666));
  const piezas = escenaPov(proyecto, sala, pov, opciones); const P = proyectorPov(pov);
  const imgs = {}; for (const pz of piezas) for (const im of pz.imagenes || []) imgs[im.id] = proyecto.imagenes[im.id];
  const Pt = MD.svgPainter(imgs);
  pintarPov(Pt, piezas, P, viewPov(W, H));
  return { svg: Pt.toString(W, H, '#ffffff'), w: W, h: H, pov, piezas };
};
