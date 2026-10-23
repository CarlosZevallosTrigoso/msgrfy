// Panel de obras: la lista única del proyecto. Desde aquí se crean, se editan y se mandan a la planta.
import * as M from '../core/modelo.js';
import { fmtNum, parseNum, r6 } from '../core/unidades.js';
import { leerImagen } from './imagenes.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dims = (o) => {
  const a = o.ancho > 0 ? (o.estimado.ancho ? '≈' : '') + fmtNum(o.ancho) : '?';
  const b = o.alto > 0 ? (o.estimado.alto ? '≈' : '') + fmtNum(o.alto) : '?';
  return a === '?' && b === '?' ? 'sin medidas' : a + ' × ' + b + ' m';
};

// ctx: { root, proyecto, onCambio(), onColocar(obraId), onIrA(obraId) → bool, mensaje(t, err) }
export function montarObras(ctx) {
  const root = ctx.root;
  let sel = null;
  const fImg = document.createElement('input'); fImg.type = 'file'; fImg.accept = 'image/*'; fImg.multiple = true; fImg.hidden = true; root.appendChild(fImg);
  const p = () => ctx.proyecto;

  const render = () => {
    const obras = p().obras;
    const o = obras.find((x) => x.id === sel) || null;
    if (!o) sel = null;
    let h = `<div class="ob-cab"><h3>obras · ${obras.length}</h3><div class="btns"><button data-acc="nueva" title="Obra sin imagen">+ obra</button><button data-acc="imagenes" class="primario" title="Una obra por cada imagen">+ imágenes</button></div></div>`;
    if (!obras.length) h += `<p class="nota">Añade obras aquí o dibújalas en la planta con «Cuadro» u «Obra». Cada una existe una sola vez y se puede usar en varias salas y muros.</p>`;
    h += `<ul class="ob-lista">` + obras.map((x) => {
      const u = M.usosDeObra(p(), x.id); const colocada = u.salas.length || u.muros.length;
      const img = x.imagenId && p().imagenes[x.imagenId] ? `<img src="${p().imagenes[x.imagenId]}" alt="">` : `<span class="ob-sin"></span>`;
      return `<li data-id="${x.id}" class="${x.id === sel ? 'activo' : ''}">${img}<div class="ob-txt"><b>${esc(x.nombre || 'sin título')}</b><span>${esc(x.autor || '')}${x.autor && x.anio ? ', ' : ''}${esc(x.anio || '')}</span><i>${dims(x)}${colocada ? '' : ' · <em>sin colocar</em>'}</i></div></li>`;
    }).join('') + `</ul>`;
    if (o) {
      const u = M.usosDeObra(p(), o.id);
      const txt = (k, label) => `<label>${label}</label><input type="text" data-ok="${k}" value="${esc(o[k] || '')}">`;
      const dim = (k, label) => `<div><label>${label}</label><input type="text" inputmode="decimal" data-odim="${k}" value="${o[k] > 0 ? fmtNum(o[k]) : ''}" placeholder="?"></div>`;
      h += `<div class="ob-ficha"><h3>ficha</h3>`;
      h += `<div class="ob-img">${o.imagenId && p().imagenes[o.imagenId] ? `<img src="${p().imagenes[o.imagenId]}" alt="">` : '<span class="nota">sin imagen</span>'}<div class="btns"><button data-acc="imagen">${o.imagenId ? 'cambiar imagen' : 'poner imagen'}</button>${o.imagenId ? '<button data-acc="quitarImagen">quitar</button>' : ''}</div></div>`;
      h += txt('nombre', 'título') + txt('autor', 'autor') + `<div class="fila"><div style="flex:0 0 70px">${txt('anio', 'año')}</div><div>${txt('tecnica', 'técnica')}</div></div>`;
      h += `<div class="fila">${dim('ancho', 'ancho (m)')}${dim('alto', 'alto (m)')}</div>`;
      if (o.estimado.ancho || o.estimado.alto) h += `<div class="nota">≈ estimada: escribe la medida real para confirmarla.</div>`;
      if (o.imgRatio && (!(o.alto > 0) || o.estimado.alto) && o.ancho > 0) h += `<div class="btns"><button data-acc="altoImagen">alto según la imagen (${fmtNum(o.ancho / o.imgRatio)} m)</button></div>`;
      h += txt('inv', 'n.º de inventario') + `<label>nota</label><textarea data-ok="nota" rows="2">${esc(o.nota || '')}</textarea>`;
      h += `<div class="dato">${u.salas.length ? `en ${u.salas.length} sala${u.salas.length > 1 ? 's' : ''}` : 'sin colocar en planta'}${u.muros.length ? ` · en ${u.muros.length} muro${u.muros.length > 1 ? 's' : ''}` : ''}</div>`;
      h += `<div class="btns"><button data-acc="colocar" class="primario" title="Dibujarla como cuadro en la sala activa">colocar en planta</button>${ctx.hayMuro && ctx.hayMuro() ? '<button data-acc="colocarMuro" title="Colgarla en el muro abierto en la vista Muro">colocar en muro</button>' : ''}${u.salas.length ? '<button data-acc="ir">ver en la planta</button>' : ''}<button data-acc="borrar" class="peligro">borrar obra</button></div></div>`;
    }
    root.querySelector('.ob-cuerpo').innerHTML = h;
    enlazar(o);
  };

  const enlazar = (o) => {
    const B = root.querySelector('.ob-cuerpo');
    B.querySelectorAll('li[data-id]').forEach((li) => li.addEventListener('click', () => { sel = li.dataset.id; render(); }));
    B.querySelectorAll('[data-ok]').forEach((i) => i.addEventListener('input', () => { if (!o) return; o[i.dataset.ok] = i.value; ctx.onCambio(); const li = B.querySelector(`li[data-id="${o.id}"] b`); if (li && i.dataset.ok === 'nombre') li.textContent = o.nombre || 'sin título'; }));
    B.querySelectorAll('[data-odim]').forEach((i) => {
      const aplicar = () => {
        if (!o) return; const k = i.dataset.odim, txt = i.value.trim(), v = parseNum(txt);
        if (txt && !(v > 0)) { ctx.mensaje('Medida no válida', true); render(); return; }
        o[k] = txt ? r6(v) : null; o.estimado[k] = !txt; ctx.onCambio(); render();
      };
      i.addEventListener('change', aplicar);
      i.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); i.blur(); } });
    });
    B.querySelectorAll('[data-acc]').forEach((b) => b.addEventListener('click', () => accion(b.dataset.acc, o)));
  };

  let pendiente = null; // qué hacer con las imágenes elegidas
  const accion = async (acc, o) => {
    if (acc === 'nueva') { const n = M.nuevaObra({ nombre: 'Obra ' + (p().obras.length + 1) }); p().obras.push(n); sel = n.id; ctx.onCambio(); render(); const i = root.querySelector('[data-ok="nombre"]'); if (i) { i.focus(); i.select(); } }
    else if (acc === 'imagenes') { pendiente = { modo: 'nuevas' }; fImg.multiple = true; fImg.value = ''; fImg.click(); }
    else if (acc === 'imagen') { if (!o) return; pendiente = { modo: 'reemplazar', id: o.id }; fImg.multiple = false; fImg.value = ''; fImg.click(); }
    else if (acc === 'quitarImagen') { if (!o) return; o.imagenId = null; o.imgRatio = null; M.limpiarImagenes(p()); ctx.onCambio(); render(); }
    else if (acc === 'altoImagen') { if (!o || !o.imgRatio || !(o.ancho > 0)) return; o.alto = r6(o.ancho / o.imgRatio); o.estimado.alto = true; ctx.onCambio(); render(); }
    else if (acc === 'colocar') { if (o) ctx.onColocar(o.id); }
    else if (acc === 'colocarMuro') { if (o && ctx.onColocarMuro) ctx.onColocarMuro(o.id); }
    else if (acc === 'ir') { if (o && !ctx.onIrA(o.id)) ctx.mensaje('Está en otra sala: cámbiala en el selector de la planta'); }
    else if (acc === 'borrar') {
      if (!o) return; const u = M.usosDeObra(p(), o.id);
      if (!confirm(`¿Borrar «${o.nombre || 'sin título'}»?${u.salas.length || u.muros.length ? ' También desaparece de la planta y los muros.' : ''}`)) return;
      M.borrarObra(p(), o.id); M.limpiarImagenes(p()); sel = null; ctx.onCambio(); render(); if (ctx.onPlantaCambiada) ctx.onPlantaCambiada();
    }
  };
  fImg.addEventListener('change', async () => {
    const files = [...fImg.files]; fImg.value = ''; if (!files.length || !pendiente) return;
    const modo = pendiente; pendiente = null; let ok = 0; const fallos = [];
    for (const f of files) {
      try {
        const im = await leerImagen(f, 1200); const id = M.nuevoId('img'); p().imagenes[id] = im.dataURL;
        if (modo.modo === 'reemplazar') { const o = M.obraDe(p(), modo.id); if (!o) break; o.imagenId = id; o.imgRatio = r6(im.ratio); if (o.ancho > 0 && (!(o.alto > 0) || o.estimado.alto)) { o.alto = r6(o.ancho / im.ratio); o.estimado.alto = true; } ok++; break; }
        const n = M.nuevaObra({ nombre: f.name.replace(/\.[^.]+$/, ''), imagenId: id, imgRatio: r6(im.ratio) }); p().obras.push(n); sel = n.id; ok++;
      } catch (e) { fallos.push(f.name); }
    }
    M.limpiarImagenes(p()); ctx.onCambio(); render();
    ctx.mensaje((ok ? (modo.modo === 'reemplazar' ? 'Imagen cambiada.' : ok + (ok === 1 ? ' obra añadida.' : ' obras añadidas.')) + ' Escribe las medidas reales en la ficha.' : '') + (fallos.length ? ' No se pudo leer: ' + fallos.join(', ') : ''), !ok);
  });

  root.innerHTML = '<div class="ob-cuerpo"></div>';
  root.appendChild(fImg);
  render();
  return { refrescar: render, seleccionar(id) { sel = id; render(); } };
}
