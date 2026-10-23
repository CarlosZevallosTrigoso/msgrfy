// Cascarón: un proyecto, varias vistas. Carga y guarda el proyecto, reparte el estado a las vistas.
import * as M from '../core/modelo.js';
import * as almacen from './almacen.js';
import { montarPlanta } from '../vistas/planta.js';
import { montarMuro } from '../vistas/muro.js';
import * as puente from '../core/puente.js';
import { montarObras } from './obras.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let proyecto = null, planta = null, muro = null, obras = null, vistaActiva = 'planta';
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
const cambio = () => { proyecto.modificado = new Date().toISOString(); guardarAuto(); };

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
const desmontar = () => { $('#vista-planta').innerHTML = ''; $('#vista-muro').innerHTML = ''; $('#obras').innerHTML = ''; planta = null; muro = null; obras = null; };
const setVista = (v) => {
  vistaActiva = v;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('activo', b.dataset.vista === v));
  document.querySelectorAll('.vista').forEach((d) => { d.hidden = d.id !== 'vista-' + v; });
  if (planta) planta.activar(v === 'planta');
  if (muro) muro.activar(v === 'muro');
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

// ---------- arranque ----------
const arrancar = async () => {
  const d = await almacen.cargar();
  if (d) { try { proyecto = M.validar(d); mensaje('Proyecto recuperado del navegador'); } catch (e) { console.warn(e); } }
  if (!proyecto) proyecto = M.nuevoProyecto('proyecto');
  montar();

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
  window.MD3 = { get proyecto() { return proyecto; }, get planta() { return planta; }, get muro() { return muro; }, get obras() { return obras; }, M, puente, setVista, abrirArchivo, abrirAlzado, cambio, listo: true };
};
arrancar();
