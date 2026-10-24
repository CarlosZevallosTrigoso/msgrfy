// Modo 3D de la vista Planta: la sala en axonometría con giro libre, al estilo de Los Sims.
// Dibuja en canvas (fluido al girar) y exporta PNG y SVG con la misma escena.
import * as I from '../core/isometrica.js';
import { MD } from '../core/muro.js';
import { fmtNum } from '../core/unidades.js';

const MARKUP = `
<div class="iso-barra">
  <span class="iso-tit">3D</span>
  <label class="iso-l">giro <input type="range" id="isoGiro" min="0" max="359" step="1"> <b data-v="giro"></b></label>
  <label class="iso-l">inclinación <input type="range" id="isoInc" min="15" max="90" step="1"> <b data-v="inc"></b></label>
  <div class="seg iso-giros"><button data-g="-90" title="Un cuarto de vuelta a la izquierda">⟲</button><button data-g="90" title="Un cuarto de vuelta a la derecha">⟳</button></div>
  <label class="iso-l">muros de frente <select id="isoMuros"><option value="cortados">cortados</option><option value="transparentes">transparentes</option><option value="completos">completos</option></select></label>
  <label class="iso-l">zócalo <input type="text" inputmode="decimal" id="isoZocalo" style="width:52px"> m</label>
  <label class="iso-l">alto por defecto <input type="text" inputmode="decimal" id="isoAlto" style="width:52px"> m</label>
  <label class="check iso-l"><input type="checkbox" id="isoRejilla"> rejilla</label>
  <label class="check iso-l"><input type="checkbox" id="isoFondo"> terreno</label>
  <span class="iso-sep"></span>
  <label class="iso-l" title="Puntos de vista guardados de esta sala">vista <select id="isoVistas"><option value="">—</option></select></label>
  <button id="isoVistaGuardar" title="Guardar la cámara y el encuadre actuales como punto de vista con nombre">＋ vista</button>
  <button id="isoVistaQuitar" title="Quitar el punto de vista elegido" disabled>×</button>
  <button id="isoAjustar" title="Encajar en la ventana">⤢</button>
  <button id="isoPng" title="Descargar PNG">PNG</button>
  <button id="isoSvg" title="Descargar SVG">SVG</button>
  <button id="isoCerrar" title="Volver a la planta (Esc)">cerrar</button>
</div>
<canvas id="isoCv"></canvas>
<div class="iso-pie">Arrastra para girar e inclinar · Shift + arrastrar desplaza · rueda acerca · «＋ vista» guarda este punto de vista con nombre; PgUp/PgDn recorre los guardados</div>
`;

// ctx: { root, proyecto, sala(), mensaje, onCambio, descargar(blob, nombre), nombreArchivo() }
export function montarIso(ctx) {
  const root = ctx.root; root.innerHTML = MARKUP;
  const $ = (s) => root.querySelector(s);
  const cv = $('#isoCv'), g2 = cv.getContext('2d');
  let cam = I.camDefecto(), view = { s: 60, ox: 0, oy: 0 }, piezas = [], visible = false, raf = 0, encajado = false, sFit = 60, vistaId = '';
  const imgCache = new Map();
  const getImage = (id) => {
    let e = imgCache.get(id);
    if (!e) { const src = ctx.proyecto.imagenes[id]; if (!src) return null; const img = new Image(); e = { img, ok: false }; img.onload = () => { e.ok = true; pedir(); }; img.src = src; imgCache.set(id, e); }
    return e.ok ? e.img : null;
  };
  const sala = () => ctx.sala();
  const leerCam = () => { const s = sala(); cam = I.soloCam(s && s.iso); };
  // sala.iso guarda la cámara actual y, aparte, las vistas con nombre: no se pisan entre sí
  const guardarCam = () => { const s = sala(); if (s) { s.iso = { ...(s.iso || {}), ...I.soloCam(cam) }; if (ctx.onCambio) ctx.onCambio(); } };
  const vistas = () => { const s = sala(); return s && s.iso && Array.isArray(s.iso.vistas) ? s.iso.vistas : []; };
  const renderVistas = () => {
    const sel = $('#isoVistas'); const vs = vistas();
    sel.innerHTML = '<option value="">' + (vs.length ? '— elegir —' : '— ninguna —') + '</option>' + vs.map((v) => `<option value="${v.id}" ${v.id === vistaId ? 'selected' : ''}>${String(v.nombre).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))}</option>`).join('');
    sel.disabled = !vs.length; $('#isoVistaQuitar').disabled = !vistaId;
  };
  const irAVista = (id) => {
    const v = vistas().find((x) => x.id === id); if (!v) { vistaId = ''; renderVistas(); return; }
    vistaId = v.id; cam = I.soloCam(v.cam); reconstruir(); sync(); encajar();
    if (v.enc) { const { w, h } = tam(); view = I.viewDeEncuadre(v.enc, w, h, sFit); }
    renderVistas(); pedir(); guardarCam(); ctx.mensaje('Vista «' + v.nombre + '»');
  };
  const vistaSiguiente = (paso) => { const vs = vistas(); if (!vs.length) return; const i = vs.findIndex((v) => v.id === vistaId); irAVista(vs[((i < 0 ? (paso > 0 ? -1 : 0) : i) + paso + vs.length) % vs.length].id); };
  const guardarVista = () => {
    const s = sala(); if (!s) return;
    const n = prompt('Nombre del punto de vista', 'Vista ' + (vistas().length + 1)); if (n == null) return;
    const { w, h } = tam(); const v = I.nuevaVista(n, cam, I.encuadreDe(view, w, h, sFit));
    s.iso = { ...(s.iso || {}), ...I.soloCam(cam), vistas: [...vistas(), v] }; vistaId = v.id; renderVistas();
    if (ctx.onCambio) ctx.onCambio(); ctx.mensaje('Vista «' + v.nombre + '» guardada: aparece en el selector y en Lectura («+ 3D»)');
  };
  const quitarVista = () => {
    const s = sala(); const v = vistas().find((x) => x.id === vistaId); if (!s || !v) return;
    if (!confirm('¿Quitar la vista «' + v.nombre + '»?')) return;
    s.iso = { ...s.iso, vistas: vistas().filter((x) => x.id !== v.id) }; vistaId = ''; renderVistas(); if (ctx.onCambio) ctx.onCambio();
  };
  const sync = () => {
    $('#isoGiro').value = ((cam.giro % 360) + 360) % 360; $('#isoInc').value = cam.inclinacion;
    $('[data-v="giro"]').textContent = fmtNum(((cam.giro % 360) + 360) % 360, 0) + '°'; $('[data-v="inc"]').textContent = fmtNum(cam.inclinacion, 0) + '°';
    $('#isoMuros').value = cam.muros; $('#isoZocalo').value = fmtNum(cam.zocalo); $('#isoAlto').value = fmtNum(cam.altoDefecto); $('#isoRejilla').checked = !!cam.rejilla; $('#isoFondo').checked = cam.fondo !== false;
  };
  const tam = () => ({ w: Math.max(1, root.clientWidth), h: Math.max(1, root.clientHeight - ($('.iso-barra').offsetHeight || 36) - ($('.iso-pie').offsetHeight || 22)) });
  const reconstruir = () => { const s = sala(); piezas = s ? I.escena(ctx.proyecto, s, cam) : []; };
  const encajar = () => {
    const { w, h } = tam(); const b = I.limites(piezas); const m = 30;
    const sc = Math.max(1, Math.min((w - 2 * m) / Math.max(b.w, 0.1), (h - 2 * m) / Math.max(b.h, 0.1)));
    view = { s: sc, ox: (w - b.w * sc) / 2 - b.x * sc, oy: (h - b.h * sc) / 2 - b.y * sc }; encajado = true; sFit = sc;
  };
  const dibujar = () => {
    raf = 0; if (!visible) return;
    const dpr = window.devicePixelRatio || 1; const { w, h } = tam();
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
    if (!g2) return;
    g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.fillStyle = '#ffffff'; g2.fillRect(0, 0, w, h);
    I.pintar(MD.canvasPainter(g2, getImage), piezas, view);
  };
  const pedir = () => { if (!raf) raf = requestAnimationFrame(dibujar); };
  const actualizar = (persistir = true) => { reconstruir(); sync(); pedir(); if (persistir) guardarCam(); if (vistaId) { vistaId = ''; renderVistas(); } };

  // controles
  $('#isoGiro').addEventListener('input', (e) => { cam.giro = +e.target.value; actualizar(false); });
  $('#isoInc').addEventListener('input', (e) => { cam.inclinacion = +e.target.value; actualizar(false); });
  for (const el of [$('#isoGiro'), $('#isoInc')]) el.addEventListener('change', () => guardarCam());
  root.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => { cam.giro = ((cam.giro + +b.dataset.g) % 360 + 360) % 360; actualizar(); }));
  $('#isoMuros').addEventListener('change', (e) => { cam.muros = e.target.value; actualizar(); });
  $('#isoZocalo').addEventListener('change', (e) => { const v = parseFloat(String(e.target.value).replace(',', '.')); if (v >= 0) cam.zocalo = v; actualizar(); });
  $('#isoAlto').addEventListener('change', (e) => { const v = parseFloat(String(e.target.value).replace(',', '.')); if (v > 0) cam.altoDefecto = v; actualizar(); });
  $('#isoRejilla').addEventListener('change', (e) => { cam.rejilla = e.target.checked; actualizar(); });
  $('#isoFondo').addEventListener('change', (e) => { cam.fondo = e.target.checked; actualizar(); encajar(); pedir(); });
  $('#isoAjustar').addEventListener('click', () => { encajar(); pedir(); });
  $('#isoVistas').addEventListener('change', (e) => { if (e.target.value) irAVista(e.target.value); else { vistaId = ''; renderVistas(); } });
  $('#isoVistaGuardar').addEventListener('click', guardarVista);
  $('#isoVistaQuitar').addEventListener('click', quitarVista);
  $('#isoCerrar').addEventListener('click', () => ctx.onCerrar && ctx.onCerrar());
  const sufijoVista = () => { const v = vistas().find((x) => x.id === vistaId); return v ? '-' + v.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() : ''; };
  $('#isoSvg').addEventListener('click', () => {
    const s = sala(); if (!s) return;
    const r = I.svgDeIso(ctx.proyecto, s, cam, 120);
    ctx.descargar(new Blob([r.svg], { type: 'image/svg+xml' }), ctx.nombreArchivo() + '-3d' + sufijoVista() + '.svg'); ctx.mensaje('SVG exportado');
  });
  $('#isoPng').addEventListener('click', () => {
    const s = sala(); if (!s) return;
    const b = I.limites(piezas); const pxm = Math.min(200, Math.sqrt(12e6 / Math.max(1, (b.w + 1) * (b.h + 1))));
    const W = Math.round((b.w + 1) * pxm), H = Math.round((b.h + 1) * pxm);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    if (!g) return ctx.mensaje('No se pudo crear el lienzo', true);
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    I.pintar(MD.canvasPainter(g, getImage), piezas, { s: pxm, ox: (0.5 - b.x) * pxm, oy: (0.5 - b.y) * pxm });
    c.toBlob((bl) => { if (bl) { ctx.descargar(bl, ctx.nombreArchivo() + '-3d' + sufijoVista() + '.png'); ctx.mensaje('PNG exportado: ' + W + ' × ' + H + ' px'); } else ctx.mensaje('No se pudo generar el PNG', true); }, 'image/png');
  });

  // puntero: arrastrar gira e inclina; Shift desplaza; rueda acerca
  let arr = null;
  cv.addEventListener('pointerdown', (e) => { e.stopPropagation(); cv.setPointerCapture(e.pointerId); arr = { x: e.clientX, y: e.clientY, giro: cam.giro, inc: cam.inclinacion, ox: view.ox, oy: view.oy, pan: e.shiftKey || e.button === 1 }; });
  cv.addEventListener('pointermove', (e) => {
    e.stopPropagation(); if (!arr) return;
    const dx = e.clientX - arr.x, dy = e.clientY - arr.y;
    if (arr.pan) { view.ox = arr.ox + dx; view.oy = arr.oy + dy; pedir(); return; }
    cam.giro = ((arr.giro + dx * 0.5) % 360 + 360) % 360; cam.inclinacion = Math.max(15, Math.min(90, arr.inc + dy * 0.3));
    actualizar(false);
  });
  const fin = (e) => { e.stopPropagation(); if (arr && !arr.pan) guardarCam(); arr = null; };
  cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); const r = cv.getBoundingClientRect(); const px = e.clientX - r.left, py = e.clientY - r.top; const f = e.deltaY < 0 ? 1.15 : 1 / 1.15; view = { s: view.s * f, ox: px - (px - view.ox) * f, oy: py - (py - view.oy) * f }; pedir(); }, { passive: false });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (visible) pedir(); }) : null; if (ro) ro.observe(root);

  return {
    mostrar() { visible = true; root.hidden = false; leerCam(); imgCache.clear(); reconstruir(); sync(); if (!encajado) encajar(); vistaId = ''; renderVistas(); pedir(); },
    vistaSiguiente,
    ocultar() { visible = false; root.hidden = true; },
    refrescar() { if (visible) { reconstruir(); pedir(); } },
    salaCambiada() { encajado = false; if (visible) { const s = sala(); if (!s || !s.entidades.length) { ctx.mensaje('Esta sala está vacía: dibújala antes de verla en 3D'); if (ctx.onCerrar) ctx.onCerrar(); return; } leerCam(); reconstruir(); sync(); encajar(); vistaId = ''; renderVistas(); pedir(); } },
    get visible() { return visible; },
    destruir() { visible = false; if (ro) ro.disconnect(); if (raf) cancelAnimationFrame(raf); },
    _cam: () => cam, _piezas: () => piezas,
  };
}
