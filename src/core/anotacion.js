// Geometría y utilidades de la vista Lectura (de anotador-planos). Sin DOM. Coordenadas en px de la imagen base.
// ─── geometria.js ─── funciones puras, sin DOM. Coordenadas siempre en px de la imagen original.
export const A = (() => {
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

  // Calibración: px por metro a partir de un segmento de longitud real conocida
  const pxPorMetro = (p1, p2, metros) => {
    const d = dist(p1, p2);
    if (!(metros > 0) || !(d > 0)) return null;
    return d / metros;
  };
  const aMetros = (px, ppm) => (ppm > 0 ? px / ppm : null);

  // Área por fórmula del cordón (shoelace)
  const areaPoligonoPx = (pts) => {
    if (!pts || pts.length < 3) return 0;
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      s += a.x * b.y - b.x * a.y;
    }
    return Math.abs(s) / 2;
  };
  const areaM2 = (pts, ppm) => (ppm > 0 ? areaPoligonoPx(pts) / (ppm * ppm) : null);
  const perimetroPx = (pts) => {
    if (!pts || pts.length < 2) return 0;
    let s = 0;
    for (let i = 0; i < pts.length; i++) s += dist(pts[i], pts[(i + 1) % pts.length]);
    return s;
  };

  const centroide = (pts) => {
    if (!pts || !pts.length) return { x: 0, y: 0 };
    let x = 0, y = 0;
    for (const p of pts) { x += p.x; y += p.y; }
    return { x: x / pts.length, y: y / pts.length };
  };
  const puntoMedio = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const anguloGrados = (a, b) => {
    let g = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    if (g > 90) g -= 180; else if (g < -90) g += 180; // texto siempre legible
    return g;
  };
  // Vector unitario perpendicular (para los tics de una cota)
  const normal = (a, b) => {
    const d = dist(a, b);
    if (!(d > 0)) return { x: 0, y: -1 };
    return { x: -(b.y - a.y) / d, y: (b.x - a.x) / d };
  };

  // Formato en español
  const fmtNum = (n, dec = 2) => n.toFixed(dec).replace('.', ',');
  const fmtM = (m) => (m == null ? '—' : fmtNum(m) + ' m');
  const fmtM2 = (m2) => (m2 == null ? '—' : fmtNum(m2) + ' m²');

  // Vista: {vx, vy, zoom}. viewBox con preserveAspectRatio="none" y relación igual al contenedor.
  const clientToImage = (cx, cy, rect, view) => ({
    x: view.vx + (cx - rect.left) / view.zoom,
    y: view.vy + (cy - rect.top) / view.zoom,
  });
  const imageToClient = (p, rect, view) => ({
    x: rect.left + (p.x - view.vx) * view.zoom,
    y: rect.top + (p.y - view.vy) * view.zoom,
  });
  const viewBoxStr = (view, cw, ch) => `${view.vx} ${view.vy} ${cw / view.zoom} ${ch / view.zoom}`;
  const zoomEn = (view, cx, cy, rect, factor, min = 0.02, max = 40) => {
    const p = clientToImage(cx, cy, rect, view);
    const z = clamp(view.zoom * factor, min, max);
    return { zoom: z, vx: p.x - (cx - rect.left) / z, vy: p.y - (cy - rect.top) / z };
  };
  const ajustar = (imgW, imgH, cw, ch, margen = 0.04) => {
    if (!(imgW > 0 && imgH > 0 && cw > 0 && ch > 0)) return { vx: 0, vy: 0, zoom: 1 };
    const z = Math.min(cw / imgW, ch / imgH) * (1 - margen);
    return { zoom: z, vx: (imgW - cw / z) / 2, vy: (imgH - ch / z) / 2 };
  };
  const centrarEn = (p, cw, ch, zoom) => ({ zoom, vx: p.x - cw / zoom / 2, vy: p.y - ch / zoom / 2 });

  // Barra de escala: el mayor valor "redondo" que cabe en maxPx de pantalla
  const barraEscala = (ppm, zoom, maxPx = 180) => {
    if (!(ppm > 0) || !(zoom > 0)) return null;
    const maxM = maxPx / (ppm * zoom);
    const bonitos = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
    let m = null;
    for (const n of bonitos) if (n <= maxM) m = n;
    if (m == null) return null;
    return { metros: m, px: m * ppm * zoom };
  };

  // Reducción de dimensiones manteniendo proporción
  const encajar = (w, h, maxLado) => {
    if (!(w > 0 && h > 0)) return { w: 0, h: 0, escala: 1 };
    const k = Math.min(1, maxLado / Math.max(w, h));
    return { w: Math.round(w * k), h: Math.round(h * k), escala: k };
  };

  const bbox = (pts) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };

  // Puntos de un ítem (para mover/centrar), por tipo
  const puntosDe = (it) => {
    if (it.puntos) return it.puntos;
    if (it.tipo === 'zona' || it.tipo === 'imagen') return [{ x: it.x, y: it.y }, { x: it.x + it.w, y: it.y + it.h }];
    return [{ x: it.x, y: it.y }];
  };
  const mover = (it, dx, dy) => {
    if (it.puntos) it.puntos = it.puntos.map(p => ({ x: p.x + dx, y: p.y + dy }));
    else { it.x += dx; it.y += dy; }
    return it;
  };

  let _seq = 0;
  const nuevoId = (pref = 'i') => pref + '_' + Date.now().toString(36) + '_' + (_seq++).toString(36) + '_' + Math.floor(Math.random() * 1e9).toString(36);

  // CSV de medidas: punto y coma como separador (Excel en español)
  const csvEscapar = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
  const csvMedidas = (proyecto) => {
    const filas = [['plano', 'capa', 'tipo', 'etiqueta', 'valor', 'unidad']];
    for (const pl of proyecto.planos) {
      const ppm = pl.escala ? pl.escala.pxPorMetro : null;
      const capas = Object.fromEntries((pl.capas || []).map(c => [c.id, c.nombre]));
      for (const it of pl.items) {
        if (it.tipo === 'dimension') {
          const m = aMetros(dist(it.puntos[0], it.puntos[1]), ppm);
          filas.push([pl.nombre, capas[it.capa] || '', 'longitud', it.label || '', m == null ? '' : fmtNum(m, 3), 'm']);
        } else if (it.tipo === 'poligono' || it.tipo === 'zona') {
          const pts = puntosRect(it);
          const a = areaM2(pts, ppm);
          filas.push([pl.nombre, capas[it.capa] || '', 'area', it.label || '', a == null ? '' : fmtNum(a, 3), 'm2']);
        }
      }
    }
    return filas.map(f => f.map(csvEscapar).join(';')).join('\n');
  };
  const puntosRect = (it) => it.puntos ? it.puntos
    : [{ x: it.x, y: it.y }, { x: it.x + it.w, y: it.y }, { x: it.x + it.w, y: it.y + it.h }, { x: it.x, y: it.y + it.h }];

  return { clamp, dist, pxPorMetro, aMetros, areaPoligonoPx, areaM2, perimetroPx, centroide, puntoMedio, anguloGrados, normal,
    fmtNum, fmtM, fmtM2, clientToImage, imageToClient, viewBoxStr, zoomEn, ajustar, centrarEn, barraEscala, encajar, bbox,
    puntosDe, mover, nuevoId, csvMedidas, puntosRect, csvEscapar };
})();
export default A;
