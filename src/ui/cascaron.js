// Cascarón: un proyecto, varias vistas. Carga y guarda el proyecto, reparte el estado a las vistas.
import * as M from '../core/modelo.js';
import * as almacen from './almacen.js';
import { montarPlanta } from '../vistas/planta.js';
import { montarMuro } from '../vistas/muro.js';
import { montarLectura } from '../vistas/lectura.js';
import * as puente from '../core/puente.js';
import { montarObras } from './obras.js';

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
    try { await almacen.guardar(proyecto); saveFallo = false; }
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
  $('#nombreProyecto').value = proyecto.nombre || '';
  document.title = (proyecto.nombre ? proyecto.nombre + ' · ' : '') + 'MuseoDraft';
  planta = montarPlanta({
    root: $('#vista-planta'), proyecto, sala: proyecto.salas[0],
    onCambio: () => { cambio(); obras.refrescar(); },
    onGuardar: guardarJson,
    onObraCambiada: (id) => { obras.refrescar(); if (id) obras.seleccionar(id); },
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
    onCambio: () => { cambio(); planta.refrescar(); },
    onColocar: (id) => { setVista('planta'); planta.colocar(id); },
    onIrA: (id) => { setVista('planta'); return planta.irA(id); },
    onPlantaCambiada: () => { planta.refrescar(); muro.refrescar(); },
    hayMuro: () => !!muro.muro,
    onColocarMuro: (id) => { setVista('muro'); muro.colocar(id); },
  });
  setVista(vistaActiva);
};
const desmontar = () => { for (const id of ['#vista-planta', '#vista-muro', '#vista-lectura', '#obras']) $(id).innerHTML = ''; planta = null; muro = null; lectura = null; obras = null; };
const setVista = (v) => {
  vistaActiva = v;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('activo', b.dataset.vista === v));
  document.querySelectorAll('.vista').forEach((d) => { d.hidden = d.id !== 'vista-' + v; });
  if (planta) planta.activar(v === 'planta');
  if (muro) muro.activar(v === 'muro');
  if (lectura) lectura.activar(v === 'lectura');
  if (obras && v !== 'planta') obras.refrescar();
};
// desde un tramo de la planta: abre su alzado (lo crea si no existe) en la vista Muro
const abrirAlzado = (sala, linea, i) => {
  let m = puente.muroDelTramo(proyecto, sala, linea, i);
  if (!m) {
    m = puente.muroDesdeTramo(proyecto, sala, linea, i);
    if (!m) return mensaje('Ese tramo no tiene longitud', true);
    proyecto.muros.push(m); cambio();
    mensaje(`Alzado creado: ${m.ancho} × ${m.alto} m, ${m.colgado.length} obra${m.colgado.length === 1 ? '' : 's'} colocada${m.colgado.length === 1 ? '' : 's'}`);
  }
  setVista('muro'); muro.abrir(m); obras.refrescar();
};

// ---------- archivos ----------
const abrirArchivo = async (file) => {
  try {
    const { proyecto: q, origen } = M.parsear(await leerTexto(file));
    if (origen === 'proyecto') {
      if (proyecto.obras.length + proyecto.salas.reduce((n, s) => n + s.entidades.length, 0) > 0 && !confirm('¿Reemplazar el proyecto actual por el del archivo? Lo que no hayas guardado se pierde.')) return;
      proyecto = q; desmontar(); montar(); cambio(); mensaje(`Proyecto «${proyecto.nombre}» abierto`);
    } else {
      // un archivo de las herramientas anteriores: se incorpora al proyecto actual (o lo sustituye si está vacío)
      const vacio = !proyecto.obras.length && !proyecto.salas.some((s) => s.entidades.length || s.calco) && !proyecto.muros.length && !proyecto.anotaciones.length;
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
const salirDeLectura = async () => {
  const previo = await almacen.cargar();
  if (previo && !confirm('Al editar, este proyecto pasa a guardarse en el navegador y reemplaza al que había. ¿Continuar?')) return;
  modoLectura = false; document.body.classList.remove('lectura');
  lectura.setModo('editor'); cambio(); mensaje('Modo edición. Guarda con .json cuando termines.');
};
const proyectoIncrustado = () => {
  const datos = document.getElementById(ID_DATOS); if (!datos) return null;
  try { const { proyecto: q } = M.importar(JSON.parse(datos.textContent)); return q; } catch (e) { mensaje('El proyecto incrustado está dañado', true); return null; }
};

// ---------- arranque ----------
const arrancar = async () => {
  const incrustado = proyectoIncrustado();
  const meta = document.querySelector('meta[name="' + META_MODO + '"]');
  if (incrustado) { proyecto = incrustado; modoLectura = !!(meta && meta.content === 'lectura'); }
  else {
    const d = await almacen.cargar();
    if (d) { try { proyecto = M.validar(d); mensaje('Proyecto recuperado del navegador'); } catch (e) { console.warn(e); } }
  }
  if (!proyecto) proyecto = M.nuevoProyecto('proyecto');
  if (modoLectura) { document.body.classList.add('lectura'); $('#tituloLectura').textContent = proyecto.nombre || ''; vistaActiva = 'lectura'; }
  montar();
  $('#bEditar').addEventListener('click', salirDeLectura);

  document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => setVista(b.dataset.vista)));
  $('#nombreProyecto').addEventListener('input', (e) => { proyecto.nombre = e.target.value; document.title = (proyecto.nombre ? proyecto.nombre + ' · ' : '') + 'MuseoDraft'; cambio(); });
  $('#bObras').addEventListener('click', () => { document.body.classList.toggle('conObras'); $('#bObras').classList.toggle('activo', document.body.classList.contains('conObras')); if (planta) planta.refrescar(); });
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
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); guardarJson(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); $('#bAbrir').click(); }
  });
  window.addEventListener('beforeunload', () => { if (saveT) { clearTimeout(saveT); almacen.guardar(proyecto).catch(() => {}); } });
  window.MD3 = { get proyecto() { return proyecto; }, get planta() { return planta; }, get muro() { return muro; }, get lectura() { return lectura; }, get obras() { return obras; }, get modoLectura() { return modoLectura; }, M, puente, setVista, abrirArchivo, abrirAlzado, exportarLectura, cambio, listo: true };
};
arrancar();
