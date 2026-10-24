// Vista axonométrica de una sala, al estilo de Los Sims: giro libre, inclinación, y los muros que
// darían la espalda a la cámara cortados o transparentes. Sin DOM: construye la escena y la pinta
// con los «pintores» del núcleo de Muro (canvas o SVG). Unidades: metros; z hacia arriba.
import { G } from './planta.js';
import { MD } from './muro.js';
import * as M from './modelo.js';
import { muroDelTramo, altoEstimado } from './puente.js';
import { muebleCajas } from './biblioteca.js';

const rad = (g) => g * Math.PI / 180;
// color hex con transparencia, como rgba() (los pintores y cualquier rasterizador lo entienden)
const alfa = (hex, a) => { const m = /^#([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex; const n = parseInt(m[1], 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
export const camDefecto = () => ({ giro: 35, inclinacion: 35, muros: 'cortados', zocalo: 0.9, altoDefecto: 3, rejilla: true, fondo: true });
const CAM_CAMPOS = ['giro', 'inclinacion', 'muros', 'zocalo', 'altoDefecto', 'rejilla', 'fondo'];
// Solo los parámetros de cámara (sin vistas guardadas ni otros restos)
export const soloCam = (c) => { const o = {}; for (const k of CAM_CAMPOS) if (c && c[k] !== undefined) o[k] = c[k]; return { ...camDefecto(), ...o }; };

// ---------- vistas guardadas (puntos de vista con nombre) ----------
// Una vista es la cámara más un encuadre relativo al «encajar»: rel = zoom / zoom de encaje, y el punto
// proyectado (X, Y) que queda en el centro del lienzo. Así se reproduce igual en otra pantalla.
// Viven en sala.iso.vistas[]. El SVG/PNG de escena completa y la base de Lectura usan solo la cámara.
let _vseq = 0;
export const nuevaVista = (nombre, cam, enc = null) => ({
  id: 'v_' + Date.now().toString(36) + '_' + (_vseq++).toString(36), nombre: String(nombre || 'Vista').trim() || 'Vista',
  cam: soloCam(cam), enc: enc && enc.rel > 0 && Number.isFinite(enc.X) && Number.isFinite(enc.Y) ? { rel: enc.rel, X: enc.X, Y: enc.Y } : null,
});
export const vistaValida = (v) => !!(v && typeof v === 'object' && typeof v.nombre === 'string' && v.cam && Number.isFinite(v.cam.giro) && Number.isFinite(v.cam.inclinacion));
// Encuadre a partir del estado del lienzo: view {s, ox, oy}, tamaño {w, h}, escala de encaje sFit
export const encuadreDe = (view, w, h, sFit) => (sFit > 0 && view.s > 0 ? { rel: view.s / sFit, X: (w / 2 - view.ox) / view.s, Y: (h / 2 - view.oy) / view.s } : null);
// Estado del lienzo que reproduce un encuadre guardado con la escala de encaje actual
export const viewDeEncuadre = (enc, w, h, sFit) => { const s = enc.rel * sFit; return { s, ox: w / 2 - enc.X * s, oy: h / 2 - enc.Y * s }; };

// ---------- proyección ----------
// Gira la planta `giro` grados y la mira con elevación `inclinacion`: X = x', Y = y'·sen φ − z·cos φ.
// Las paralelas siguen paralelas; las longitudes en planta son reales a inclinación 90° (cenital).
export const proyector = (cam) => {
  const t = rad(cam.giro), c = Math.cos(t), s = Math.sin(t);
  const f = rad(cam.inclinacion), sf = Math.sin(f), cf = Math.cos(f);
  const P = (x, y, z = 0) => { const xr = x * c - y * s, yr = x * s + y * c; return { X: xr, Y: yr * sf - z * cf, d: yr }; };
  P.vista = { x: s, y: c }; // dirección en planta hacia la cámara: la profundidad d = x·sen θ + y·cos θ crece en ese sentido
  return P;
};

// ---------- escena ----------
// Devuelve piezas ordenables: { d (profundidad), caras: [{ pts: [[X,Y]...], fill, stroke, lw, dash }], imagenes: [...] }
const altoLinea = (e, i, cam) => G.alturaTramo(e, i) || cam.altoDefecto;
const banda = (e) => G.bandaMuro(e) || [-0.05, 0.05];

export const escena = (proyecto, sala, cam) => {
  const P = proyector(cam), piezas = [];
  const ents = sala.entidades;
  const lineas = ents.filter((e) => e.tipo === 'linea' && e.pts.length >= 2);
  const contorno = lineas.filter((e) => G.contornoDe(e)).sort((a, b) => G.area(b.pts) - G.area(a.pts))[0] || null;
  const eje = 1.5;
  const sombra = (col, k) => col; // sin iluminación: el tono lo da cada cara
  const cara = (pts3, st) => ({ pts: pts3.map(([x, y, z]) => { const p = P(x, y, z); return [p.X, p.Y]; }), ...st });
  const prof = (pts2) => Math.max(...pts2.map((p) => P(p.x, p.y).d));
  const profMin = (pts2) => Math.min(...pts2.map((p) => P(p.x, p.y).d));

  // piso: el contorno mayor; si no hay, la caja de todo
  const pisoPts = contorno ? contorno.pts : (G.caja(ents, 0.2) ? (({ x, y, w, h }) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }])(G.caja(ents, 0.2)) : []);
  if (pisoPts.length) {
    // losa bajo el piso, que asoma algo más que los muros, y una sombra en el suelo para que no flote
    const t = contorno ? (() => { const [o0, o1] = banda(contorno); const f = G.ladoFuera(contorno); return f > 0 ? Math.max(0, o1) + 0.12 : Math.min(0, o0) - 0.12; })() : 0.12;
    const losaPts = G.desplazarPolilinea(pisoPts, true, t);
    // terreno: un plano de suelo que se extiende más allá de la sala, con rejilla de 1 m, sobre el que se apoya la losa
    if (cam.fondo !== false) {
      const b = G.cajaPuntos(losaPts); const M0 = 30; // muy amplio: lo recorta el encuadre
      const x0 = Math.floor(b.x - M0), y0 = Math.floor(b.y - M0), x1 = Math.ceil(b.x + b.w + M0), y1 = Math.ceil(b.y + b.h + M0);
      const suelo = [cara([[x0, y0, -0.15], [x1, y0, -0.15], [x1, y1, -0.15], [x0, y1, -0.15]], { fill: '#e6e4dc', stroke: '#cfcdc4', lw: 1 })];
      for (let x = x0; x <= x1; x++) suelo.push(cara([[x, y0, -0.15], [x, y1, -0.15]], { stroke: 'rgba(17,17,17,0.06)', lw: 1, linea: true }));
      for (let y = y0; y <= y1; y++) suelo.push(cara([[x0, y, -0.15], [x1, y, -0.15]], { stroke: 'rgba(17,17,17,0.06)', lw: 1, linea: true }));
      piezas.push({ tipo: 'suelo', d: -4e6, caras: suelo });
    }
    const sombra = losaPts.map((q) => { const pr = P(q.x, q.y, -0.15); return [pr.X + 0.35, pr.Y + 0.25]; });
    piezas.push({ tipo: 'sombra', d: -3e6, caras: [{ pts: sombra, fill: 'rgba(17,17,17,0.07)', stroke: null }] });
    const losa = prisma(losaPts, 0.15, '#d9d7cf', '#8f8d85', P, cara, prof, false, -0.15); losa.d = -2e6; losa.tipo = 'losa';
    piezas.push(losa);
    const caras = [cara(pisoPts.map((p) => [p.x, p.y, 0]), { fill: '#eeede8', stroke: '#b9b7ae', lw: 1 })];
    if (cam.rejilla) {
      const b = G.cajaPuntos(pisoPts); const seg = [];
      for (let x = Math.ceil(b.x); x <= b.x + b.w; x++) seg.push([[x, b.y, 0], [x, b.y + b.h, 0]]);
      for (let y = Math.ceil(b.y); y <= b.y + b.h; y++) seg.push([[b.x, y, 0], [b.x + b.w, y, 0]]);
      for (const [a, c] of seg) for (const [u, v] of recortar(a, c, pisoPts)) caras.push(cara([u, v], { stroke: 'rgba(17,17,17,0.08)', lw: 1, linea: true }));
    }
    piezas.push({ tipo: 'piso', d: -1e6, caras });
  }

  // muros: cada tramo se trocea en rebanadas cortas (≈ 0,5 m) con profundidad propia, para que el orden
  // de pintado funcione también en salas en L; los muros que dan la espalda a la cámara se cortan o se vuelven transparentes
  const vanos = ents.filter((e) => e.tipo === 'puerta' || e.tipo === 'ventana');
  const REB = 0.5;
  for (const e of lineas) {
    const [omin, omax] = banda(e); const fuera = G.ladoFuera(e); const esContorno = !!G.contornoDe(e);
    for (const [a, b, i] of G.segmentos(e)) {
      const L = G.dist(a, b); if (!(L > 1e-6)) continue;
      const h = altoLinea(e, i, cam); const d = G.unit(G.sub(b, a)); const n = G.perp(d);
      const nInt = G.mul(n, esContorno ? -fuera : 1);
      const frente = esContorno && G.dot(nInt, P.vista) < -1e-9; // la cara interior da la espalda a la cámara
      const modo = frente ? cam.muros : 'completos';
      const alto = modo === 'cortados' ? Math.min(h, cam.zocalo) : h;
      const trans = modo === 'transparentes';
      const colMuro = e.color && e.color !== '#111111' ? e.color : null;
      const st = { stroke: trans ? '#9a9a92' : '#2a2a28', lw: trans ? 1 : 1.1, dash: trans ? [4, 3] : null };
      const huecos = vanos.filter((v) => G.proyectar(v.a, a, b).d < 0.02 && G.proyectar(v.b, a, b).d < 0.02)
        .map((v) => { const ta = G.dot(G.sub(v.a, a), d), tb = G.dot(G.sub(v.b, a), d); return { u0: Math.min(ta, tb), u1: Math.max(ta, tb), z0: v.tipo === 'ventana' ? 0.9 : 0, z1: 2.1, ventana: v.tipo === 'ventana' }; });
      const nReb = Math.max(1, Math.ceil(L / REB));
      const lados = [[omin, G.mul(n, -1)], [omax, n]]; // cara en omin (normal −n) y cara en omax (normal +n)
      for (let k = 0; k < nReb; k++) {
        const u0 = L * k / nReb, u1 = L * (k + 1) / nReb;
        const p0 = G.add(a, G.mul(d, u0)), p1 = G.add(a, G.mul(d, u1));
        const esq = [G.add(p0, G.mul(n, omin)), G.add(p1, G.mul(n, omin)), G.add(p1, G.mul(n, omax)), G.add(p0, G.mul(n, omax))];
        const caras = [];
        const linea = (A, B, stt) => caras.push(cara([A, B], { ...stt, linea: true }));
        // caras largas visibles
        for (const [off, nn] of lados) {
          if (G.dot(nn, P.vista) <= 1e-9 && !trans) continue;
          const q0 = G.add(p0, G.mul(n, off)), q1 = G.add(p1, G.mul(n, off));
          const lateral = Math.abs(G.dot(nn, { x: P.vista.y, y: -P.vista.x })) > 0.5;
          const fill = trans ? 'rgba(255,255,255,0)' : colMuro ? alfa(colMuro, 0.33) : (lateral ? '#e4e2db' : '#f1f0ea');
          // las rebanadas se solapan 5 mm para que no se vean costuras
          const e0 = k === 0 ? q0 : G.sub(q0, G.mul(d, 0.005)), e1 = k === nReb - 1 ? q1 : G.add(q1, G.mul(d, 0.005));
          caras.push(cara([[e0.x, e0.y, 0], [e1.x, e1.y, 0], [e1.x, e1.y, alto], [e0.x, e0.y, alto]], { fill, stroke: null }));
          linea([q0.x, q0.y, alto], [q1.x, q1.y, alto], st); linea([q0.x, q0.y, 0], [q1.x, q1.y, 0], st);
          if (!trans) for (const hu of huecos) {
            const v0 = Math.max(u0, hu.u0), v1 = Math.min(u1, hu.u1); if (v1 - v0 < 1e-6) continue;
            const z0 = Math.min(alto, hu.z0), z1 = Math.min(alto, hu.z1); if (z1 <= z0) continue;
            const r0 = G.add(a, G.add(G.mul(d, v0), G.mul(n, off))), r1 = G.add(a, G.add(G.mul(d, v1), G.mul(n, off)));
            caras.push(cara([[r0.x, r0.y, z0], [r1.x, r1.y, z0], [r1.x, r1.y, z1], [r0.x, r0.y, z1]], { fill: hu.ventana ? '#dfe8ee' : '#ffffff', stroke: null }));
            linea([r0.x, r0.y, z1], [r1.x, r1.y, z1], { stroke: '#8a8a84', lw: 1 }); if (hu.ventana) linea([r0.x, r0.y, z0], [r1.x, r1.y, z0], { stroke: '#8a8a84', lw: 1 });
            if (Math.abs(v0 - hu.u0) < 1e-9) linea([r0.x, r0.y, z0], [r0.x, r0.y, z1], { stroke: '#8a8a84', lw: 1 });
            if (Math.abs(v1 - hu.u1) < 1e-9) linea([r1.x, r1.y, z0], [r1.x, r1.y, z1], { stroke: '#8a8a84', lw: 1 });
          }
        }
        // testeros en los extremos del tramo
        for (const [esInicio, nn] of [[true, G.mul(d, -1)], [false, d]]) {
          if (esInicio ? k !== 0 : k !== nReb - 1) continue;
          const pp = esInicio ? p0 : p1; const c0 = G.add(pp, G.mul(n, omin)), c1 = G.add(pp, G.mul(n, omax));
          if (G.dot(nn, P.vista) > 1e-9 || trans) caras.push(cara([[c0.x, c0.y, 0], [c1.x, c1.y, 0], [c1.x, c1.y, alto], [c0.x, c0.y, alto]], { fill: trans ? 'rgba(255,255,255,0)' : (colMuro ? alfa(colMuro, 0.33) : '#dcdad2'), stroke: null }));
          linea([c0.x, c0.y, 0], [c0.x, c0.y, alto], st); linea([c1.x, c1.y, 0], [c1.x, c1.y, alto], st); linea([c0.x, c0.y, alto], [c1.x, c1.y, alto], st);
          if (trans) linea([c0.x, c0.y, 0], [c1.x, c1.y, 0], st);
        }
        // tapa
        const esqE = [G.sub(esq[0], G.mul(d, k ? 0.005 : 0)), G.add(esq[1], G.mul(d, k < nReb - 1 ? 0.005 : 0)), G.add(esq[2], G.mul(d, k < nReb - 1 ? 0.005 : 0)), G.sub(esq[3], G.mul(d, k ? 0.005 : 0))];
        caras.push(cara(esqE.map((q) => [q.x, q.y, alto]), { fill: trans ? 'rgba(255,255,255,0)' : '#ffffff', stroke: null }));
        piezas.push({ tipo: 'muro', d: prof(esq), dmin: profMin(esq), caras, frente, tramo: e.id + ':' + i });
      }
      // cuadros sobre este tramo (solo si el muro está entero)
      if (!frente || modo !== 'cortados') for (const q of ents) {
        if (q.tipo !== 'cuadro' || !q.obraId) continue;
        if (G.proyectar(q.a, a, b).d > 0.02 || G.proyectar(q.b, a, b).d > 0.02) continue;
        const o = M.obraDe(proyecto, q.obraId); if (!o) continue;
        const nc = G.mul(G.perp(G.unit(G.sub(q.b, q.a))), q.lado === -1 ? -1 : 1); // hacia la sala
        const caraMuro = Math.sign(G.dot(nc, n)) || 1;
        if (G.dot(nc, P.vista) <= 1e-9) continue; // cuelga de una cara que no se ve
        const w = o.ancho > 0 ? o.ancho : G.dist(q.a, q.b), hh = altoEstimado(o);
        let zTop = eje + hh / 2;
        const mu = muroDelTramo(proyecto, sala, e, i); const c = mu && mu.colgado.find((cc) => cc.obraId === o.id);
        if (c) zTop = mu.alto - c.y - c.marco - c.pp;
        const zBot = Math.max(0, zTop - hh);
        const off = caraMuro > 0 ? omax : omin; const salto = 0.03;
        const base0 = G.add(q.a, G.mul(n, off + caraMuro * salto)), base1 = G.add(q.b, G.mul(n, off + caraMuro * salto));
        const dirQ = G.unit(G.sub(q.b, q.a));
        const esqC = [[base0.x, base0.y, zBot], [base1.x, base1.y, zBot], [base1.x, base1.y, zTop], [base0.x, base0.y, zTop]];
        const col = q.color || '#b06a36';
        const pieza = { tipo: 'cuadro', d: prof([base0, base1]) + 0.01, caras: [cara(esqC, { fill: col, stroke: '#2a2a28', lw: 1 })], imagenes: [] };
        if (o.imagenId && proyecto.imagenes[o.imagenId]) {
          const izq = G.dot(dirQ, { x: -nc.y, y: nc.x }) < 0;
          const o0 = izq ? base0 : base1, dd = izq ? dirQ : G.mul(dirQ, -1);
          const p0 = P(o0.x, o0.y, zTop), pu = P(o0.x + dd.x, o0.y + dd.y, zTop), pv = P(o0.x, o0.y, zTop - 1);
          pieza.imagenes.push({ id: o.imagenId, m: [pu.X - p0.X, pu.Y - p0.Y, pv.X - p0.X, pv.Y - p0.Y, p0.X, p0.Y], w, h: zTop - zBot });
        }
        piezas.push(pieza);
      }
    }
  }

  // obras en planta (prismas), columnas (cilindros), proyectores (caja + haz)
  for (const e of ents) {
    if (e.tipo === 'obra' && e.pts.length >= 3) {
      const h = e.alto > 0 ? e.alto : 1; const col = e.color || '#b06a36';
      piezas.push(prisma(e.pts, h, alfa(col, 0.45), col, P, cara, prof));
    } else if (e.tipo === 'mueble') {
      for (const cj of muebleCajas(e)) {
        const col = cj.color || '#8a8a8a'; const esRgba = /^rgba/.test(col);
        piezas.push(prisma(cj.pts, cj.h, esRgba ? col : alfa(col, col === '#ffffff' ? 0.95 : 0.8), esRgba ? '#6b8aa0' : (col === '#ffffff' ? '#8f8d85' : col), P, cara, prof, cj.forma === 'cilindro', cj.z0));
      }
    } else if (e.tipo === 'circulo') {
      const n = 24, pts = []; for (let k = 0; k < n; k++) { const a = k / n * 2 * Math.PI; pts.push({ x: e.c.x + Math.cos(a) * e.r, y: e.c.y + Math.sin(a) * e.r }); }
      const h = e.alto > 0 ? e.alto : cam.altoDefecto; const col = e.color || '#111111';
      piezas.push(prisma(pts, h, '#e9e8e2', '#6b6b64', P, cara, prof, true));
    } else if (e.tipo === 'proyeccion') {
      const g = G.proyGeom(e, ents); const zc = e.altoProy > 0 ? e.altoProy : 2.4; const L = e.largo > 0 ? e.largo : 0.4, W = e.anchoCuerpo > 0 ? e.anchoCuerpo : 0.3;
      const col = e.color || '#4f6b82';
      piezas.push(prisma(g.cuerpo, 0.12, alfa(col, 0.4), col, P, cara, prof, false, zc));
      const z0 = eje - g.alto / 2, z1 = eje + g.alto / 2;
      const A = g.frenteA, B = g.frenteB;
      piezas.push({ tipo: 'pantalla', d: prof([A, B]) + 0.01, caras: [cara([[A.x, A.y, z0], [B.x, B.y, z0], [B.x, B.y, z1], [A.x, A.y, z1]], { fill: alfa(col, 0.8), stroke: col, lw: 1 })] });
      if (e.verHaz !== false) piezas.push({ tipo: 'haz', d: prof([e.p, A, B]) + 0.003, caras: [cara([[e.p.x, e.p.y, zc], [A.x, A.y, z0], [B.x, B.y, z0]], { fill: alfa(col, 0.08), stroke: col, lw: 0.8, dash: [4, 3] }), cara([[e.p.x, e.p.y, zc], [A.x, A.y, z1], [B.x, B.y, z1]], { fill: alfa(col, 0.08), stroke: col, lw: 0.8, dash: [4, 3] })] });
    }
  }
  return piezas;
};

// trozos del segmento a–c que quedan dentro del polígono (para la rejilla del piso)
function recortar(a, c, poly) {
  const ts = [0, 1]; const d = { x: c[0] - a[0], y: c[1] - a[1] };
  for (let k = 0; k < poly.length; k++) {
    const p = poly[k], q = poly[(k + 1) % poly.length]; const e = { x: q.x - p.x, y: q.y - p.y };
    const den = d.x * e.y - d.y * e.x; if (Math.abs(den) < 1e-12) continue;
    const t = ((p.x - a[0]) * e.y - (p.y - a[1]) * e.x) / den, u = ((p.x - a[0]) * d.y - (p.y - a[1]) * d.x) / den;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
  }
  ts.sort((x, y) => x - y); const out = [];
  for (let k = 0; k < ts.length - 1; k++) {
    const t0 = ts[k], t1 = ts[k + 1]; if (t1 - t0 < 1e-9) continue;
    const tm = (t0 + t1) / 2;
    if (G.puntoEnPoligono({ x: a[0] + d.x * tm, y: a[1] + d.y * tm }, poly)) out.push([[a[0] + d.x * t0, a[1] + d.y * t0, 0], [a[0] + d.x * t1, a[1] + d.y * t1, 0]]);
  }
  return out;
}

// prisma vertical sobre un polígono de planta (z0 → z0 + h): caras laterales visibles + tapa
function prisma(pts, h, fill, stroke, P, cara, prof, suave = false, z0 = 0) {
  const n = pts.length, caras = [];
  const orient = G.areaFirmada(pts) > 0 ? 1 : -1; // normal exterior de cada lado según el sentido del polígono
  for (let k = 0; k < n; k++) {
    const p = pts[k], q = pts[(k + 1) % n]; const d = G.unit(G.sub(q, p)); const nn = G.mul(G.perp(d), -orient);
    if (G.dot(nn, P.vista) <= 1e-9) continue;
    const lateral = Math.abs(G.dot(nn, { x: P.vista.y, y: -P.vista.x })) > 0.5;
    caras.push(cara([[p.x, p.y, z0], [q.x, q.y, z0], [q.x, q.y, z0 + h], [p.x, p.y, z0 + h]], { fill, stroke: suave ? null : stroke, lw: 1, lateral }));
  }
  caras.push(cara(pts.map((p) => [p.x, p.y, z0 + h]), { fill: fill.replace(/,([\d.]+)\)$/, (m, a) => ',' + Math.min(1, +a * 1.4) + ')'), stroke, lw: 1 }));
  return { tipo: 'prisma', d: prof(pts), caras };
}

// ---------- encuadre y pintado ----------
// caja de la escena en unidades proyectadas; el terreno no cuenta (se extiende hasta donde llegue el encuadre)
export const limites = (piezas) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const pz of piezas) if (pz.tipo !== 'suelo') for (const c of pz.caras) for (const [X, Y] of c.pts) { x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y); }
  return x0 === Infinity ? { x: 0, y: 0, w: 1, h: 1 } : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};
// Pinta con un pintor del núcleo de Muro. view: { s (px por m), ox, oy }
export const pintar = (Pt, piezas, view, o = {}) => {
  const s = view.s, X = (x) => view.ox + x * s, Y = (y) => view.oy + y * s;
  const orden = piezas.slice().sort((a, b) => a.d - b.d);
  for (const pz of orden) {
    for (const c of pz.caras) {
      const pts = c.pts.map(([x, y]) => [X(x), Y(y)]);
      if (c.linea) { Pt.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1], { stroke: c.stroke, lw: c.lw }); continue; }
      const fill = c.fill && c.lateral ? oscurecer(c.fill) : c.fill;
      Pt.poly(pts, { fill: fill || 'none', stroke: c.stroke || null, lw: c.lw || 1, dash: c.dash || null });
    }
    if (pz.imagenes && o.imagenes !== false) for (const im of pz.imagenes) {
      const m = im.m; Pt.imageM(im.id, [m[0] * s, m[1] * s, m[2] * s, m[3] * s, X(m[4]), Y(m[5])], im.w, im.h, 0);
    }
  }
};
const oscurecer = (c) => {
  const h = /^#([0-9a-f]{6})$/i.exec(c);
  if (h) { const n = parseInt(h[1], 16); const f = (v) => Math.max(0, Math.round(v * 0.86)).toString(16).padStart(2, '0'); return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255); }
  const r = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(c);
  if (r) return `rgba(${Math.round(r[1] * 0.86)},${Math.round(r[2] * 0.86)},${Math.round(r[3] * 0.86)},${r[4]})`;
  return c;
};

// SVG completo de la escena a una resolución dada (px por metro)
export const svgDeIso = (proyecto, sala, cam, pxPorMetro = 120, margen = 1) => {
  const piezas = escena(proyecto, sala, cam); const b = limites(piezas);
  const W = Math.max(1, Math.round((b.w + 2 * margen) * pxPorMetro)), H = Math.max(1, Math.round((b.h + 2 * margen) * pxPorMetro));
  const imgs = {}; for (const pz of piezas) for (const im of pz.imagenes || []) imgs[im.id] = proyecto.imagenes[im.id];
  const Pt = MD.svgPainter(imgs);
  pintar(Pt, piezas, { s: pxPorMetro, ox: (margen - b.x) * pxPorMetro, oy: (margen - b.y) * pxPorMetro });
  return { svg: Pt.toString(W, H, '#ffffff'), w: W, h: H, pxPorMetro, piezas };
};
