// Puente planta → muro: a partir de un tramo de muro de la planta, el alzado con sus obras ya colocadas.
// Sin DOM. Metros.
import { G } from './planta.js';
import { MD } from './muro.js';
import * as M from './modelo.js';
import { r6, mAcm, fmtNum } from './unidades.js';

const TOL = 0.02; // m: un cuadro «está» sobre el tramo si sus dos extremos quedan a menos de esto

// Cara del tramo (±1 sobre la normal izquierda de a→b) desde la que se mira el muro.
// Si la línea es un contorno, la cara interior; si no, la izquierda.
export const caraPorDefecto = (linea) => -G.ladoFuera(linea);

// Extremo izquierdo del tramo visto por alguien de pie en la cara `cara`, mirando al muro.
// En coordenadas de pantalla (y hacia abajo), el vector «izquierda» del observador es (-n.y, n.x), con n la normal hacia él.
export const extremoIzquierdo = (a, b, cara) => {
  const d = G.unit(G.sub(b, a)); const n = G.mul(G.perp(d), cara);
  const izq = { x: -n.y, y: n.x };
  return G.dot(G.sub(b, a), izq) < 0 ? 'a' : 'b';
};

// Cuadros de la sala que cuelgan de ese tramo, con la cara en la que están
export const cuadrosDelTramo = (sala, linea, i) => {
  const seg = G.segmentos(linea).find((s) => s[2] === i); if (!seg) return [];
  const [a, b] = seg; const d = G.unit(G.sub(b, a)); const nz = G.perp(d);
  const out = [];
  for (const e of sala.entidades) {
    if (e.tipo !== 'cuadro' || !e.obraId) continue;
    if (G.proyectar(e.a, a, b).d > TOL || G.proyectar(e.b, a, b).d > TOL) continue;
    const nc = G.mul(G.perp(G.unit(G.sub(e.b, e.a))), e.lado === -1 ? -1 : 1);
    out.push({ e, cara: Math.sign(G.dot(nc, nz)) || 1 });
  }
  return out;
};

// Alto que se usará para una obra sin alto conocido (y queda marcado como estimado)
export const altoEstimado = (o) => (o.alto > 0 ? o.alto : o.ancho > 0 ? (o.imgRatio > 0 ? o.ancho / o.imgRatio : o.ancho * 0.75) : 0.7);

// Crea (sin añadir al proyecto) el muro del tramo i de la línea, visto desde `cara`.
// Las obras cuyo alto se desconoce reciben un alto estimado en su ficha.
export const muroDesdeTramo = (proyecto, sala, linea, i, cara) => {
  const seg = G.segmentos(linea).find((s) => s[2] === i); if (!seg) return null;
  const [a, b] = seg; const largo = G.dist(a, b); if (!(largo > 0)) return null;
  cara = cara === -1 || cara === 1 ? cara : caraPorDefecto(linea);
  const izq = extremoIzquierdo(a, b, cara);
  const origen = izq === 'a' ? a : b, d = G.unit(G.sub(izq === 'a' ? b : a, origen));
  const alto = G.alturaTramo(linea, i) || 3;
  const muro = M.nuevoMuro({
    nombre: (sala.nombre || 'Sala') + ' · tramo ' + (i + 1), salaId: sala.id, tramo: { entidadId: linea.id, i, cara },
    ancho: r6(largo), alto: r6(alto), eje: r6(Math.min(1.5, alto / 2)), grosor: r6(linea.espesor > 0 ? linea.espesor : 0.15),
  });
  const cuadros = cuadrosDelTramo(sala, linea, i).filter((c) => c.cara === cara);
  for (const { e } of cuadros) {
    const o = M.obraDe(proyecto, e.obraId); if (!o) continue;
    const ancho = o.ancho > 0 ? o.ancho : G.dist(e.a, e.b);
    if (!(o.ancho > 0)) { o.ancho = r6(ancho); o.estimado.ancho = false; }
    if (!(o.alto > 0)) { o.alto = r6(altoEstimado(o)); o.estimado.alto = true; }
    const x0 = Math.min(G.dot(G.sub(e.a, origen), d), G.dot(G.sub(e.b, origen), d));
    muro.colgado.push(M.nuevoColgado({ obraId: o.id, x: r6(x0), y: r6(alto - muro.eje - o.alto / 2) }));
  }
  muro.colgado.sort((p, q) => p.x - q.x);
  return muro;
};

// Muro ya existente para ese tramo y cara, si lo hay
export const muroDelTramo = (proyecto, sala, linea, i, cara) =>
  proyecto.muros.find((m) => m.salaId === sala.id && m.tramo && m.tramo.entidadId === linea.id && m.tramo.i === i && (cara == null || m.tramo.cara === cara)) || null;

// ---------- documentos de las vistas y SVG a escala ----------
// Sala con sus entidades decoradas con la ficha de cada obra (la planta no guarda fichas) y el calco con su imagen
export const dimsTexto = (o) => (o && (o.ancho > 0 || o.alto > 0) ? [o.ancho > 0 ? (o.estimado.ancho ? '≈' : '') + fmtNum(o.ancho) : '?', o.alto > 0 ? (o.estimado.alto ? '≈' : '') + fmtNum(o.alto) : '?'].join(' × ') + ' m' : '');
export const salaDecorada = (proyecto, sala) => ({
  ...sala,
  calco: sala.calco ? { ...sala.calco, src: proyecto.imagenes[sala.calco.imagenId] || '' } : null,
  entidades: sala.entidades.map((e) => {
    if (!G.esObra(e)) return e;
    const o = e.obraId ? M.obraDe(proyecto, e.obraId) : null;
    return o ? { ...e, titulo: o.nombre, artista: o.autor, anio: o.anio, tecnica: o.tecnica, dims: dimsTexto(o), nota: o.nota } : { ...e, titulo: '', artista: '', anio: '', tecnica: '', dims: '', nota: '' };
  }),
});
// SVG de la planta a un ancho en px; devuelve también px por metro
export const svgDeSala = (proyecto, sala, pxAncho = 2400) => {
  const r = G.construirSVG(salaDecorada(proyecto, sala), { pxAncho, titulo: true, barra: true, calco: !!sala.calco });
  return r ? { svg: r.svg, w: r.ancho, h: r.alto, pxPorMetro: r.ancho / r.W } : null;
};
// Documento de la vista Muro (formato MuseoDraft, cm) a partir de un muro del proyecto
const CM = { vano: ['x', 'y', 'w', 'h', 'prof'], persona: ['x', 'y', 'h', 'w', 'dist'], medida: ['x1', 'y1', 'x2', 'y2'], nota: ['x', 'y', 'tam'] };
export const docDeMuro = (proyecto, mu) => {
  const src = {
    version: 2, titulo: mu.nombre,
    wall: { w: mAcm(mu.ancho), h: mAcm(mu.alto), color: mu.color, eje: mAcm(mu.eje), grosor: mAcm(mu.grosor) },
    guides: { v: mu.guias.v.map(mAcm), h: mu.guias.h.map(mAcm) }, opts: mu.opts || {}, images: {}, items: [],
  };
  for (const c of mu.colgado) {
    const o = M.obraDe(proyecto, c.obraId); if (!o) continue;
    const w = o.ancho > 0 ? o.ancho : 0.5, h = o.alto > 0 ? o.alto : (o.imgRatio > 0 ? w / o.imgRatio : 0.7);
    if (o.imagenId && proyecto.imagenes[o.imagenId]) src.images[o.imagenId] = proyecto.imagenes[o.imagenId];
    src.items.push({
      id: c.id, obraId: o.id, tipo: 'obra', nombre: o.nombre, x: mAcm(c.x), y: mAcm(c.y), w: mAcm(w), h: mAcm(h),
      marco: mAcm(c.marco), pp: mAcm(c.pp), prof: mAcm(c.prof), caida: mAcm(c.caida), rot: c.rot, lock: c.lock, bloqueado: c.bloqueado, oculto: c.oculto,
      imgId: o.imagenId && proyecto.imagenes[o.imagenId] ? o.imagenId : null, imgRatio: o.imgRatio,
      est: { w: !(o.ancho > 0) || o.estimado.ancho, h: !(o.alto > 0) || o.estimado.alto },
      ficha: { titulo: o.nombre, autor: o.autor, anio: o.anio, tecnica: o.tecnica, inv: o.inv },
    });
  }
  for (const ot of mu.otros) { const n = { ...ot }; for (const k of CM[ot.tipo] || []) if (Number.isFinite(n[k])) n[k] = mAcm(n[k]); src.items.push(n); }
  return MD.normalize(src);
};
// SVG del alzado completo (cotas de todas las obras, fichas, personas, escala y rótulo)
export const svgDeMuro = (proyecto, mu, pxcm = 8) => {
  const doc = docDeMuro(proyecto, mu);
  const show = { imagenes: true, vanos: true, dims: true, gaps: true, bordes: true, centro: true, lineas: true, medidas: true, muro: true, fichas: true, notas: true };
  const o = { iso: false, pxcm, margen: 40, cotaCm: 4, show, escala: true, rotulo: true, human: true };
  const fr = MD.exportFrame(doc, o);
  const P = MD.svgPainter(doc.images);
  MD.drawScene(P, doc, fr.view, { ui: fr.u, sel: new Set(), cotas: 'all', show, eje: true, human: true, ojos: false, grid: false, guides: null, vw: fr.W, vh: fr.H, escala: true, rotulo: true, bounds: fr.bounds, floorRange: [fr.bounds.x - 1e4, fr.bounds.x + fr.bounds.w + 1e4] });
  return { svg: P.toString(fr.W, fr.H, '#ffffff'), w: fr.W, h: fr.H, pxPorMetro: fr.s * 100 };
};
