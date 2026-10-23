// Puente planta → muro: a partir de un tramo de muro de la planta, el alzado con sus obras ya colocadas.
// Sin DOM. Metros.
import { G } from './planta.js';
import * as M from './modelo.js';
import { r6 } from './unidades.js';

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
