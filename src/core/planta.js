// Geometría y render de la planta. Extraído de plano-sala; sin DOM. Modelo en metros, SVG en cm.
import { mueblePts as _mueblePts } from './biblioteca.js';
// ─── G: geometría y render, funciones puras sin DOM. Modelo en metros; SVG en centímetros (U).
export const G = (() => {
  const U = 100;
  const GROSOR = { fino: 1, medio: 2, grueso: 3.5 };
  const TRAZO = { continua: null, discontinua: [6, 4], punteada: [0.1, 2.6] };
  const COLORES = ['#111111', '#4f6b82', '#586a45', '#b06a36', '#b03a2e', '#8a8a8a'];
  const FUENTE = "'Fira Code', ui-monospace, Menlo, Consolas, monospace";
  const ESCALAS = [20, 25, 50, 75, 100, 200];
  const PAPELES = [['A4', 210, 297], ['A3', 297, 420], ['A2', 420, 594], ['A1', 594, 841], ['A0', 841, 1189]];

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const r6 = (v) => Math.round(v * 1e6) / 1e6;
  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const unit = (v) => { const l = Math.hypot(v.x, v.y); return l > 0 ? { x: v.x / l, y: v.y / l } : { x: 1, y: 0 }; };
  const perp = (v) => ({ x: -v.y, y: v.x });
  const medio = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const rotar = (v, grados) => { const r = grados * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }; };

  // Números en español: acepta coma o punto
  const parseNum = (s) => {
    if (typeof s === 'number') return s;
    const t = String(s ?? '').trim().replace(/\s+/g, '').replace(',', '.');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return NaN;
    return parseFloat(t);
  };
  const fmtNum = (n, dec = 2) => {
    if (!Number.isFinite(n)) return '—';
    const f = 10 ** dec; let s = (Math.round((n + Math.sign(n) * 1e-9) * f) / f).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    return s.replace('.', ',');
  };
  const fmtM = (m) => fmtNum(m) + ' m';
  const fmtM2 = (a) => fmtNum(a) + ' m²';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ── ajustes de puntero
  const snapGrid = (p, s) => (s > 0 ? { x: r6(Math.round(p.x / s) * s), y: r6(Math.round(p.y / s) * s) } : { x: p.x, y: p.y });
  // Ángulo en pasos de `paso` grados; longitud redondeada a `pasoLong` si se da
  const snapAngulo = (o, p, paso = 15, pasoLong = 0) => {
    let d = dist(o, p); if (!(d > 0)) return { x: p.x, y: p.y };
    if (pasoLong > 0) d = Math.max(pasoLong, Math.round(d / pasoLong) * pasoLong);
    const s = paso * Math.PI / 180;
    const b = Math.round(Math.atan2(p.y - o.y, p.x - o.x) / s) * s;
    return { x: r6(o.x + Math.cos(b) * d), y: r6(o.y + Math.sin(b) * d) };
  };
  const proyectar = (p, a, b) => {
    const ab = sub(b, a); const L2 = dot(ab, ab);
    if (!(L2 > 0)) return { q: { x: a.x, y: a.y }, t: 0, d: dist(p, a) };
    const t = clamp(dot(sub(p, a), ab) / L2, 0, 1);
    const q = { x: a.x + ab.x * t, y: a.y + ab.y * t };
    return { q, t, d: dist(p, q) };
  };
  const esPoligono = (e) => e.tipo === 'obra' || e.tipo === 'region';
  const esMueble = (e) => e.tipo === 'mueble';
  const mueblePts = _mueblePts;
  const segmentos = (e) => {
    if (esPoligono(e)) { const s = []; const n = e.pts.length; for (let i = 0; i < n; i++) s.push([e.pts[i], e.pts[(i + 1) % n], i]); return n > 2 ? s : []; }
    if (esMueble(e) && e.forma !== 'cilindro') { const pts = mueblePts(e); return pts.map((p, i) => [p, pts[(i + 1) % 4], i]); }
    if (e.tipo === 'linea') {
      const s = [];
      for (let i = 0; i < e.pts.length - 1; i++) s.push([e.pts[i], e.pts[i + 1], i]);
      if (e.cerrada && e.pts.length > 2) s.push([e.pts[e.pts.length - 1], e.pts[0], e.pts.length - 1]);
      return s;
    }
    if (e.tipo === 'puerta' || e.tipo === 'ventana' || e.tipo === 'cuadro') return [[e.a, e.b, 0]];
    return [];
  };
  const verticesIman = (e) => (e.tipo === 'linea' ? e.pts : e.tipo === 'circulo' ? [e.c] : e.tipo === 'puerta' || e.tipo === 'ventana' || e.tipo === 'cuadro' || e.tipo === 'proyeccion' ? [e.a, e.b] : esPoligono(e) ? e.pts : esMueble(e) ? (e.forma === 'cilindro' ? [{ x: e.x, y: e.y }] : mueblePts(e)) : []);
  // Imán: vértice > punto medio > sobre un tramo > rejilla > libre
  const imanar = (p, o) => {
    const ents = o.entidades || [], tol = o.tol || 0.1, ex = o.excluir || null;
    if (o.objetos !== false) {
      let best = null, bd = tol;
      for (const e of ents) verticesIman(e).forEach((v, i) => {
        if (ex && ex.id === e.id && ex.idx === i) return;
        const d = dist(p, v); if (d <= bd) { bd = d; best = { p: { x: v.x, y: v.y }, tipo: 'vertice' }; }
      });
      if (best) return best;
      const segs = [];
      for (const e of ents) { if (ex && ex.id === e.id) continue; for (const s of segmentos(e)) segs.push(s); }
      let bm = tol * 0.55;
      for (const [a, b] of segs) { const m = medio(a, b); const d = dist(p, m); if (d <= bm) { bm = d; best = { p: { x: r6(m.x), y: r6(m.y) }, tipo: 'medio' }; } }
      if (best) return best;
      let bl = null, bdl = tol * 0.8;
      for (const [a, b] of segs) { const pr = proyectar(p, a, b); if (pr.d <= bdl) { bdl = pr.d; bl = { p: { x: r6(pr.q.x), y: r6(pr.q.y) }, tipo: 'linea' }; } }
      if (bl) return bl;
    }
    if (o.rejilla > 0) return { p: snapGrid(p, o.rejilla), tipo: 'rejilla' };
    return { p: { x: p.x, y: p.y }, tipo: 'libre' };
  };

  // ── medidas
  const areaFirmada = (pts) => { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.y - b.x * a.y; } return s / 2; };
  const area = (pts) => (pts && pts.length > 2 ? Math.abs(areaFirmada(pts)) : 0);
  const longitudLinea = (e) => segmentos(e).reduce((s, [a, b]) => s + dist(a, b), 0);
  const puntoEnPoligono = (p, pts) => {
    let dentro = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) dentro = !dentro;
    }
    return dentro;
  };
  const anguloLegible = (a, b) => { let g = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; if (g > 89.999) g -= 180; else if (g < -90.001) g += 180; return g; };
  // Lado "de lectura" para un rótulo junto a un tramo abierto: arriba, o a la izquierda si es vertical
  const ladoArriba = (n) => (n.y < -1e-9 || (Math.abs(n.y) < 1e-9 && n.x < 0)) ? 1 : -1;
  // Rótulos de longitud por tramo: fuera de la figura si es cerrada; arriba/izquierda si es abierta
  // Una línea cerrada, o abierta que rodea un espacio (calco a medio trazar), define un contorno con dentro y fuera
  const contornoDe = (e) => (e.tipo === 'linea' && e.pts.length > 2 && (e.cerrada || area(e.pts) > 0.05 * Math.pow(longitudLinea(e), 2) / 16) ? e.pts : null);
  const esRectangulo = (pts) => {
    if (pts.length !== 4) return false;
    for (let i = 0; i < 4; i++) { const a = pts[i], b = pts[(i + 1) % 4], c = pts[(i + 2) % 4]; const u = sub(b, a), v = sub(c, b); if (Math.abs(dot(u, v)) > 1e-6 * (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y) + 1e-12)) return false; }
    return true;
  };
  // extra(a, b): separación adicional para un tramo (p. ej. el marco de una ventana que está sobre él)
  const etiquetasTramos = (e, h, extra = null) => {
    const res = []; const cerr = e.tipo === 'linea' && e.cerrada && e.pts.length > 2;
    // una línea abierta que rodea un espacio se rotula hacia fuera de la figura que insinúa
    const contorno = contornoDe(e);
    const rect = cerr && esRectangulo(e.pts);
    for (const [a, b, i] of segmentos(e)) {
      if (rect && i > 1) continue;
      const L = dist(a, b); if (L < h * 2) continue; // un tramo más corto que su rótulo se acota a mano
      const m = medio(a, b); const n = unit(perp(sub(b, a)));
      let s;
      if (contorno) { const prueba = add(m, mul(n, Math.min(h * 0.85, L * 0.2, h * 0.3))); s = puntoEnPoligono(prueba, contorno) ? -1 : 1; }
      else s = ladoArriba(n);
      // extra puede devolver un número (separación) o {off, t}: separación y posición a lo largo del tramo (0–1)
      const ex = extra ? extra(a, b, s) : 0;
      const off = h * 0.85 + (typeof ex === 'number' ? ex : ex.off);
      const base = typeof ex === 'number' ? m : add(a, mul(sub(b, a), ex.t));
      const pos = add(base, mul(n, s * off));
      res.push({ x: pos.x, y: pos.y, ang: anguloLegible(a, b), texto: fmtM(L), L, i, lado: s, n, base });
    }
    return res;
  };

  // Altura de un tramo: la propia si se indicó, si no la general del muro (0 = sin indicar)
  const alturaTramo = (e, i) => (e.alturas && e.alturas[i] > 0 ? e.alturas[i] : e.altura > 0 ? e.altura : 0);
  const tieneAlturas = (e) => e.tipo === 'linea' && (e.altura > 0 || (e.alturas && Object.values(e.alturas).some((v) => v > 0)));
  // Rótulos de altura: los tramos con altura propia, más la general una vez (en el tramo rotulado más largo sin altura propia)
  const etiquetasAltura = (e, et) => {
    if (!tieneAlturas(e)) return [];
    const propia = (i) => e.alturas && e.alturas[i] > 0;
    const res = et.filter((t) => propia(t.i)).map((t) => ({ t, v: e.alturas[t.i] }));
    if (e.altura > 0) { const libres = et.filter((t) => !propia(t.i)).sort((a, b) => b.L - a.L); if (libres.length) res.push({ t: libres[0], v: e.altura }); }
    return res;
  };
  // ── obras y regiones
  const centroide = (pts) => {
    let A = 0, cx = 0, cy = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; const c = a.x * b.y - b.x * a.y; A += c; cx += (a.x + b.x) * c; cy += (a.y + b.y) * c; }
    if (Math.abs(A) < 1e-12) { const n = pts.length || 1; return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n }; }
    return { x: cx / (3 * A), y: cy / (3 * A) };
  };
  // Muro (línea) sobre el que está un tramo a–b
  const lineaBajo = (ents, a, b) => {
    for (let k = ents.length - 1; k >= 0; k--) { const e = ents[k]; if (e.tipo !== 'linea') continue; for (const [p, q] of segmentos(e)) if (proyectar(a, p, q).d < 0.02 && proyectar(b, p, q).d < 0.02) return { e, hn: unit(perp(sub(q, p))) }; }
    return null;
  };
  // Cuadro adosado: franja de fondo `fondo` desde la cara del muro, hacia el lado `lado` (±1 sobre la normal izquierda de a→b)
  const cuadroGeom = (e, ents = [], k = 0) => {
    const w = dist(e.a, e.b); const d = unit(sub(e.b, e.a)); const n = mul(perp(d), e.lado === -1 ? -1 : 1);
    const host = lineaBajo(ents, e.a, e.b); let s0 = 0;
    if (host) {
      const bm = bandaMuro(host.e); const sh = Math.sign(dot(n, host.hn)) || 1;
      s0 = bm ? Math.max(0, sh > 0 ? bm[1] : -bm[0]) : (GROSOR[host.e.grosor] || 2) * k / 2;
    }
    const f = Math.max(e.fondo > 0 ? e.fondo : 0.05, k * 4);
    const esquinas = [add(e.a, mul(n, s0)), add(e.b, mul(n, s0)), add(e.b, mul(n, s0 + f)), add(e.a, mul(n, s0 + f))];
    return { w, d, n, s0, f, esquinas, centro: add(medio(e.a, e.b), mul(n, s0 + f / 2)), frente: add(medio(e.a, e.b), mul(n, s0 + f)) };
  };
  // Lado por defecto de un cuadro: hacia dentro de la sala si el muro es un contorno
  const ladoCuadro = (ents, a, b) => {
    const host = lineaBajo(ents, a, b); const c = host && contornoDe(host.e); if (!c) return 1;
    // sala: hacia dentro; panel o tabique delgado (ancho medio 2·área/perímetro < 35 cm): hacia fuera
    const dentro = -ladoFuera(host.e); const anchoMedio = 2 * area(c) / Math.max(longitudLinea({ ...host.e, cerrada: true }), 1e-9);
    const lado = anchoMedio < 0.35 ? -dentro : dentro;
    return (Math.sign(dot(perp(unit(sub(b, a))), host.hn)) || 1) * lado;
  };
  const esObra = (e) => e.tipo === 'obra' || e.tipo === 'cuadro';
  // ── proyección: imagen a–b sobre un muro o pantalla, proyector con la lente en p
  const FORMATOS = { '16:9': 16 / 9, '16:10': 16 / 10, '4:3': 4 / 3, '1:1': 1 };
  const proyGeom = (e, ents = [], k = 0) => {
    const w = dist(e.a, e.b); const mid = medio(e.a, e.b); const d = unit(sub(e.b, e.a)); const nl = perp(d);
    const lado = Math.sign(dot(sub(e.p, e.a), nl)) || 1;                       // la imagen mira hacia el proyector
    const pant = cuadroGeom({ a: e.a, b: e.b, lado, fondo: Math.max(0.03, k * 3) }, ents, k);
    const dIst = Math.abs(dot(sub(e.p, e.a), nl));                               // distancia perpendicular lente–imagen
    const eje = dist(e.p, mid) > 1e-9 ? unit(sub(mid, e.p)) : mul(nl, -lado);
    const L = e.largo > 0 ? e.largo : 0.4, W = e.anchoCuerpo > 0 ? e.anchoCuerpo : 0.3; const q = perp(eje);
    const atras = sub(e.p, mul(eje, L));
    const cuerpo = [add(atras, mul(q, W / 2)), add(e.p, mul(q, W / 2)), sub(e.p, mul(q, W / 2)), sub(atras, mul(q, W / 2))];
    const asp = e.formato === 'libre' ? (e.alto > 0 ? w / e.alto : 16 / 9) : FORMATOS[e.formato] || 16 / 9;
    const alto = e.formato === 'libre' && e.alto > 0 ? e.alto : w / asp;
    return { w, mid, d, nl, lado, pant, dist: dIst, tiro: w > 0 ? dIst / w : 0, eje, cuerpo, atras, alto, asp, frenteA: pant.esquinas[3], frenteB: pant.esquinas[2] };
  };
  // cambiar la distancia: el proyector se mueve en perpendicular a la imagen, sin desplazarse de lado
  const proyConDistancia = (e, D) => { const g = proyGeom(e); const n = mul(g.nl, g.lado); const actual = dot(sub(e.p, e.a), n); return add(e.p, mul(n, D - actual)); };
  const proyConAncho = (e, w) => { const g = proyGeom(e); return { a: sub(g.mid, mul(g.d, w / 2)), b: add(g.mid, mul(g.d, w / 2)) }; };
  const etqRegion = (e) => (e.etq && Number.isFinite(e.etq.x) ? e.etq : centroide(e.pts));
  const enEtqRegion = (e, p, h = 0.2) => { const c = etqRegion(e); const w = Math.max(3, String(e.nombre || '').length) * h * 1.5 * 0.62; return Math.abs(p.x - c.x) <= w / 2 && Math.abs(p.y - c.y) <= h * 1.3; };
  const puntoObra = (e, ents) => (e.tipo === 'obra' ? centroide(e.pts) : cuadroGeom(e, ents).centro);
  const obrasEn = (doc, r) => doc.entidades.filter((o) => esObra(o) && puntoEnPoligono(puntoObra(o, doc.entidades), r.pts));
  const regionDe = (doc, o) => { const p = puntoObra(o, doc.entidades); const rs = doc.entidades.filter((r) => r.tipo === 'region' && r.pts.length > 2 && puntoEnPoligono(p, r.pts)); return rs.length ? rs[rs.length - 1] : null; };
  const numSiguiente = (ents) => ents.filter(esObra).reduce((m, o) => Math.max(m, parseInt(o.num, 10) || 0), 0) + 1;
  const ordenNatural = (a, b) => String(a.num ?? '').localeCompare(String(b.num ?? ''), 'es', { numeric: true });
  // Lista de obras: punto y coma y coma decimal (Excel en español)
  const csvObras = (doc) => {
    const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const filas = [['nº', 'tipo', 'título', 'artista', 'año', 'técnica', 'medidas', 'región', 'ancho en planta (m)', 'área en planta (m²)', 'x (m)', 'y (m)', 'nota']];
    for (const o of doc.entidades.filter(esObra).slice().sort(ordenNatural)) {
      const r = regionDe(doc, o); const p = puntoObra(o, doc.entidades);
      filas.push([o.num, o.tipo === 'cuadro' ? 'cuadro' : 'obra en planta', o.titulo, o.artista, o.anio, o.tecnica, o.dims, r ? r.nombre : '',
        o.tipo === 'cuadro' ? fmtNum(dist(o.a, o.b)) : '', o.tipo === 'obra' ? fmtNum(area(o.pts)) : '', fmtNum(p.x), fmtNum(p.y), o.nota]);
    }
    return filas.map((f) => f.map(q).join(';')).join('\r\n');
  };
  // ── geometría de piezas
  const puertaGeom = (e) => {
    const hinge = e.bisagra === 'b' ? e.b : e.a, otro = e.bisagra === 'b' ? e.a : e.b;
    const w = dist(hinge, otro); if (!(w > 0)) return null;
    const d = unit(sub(otro, hinge)); const n = mul(perp(d), e.lado === -1 ? -1 : 1);
    const hoja = add(hinge, mul(n, w));
    const v1 = sub(hoja, hinge), v2 = sub(otro, hinge);
    return { hinge, otro, hoja, w, sweep: v1.x * v2.y - v1.y * v2.x > 0 ? 1 : 0 };
  };
  // Cuatro giros posibles de una puerta: [lado, bisagra]
  const GIROS = [[1, 'a'], [-1, 'a'], [-1, 'b'], [1, 'b']];
  const siguienteGiro = (e) => { const i = GIROS.findIndex(([l, b]) => l === (e.lado === -1 ? -1 : 1) && b === (e.bisagra === 'b' ? 'b' : 'a')); const [l, b] = GIROS[(i + 1) % GIROS.length]; return { lado: l, bisagra: b }; };
  // ── muros con espesor. La línea dibujada es la cara de referencia (la que se mide); la banda crece hacia `cara`
  // Signo de la normal izquierda (perp) que apunta fuera del contorno; +1 si no hay contorno
  const ladoFuera = (e) => {
    const c = contornoDe(e); if (!c) return 1;
    let mejor = null, bl = 0; for (const [a, b] of segmentos(e)) { const L = dist(a, b); if (L > bl) { bl = L; mejor = [a, b]; } }
    if (!mejor) return 1;
    const [a, b] = mejor; const prueba = add(medio(a, b), mul(unit(perp(sub(b, a))), Math.min(bl * 0.01, 0.01)));
    return puntoEnPoligono(prueba, c) ? -1 : 1;
  };
  // [omin, omax]: extensión de la banda respecto de la normal izquierda de cada tramo
  const bandaMuro = (e) => {
    const t = e.tipo === 'linea' && e.espesor > 0 ? e.espesor : 0; if (!t) return null;
    if (e.cara === 'centro') return [-t / 2, t / 2];
    const s = ladoFuera(e) * (e.cara === 'dentro' ? -1 : 1);
    return s > 0 ? [0, t] : [-t, 0];
  };
  // Polilínea desplazada o metros hacia la normal izquierda, con ingletes (limitados a 6 veces el desplazamiento)
  const desplazarPolilinea = (pts, cerrada, o) => {
    const n = pts.length; if (!o) return pts.map((p) => ({ x: p.x, y: p.y }));
    const nrm = (i) => unit(perp(sub(pts[(i + 1) % n], pts[i])));
    return pts.map((p, i) => {
      if (!cerrada && i === 0) return add(p, mul(nrm(0), o));
      if (!cerrada && i === n - 1) return add(p, mul(nrm(n - 2), o));
      const n1 = nrm((i - 1 + n) % n), n2 = nrm(i); const m = add(n1, n2); const ml = Math.hypot(m.x, m.y);
      if (ml < 1e-9) return add(p, mul(n1, o));
      const mu = mul(m, 1 / ml); const largo = Math.min(1 / Math.max(dot(mu, n1), 1e-9), 6) * o;
      return add(p, mul(mu, largo));
    });
  };
  const contornoBanda = (e) => {
    const b = bandaMuro(e); if (!b) return null;
    const cerr = e.cerrada && e.pts.length > 2;
    return { banda: b, cerrada: cerr, A: desplazarPolilinea(e.pts, cerr, b[1]), B: desplazarPolilinea(e.pts, cerr, b[0]) };
  };
  // Muro con espesor bajo un vano a–b (puerta o ventana): normal del tramo y extensión de la banda
  const anfitrion = (ents, a, b) => {
    for (const e of ents) {
      const banda = bandaMuro(e); if (!banda) continue;
      for (const [p, q] of segmentos(e)) if (proyectar(a, p, q).d < 0.02 && proyectar(b, p, q).d < 0.02) return { n: unit(perp(sub(q, p))), omin: banda[0], omax: banda[1] };
    }
    return null;
  };
  // Ventana: vano a–b con marco del espesor del muro, centrado en él
  const ventanaGeom = (e) => {
    const w = dist(e.a, e.b); if (!(w > 0)) return null;
    const d = unit(sub(e.b, e.a)); const n = perp(d); const m = mul(n, (e.esp > 0 ? e.esp : 0.15) / 2);
    return { w, d, n, mitad: (e.esp > 0 ? e.esp : 0.15) / 2, esquinas: [add(e.a, m), add(e.b, m), sub(e.b, m), sub(e.a, m)] };
  };
  // Cota encadenada: puntos medidos sobre la dirección del primer tramo. Las longitudes son proyectadas: un clic torcido no las altera
  const cotaPts = (e) => (Array.isArray(e.pts) ? e.pts : e.a && e.b ? [e.a, e.b] : []);
  const cotaGeom = (e) => {
    const pts = cotaPts(e); const p0 = pts[0] || { x: 0, y: 0 };
    let d = { x: 1, y: 0 }; for (let i = 1; i < pts.length; i++) if (dist(pts[i], p0) > 1e-9) { d = unit(sub(pts[i], p0)); break; }
    const n = perp(d); const off = e.desp || 0;
    const ts = pts.map((p) => dot(sub(p, p0), d));
    const sobre = (t, o) => add(p0, add(mul(d, t), mul(n, o)));
    const qs = ts.map((t) => sobre(t, off));
    const tmin = Math.min(...ts), tmax = Math.max(...ts);
    const tramos = []; for (let i = 0; i < pts.length - 1; i++) tramos.push({ L: Math.abs(ts[i + 1] - ts[i]), m: medio(qs[i], qs[i + 1]) });
    const lado = off !== 0 ? Math.sign(off) : ladoArriba(n);
    const qmin = sobre(tmin, off), qmax = sobre(tmax, off);
    return { pts, d, n, ts, qs, tramos, lado, sobre, tmin, tmax, total: tmax - tmin, L: tmax - tmin, qmin, qmax, a2: qmin, b2: qmax, m: medio(qmin, qmax), ang: anguloLegible(p0, add(p0, d)) };
  };
  // Cambia la medida del tramo i desplazando los puntos siguientes a lo largo de la cota
  const estirarCota = (e, i, nuevaL) => {
    const g = cotaGeom(e); if (i < 0 || i >= g.pts.length - 1 || !(nuevaL > 0)) return null;
    const dt = g.ts[i + 1] - g.ts[i]; const s = Math.sign(dt) || 1; const delta = (nuevaL - Math.abs(dt)) * s;
    return g.pts.map((p, k) => (k > i ? { x: r6(p.x + g.d.x * delta), y: r6(p.y + g.d.y * delta) } : { x: p.x, y: p.y }));
  };
  const textoCaja = (e) => {
    const lineas = String(e.texto || ' ').split('\n');
    const w = Math.max(1, ...lineas.map((l) => l.length)) * e.tam * 0.62;
    return { w, h: lineas.length * e.tam * 1.25, lineas };
  };

  // ── selección: distancia de un punto a una pieza (m)
  let o_h = 0.2, o_ents = [];
  const distanciaA = (e, p) => {
    switch (e.tipo) {
      case 'linea': {
        const bm = bandaMuro(e); const ext = bm ? Math.max(-bm[0], bm[1]) : 0;
        if (ext) { let d = Infinity; for (const [a, b] of segmentos(e)) d = Math.min(d, proyectar(p, a, b).d); if (d <= ext) return 0; }
        if (e.cerrada && e.relleno && e.relleno !== 'ninguno' && e.pts.length > 2 && puntoEnPoligono(p, e.pts)) return 0;
        let d = Infinity; for (const [a, b] of segmentos(e)) d = Math.min(d, proyectar(p, a, b).d);
        if (e.pts.length === 1) d = dist(p, e.pts[0]);
        return d;
      }
      case 'circulo': { const d = dist(p, e.c); return e.relleno && e.relleno !== 'ninguno' && d <= e.r ? 0 : Math.abs(d - e.r); }
      case 'puerta': { const g = puertaGeom(e); if (!g) return dist(p, e.a); const da = Math.abs(dist(p, g.hinge) - g.w); const enArco = dot(sub(p, g.hinge), sub(g.hoja, g.hinge)) >= 0 && dot(sub(p, g.hinge), sub(g.otro, g.hinge)) >= 0; return Math.min(proyectar(p, e.a, e.b).d, proyectar(p, g.hinge, g.hoja).d, enArco ? da : Infinity); }
      case 'ventana': { const g = ventanaGeom(e); const pr = proyectar(p, e.a, e.b); return g ? Math.max(0, pr.d - g.mitad) : pr.d; }
      case 'obra': { if (e.pts.length > 2 && puntoEnPoligono(p, e.pts)) return 0; let d = Infinity; for (const [a, b] of segmentos(e)) d = Math.min(d, proyectar(p, a, b).d); return d; }
      case 'region': {
        let d = Infinity; for (const [a, b] of segmentos(e)) d = Math.min(d, proyectar(p, a, b).d);
        if (enEtqRegion(e, p, o_h || 0.2)) return 0;
        return d;
      }
      case 'proyeccion': {
        const g = proyGeom(e, o_ents); if (puntoEnPoligono(p, g.cuerpo)) return 0;
        return Math.min(proyectar(p, e.a, e.b).d, proyectar(p, e.p, g.frenteA).d, proyectar(p, e.p, g.frenteB).d, ...g.cuerpo.map((c, i) => proyectar(p, c, g.cuerpo[(i + 1) % 4]).d));
      }
      case 'cuadro': { const g = cuadroGeom(e, o_ents); if (puntoEnPoligono(p, g.esquinas)) return 0; return Math.min(proyectar(p, e.a, e.b).d, dist(p, g.frente)); }
      case 'texto': { const c = textoCaja(e); const l = rotar(sub(p, e), -(e.rot || 0)); const dx = Math.max(0, Math.abs(l.x) - c.w / 2), dy = Math.max(0, Math.abs(l.y) - c.h / 2); return Math.hypot(dx, dy); }
      case 'mueble': { const pts = mueblePts(e); if (puntoEnPoligono(p, pts)) return 0; let d = Infinity; for (let i = 0; i < pts.length; i++) d = Math.min(d, proyectar(p, pts[i], pts[(i + 1) % pts.length]).d); return d; }
      case 'cota': { const g = cotaGeom(e); return Math.min(proyectar(p, g.qmin, g.qmax).d, ...g.tramos.map((t) => dist(p, t.m))); }
    }
    return Infinity;
  };
  const tocar = (ents, p, tol, h = 0.2) => {
    o_h = h; o_ents = ents; let best = null, bd = tol;
    for (let i = ents.length - 1; i >= 0; i--) { const d = distanciaA(ents[i], p); if (d < bd - 1e-9) { bd = d; best = ents[i].id; } }
    return best;
  };

  // ── edición
  const mover = (e, dx, dy) => {
    const m = (p) => ({ x: r6(p.x + dx), y: r6(p.y + dy) });
    if (e.tipo === 'linea') e.pts = e.pts.map(m);
    else if (e.tipo === 'circulo') e.c = m(e.c);
    else if (e.tipo === 'cota') { e.pts = cotaPts(e).map(m); delete e.a; delete e.b; }
    else if (esPoligono(e)) { e.pts = e.pts.map(m); if (e.etq) e.etq = m(e.etq); }
    else if (e.tipo === 'proyeccion') { e.a = m(e.a); e.b = m(e.b); e.p = m(e.p); }
    else if (e.tipo === 'puerta' || e.tipo === 'ventana' || e.tipo === 'cuadro') { e.a = m(e.a); e.b = m(e.b); }
    else if (e.tipo === 'texto' || esMueble(e)) { const q = m(e); e.x = q.x; e.y = q.y; }
    return e;
  };
  const asas = (e) => {
    if (e.tipo === 'linea' || esPoligono(e)) return e.pts.map((p) => ({ x: p.x, y: p.y }));
    if (e.tipo === 'cuadro') return [{ x: e.a.x, y: e.a.y }, { x: e.b.x, y: e.b.y }];
    if (e.tipo === 'proyeccion') return [{ x: e.a.x, y: e.a.y }, { x: e.b.x, y: e.b.y }, { x: e.p.x, y: e.p.y }];
    if (e.tipo === 'circulo') return [{ x: e.c.x, y: e.c.y }, { x: e.c.x + e.r, y: e.c.y }];
    if (e.tipo === 'cota') return cotaPts(e).map((p) => ({ x: p.x, y: p.y }));
    if (e.tipo === 'puerta' || e.tipo === 'ventana') return [{ x: e.a.x, y: e.a.y }, { x: e.b.x, y: e.b.y }];
    return [];
  };
  const fijarAsa = (e, i, p) => {
    const q = { x: r6(p.x), y: r6(p.y) };
    if (e.tipo === 'linea' || esPoligono(e)) e.pts[i] = q;
    else if (e.tipo === 'cuadro') e[i === 0 ? 'a' : 'b'] = q;
    else if (e.tipo === 'proyeccion') e[['a', 'b', 'p'][i]] = q;
    else if (e.tipo === 'circulo') { if (i === 0) e.c = q; else e.r = Math.max(0.01, r6(dist(e.c, q))); }
    else if (e.tipo === 'cota') { e.pts = cotaPts(e).slice(); e.pts[i] = q; delete e.a; delete e.b; }
    else if (e.tipo === 'puerta' || e.tipo === 'ventana') e[i === 0 ? 'a' : 'b'] = q;
    return e;
  };
  // Inserta un vértice en el tramo más cercano a p (si está a menos de tol). Devuelve el índice nuevo o -1
  const insertarVertice = (e, p, tol) => {
    if (e.tipo !== 'linea' && !esPoligono(e)) return -1;
    let best = null, bd = tol;
    for (const [a, b, i] of segmentos(e)) { const pr = proyectar(p, a, b); if (pr.d <= bd && pr.t > 0.001 && pr.t < 0.999) { bd = pr.d; best = { i, q: pr.q }; } }
    if (!best) return -1;
    e.pts.splice(best.i + 1, 0, { x: r6(best.q.x), y: r6(best.q.y) }); delete e.etiq;
    return best.i + 1;
  };
  const borrarVertice = (e, i) => {
    if (esPoligono(e)) { if (e.pts.length <= 3) return false; e.pts.splice(i, 1); return true; }
    if (e.tipo !== 'linea' || e.pts.length <= 2) return false;
    delete e.etiq;
    e.pts.splice(i, 1); if (e.cerrada && e.pts.length < 3) e.cerrada = false; return true;
  };
  // Estira el tramo i hasta nuevaL: todo lo que queda más allá de su extremo, en su dirección, se desplaza.
  // Mantiene rectángulos y salas ortogonales rectas al cambiar una medida.
  const estirarTramo = (pts, i, cerrada, nuevaL) => {
    const n = pts.length; const j = (i + 1) % n;
    if (i < 0 || i >= n || (!cerrada && j === 0)) return null;
    const a = pts[i], b = pts[j]; const L = dist(a, b);
    if (!(L > 0) || !(nuevaL > 0)) return null;
    const d = unit(sub(b, a)); const delta = nuevaL - L; const tolp = Math.max(1e-6, L * 1e-6);
    return pts.map((p, k) => {
      if (k === i) return { x: p.x, y: p.y };
      return dot(sub(p, a), d) >= L - tolp ? { x: r6(p.x + d.x * delta), y: r6(p.y + d.y * delta) } : { x: p.x, y: p.y };
    });
  };
  const rectPts = (a, b) => [{ x: a.x, y: a.y }, { x: b.x, y: a.y }, { x: b.x, y: b.y }, { x: a.x, y: b.y }];

  // ── calco (papel de cebolla): imagen con escala mpp (m por px), posición x,y (esquina, m) y rotación en grados sobre su centro
  const calcoCentro = (c) => ({ x: c.x + c.w * c.mpp / 2, y: c.y + c.h * c.mpp / 2 });
  const localAMundo = (c, l) => add(calcoCentro(c), rotar({ x: (l.x - c.w / 2) * c.mpp, y: (l.y - c.h / 2) * c.mpp }, c.rot || 0));
  const mundoALocal = (c, p) => { const v = rotar(sub(p, calcoCentro(c)), -(c.rot || 0)); return { x: v.x / c.mpp + c.w / 2, y: v.y / c.mpp + c.h / 2 }; };
  // Dos puntos en el mundo sobre la imagen + su longitud real: nueva escala, con el primer punto fijo en su sitio
  const calibrarCalco = (c, p1, p2, metros) => {
    const l1 = mundoALocal(c, p1), l2 = mundoALocal(c, p2); const dpx = dist(l1, l2);
    if (!(dpx > 0) || !(metros > 0)) return null;
    const mpp = metros / dpx;
    const centro = sub(p1, rotar({ x: (l1.x - c.w / 2) * mpp, y: (l1.y - c.h / 2) * mpp }, c.rot || 0));
    return { ...c, mpp, x: centro.x - c.w * mpp / 2, y: centro.y - c.h * mpp / 2, calibrado: { metros } };
  };
  // Rotar sin que el centro se mueva
  const esquinasCalco = (c) => [[0, 0], [c.w, 0], [c.w, c.h], [0, c.h]].map(([x, y]) => localAMundo(c, { x, y }));

  // ── caja envolvente de todo el dibujo (m)
  const caja = (ents, h = 0.2) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const inc = (p, r = 0) => { x0 = Math.min(x0, p.x - r); y0 = Math.min(y0, p.y - r); x1 = Math.max(x1, p.x + r); y1 = Math.max(y1, p.y + r); };
    for (const e of ents) {
      if (e.tipo === 'linea') { const r = (e.medidas || tieneAlturas(e) ? h * 1.6 : 0) + (e.espesor > 0 ? e.espesor : 0); e.pts.forEach((p) => inc(p, r)); }
      else if (e.tipo === 'circulo') { inc(e.c, e.r); if (e.medidas) inc({ x: e.c.x + e.r + h * 6, y: e.c.y }); }
      else if (esMueble(e)) mueblePts(e).forEach((p) => inc(p));
      else if (e.tipo === 'puerta') { inc(e.a); inc(e.b); const g = puertaGeom(e); if (g) inc(g.hoja); }
      else if (e.tipo === 'ventana') { const g = ventanaGeom(e); (g ? g.esquinas : [e.a, e.b]).forEach((p) => inc(p, e.medidas ? h * 1.6 : 0)); }
      else if (e.tipo === 'cota') { const g = cotaGeom(e); g.pts.forEach((p) => inc(p)); g.qs.forEach((p) => inc(p, h * 1.5)); if (e.total) { const o = (e.desp || 0) + g.lado * h * 2.2; inc(g.sobre(g.tmin, o), h * 1.5); inc(g.sobre(g.tmax, o), h * 1.5); } }
      else if (e.tipo === 'texto') { const c = textoCaja(e); inc(e, Math.max(c.w, c.h) / 2); }
      else if (esPoligono(e)) { e.pts.forEach((p) => inc(p)); if (e.tipo === 'region') { const c = etqRegion(e); inc(c, String(e.nombre || '').length * h * 0.5); } }
      else if (e.tipo === 'cuadro') { const g = cuadroGeom(e, ents); g.esquinas.forEach((p) => inc(p)); inc(g.frente, h * 1.6); }
      else if (e.tipo === 'proyeccion') { const g = proyGeom(e, ents); [e.a, e.b, ...g.cuerpo].forEach((p) => inc(p)); inc(g.atras, h * 2.5); }
    }
    return x1 >= x0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  };
  const unirCajas = (a, b) => { if (!a) return b; if (!b) return a; const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y); return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }; };
  const cajaPuntos = (pts) => { if (!pts.length) return null; const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y); const x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; };

  const longitudBonita = (maxM) => { const b = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100]; let m = null; for (const n of b) if (n <= maxM) m = n; return m; };
  // Hoja más pequeña que lo contiene con 10 mm de margen por lado; prueba primero la orientación del dibujo
  const papelPara = (wmm, hmm, margen = 10) => {
    const w = wmm + 2 * margen, h = hmm + 2 * margen; const apaisado = w > h;
    for (const [n, a, b] of PAPELES) {
      const ops = apaisado ? [['horizontal', b, a], ['vertical', a, b]] : [['vertical', a, b], ['horizontal', b, a]];
      for (const [o, pw, ph] of ops) if (w <= pw && h <= ph) return { nombre: n, orient: o };
    }
    return null;
  };

  // ── render: SVG en cm. k = metros por unidad de grosor (editor: 1 px de pantalla; exportación: 0,18 mm de papel)
  const C = (v) => +(v * U).toFixed(2);
  // Texto centrado verticalmente en (x,y) sin depender de dominant-baseline. halo: grosor del contorno blanco (m), como copia detrás
  const svgTexto = (x, y, texto, tam, color, ang, halo = 0, ancla = 'middle', peso = '') => {
    const lineas = String(texto).split('\n'); const n = lineas.length;
    const tr = ang ? ` transform="rotate(${+ang.toFixed(3)} ${C(x)} ${C(y)})"` : '';
    const spans = lineas.map((l, i) => `<tspan x="${C(x)}" dy="${i === 0 ? fmtDy(0.35 - (n - 1) * 0.625) : '1.25em'}">${esc(l) || ' '}</tspan>`).join('');
    const abre = (atr) => `<text x="${C(x)}" y="${C(y)}" font-size="${C(tam)}" font-family="${FUENTE}" text-anchor="${ancla}"${peso ? ` font-weight="${peso}"` : ''}${tr} ${atr}>`;
    let s = '';
    if (halo > 0) s += abre(`fill="#ffffff" stroke="#ffffff" stroke-width="${C(halo)}" stroke-linejoin="round"`) + spans + '</text>';
    return s + abre(`fill="${color}"`) + spans + '</text>';
  };
  const fmtDy = (v) => (v === 0 ? '0' : +v.toFixed(4) + 'em');
  // ── rótulos: colocación evitando choques
  const cajaRotada = (c, w, hh, ang) => {
    const r = (ang || 0) * Math.PI / 180, cs = Math.abs(Math.cos(r)), sn = Math.abs(Math.sin(r));
    const ex = cs * w / 2 + sn * hh / 2, ey = sn * w / 2 + cs * hh / 2;
    return { x0: c.x - ex, y0: c.y - ey, x1: c.x + ex, y1: c.y + ey };
  };
  const unirCaja = (a, b) => (a ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } : b);
  const cajaDePuntos = (pts, m = 0) => pts.reduce((c, p) => unirCaja(c, { x0: p.x - m, y0: p.y - m, x1: p.x + m, y1: p.y + m }), null);
  const cajasChocan = (a, b, eps = 0) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > eps && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > eps;
  // Liang–Barsky: ¿el segmento p–q atraviesa la caja?
  const segCruzaCaja = (p, q, c) => {
    let t0 = 0, t1 = 1; const dx = q.x - p.x, dy = q.y - p.y;
    for (const [pp, qq] of [[-dx, p.x - c.x0], [dx, c.x1 - p.x], [-dy, p.y - c.y0], [dy, c.y1 - p.y]]) {
      if (Math.abs(pp) < 1e-12) { if (qq < 0) return false; continue; }
      const r = qq / pp; if (pp < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    return t1 - t0 > 1e-9;
  };
  const marcoDe = (a, b) => { const d = unit(sub(b, a)); return { o: a, d, n: perp(d) }; };
  const marcoFijo = (o) => ({ o, d: { x: 1, y: 0 }, n: { x: 0, y: 1 } });
  const enMarco = (f, p) => { const r = sub(p, f.o); return { u: dot(r, f.d), v: dot(r, f.n) }; };
  const deMarco = (f, c) => add(f.o, add(mul(f.d, c.u), mul(f.n, c.v)));
  // Geometría de un rótulo (una o varias líneas apiladas) en una posición: centros por línea y caja envolvente
  const disponer = (p, pos) => {
    const ap = p.apila || { x: 0, y: 1 }; let off = 0; let caja = null; const centros = [], cajas = [];
    p.lineas.forEach((l, i) => {
      if (i > 0) off += (p.lineas[i - 1].tam + l.tam) / 2 * 1.15;
      const c = add(pos, mul(ap, off)); centros.push(c);
      const cl = cajaRotada(c, Math.max(1, String(l.texto).length) * l.tam * 0.6, l.tam * 1.2, p.ang); cajas.push(cl); caja = unirCaja(caja, cl);
    });
    return { centros, caja, cajas };
  };

  const svgDibujo = (doc, o = {}) => {
    const k = o.k || 0.01; const h = doc.rotulo || 0.2;
    const sw = (g) => C((GROSOR[g] || GROSOR.medio) * k);
    const trazo = (estilo, g) => {
      const t = TRAZO[estilo]; if (!t) return ' stroke-linecap="square"';
      const f = GROSOR[g] || 2;
      return ` stroke-dasharray="${t.map((v) => C(v * k * f)).join(' ')}" stroke-linecap="${estilo === 'punteada' ? 'round' : 'butt'}"`;
    };
    const halo = h * 0.3;
    const usados = new Set(); let cuerpo = '';
    const pedidos = [], obsCajas = [], obsSegs = [];
    const anchoTxt = (t, tam) => Math.max(1, String(t).length) * tam * 0.6;
    // giro manual: el texto se lee con ese ángulo y las líneas se apilan hacia «abajo» del texto
    const giroManual = (e, key) => { const g = e.etiq && e.etiq[key] && e.etiq[key].ang; return Number.isFinite(g) ? g : null; };
    const abajo = (ang) => { const r = ang * Math.PI / 180; return { x: -Math.sin(r), y: Math.cos(r) }; };
    // tamaño propio: factor sobre el tamaño de rótulos de la sala
    const escala = (e, key) => { const v = e.etiq && e.etiq[key] && e.etiq[key].esc; return v > 0 && v !== 1 ? v : null; };
    const escalar = (lineas, esc) => (esc ? lineas.map((l) => ({ ...l, tam: l.tam * esc })) : lineas);
    const pedir = (e, key, lineas0, ang, f, cands0, op = {}) => {
      const ov = e.etiq && e.etiq[key] && Number.isFinite(e.etiq[key].u) ? e.etiq[key] : null;
      const esc = escala(e, key); const lineas = escalar(lineas0, esc);
      // al crecer, el rótulo se aparta lo que crece su media altura
      const cands = esc && !op.fijo ? cands0.map((c) => ({ u: c.u, v: c.v + (Math.sign(c.v) || 0) * (esc - 1) * lineas0[0].tam * 0.6 })) : cands0;
      const gm = giroManual(e, key);
      pedidos.push({ id: e.id, key, lineas, ang: gm ?? (ang || 0), f, cands: ov ? [ov] : cands, fijo: !!(ov || op.fijo), movible: op.movible !== false, manual: !!(ov || gm !== null || esc), apila: gm !== null && lineas.length > 1 ? abajo(gm) : op.apila || null, esc: esc || 1 });
    };
    // posiciones candidatas a lo largo de un tramo de largo L: deslizar y alejar; las del otro lado al final
    const variantes = (L, w, u0, vs) => {
      const du = Math.max(w * 0.55, L * 0.1); const us = [u0];
      for (let i = 1; i <= 3; i++) us.push(u0 - du * i, u0 + du * i);
      const lo = Math.min(w / 2, L / 2), hi = Math.max(L - w / 2, L / 2);
      let ok = us.filter((u) => u >= lo - 1e-9 && u <= hi + 1e-9); if (!ok.length) ok = [u0];
      return vs.flatMap((v) => ok.map((u) => ({ u, v })));
    };
    const alejar = (v0) => { const s = Math.sign(v0) || 1; return [v0, v0 + s * h * 1.1, v0 + s * h * 2.2]; };
    const vanos = doc.entidades.filter((x) => x.tipo === 'puerta' || x.tipo === 'ventana');
    const ventanas = doc.entidades.filter((x) => x.tipo === 'ventana').map((v) => ({ v, g: ventanaGeom(v) })).filter((x) => x.g);
    const margenVentanas = (a, b) => {
      let m = 0;
      for (const { v, g } of ventanas) { const pa = proyectar(v.a, a, b), pb = proyectar(v.b, a, b); if (pa.d < 0.02 && pb.d < 0.02) m = Math.max(m, g.mitad); }
      return m;
    };
    const relleno = (e) => {
      if (e.relleno === 'tenue') return `fill="${e.color}" fill-opacity="0.13"`;
      if (e.relleno === 'rayado') { usados.add(e.color); return `fill="url(#ry${e.color.slice(1)})"`; }
      return 'fill="none"';
    };
    const capa = (e) => (e.tipo === 'region' ? -1 : e.tipo === 'puerta' || e.tipo === 'ventana' || esObra(e) || e.tipo === 'proyeccion' || esMueble(e) ? 1 : e.tipo === 'cota' || e.tipo === 'texto' ? 2 : 0);
    const orden = [-1, 0, 1, 2].flatMap((n) => doc.entidades.filter((e) => capa(e) === n));
    for (const e of orden) {
      const col = e.color || COLORES[0];
      if (e.tipo === 'linea') {
        if (e.pts.length < 2) continue;
        const cerr = e.cerrada && e.pts.length > 2;
        const d = 'M' + e.pts.map((p) => C(p.x) + ' ' + C(p.y)).join(' L') + (cerr ? ' Z' : '');
        const cb = contornoBanda(e);
        const segs = segmentos(e); segs.forEach(([a, b]) => obsSegs.push([a, b]));
        if (cb) {
          for (const P of [cb.A, cb.B]) for (let i = 0; i < P.length - (cb.cerrada ? 0 : 1); i++) obsSegs.push([P[i], P[(i + 1) % P.length]]);
          const anillo = (P) => 'M' + P.map((p) => C(p.x) + ' ' + C(p.y)).join(' L');
          const dB = cb.cerrada ? anillo(cb.A) + ' Z ' + anillo(cb.B) + ' Z' : anillo(cb.A) + ' L' + cb.B.slice().reverse().map((p) => C(p.x) + ' ' + C(p.y)).join(' L') + ' Z';
          if (cerr && e.relleno && e.relleno !== 'ninguno') cuerpo += `<path d="${d}" ${relleno(e)} stroke="none"/>`;
          const mr = e.muroRelleno || 'gris';
          const fill = mr === 'negro' ? `fill="${col}"` : mr === 'rayado' ? (usados.add(col), `fill="url(#ry${col.slice(1)})"`) : mr === 'blanco' ? 'fill="#ffffff"' : `fill="${col}" fill-opacity="0.55"`;
          cuerpo += `<path d="${dB}" ${fill} fill-rule="evenodd" stroke="${col}" stroke-width="${sw('fino')}" stroke-linejoin="miter" stroke-miterlimit="6"/>`;
        } else cuerpo += `<path d="${d}" ${cerr ? relleno(e) : 'fill="none"'} stroke="${col}" stroke-width="${sw(e.grosor)}" stroke-linejoin="miter" stroke-miterlimit="6"${trazo(e.estilo, e.grosor)}/>`;
        if (e.flecha && !cerr) {
          const b = e.pts[e.pts.length - 1], a = e.pts[e.pts.length - 2]; const dd = unit(sub(b, a)); const s = h * 0.9;
          const base = sub(b, mul(dd, s)); const w = mul(perp(dd), s * 0.42);
          cuerpo += `<polygon points="${[b, add(base, w), sub(base, w)].map((p) => C(p.x) + ',' + C(p.y)).join(' ')}" fill="${col}"/>`;
        }
        const bnd = cb ? cb.banda : null;
        const banda = (s) => (bnd ? Math.max(0, s > 0 ? bnd[1] : -bnd[0]) : 0);
        const apartar = (a, b, s) => {
          let off = Math.max(margenVentanas(a, b), banda(s));
          // vanos en este tramo: el rótulo va al centro del mayor trozo libre; si no cabe en ninguno, se aparta de la hoja de la puerta
          const L = dist(a, b); const iv = []; let hoja = 0;
          const n = unit(perp(sub(b, a)));
          for (const v of vanos) {
            const pa = proyectar(v.a, a, b), pb = proyectar(v.b, a, b); if (pa.d > 0.02 || pb.d > 0.02) continue;
            iv.push([Math.min(pa.t, pb.t), Math.max(pa.t, pb.t)]);
            if (v.tipo === 'puerta') { const g = puertaGeom(v); if (g && dot(sub(g.hoja, g.hinge), n) * s > 0) hoja = Math.max(hoja, g.w); }
          }
          if (!iv.length) return off;
          iv.sort((x, y) => x[0] - y[0]); const huecos = []; let c = 0;
          for (const [u, w] of iv) { if (u > c) huecos.push([c, u]); c = Math.max(c, w); }
          if (c < 1) huecos.push([c, 1]);
          const necesita = (h * 4.2) / L;
          const mejor = huecos.filter((g) => g[1] - g[0] >= necesita).sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]))[0];
          return mejor ? { off, t: (mejor[0] + mejor[1]) / 2 } : { off: off + hoja, t: 0.5 };
        };
        const et = e.medidas || tieneAlturas(e) ? etiquetasTramos(e, h, apartar) : [];
        const alts = etiquetasAltura(e, et);
        // figura estrecha (panel, vitrina): no cabe la altura por dentro; va junto al largo
        const estrecha = cerr && 2 * area(e.pts) / Math.max(longitudLinea(e), 1e-9) < h * 2.2;
        const junto = new Map(); if (estrecha) alts.forEach(({ t, v }) => junto.set(t.i, v));
        const tramo = (i) => segs.find((x) => x[2] === i);
        const otroLado = (v, tam) => { const s = -(Math.sign(v) || 1); return s * (h * 0.85 + banda(s)); };
        if (e.medidas) for (const t of et) {
          const [a, b] = tramo(t.i); const f = marcoDe(a, b); const L = dist(a, b);
          const txt = t.texto + (junto.has(t.i) ? ' · h ' + fmtM(junto.get(t.i)) : '');
          const c0 = enMarco(f, t);
          pedir(e, 'L' + t.i, [{ texto: txt, tam: h, color: '#333333' }], t.ang, f, variantes(L, anchoTxt(txt, h), c0.u, [...alejar(c0.v), otroLado(c0.v)]));
        }
        // altura: al otro lado del muro respecto de la medida de largo
        for (const { t, v } of alts) {
          if (estrecha && e.medidas) continue;
          const [a, b] = tramo(t.i); const f = marcoDe(a, b); const L = dist(a, b);
          const so = estrecha ? t.lado : -t.lado; const off = h * 0.85 + banda(so);
          const c0 = enMarco(f, add(t.base, mul(t.n, so * off))); const txt = 'h ' + fmtM(v);
          pedir(e, 'H' + t.i, [{ texto: txt, tam: h * 0.9, color: '#4f6b82' }], t.ang, f, variantes(L, anchoTxt(txt, h * 0.9), c0.u, [...alejar(c0.v), otroLado(c0.v)]));
        }
      } else if (e.tipo === 'circulo') {
        cuerpo += `<circle cx="${C(e.c.x)}" cy="${C(e.c.y)}" r="${C(e.r)}" ${relleno(e)} stroke="${col}" stroke-width="${sw(e.grosor)}"${trazo(e.estilo, e.grosor)}/>`;
        obsCajas.push({ x0: e.c.x - e.r, y0: e.c.y - e.r, x1: e.c.x + e.r, y1: e.c.y + e.r });
        if (e.medidas) {
          const txt = 'Ø ' + fmtM(e.r * 2); const w = anchoTxt(txt, h); const dx = e.r + h * 0.4 + w / 2, dy = e.r + h * 0.9;
          pedir(e, 'D', [{ texto: txt, tam: h, color: '#333333' }], 0, marcoFijo(e.c), [{ u: dx, v: 0 }, { u: -dx, v: 0 }, { u: 0, v: -dy }, { u: 0, v: dy }, { u: dx, v: -dy }, { u: dx, v: dy }]);
        }
      } else if (e.tipo === 'puerta') {
        const g = puertaGeom(e); if (!g) continue;
        const an = anfitrion(doc.entidades, e.a, e.b);
        if (an) {
          const x = k * 1.5, c4 = [add(e.a, mul(an.n, an.omin - x)), add(e.b, mul(an.n, an.omin - x)), add(e.b, mul(an.n, an.omax + x)), add(e.a, mul(an.n, an.omax + x))];
          cuerpo += `<polygon points="${c4.map((p) => C(p.x) + ',' + C(p.y)).join(' ')}" fill="#ffffff"/>`;
          for (const p of [e.a, e.b]) { const p1 = add(p, mul(an.n, an.omin)), p2 = add(p, mul(an.n, an.omax)); cuerpo += `<line x1="${C(p1.x)}" y1="${C(p1.y)}" x2="${C(p2.x)}" y2="${C(p2.y)}" stroke="${col}" stroke-width="${sw('fino')}"/>`; }
        } else cuerpo += `<line x1="${C(e.a.x)}" y1="${C(e.a.y)}" x2="${C(e.b.x)}" y2="${C(e.b.y)}" stroke="#ffffff" stroke-width="${C(k * 7)}"/>`;
        cuerpo += `<line x1="${C(g.hinge.x)}" y1="${C(g.hinge.y)}" x2="${C(g.hoja.x)}" y2="${C(g.hoja.y)}" stroke="${col}" stroke-width="${sw('medio')}" stroke-linecap="square"/>`;
        cuerpo += `<path d="M${C(g.hoja.x)} ${C(g.hoja.y)} A${C(g.w)} ${C(g.w)} 0 0 ${g.sweep} ${C(g.otro.x)} ${C(g.otro.y)}" fill="none" stroke="${col}" stroke-width="${sw('fino')}"/>`;
        obsCajas.push(cajaDePuntos([g.hinge, g.hoja, g.otro, add(g.hinge, sub(g.hoja, g.hinge)), add(g.otro, sub(g.hoja, g.hinge))]));
        if (e.medidas) {
          const f = marcoDe(e.a, e.b); const s = dot(sub(g.hoja, g.hinge), f.n) > 0 ? -1 : 1; const txt = fmtM(g.w);
          pedir(e, 'W', [{ texto: txt, tam: h * 0.85, color: '#333333' }], anguloLegible(e.a, e.b), f, variantes(g.w, anchoTxt(txt, h * 0.85), g.w / 2, alejar(s * h * 0.85)));
        }
      } else if (e.tipo === 'ventana') {
        const g = ventanaGeom(e); if (!g) continue;
        const an = anfitrion(doc.entidades, e.a, e.b);
        const nn = an ? an.n : g.n, o0 = an ? an.omin : -g.mitad, o1 = an ? an.omax : g.mitad, om = (o0 + o1) / 2;
        const esq = [add(e.a, mul(nn, o0)), add(e.b, mul(nn, o0)), add(e.b, mul(nn, o1)), add(e.a, mul(nn, o1))];
        const va = add(e.a, mul(nn, om)), vb = add(e.b, mul(nn, om));
        if (!an) cuerpo += `<line x1="${C(e.a.x)}" y1="${C(e.a.y)}" x2="${C(e.b.x)}" y2="${C(e.b.y)}" stroke="#ffffff" stroke-width="${C(k * 7)}"/>`;
        cuerpo += `<polygon points="${esq.map((p) => C(p.x) + ',' + C(p.y)).join(' ')}" fill="#ffffff" stroke="${col}" stroke-width="${sw('fino')}"/>`;
        cuerpo += `<line x1="${C(va.x)}" y1="${C(va.y)}" x2="${C(vb.x)}" y2="${C(vb.y)}" stroke="${col}" stroke-width="${sw('fino')}"/>`;
        obsCajas.push(cajaDePuntos(esq));
        if (e.medidas) {
          const s = ladoArriba(nn); const pos = add(medio(va, vb), mul(nn, s * ((o1 - o0) / 2 + h * 0.85)));
          const f = marcoDe(e.a, e.b); const c0 = enMarco(f, pos); const txt = fmtM(g.w);
          pedir(e, 'W', [{ texto: txt, tam: h * 0.85, color: '#333333' }], anguloLegible(e.a, e.b), f, variantes(g.w, anchoTxt(txt, h * 0.85), c0.u, [...alejar(c0.v), -c0.v]));
        }
      } else if (e.tipo === 'region') {
        if (e.pts.length < 3) continue;
        const dd = 'M' + e.pts.map((p) => C(p.x) + ' ' + C(p.y)).join(' L') + ' Z';
        cuerpo += `<path d="${dd}" fill="${col}" fill-opacity="0.07" stroke="${col}" stroke-width="${sw('medio')}" stroke-linejoin="round"${trazo('discontinua', 'medio')}/>`;
        const c = etqRegion(e);
        const info = [e.conteo !== false ? (() => { const n = obrasEn(doc, e).length; return n + (n === 1 ? ' obra' : ' obras'); })() : null, e.verArea ? fmtM2(area(e.pts)) : null].filter(Boolean).join(' · ');
        const lineas = [{ texto: e.nombre || 'Región', tam: h * 1.5, color: col }]; if (info) lineas.push({ texto: info, tam: h * 0.8, color: col });
        // nombre: donde lo dejaste; si no, busca sitio libre en espiral dentro de la región
        let cands = [{ u: 0, v: 0 }];
        if (!e.etq) {
          const bb = cajaDePuntos(e.pts); const R = Math.min(bb.x1 - bb.x0, bb.y1 - bb.y0) / 2;
          for (const f of [0.18, 0.36, 0.54, 0.72]) for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; const q = { u: Math.cos(a) * R * f * 1.6, v: Math.sin(a) * R * f }; if (puntoEnPoligono(add(c, { x: q.u, y: q.v }), e.pts)) cands.push(q); }
        }
        const gR = giroManual(e, 'R'); const eR = escala(e, 'R');
        pedidos.push({ id: e.id, key: 'R', lineas: escalar(lineas, eR), esc: eR || 1, ang: gR ?? 0, f: marcoFijo(add(c, { x: 0, y: info ? -h * 0.45 : 0 })), cands, fijo: !!e.etq, movible: false, apila: gR !== null ? abajo(gR) : null });
      } else if (e.tipo === 'obra') {
        if (e.pts.length < 3) continue;
        const dd = 'M' + e.pts.map((p) => C(p.x) + ' ' + C(p.y)).join(' L') + ' Z';
        cuerpo += `<path d="${dd}" fill="${col}" fill-opacity="0.18" stroke="${col}" stroke-width="${sw('medio')}" stroke-linejoin="miter"/>`;
        obsCajas.push(cajaDePuntos(e.pts));
        const c = centroide(e.pts); const tit = e.verTitulo && e.titulo ? e.titulo : '';
        const lineas = [{ texto: String(e.num ?? ''), tam: h * 1.15, color: col, peso: '700' }]; if (tit) lineas.push({ texto: tit, tam: h * 0.75, color: '#333333' });
        const gN = giroManual(e, 'N'); const eN = escala(e, 'N');
        pedidos.push({ id: e.id, key: 'N', lineas: escalar(lineas, eN), esc: eN || 1, ang: gN ?? 0, f: marcoFijo(gN !== null ? c : add(c, { x: 0, y: tit ? -h * 0.4 : 0 })), cands: [{ u: 0, v: 0 }], fijo: true, movible: false, apila: gN !== null ? abajo(gN) : null });
      } else if (e.tipo === 'cuadro') {
        const g = cuadroGeom(e, doc.entidades, k); if (!(g.w > 0)) continue;
        cuerpo += `<polygon points="${g.esquinas.map((p) => C(p.x) + ',' + C(p.y)).join(' ')}" fill="${col}" fill-opacity="0.9" stroke="${col}" stroke-width="${sw('fino')}"/>`;
        // para los rótulos, la geometría real (sin el grosor mínimo de pantalla): misma colocación a cualquier zoom y al exportar
        const gr = cuadroGeom(e, doc.entidades, 0); obsCajas.push(cajaDePuntos(gr.esquinas));
        const tit = e.verTitulo && e.titulo ? ' · ' + e.titulo : '';
        const ang = Math.abs(anguloLegible(e.a, e.b)) > 45 ? anguloLegible(e.a, e.b) : 0;
        const lineas = [{ texto: String(e.num ?? '') + tit, tam: h * 0.95, color: col, peso: '700' }]; if (e.medidas) lineas.push({ texto: fmtM(g.w), tam: h * 0.75, color: '#333333' });
        const f = marcoDe(e.a, e.b); const c0 = enMarco(f, add(gr.frente, mul(gr.n, h * 0.85)));
        const w = anchoTxt(lineas[0].texto, h * 0.95); const vs = alejar(c0.v);
        const paso = Math.max(w, h * 1.6);
        const cands = vs.flatMap((v) => [0, -0.6, 0.6, -1, 1, -2, 2, -3, 3].map((m) => ({ u: c0.u + m * paso, v })));
        pedir(e, 'N', lineas, ang, f, cands, { apila: g.n });
      } else if (e.tipo === 'proyeccion') {
        const g = proyGeom(e, doc.entidades, k); if (!(g.w > 0)) continue;
        const pts = (P) => P.map((p) => C(p.x) + ',' + C(p.y)).join(' ');
        if (e.verHaz !== false) {
          cuerpo += `<polygon points="${pts([e.p, g.frenteA, g.frenteB])}" fill="${col}" fill-opacity="0.08" stroke="none"/>`;
          for (const f of [g.frenteA, g.frenteB]) cuerpo += `<line x1="${C(e.p.x)}" y1="${C(e.p.y)}" x2="${C(f.x)}" y2="${C(f.y)}" stroke="${col}" stroke-width="${sw('fino')}"${trazo('discontinua', 'fino')}/>`;
        }
        cuerpo += `<polygon points="${pts(g.pant.esquinas)}" fill="${col}" fill-opacity="0.85" stroke="${col}" stroke-width="${sw('fino')}"/>`;
        cuerpo += `<polygon points="${pts(g.cuerpo)}" fill="#ffffff" stroke="${col}" stroke-width="${sw('medio')}"/>`;
        const lente = [add(e.p, mul(perp(g.eje), Math.min(0.08, (e.anchoCuerpo > 0 ? e.anchoCuerpo : 0.3) / 3))), sub(e.p, mul(perp(g.eje), Math.min(0.08, (e.anchoCuerpo > 0 ? e.anchoCuerpo : 0.3) / 3))), sub(e.p, mul(g.eje, 0.07))];
        cuerpo += `<polygon points="${pts(lente)}" fill="${col}"/>`;
        // para los rótulos, la geometría real (independiente del zoom)
        const gr = proyGeom(e, doc.entidades, 0);
        obsCajas.push(cajaDePuntos(gr.cuerpo)); obsCajas.push(cajaDePuntos(gr.pant.esquinas));
        if (e.verHaz !== false) { obsSegs.push([e.p, gr.frenteA]); obsSegs.push([e.p, gr.frenteB]); }
        const lineas = [{ texto: e.nombre || 'P', tam: h * 0.95, color: col, peso: '700' }];
        if (e.verDatos !== false) { lineas.push({ texto: fmtNum(gr.w) + ' × ' + fmtNum(gr.alto) + ' m', tam: h * 0.75, color: '#333333' }); lineas.push({ texto: 'tiro ' + fmtNum(gr.tiro) + ' · ' + fmtM(gr.dist), tam: h * 0.75, color: '#333333' }); }
        const f = marcoDe(gr.atras, e.p); const off = h * 0.9; const wl = Math.max(...lineas.map((l) => anchoTxt(l.texto, l.tam)));
        const Lc = e.largo > 0 ? e.largo : 0.4, Wc = e.anchoCuerpo > 0 ? e.anchoCuerpo : 0.3;
        const tras = -(off + lineas.length * h * 0.5), lado = Wc / 2 + off + wl / 2;
        pedir(e, 'P', lineas, 0, f, [{ u: tras, v: 0 }, { u: Lc / 2, v: lado }, { u: Lc / 2, v: -lado }, { u: tras * 1.8, v: 0 }, { u: tras, v: wl * 0.7 }, { u: tras, v: -wl * 0.7 }, { u: Lc / 2, v: lado * 1.6 }, { u: Lc / 2, v: -lado * 1.6 }]);
      } else if (esMueble(e)) {
        // mobiliario: huella rellena con el color del objeto, muy tenue, y su nombre dentro si cabe
        const pts = mueblePts(e); const col2 = e.color && e.color !== '#ffffff' ? e.color : '#8a8a8a';
        cuerpo += `<path d="M${pts.map((p) => C(p.x) + ' ' + C(p.y)).join(' L')} Z" fill="${col2}" fill-opacity="0.16" stroke="${col2}" stroke-width="${sw('medio')}" stroke-linejoin="miter"/>`;
        if (e.forma !== 'cilindro') { const d0 = pts[0], d2 = pts[2]; cuerpo += `<line x1="${C(d0.x)}" y1="${C(d0.y)}" x2="${C(d2.x)}" y2="${C(d2.y)}" stroke="${col2}" stroke-width="${sw('fino')}" stroke-opacity="0.5"/>`; }
        obsCajas.push(cajaDePuntos(pts));
        const tam = Math.min(h * 0.75, Math.max(e.l, e.a) * 0.22);
        if (tam >= h * 0.35) { const ang = e.forma === 'cilindro' ? 0 : (((e.rot || 0) % 180) + 180) % 180 > 90 ? ((e.rot || 0) % 180) - 180 : (e.rot || 0) % 180;
          pedidos.push({ id: e.id, key: 'M', lineas: [{ texto: e.nombre || 'mueble', tam, color: '#333333' }], esc: 1, ang: e.l >= e.a ? ang : ang + 90, f: marcoFijo({ x: e.x, y: e.y }), cands: [{ u: 0, v: 0 }], fijo: true, movible: false }); }
      } else if (e.tipo === 'texto') {
        cuerpo += svgTexto(e.x, e.y, e.texto || ' ', e.tam, col, e.rot || 0, halo);
        const c = textoCaja(e); obsCajas.push(cajaRotada(e, c.w, c.h, e.rot || 0));
      } else if (e.tipo === 'cota') {
        const g = cotaGeom(e); if (!(g.total > 0)) continue;
        const ln = (p, q, c, w) => `<line x1="${C(p.x)}" y1="${C(p.y)}" x2="${C(q.x)}" y2="${C(q.y)}" stroke="${c}" stroke-width="${w}"/>`;
        const t = mul(unit(add(g.d, g.n)), h * 0.32);
        const tic = (p) => ln(sub(p, t), add(p, t), col, sw('medio'));
        const offT = (e.desp || 0) + g.lado * h * 2.2; const conTotal = e.total && g.pts.length > 2;
        // líneas de referencia: del punto medido a la línea de cota (y a la del total en los extremos)
        g.pts.forEach((p, i) => {
          const extremo = conTotal && (Math.abs(g.ts[i] - g.tmin) < 1e-9 || Math.abs(g.ts[i] - g.tmax) < 1e-9);
          const hasta = g.sobre(g.ts[i], (extremo ? offT : (e.desp || 0)) + g.lado * h * 0.3);
          if (dist(p, hasta) > h * 0.31) cuerpo += ln(p, hasta, '#8a8a8a', sw('fino'));
        });
        cuerpo += ln(g.qmin, g.qmax, col, sw('fino')); obsSegs.push([g.qmin, g.qmax]);
        g.qs.forEach((q) => { cuerpo += tic(q); });
        const f = { o: g.pts[0], d: g.d, n: g.n };
        g.tramos.forEach((tr, i) => {
          if (!(tr.L > 1e-6)) return;
          pedir(e, 'T' + i, [{ texto: (i === 0 && e.texto ? e.texto + ' ' : '') + fmtM(tr.L), tam: h, color: col }], g.ang, f, [{ u: (g.ts[i] + g.ts[i + 1]) / 2, v: (e.desp || 0) + g.lado * h * 0.7 }], { fijo: true });
        });
        if (conTotal) {
          const a = g.sobre(g.tmin, offT), b = g.sobre(g.tmax, offT);
          cuerpo += ln(a, b, col, sw('fino')) + tic(a) + tic(b); obsSegs.push([a, b]);
          pedir(e, 'TOT', [{ texto: fmtM(g.total), tam: h, color: col }], g.ang, f, [{ u: (g.tmin + g.tmax) / 2, v: offT + g.lado * h * 0.7 }], { fijo: true });
        }
      }
    }
    // colocación: primero los fijos (y los movidos a mano), luego los automáticos en la primera posición libre
    const colocados = []; let rot = '';
    // cada línea de un rótulo cuenta con su propia caja: «6 obras» no ocupa el ancho del nombre de la región
    const choques = (cajas) => {
      let n = 0;
      for (const caja of cajas) {
        for (const c of colocados) for (const cc of c.cajas) if (cajasChocan(caja, cc, h * 0.02)) n++;
        for (const c of obsCajas) if (c && cajasChocan(caja, c, h * 0.02)) n++;
        for (const [a, b] of obsSegs) if (segCruzaCaja(a, b, caja)) n++;
      }
      return n;
    };
    // fijos primero; luego los automáticos más restringidos; los nombres de región, que pueden moverse más, al final
    const ordenados = [...pedidos.filter((p) => p.fijo), ...pedidos.filter((p) => !p.fijo && p.key !== 'R'), ...pedidos.filter((p) => !p.fijo && p.key === 'R')];
    for (const p of ordenados) {
      let mejor = null;
      for (const c of p.cands) {
        const pos = deMarco(p.f, c); const dsp = disponer(p, pos);
        const n = p.fijo ? 0 : choques(dsp.cajas);
        if (!mejor || n < mejor.n) mejor = { c, pos, dsp, n };
        if (n === 0) break;
      }
      if (!mejor) continue;
      colocados.push({ id: p.id, key: p.key, caja: mejor.dsp.caja, cajas: mejor.dsp.cajas, f: p.f, u: mejor.c.u, v: mejor.c.v, x: mejor.pos.x, y: mejor.pos.y, ang: p.ang, esc: p.esc || 1, texto: p.lineas[0].texto, movible: p.movible, manual: p.manual });
      p.lineas.forEach((l, i) => { const c = mejor.dsp.centros[i]; rot += svgTexto(c.x, c.y, l.texto, l.tam, l.color, p.ang, halo, 'middle', l.peso || ''); });
    }
    let defs = '';
    for (const c of usados) {
      const s = C(Math.max(0.04, h * 0.45));
      defs += `<pattern id="ry${c.slice(1)}" patternUnits="userSpaceOnUse" width="${s}" height="${s}" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${s}" stroke="${c}" stroke-width="${C(k * 1.2)}"/></pattern>`;
    }
    return { defs, cuerpo: cuerpo + rot, rotulos: colocados };
  };
  const svgCalco = (c, opacidad) => {
    if (!c) return '';
    const cc = calcoCentro(c);
    const tr = c.rot ? ` transform="rotate(${+(+c.rot).toFixed(3)} ${C(cc.x)} ${C(cc.y)})"` : '';
    return `<image href="${c.src}" xlink:href="${c.src}" x="${C(c.x)}" y="${C(c.y)}" width="${C(c.w * c.mpp)}" height="${C(c.h * c.mpp)}" preserveAspectRatio="none" opacity="${opacidad ?? c.opacidad}"${tr}/>`;
  };
  // SVG autónomo. o: {escala: 50 | null, pxAncho, titulo, barra, calco}
  const construirSVG = (doc, o = {}) => {
    const h = doc.rotulo || 0.2;
    let bb = caja(doc.entidades, h);
    const conCalco = !!(o.calco && doc.calco);
    if (conCalco) bb = unirCajas(bb, cajaPuntos(esquinasCalco(doc.calco)));
    if (!bb) return null;
    // los rótulos pueden haberse apartado fuera de la caja de las piezas
    for (const r of svgDibujo(doc, { k: 0.18 / 1000 * (o.escala || 50) }).rotulos) bb = unirCajas(bb, { x: r.caja.x0, y: r.caja.y0, w: r.caja.x1 - r.caja.x0, h: r.caja.y1 - r.caja.y0 });
    const margen = Math.max(h * 3, 0.3);
    const arriba = o.titulo && doc.nombre ? h * 3.2 : 0;
    const abajo = o.barra ? h * 4 : 0;
    const vx = bb.x - margen, vy = bb.y - margen - arriba;
    const W = bb.w + margen * 2, H = bb.h + margen * 2 + arriba + abajo;
    let k, ancho, alto;
    if (o.escala) {
      k = 0.18 / 1000 * o.escala;
      ancho = +(W * 1000 / o.escala).toFixed(2) + 'mm'; alto = +(H * 1000 / o.escala).toFixed(2) + 'mm';
    } else {
      const px = o.pxAncho || 3000; const ppm = px / W;
      k = (px / 1600) / ppm; ancho = Math.round(px); alto = Math.round(H * ppm);
    }
    const dib = svgDibujo(doc, { k });
    let s = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${ancho}" height="${alto}" viewBox="${C(vx)} ${C(vy)} ${C(W)} ${C(H)}">`;
    s += `<rect x="${C(vx)}" y="${C(vy)}" width="${C(W)}" height="${C(H)}" fill="#ffffff"/>`;
    if (dib.defs) s += `<defs>${dib.defs}</defs>`;
    if (conCalco) s += svgCalco(doc.calco);
    s += dib.cuerpo;
    if (arriba) s += svgTexto(bb.x, bb.y - arriba * 0.55, doc.nombre, h * 1.5, '#111111', 0, 0, 'start');
    if (abajo) {
      const L = longitudBonita(Math.max(0.1, bb.w / 3)) || 1;
      const y = bb.y + bb.h + margen * 0.5 + h * 1.6, x = bb.x, alt = h * 0.45, n = L >= 1 && Number.isInteger(L) && L <= 5 ? L : 4;
      for (let i = 0; i < n; i++) s += `<rect x="${C(x + L / n * i)}" y="${C(y)}" width="${C(L / n)}" height="${C(alt)}" fill="${i % 2 ? '#ffffff' : '#111111'}" stroke="#111111" stroke-width="${C(k)}"/>`;
      s += svgTexto(x, y + alt + h * 0.8, '0', h * 0.85, '#111111', 0, 0, 'start');
      s += svgTexto(x + L, y + alt + h * 0.8, L >= 1 ? fmtNum(L, L % 1 ? 1 : 0) + ' m' : fmtNum(L * 100, 0) + ' cm', h * 0.85, '#111111', 0, 0, 'middle');
      if (o.escala) s += svgTexto(x + L + h * 2.5, y + alt / 2, 'escala 1:' + o.escala, h * 0.85, '#111111', 0, 0, 'start');
    }
    return { svg: s + '</svg>', W, H, ancho, alto };
  };

  let _n = 0;
  const nuevoId = () => 'e' + Date.now().toString(36) + (_n++).toString(36) + Math.floor(Math.random() * 1e6).toString(36);

  return { U, GROSOR, TRAZO, COLORES, ESCALAS, clamp, r6, dist, sub, add, mul, dot, unit, perp, medio, rotar, parseNum, fmtNum, fmtM, fmtM2, esc,
    snapGrid, snapAngulo, proyectar, segmentos, imanar, areaFirmada, area, longitudLinea, puntoEnPoligono, anguloLegible, etiquetasTramos,
    esRectangulo, puertaGeom, ventanaGeom, siguienteGiro, FORMATOS, proyGeom, proyConDistancia, proyConAncho, esPoligono, esMueble, mueblePts, centroide, etqRegion, enEtqRegion, lineaBajo, cuadroGeom, ladoCuadro, esObra, puntoObra, obrasEn, regionDe, numSiguiente, ordenNatural, csvObras, alturaTramo, tieneAlturas, etiquetasAltura, cotaGeom, cotaPts, estirarCota, contornoDe, ladoFuera, bandaMuro, desplazarPolilinea, contornoBanda, anfitrion, textoCaja, distanciaA, tocar, mover, asas, fijarAsa, insertarVertice, borrarVertice, estirarTramo, rectPts,
    calcoCentro, localAMundo, mundoALocal, calibrarCalco, esquinasCalco, caja, unirCajas, cajaPuntos, longitudBonita, papelPara,
    C, svgDibujo, svgCalco, marcoDe, enMarco, deMarco, cajasChocan, segCruzaCaja, construirSVG, nuevoId };
})();
export default G;

