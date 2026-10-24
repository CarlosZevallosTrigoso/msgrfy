// Cascarón: un proyecto, varias vistas. Carga y guarda el proyecto, reparte el estado a las vistas.
import * as M from '../core/modelo.js';
import * as almacen from './almacen.js';
import { montarPlanta } from '../vistas/planta.js';
import { montarMuro } from '../vistas/muro.js';
import { montarLectura } from '../vistas/lectura.js';
import * as puente from '../core/puente.js';
import { montarObras } from './obras.js';
import { fmtNum } from '../core/unidades.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let proyecto = null, planta = null, muro = null, lectura = null, obras = null, vistaActiva = 'planta';
let modoLectura = false; // app abierta desde un HTML exportado: solo la vista Lectura, sin guardar en el navegador
let msgT = 0;
const mensaje = (t, error = false) => { const m = $('#msgTop'); m.textContent = t; m.classList.toggle('error', error); clearTimeout(msgT); msgT = setTimeout(() => { m.textContent = ''; }, error ? 8000 : 4500); };

// guardado automático con retardo
let saveT = 0, saveFallo = false;
const guardarAuto = () => {
  clearTimeout(saveT);
  saveT = setTimeout(async () => {
    saveT = 0;
    try { await almacen.guardar(M.copiaLimpia(proyecto)); saveFallo = false; }
    catch (e) { if (!saveFallo) { saveFallo = true; mensaje('No se pudo guardar en el navegador: descarga el .json con «Guardar»', true); } }
  }, 500);
};
const cambio = () => { proyecto.modificado = new Date().toISOString(); if (!modoLectura) guardarAuto(); };

const nombreArchivo = () => (proyecto.nombre || 'proyecto').replace(/[^\w\-áéíóúñü ]+/gi, '').trim().replace(/\s+/g, '-') || 'proyecto';
const descargar = (blob, nombre) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); };
const guardarJson = () => { descargar(new Blob([M.serializar(proyecto)], { type: 'application/json' }), nombreArchivo() + '.museodraft.json'); mensaje('Proyecto guardado'); };

const leerTexto = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(new Error('No se pudo leer el archivo')); fr.readAsText(file); });

// ---------- vistas ----------
const montar = () => {
  if (!proyecto.salas.length) proyecto.salas.push(M.nuevaSala({ nombre: 'Sala 1' }));
  $('#nombreProyecto').value = proyecto.nombre || ''; $('#tituloLectura').textContent = proyecto.nombre || '';
  document.title = (proyecto.nombre ? proyecto.nombre + ' · ' : '') + 'MuseoDraft';
  planta = montarPlanta({
    root: $('#vista-planta'), proyecto, sala: proyecto.salas[0],
    onCambio: () => { cambio(); obras.refrescar(); },
    onGuardar: guardarJson,
    onObraCambiada: (id) => { if (id) obras.seleccionar(id); else obras.refrescar(); },
    onArchivoJson: abrirArchivo,
    onAbrirAlzado: abrirAlzado,
  });
  muro = montarMuro({
    root: $('#vista-muro'), proyecto, muro: proyecto.muros[0] || null, mensaje,
    onCambio: () => { cambio(); obras.refrescar(); },
    onGuardar: guardarJson,
    onObraCambiada: () => obras.refrescar(),
    onArchivoJson: abrirArchivo,
  });
  lectura = montarLectura({
    root: $('#vista-lectura'), proyecto, modo: modoLectura ? 'lectura' : 'editor', mensaje,
    onCambio: () => { cambio(); obras.refrescar(); },
    onGuardar: guardarJson, onExportarHtml: exportarLectura, onEditar: salirDeLectura, onArchivoJson: abrirArchivo,
  });
  obras = montarObras({
    root: $('#obras'), proyecto, mensaje,
    onCambio: () => { cambio(); planta.refrescar(); muro.obrasCambiadas(); },
    onColocar: (id) => { irAVista('planta'); planta.colocar(id); },
    onIrA: (id) => { irAVista('planta'); return planta.irA(id); },
    onPlantaCambiada: () => { planta.refrescar(); muro.refrescar(); },
    hayMuro: () => !!muro.muro,
    onColocarMuro: (id) => { irAVista('muro'); muro.colocar(id); },
  });
  setVista(vistaActiva);
};
// las vistas registran teclado en document/window: hay que desactivarlas (y destruirlas si pueden) antes de vaciar su DOM
const desmontar = () => {
  for (const v of [planta, muro, lectura]) { if (!v) continue; try { v.activar(false); if (v.destruir) v.destruir(); } catch (e) { console.warn(e); } }
  for (const id of ['#vista-planta', '#vista-muro', '#vista-lectura', '#obras']) $(id).innerHTML = '';
  planta = null; muro = null; lectura = null; obras = null;
};
const panelEstrecho = () => typeof matchMedia === 'function' && matchMedia('(max-width: 900px)').matches;
const mostrarObras = (on) => { document.body.classList.toggle('conObras', on); $('#bObras').classList.toggle('activo', on); $('#bObras').setAttribute('aria-pressed', String(on)); };
const setVista = (v) => {
  vistaActiva = v;
  document.querySelectorAll('#tabs button').forEach((b) => { const on = b.dataset.vista === v; b.classList.toggle('activo', on); b.setAttribute('aria-pressed', String(on)); });
  document.querySelectorAll('.vista').forEach((d) => { d.hidden = d.id !== 'vista-' + v; });
  // el foco se queda en la pestaña pulsada y las vistas ignoran el teclado mientras esté fuera de su raíz: se suelta
  const ae = document.activeElement; if (ae && ae !== document.body && ae.closest && ae.closest('#top')) ae.blur();
  if (planta) planta.activar(v === 'planta');
  if (muro) muro.activar(v === 'muro');
  if (lectura) lectura.activar(v === 'lectura');
  if (obras && v !== 'planta') obras.refrescar();
};
// ir a una vista para trabajar en ella: en pantallas estrechas el panel de obras la taparía, así que se cierra
const irAVista = (v) => { if (panelEstrecho() && document.body.classList.contains('conObras')) mostrarObras(false); setVista(v); };
// desde un tramo de la planta: abre su alzado (lo crea si no existe) en la vista Muro
const abrirAlzado = (sala, linea, i) => {
  let m = puente.muroDelTramo(proyecto, sala, linea, i);
  if (!m) {
    m = puente.muroDesdeTramo(proyecto, sala, linea, i);
    if (!m) return mensaje('Ese tramo no tiene longitud', true);
    proyecto.muros.push(m); cambio();
    mensaje(`Alzado creado: ${fmtNum(m.ancho)} × ${fmtNum(m.alto)} m, ${m.colgado.length} obra${m.colgado.length === 1 ? '' : 's'} colocada${m.colgado.length === 1 ? '' : 's'}`);
  }
  irAVista('muro'); muro.abrir(m); obras.refrescar();
};

// ---------- archivos ----------
const abrirArchivo = async (file) => {
  try {
    const { proyecto: q, origen } = M.parsear(await leerTexto(file));
    const vacio = !proyecto.obras.length && !proyecto.salas.some((s) => s.entidades.length || s.calco) && !proyecto.muros.length && !proyecto.anotaciones.length;
    if (origen === 'proyecto') {
      if (!vacio && !confirm('¿Reemplazar el proyecto actual por el del archivo? Lo que no hayas descargado como .json se pierde.')) return;
      proyecto = q; desmontar(); montar(); cambio(); mensaje(`Proyecto «${proyecto.nombre}» abierto`);
    } else {
      // un archivo de las herramientas anteriores: se incorpora al proyecto actual (o lo sustituye si está vacío)
      if (vacio) { proyecto = q; if (!proyecto.nombre || proyecto.nombre === 'proyecto') proyecto.nombre = file.name.replace(/\.[^.]+$/, ''); }
      else { const r = M.incorporar(proyecto, q); mensaje(`Incorporado desde ${origen}: ${r.añadido.obras} obras, ${r.añadido.salas} salas, ${r.añadido.muros} muros, ${r.añadido.anotaciones} planos anotados`); }
      desmontar(); montar(); cambio();
      if (vacio) mensaje(`Archivo de ${origen} convertido en proyecto`);
    }
  } catch (e) { mensaje(e.message || 'No se pudo abrir el archivo', true); }
};

// ---------- HTML de lectura: la app entera con el proyecto incrustado ----------
const ID_DATOS = 'museodraft-datos', META_MODO = 'museodraft-modo', CIERRE = '<' + '/script>';
const origenHtml = async () => {
  if (window.__ORIGEN_HTML) return window.__ORIGEN_HTML;
  const r = await fetch('app.html'); if (!r.ok) throw new Error('No se encontró app.html junto a la app: genera el archivo único con build/concatenar.js');
  return await r.text();
};
const exportarLectura = async () => {
  try {
    const json = M.serializar(proyecto).replace(/<\//g, '<\\/');
    let html = await origenHtml();
    html = html.replace(new RegExp('<script id="' + ID_DATOS + '"[^>]*>[\\s\\S]*?' + CIERRE + '\\s*'), '').replace(new RegExp('<meta name="' + META_MODO + '"[^>]*>\\s*'), '');
    const bloque = '<meta name="' + META_MODO + '" content="lectura">\n<script id="' + ID_DATOS + '" type="application/json">' + json + CIERRE + '\n';
    html = html.replace(/<title>[^<]*<\/title>/, () => '<title>' + esc(proyecto.nombre || 'MuseoDraft') + '</title>').replace(/(<body[^>]*>)/, (m, b) => b + '\n' + bloque);
    descargar(new Blob([html], { type: 'text/html;charset=utf-8' }), nombreArchivo() + '-lectura.html'); mensaje('HTML de lectura exportado');
  } catch (e) { mensaje(e.message, true); }
};
let saliendo = false;
const salirDeLectura = async () => {
  if (saliendo || !modoLectura) return; saliendo = true;
  try {
    const previo = await almacen.cargar();
    if (previo && previo.creado !== proyecto.creado && !confirm('Al editar, este proyecto pasa a guardarse en el navegador y reemplaza al que había. ¿Continuar?')) return;
  } finally { saliendo = false; }
  modoLectura = false; document.body.classList.remove('lectura');
  lectura.setModo('editor'); cambio(); mensaje('Modo edición. Guarda con .json cuando termines.');
};
const proyectoIncrustado = () => {
  const datos = document.getElementById(ID_DATOS); if (!datos) return null;
  try { const { proyecto: q } = M.importar(JSON.parse(datos.textContent)); return q; } catch (e) { mensaje('El proyecto incrustado está dañado', true); return null; }
};

// ---------- arranque ----------
const domListo = () => new Promise((res) => { if (document.readyState !== 'loading') res(); else document.addEventListener('DOMContentLoaded', () => res(), { once: true }); });
const arrancar = async () => {
  await domListo(); // en app.html la copia del documento (__ORIGEN_HTML) se toma al final del body, antes de montar
  const incrustado = proyectoIncrustado();
  const meta = document.querySelector('meta[name="' + META_MODO + '"]');
  const d = await almacen.cargar();
  if (incrustado) {
    // si este mismo proyecto ya se pasó a edición («Editar») y se guardó en el navegador, se sigue con esa copia, no con la incrustada
    if (d && d.creado === incrustado.creado && String(d.modificado || '') >= String(incrustado.modificado || '')) {
      try { proyecto = M.validar(d); mensaje('Proyecto recuperado del navegador (edición de este HTML)'); } catch (e) { console.warn(e); }
    }
    if (!proyecto) { proyecto = incrustado; modoLectura = !!(meta && meta.content === 'lectura'); }
  } else if (d) {
    try { proyecto = M.validar(d); mensaje('Proyecto recuperado del navegador'); }
    catch (e) {
      console.warn(e);
      // no se sobrescribe en silencio lo que había: se ofrece el .json crudo antes de que el guardado automático lo reemplace
      try { descargar(new Blob([JSON.stringify(d)], { type: 'application/json' }), 'museodraft-recuperado.json'); } catch (e2) { /* nada */ }
      mensaje('El proyecto guardado en el navegador no se pudo leer; se descargó como museodraft-recuperado.json', true);
    }
  }
  if (!proyecto) proyecto = M.nuevoProyecto('proyecto');
  if (modoLectura) { document.body.classList.add('lectura'); $('#tituloLectura').textContent = proyecto.nombre || ''; vistaActiva = 'lectura'; }
  montar();
  $('#bEditar').addEventListener('click', salirDeLectura);

  document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => setVista(b.dataset.vista)));
  $('#nombreProyecto').addEventListener('input', (e) => { proyecto.nombre = e.target.value; document.title = (proyecto.nombre ? proyecto.nombre + ' · ' : '') + 'MuseoDraft'; cambio(); });
  $('#bObras').addEventListener('click', () => { mostrarObras(!document.body.classList.contains('conObras')); if (planta) planta.refrescar(); });
  $('#bGuardar').addEventListener('click', guardarJson);
  $('#bAbrir').addEventListener('click', () => { const f = $('#fJson'); f.value = ''; f.click(); });
  $('#fJson').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) abrirArchivo(f); });
  $('#bNuevo').addEventListener('click', async () => {
    if (!confirm('¿Empezar un proyecto nuevo? Lo que no hayas descargado como .json se pierde.')) return;
    proyecto = M.nuevoProyecto('proyecto'); desmontar(); montar(); await almacen.borrar(); cambio(); mensaje('Proyecto nuevo');
  });
  $('#bAyudaTop').addEventListener('click', () => $('#ayudaTop').classList.toggle('visible'));
  $('#bCerrarAyudaTop').addEventListener('click', () => $('#ayudaTop').classList.remove('visible'));
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); guardarJson(); }
    else if (k === 'o' && !modoLectura) { e.preventDefault(); $('#bAbrir').click(); }
  });
  window.addEventListener('beforeunload', (e) => {
    if (saveT) { clearTimeout(saveT); saveT = 0; almacen.guardar(M.copiaLimpia(proyecto)).catch(() => {}); }
    if (saveFallo && !modoLectura) { e.preventDefault(); e.returnValue = ''; } // el navegador no pudo guardar: que el usuario confirme la salida
  });
  window.MD3 = { get proyecto() { return proyecto; }, get planta() { return planta; }, get muro() { return muro; }, get lectura() { return lectura; }, get obras() { return obras; }, get modoLectura() { return modoLectura; }, M, puente, setVista, abrirArchivo, abrirAlzado, exportarLectura, cambio, listo: true };
};
arrancar();
