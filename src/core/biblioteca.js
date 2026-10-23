// Biblioteca de objetos: mobiliario museográfico con medidas reales. Sin DOM. Metros.
// Un mueble en la planta es { tipo:'mueble', x, y (centro), l, a, h, rot (grados), forma:'caja'|'cilindro',
// nombre, cat, color, catalogoId, partes? }. partes: cajas relativas al mueble para el 3D
// (dx, dy, dz desde el centro de la base; l, a, h; color), con el mueble como caja envolvente.
import { r6 } from './unidades.js';

export const CATEGORIAS = [['soportes', 'Soportes'], ['recorrido', 'Recorrido'], ['tecnica', 'Técnica'], ['referencia', 'Referencia'], ['propios', 'Mi biblioteca']];

const o = (id, cat, nombre, l, a, h, extra = {}) => ({ id, cat, nombre, l, a, h, forma: 'caja', color: '#8a8a8a', ...extra });
export const CATALOGO = [
  o('ped-40-110', 'soportes', 'Pedestal 40×40×110', 0.4, 0.4, 1.1, { color: '#ffffff' }),
  o('ped-50-90', 'soportes', 'Pedestal 50×50×90', 0.5, 0.5, 0.9, { color: '#ffffff' }),
  o('ped-60-60', 'soportes', 'Pedestal 60×60×60', 0.6, 0.6, 0.6, { color: '#ffffff' }),
  o('peana', 'soportes', 'Peana baja 120×120×15', 1.2, 1.2, 0.15, { color: '#ffffff' }),
  o('tarima', 'soportes', 'Tarima 240×240×30', 2.4, 2.4, 0.3, { color: '#e6e4dc' }),
  o('vit-mesa', 'soportes', 'Vitrina de mesa 120×60×100', 1.2, 0.6, 1.0, { color: '#ffffff', partes: [
    { dx: 0, dy: 0, dz: 0, l: 1.2, a: 0.6, h: 0.75, color: '#ffffff' }, { dx: 0, dy: 0, dz: 0.75, l: 1.2, a: 0.6, h: 0.25, color: 'rgba(170,200,220,0.45)' }] }),
  o('vit-vert', 'soportes', 'Vitrina vertical 60×60×200', 0.6, 0.6, 2.0, { color: '#ffffff', partes: [
    { dx: 0, dy: 0, dz: 0, l: 0.6, a: 0.6, h: 0.5, color: '#ffffff' }, { dx: 0, dy: 0, dz: 0.5, l: 0.6, a: 0.6, h: 1.5, color: 'rgba(170,200,220,0.45)' }] }),
  o('panel-240', 'recorrido', 'Panel móvil 240×10×240', 2.4, 0.1, 2.4, { color: '#f1f0ea' }),
  o('panel-120', 'recorrido', 'Panel móvil 120×10×240', 1.2, 0.1, 2.4, { color: '#f1f0ea' }),
  o('biombo', 'recorrido', 'Biombo 3 cuerpos 180×40×180', 1.8, 0.4, 1.8, { color: '#f1f0ea' }),
  o('banca', 'recorrido', 'Banca 150×45×45', 1.5, 0.45, 0.45, { color: '#b9a98a' }),
  o('poste', 'recorrido', 'Poste separador Ø35×95', 0.35, 0.35, 0.95, { forma: 'cilindro', color: '#8a8a8a' }),
  o('totem', 'recorrido', 'Tótem señalética 60×20×180', 0.6, 0.2, 1.8, { color: '#586a45' }),
  o('mesa-lect', 'recorrido', 'Mesa de lectura 120×60×75', 1.2, 0.6, 0.75, { color: '#b9a98a' }),
  o('pantalla', 'tecnica', 'Pantalla 160×6×95 (65″)', 1.6, 0.06, 0.95, { color: '#111111' }),
  o('monitor', 'tecnica', 'Monitor sobre pie 60×40×150', 0.6, 0.4, 1.5, { color: '#333333', partes: [
    { dx: 0, dy: 0, dz: 0, l: 0.6, a: 0.4, h: 0.02, color: '#333333' }, { dx: 0, dy: 0, dz: 0.02, l: 0.06, a: 0.06, h: 1.1, color: '#333333' }, { dx: 0, dy: 0, dz: 1.12, l: 0.6, a: 0.06, h: 0.38, color: '#111111' }] }),
  o('altavoz', 'tecnica', 'Altavoz 25×25×45', 0.25, 0.25, 0.45, { color: '#333333' }),
  o('extintor', 'tecnica', 'Extintor Ø20×60', 0.2, 0.2, 0.6, { forma: 'cilindro', color: '#b03a2e' }),
  o('riel', 'tecnica', 'Luminaria de riel 100×5×5', 1.0, 0.05, 0.05, { color: '#333333', dz: 2.8 }),
  o('persona', 'referencia', 'Persona de pie 50×30×170', 0.5, 0.3, 1.7, { color: '#4f6b82' }),
  o('silla-r', 'referencia', 'Silla de ruedas 70×110×130', 0.7, 1.1, 1.3, { color: '#4f6b82' }),
  o('nino', 'referencia', 'Niño 40×25×115', 0.4, 0.25, 1.15, { color: '#4f6b82' }),
];
export const catalogoPorId = (id) => CATALOGO.find((c) => c.id === id) || null;

// Mueble nuevo en (x, y) a partir de una entrada del catálogo (o de la biblioteca propia)
export const muebleDesde = (entrada, x, y, id) => ({
  id, tipo: 'mueble', x: r6(x), y: r6(y), l: entrada.l, a: entrada.forma === 'cilindro' ? entrada.l : entrada.a, h: entrada.h, rot: 0,
  forma: entrada.forma === 'cilindro' ? 'cilindro' : 'caja', nombre: entrada.nombre, cat: entrada.cat || 'propios', color: entrada.color || '#8a8a8a',
  catalogoId: entrada.id || null, dz: entrada.dz > 0 ? entrada.dz : 0,
  partes: Array.isArray(entrada.partes) ? entrada.partes.map((p) => ({ ...p })) : null,
});
// Entrada de biblioteca a partir de un mueble colocado (para «guardar en mi biblioteca»)
export const entradaDesde = (m, id) => ({
  id, cat: 'propios', nombre: m.nombre, l: m.l, a: m.a, h: m.h, forma: m.forma, color: m.color, dz: m.dz || 0,
  partes: Array.isArray(m.partes) ? m.partes.map((p) => ({ ...p })) : undefined,
});

const rad = (g) => g * Math.PI / 180;
// Huella en planta (polígono): rectángulo girado, o polígono de 24 lados si es cilindro
export const mueblePts = (m) => {
  if (m.forma === 'cilindro') { const r = m.l / 2, pts = []; for (let k = 0; k < 24; k++) { const t = k / 24 * 2 * Math.PI; pts.push({ x: m.x + Math.cos(t) * r, y: m.y + Math.sin(t) * r }); } return pts; }
  const c = Math.cos(rad(m.rot || 0)), s = Math.sin(rad(m.rot || 0)), L = m.l / 2, A = m.a / 2;
  return [[-L, -A], [L, -A], [L, A], [-L, A]].map(([u, v]) => ({ x: m.x + u * c - v * s, y: m.y + u * s + v * c }));
};
// Cajas 3D del mueble en coordenadas de sala: [{ pts (huella), z0, h, color }]
export const muebleCajas = (m) => {
  const z = m.dz || 0;
  if (!m.partes || !m.partes.length) return [{ pts: mueblePts(m), z0: z, h: m.h, color: m.color, forma: m.forma }];
  const c = Math.cos(rad(m.rot || 0)), s = Math.sin(rad(m.rot || 0));
  return m.partes.map((p) => {
    const cx = m.x + p.dx * c - p.dy * s, cy = m.y + p.dx * s + p.dy * c;
    return { pts: mueblePts({ x: cx, y: cy, l: p.l, a: p.a, rot: m.rot, forma: 'caja' }), z0: z + (p.dz || 0), h: p.h, color: p.color || m.color, forma: 'caja' };
  });
};

// Lista de materiales: conteo por nombre y medidas, por sala
export const csvMobiliario = (proyecto) => {
  const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
  const filas = [['sala', 'categoría', 'objeto', 'largo (m)', 'ancho (m)', 'alto (m)', 'cantidad']];
  for (const s of proyecto.salas) {
    const grupos = new Map();
    for (const e of s.entidades) {
      if (e.tipo !== 'mueble') continue;
      const k = [e.cat, e.nombre, fmt(e.l), fmt(e.a), fmt(e.h)].join('|');
      grupos.set(k, (grupos.get(k) || 0) + 1);
    }
    for (const [k, n] of [...grupos.entries()].sort()) filas.push([s.nombre, ...k.split('|'), String(n)]);
  }
  return filas.map((f) => f.map(q).join(';')).join('\r\n');
};
