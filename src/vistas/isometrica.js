// Modo 3D de la vista Planta: la sala en axonometría con giro libre, al estilo de Los Sims.
// Dibuja en canvas (fluido al girar) y exporta PNG y SVG con la misma escena.
import * as I from '../core/isometrica.js';
import { MD } from '../core/muro.js';
import { fmtNum } from '../core/unidades.js';
import * as V from '../core/perspectiva.js';

const MARKUP = `
<div class="iso-barra">
  <span class="iso-tit">3D</span>
  <label class="iso-l" title="Perspectiva desde los ojos de una figura (persona, silla de ruedas, niño) colocada en la planta">ojos de <select id="isoOjos"><option value="">— nadie (axonometría) —</option></select></label>
  <span class="iso-pov" id="isoPovInfo" hidden></span>
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
<div class="iso-pie" id="isoPie">Arrastra para girar e inclinar · Shift + arrastrar desplaza · rueda acerca · «＋ vista» guarda este punto de vista con nombre; PgUp/PgDn recorre los guardados</div>
`;

// ctx: { root, proyecto, sala(), mensaje, onCambio, descargar(blob, nombre), nombreArchivo() }
export function montarIso(ctx) {
  const root = ctx.root; root.innerHTML = MARKUP;
  const $ = (s) => root.querySelector(s);
  const cv = $('#isoCv'), g2 = cv.getContext('2d');
  let cam = I.camDefecto(), view = { s: 60, ox: 0, oy: 0 }, piezas = [], visible = false, raf = 0, encajado = false, sFit = 60, vistaId = '';
  let povId = ''; // figura desde cuyos ojos se mira; '' = axonometría
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
  // ---- perspectiva desde una figura ----
  const figuras = () => { const s = sala(); return s ? s.entidades.filter(V.esFigura) : []; };
  const figura = () => figuras().find((f) => f.id === povId) || null;
  const enPov = () => !!figura();
  const renderOjos = () => {
    const sel = $('#isoOjos'); const fs = figuras();
    sel.innerHTML = '<option value="">— nadie (axonometría) —</option>' + fs.map((f, k) => `<option value="${f.id}" ${f.id === povId ? 'selected' : ''}>${esc(f.nombre || 'figura')} ${k + 1}</option>`).join('');
    sel.disabled = !fs.length; sel.title = fs.length ? 'Perspectiva desde los ojos de una figura de la planta' : 'Coloca una persona de la biblioteca (Referencia) en la planta para mirar desde sus ojos';
    const pov = enPov();
    for (const id of ['isoGiro', 'isoInc', 'isoRejilla', 'isoVistas', 'isoVistaGuardar', 'isoVistaQuitar', 'isoAjustar']) $('#' + id).disabled = pov || (id === 'isoVistas' && !vistas().length) || (id === 'isoVistaQuitar' && !vistaId);
    root.querySelectorAll('[data-g]').forEach((b) => { b.disabled = pov; });
    $('#isoPovInfo').hidden = !pov;
    if (pov) { const p = V.povDe(figura()); $('#isoPovInfo').textContent = `mira ${fmtNum(p.mira, 0)}° · ojos ${fmtNum(p.ojos)} m · campo ${fmtNum(p.fov, 0)}°`; }
    $('#isoPie').textContent = pov ? 'Arrastra para mirar alrededor (y arriba/abajo) · rueda abre o cierra el campo visual · la figura y su cono se mueven en la planta · PNG/SVG exportan esta vista'
      : 'Arrastra para girar e inclinar · Shift + arrastrar desplaza · rueda acerca · «＋ vista» guarda este punto de vista con nombre; PgUp/PgDn recorre los guardados';
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const setPov = (id) => { povId = id || ''; if (!figura()) povId = ''; renderOjos(); reconstruir(); if (!enPov()) { sync(); encajar(); } pedir(); };
  const guardarPov = () => { if (ctx.onCambio) ctx.onCambio(); };
  const sync = () => {
    $('#isoGiro').value = ((cam.giro % 360) + 360) % 360; $('#isoInc').value = cam.inclinacion;
    $('[data-v="giro"]').textContent = fmtNum(((cam.giro % 360) + 360) % 360, 0) + '°'; $('[data-v="inc"]').textContent = fmtNum(cam.inclinacion, 0) + '°';
    $('#isoMuros').value = cam.muros; $('#isoZocalo').value = fmtNum(cam.zocalo); $('#isoAlto').value = fmtNum(cam.altoDefecto); $('#isoRejilla').checked = !!cam.rejilla; $('#isoFondo').checked = cam.fondo !== false;
  };
  const tam = () => ({ w: Math.max(1, root.clientWidth), h: Math.max(1, root.clientHeight - ($('.iso-barra').offsetHeight || 36) - ($('.iso-pie').offsetHeight || 22)) });
  const reconstruir = () => { const s = sala(); const f = figura(); piezas = !s ? [] : f ? V.escenaPov(ctx.proyecto, s, V.povDe(f), { muros: cam.muros, zocalo: cam.zocalo, altoDefecto: cam.altoDefecto, rejilla: cam.rejilla, fondo: cam.fondo }) : I.escena(ctx.proyecto, s, cam); };
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
    const f = figura();
    if (f) V.pintarPov(MD.canvasPainter(g2, getImage), piezas, V.proyectorPov(V.povDe(f)), V.viewPov(w, h));
    else I.pintar(MD.canvasPainter(g2, getImage), piezas, view);
  };
  const pedir = () => { if (!raf) raf = requestAnimationFrame(dibujar); };
  const actualizar = (persistir = true) => { reconstruir(); sync(); pedir(); if (persistir) guardarCam(); if (vistaId && !enPov()) { vistaId = ''; renderVistas(); } };

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
  $('#isoOjos').addEventListener('change', (e) => setPov(e.target.value));
  $('#isoVistas').addEventListener('change', (e) => { if (e.target.value) irAVista(e.target.value); else { vistaId = ''; renderVistas(); } });
  $('#isoVistaGuardar').addEventListener('click', guardarVista);
  $('#isoVistaQuitar').addEventListener('click', quitarVista);
  $('#isoCerrar').addEventListener('click', () => ctx.onCerrar && ctx.onCerrar());
  const slug = (s) => String(s || 'figura').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'figura';
  const sufijoVista = () => { const v = vistas().find((x) => x.id === vistaId); return v ? '-' + v.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() : ''; };
  $('#isoSvg').addEventListener('click', () => {
    const s = sala(); if (!s) return;
    const f = figura();
    const r = f ? V.svgDePov(ctx.proyecto, s, f, 1600, { muros: cam.muros, zocalo: cam.zocalo, altoDefecto: cam.altoDefecto, rejilla: cam.rejilla, fondo: cam.fondo, aspecto: tam().h / tam().w }) : I.svgDeIso(ctx.proyecto, s, cam, 120);
    ctx.descargar(new Blob([r.svg], { type: 'image/svg+xml' }), ctx.nombreArchivo() + (f ? '-desde-' + slug(f.nombre) : '-3d' + sufijoVista()) + '.svg'); ctx.mensaje('SVG exportado');
  });
  $('#isoPng').addEventListener('click', () => {
    const s = sala(); if (!s) return;
    const f = figura();
    let W, H, pintarEn;
    if (f) { const t = tam(); W = 2400; H = Math.round(W * t.h / t.w); pintarEn = (g) => V.pintarPov(MD.canvasPainter(g, getImage), piezas, V.proyectorPov(V.povDe(f)), V.viewPov(W, H)); }
    else { const b = I.limites(piezas); const pxm = Math.min(200, Math.sqrt(12e6 / Math.max(1, (b.w + 1) * (b.h + 1)))); W = Math.round((b.w + 1) * pxm); H = Math.round((b.h + 1) * pxm); pintarEn = (g) => I.pintar(MD.canvasPainter(g, getImage), piezas, { s: pxm, ox: (0.5 - b.x) * pxm, oy: (0.5 - b.y) * pxm }); }
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    if (!g) return ctx.mensaje('No se pudo crear el lienzo', true);
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    pintarEn(g);
    c.toBlob((bl) => { if (bl) { ctx.descargar(bl, ctx.nombreArchivo() + (f ? '-desde-' + slug(f.nombre) : '-3d' + sufijoVista()) + '.png'); ctx.mensaje('PNG exportado: ' + W + ' × ' + H + ' px'); } else ctx.mensaje('No se pudo generar el PNG', true); }, 'image/png');
  });

  // puntero: arrastrar gira e inclina; Shift desplaza; rueda acerca
  let arr = null;
  cv.addEventListener('pointerdown', (e) => { e.stopPropagation(); cv.setPointerCapture(e.pointerId); const f = figura(); const p = f ? V.povDe(f) : null; arr = { x: e.clientX, y: e.clientY, giro: cam.giro, inc: cam.inclinacion, ox: view.ox, oy: view.oy, pan: !f && (e.shiftKey || e.button === 1), mira: p && p.mira, cabeceo: p && p.cabeceo }; });
  cv.addEventListener('pointermove', (e) => {
    e.stopPropagation(); if (!arr) return;
    const dx = e.clientX - arr.x, dy = e.clientY - arr.y;
    const f = figura();
    if (f) { // mirar alrededor: la mirada sigue al arrastre, como girar la cabeza
      const { w } = tam(); const p = V.povDe(f);
      f.mira = ((arr.mira - dx / w * p.fov) % 360 + 360) % 360; f.cabeceo = Math.max(-45, Math.min(45, arr.cabeceo + dy / w * p.fov));
      renderOjos(); reconstruir(); pedir(); return;
    }
    if (arr.pan) { view.ox = arr.ox + dx; view.oy = arr.oy + dy; pedir(); return; }
    cam.giro = ((arr.giro + dx * 0.5) % 360 + 360) % 360; cam.inclinacion = Math.max(15, Math.min(90, arr.inc + dy * 0.3));
    actualizar(false);
  });
  const fin = (e) => { e.stopPropagation(); if (arr && figura()) guardarPov(); else if (arr && !arr.pan) guardarCam(); arr = null; };
  cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); const f = figura(); if (f) { f.fov = Math.max(25, Math.min(110, Math.round(V.povDe(f).fov * (e.deltaY < 0 ? 0.92 : 1 / 0.92)))); renderOjos(); reconstruir(); pedir(); guardarPov(); return; } const r = cv.getBoundingClientRect(); const px = e.clientX - r.left, py = e.clientY - r.top; const k = e.deltaY < 0 ? 1.15 : 1 / 1.15; view = { s: view.s * k, ox: px - (px - view.ox) * k, oy: py - (py - view.oy) * k }; pedir(); }, { passive: false });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (visible) pedir(); }) : null; if (ro) ro.observe(root);

  return {
    mostrar(figuraId = null) { visible = true; root.hidden = false; leerCam(); imgCache.clear(); if (figuraId !== null) povId = figuraId; if (!figura()) povId = ''; renderOjos(); reconstruir(); sync(); if (!encajado) encajar(); vistaId = ''; renderVistas(); renderOjos(); pedir(); },
    vistaSiguiente,
    ocultar() { visible = false; root.hidden = true; },
    refrescar() { if (visible) { if (povId && !figura()) { povId = ''; renderOjos(); } reconstruir(); pedir(); } },
    get povId() { return povId; }, setPov,
    salaCambiada() { encajado = false; if (visible) { const s = sala(); if (!s || !s.entidades.length) { ctx.mensaje('Esta sala está vacía: dibújala antes de verla en 3D'); if (ctx.onCerrar) ctx.onCerrar(); return; } povId = ''; renderOjos(); leerCam(); reconstruir(); sync(); encajar(); vistaId = ''; renderVistas(); pedir(); } },
    get visible() { return visible; },
    destruir() { visible = false; if (ro) ro.disconnect(); if (raf) cancelAnimationFrame(raf); },
    _cam: () => cam, _piezas: () => piezas,
  };
}
