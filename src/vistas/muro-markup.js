// Marcado de la vista Muro (se inyecta en el contenedor que da el cascarón)
export const MARKUP = `
<div id="md">
<header id="md-top">
  <label class="inline" for="selMuro">muro</label>
  <select id="selMuro" aria-label="Muro"></select>
  <button class="tb" id="m-nombre" title="Renombrar el muro">✎</button>
  <button class="tb" id="m-nuevo" title="Añadir un muro suelto (sin tramo en la planta)">+ muro</button>
  <button class="tb" id="m-borrar" title="Borrar este muro">×</button>
  <span id="m-origen" class="lbl"></span>
  <div class="sep"></div>
  <button class="tb" id="t-select" aria-pressed="true" title="Seleccionar y mover (V)"><svg viewBox="0 0 16 16"><path d="M3 2l9 5-4 1 2.5 5-1.6.8L6.4 9 3 12z" fill="currentColor"/></svg><span class="lbl">Mover</span><kbd>V</kbd></button>
  <button class="tb" id="t-hand" aria-pressed="false" title="Mano: desplazar la vista (H, o mantén Espacio)"><svg viewBox="0 0 16 16"><path d="M5 8V3.5a1 1 0 012 0V7m0-4.5a1 1 0 012 0V7m0-3.5a1 1 0 012 0V8m0-2a1 1 0 012 0v4c0 3-2 4.5-4.5 4.5S5 13 4 11.5L2.3 8.8a1 1 0 011.6-1.1L5 9" fill="none" stroke="currentColor" stroke-width="1.2"/></svg><span class="lbl">Mano</span><kbd>H</kbd></button>
  <button class="tb" id="t-measure" aria-pressed="false" title="Medir: arrastra entre dos puntos (M). Shift = horizontal o vertical"><svg viewBox="0 0 16 16"><path d="M1.5 10.5l9-9 4 4-9 9z M4 8l1.5 1.5 M6 6l2 2 M8 4l1.5 1.5 M10 2l2 2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg><span class="lbl">Medir</span><kbd>M</kbd></button>
  <div class="sep"></div>
  <button class="tb" id="b-undo" title="Deshacer (Ctrl/⌘ Z)" disabled><svg viewBox="0 0 16 16"><path d="M5 3L2 6l3 3M2 6h7a4 4 0 010 8H6" fill="none" stroke="currentColor" stroke-width="1.3"/></svg></button>
  <button class="tb" id="b-redo" title="Rehacer (Ctrl/⌘ Shift Z)" disabled><svg viewBox="0 0 16 16"><path d="M11 3l3 3-3 3M14 6H7a4 4 0 000 8h3" fill="none" stroke="currentColor" stroke-width="1.3"/></svg></button>
  <div class="sep"></div>
  <button class="tb" id="b-zout" title="Alejar (Ctrl/⌘ −)">−</button>
  <input id="zoomv" aria-label="Zoom en porcentaje" title="100 % = tamaño real en pantalla (calíbralo en Vista y ajustes)">
  <button class="tb" id="b-zin" title="Acercar (Ctrl/⌘ +)">+</button>
  <button class="tb" id="b-fit" title="Encajar el muro en la ventana (Shift 1 o Ctrl/⌘ 0)">Encajar</button>
  <button class="tb" id="b-100" title="Tamaño real en pantalla (Shift 0)">100 %</button>
  <button class="tb" id="b-center" title="Centrar la vista en la selección, o en el muro si no hay selección (Shift 2)">Centrar</button>
  <div class="sep"></div>
  <div class="seg" role="group" aria-label="Vista">
    <button class="tb" id="v-alz" aria-pressed="true" title="Alzado: vista frontal editable (Shift A)">Alzado</button>
    <button class="tb" id="v-iso" aria-pressed="false" title="Vista isométrica de solo lectura (Shift I)">Isométrica</button>
  </div>
  <div class="grow"></div>
  <button class="tb" id="b-help" title="Atajos de teclado (?)">Atajos</button>
</header>

<div id="md-main">
  <div id="md-work">
    <canvas id="cv" tabindex="0" aria-label="Muro de montaje"></canvas>
    <div id="cota-ed" hidden></div>
    <div id="empty"><b>Arrastra imágenes de obras al muro</b>, usa «Obra» o «De la lista…». Todas las medidas están en centímetros; las obras nuevas se colocan con el centro en el eje visual.</div>
    <div id="sin-muro" hidden><b>No hay ningún alzado todavía</b><p>Ábrelo desde la planta: en el panel de un muro, cada tramo tiene un botón ▭ que crea su alzado con el largo, la altura y los cuadros ya colocados.</p><p>O añade un muro suelto con «+ muro» en la barra superior.</p></div>
  </div>

  <aside id="md-panel">
    <details open id="iso-sec" hidden>
      <summary>Isométrica</summary>
      <div class="pb stack">
        <label class="f">Vista desde<select id="iso-lado"><option value="der">la derecha</option><option value="izq">la izquierda</option></select></label>
        <label class="f"><span>Giro del muro: <b class="out" id="iso-a-v"></b></span><input type="range" id="iso-a" min="0" max="45" step="1"></label>
        <label class="f"><span>Inclinación de la profundidad: <b class="out" id="iso-b-v"></b></span><input type="range" id="iso-b" min="15" max="60" step="1"></label>
        <div class="g3">
          <button class="pbtn" data-iso="30,30" title="Ejes a 120°">Isométrica</button>
          <button class="pbtn" data-iso="10,40" title="El muro casi de frente">Muro frontal</button>
          <button class="pbtn" data-iso="40,25" title="Muro más girado">Escorzo</button>
        </div>
        <div class="g2">
          <label class="f">Profundidad del piso (cm)<input id="iso-piso" type="number" min="20" step="10"></label>
          <label class="f">Grosor del muro (cm)<input id="iso-grosor" type="number" min="0" step="1"></label>
        </div>
        <label class="c"><input type="checkbox" id="iso-grid"> Cuadrícula del piso cada 50 cm</label>
        <p class="note">Vista de solo lectura: arrastra para desplazar, rueda con Ctrl/⌘ (o Alt) o pellizco para el zoom. Las obras se mueven en Alzado; la profundidad de obras y vanos y la distancia de las personas al muro se cambian en Selección.</p>
      </div>
    </details>

    <details open>
      <summary>Muro</summary>
      <div class="pb stack">
        <label class="f">Título<input id="w-title" type="text"></label>
        <div class="g2">
          <label class="f">Ancho (cm)<input id="w-w" type="number" min="1" step="1"></label>
          <label class="f">Alto (cm)<input id="w-h" type="number" min="1" step="1"></label>
          <label class="f">Eje visual (cm)<input id="w-eje" type="number" min="0" step="1" title="Altura del centro de las obras desde el piso"></label>
          <label class="f">Color<input id="w-color" type="color"></label>
        </div>
      </div>
    </details>

    <details open>
      <summary>Añadir</summary>
      <div class="pb g2">
        <button class="pbtn main" id="a-img" title="Añadir obras desde archivos de imagen">Obra</button>
        <button class="pbtn" id="a-blank" title="Obra sin imagen, solo con medidas">Obra sin imagen</button>
        <button class="pbtn" id="a-lista" title="Colocar en este muro una obra de la lista del proyecto">De la lista…</button>
        <button class="pbtn" id="a-vano" title="Puerta, ventana, enchufe, extintor u otro obstáculo">Vano</button>
        <button class="pbtn" id="a-persona" title="Figura humana de referencia; puedes añadir varias">Persona</button>
        <button class="pbtn" id="a-nota" title="Texto libre que se exporta con el plano. Con una obra seleccionada, la señala.">Nota</button>
      </div>
    </details>

    <details open>
      <summary>Selección</summary>
      <div class="pb" id="sel-body"></div>
    </details>

    <details open>
      <summary>Disposición</summary>
      <div class="pb stack">
        <label class="f">Alinear respecto a
          <select id="al-ref"><option value="sel">la selección</option><option value="wall">el muro</option></select>
        </label>
        <div class="g6" id="al-btns">
          <button class="pbtn ic" data-al="left" title="Alinear bordes izquierdos"><svg viewBox="0 0 18 18"><path d="M2 1v16" stroke="currentColor" stroke-width="1.4"/><rect x="4" y="4" width="10" height="3.5" fill="currentColor"/><rect x="4" y="10.5" width="6" height="3.5" fill="currentColor"/></svg></button>
          <button class="pbtn ic" data-al="hcenter" title="Alinear centros horizontales"><svg viewBox="0 0 18 18"><path d="M9 1v16" stroke="currentColor" stroke-width="1.4"/><rect x="3" y="4" width="12" height="3.5" fill="currentColor"/><rect x="5.5" y="10.5" width="7" height="3.5" fill="currentColor"/></svg></button>
          <button class="pbtn ic" data-al="right" title="Alinear bordes derechos"><svg viewBox="0 0 18 18"><path d="M16 1v16" stroke="currentColor" stroke-width="1.4"/><rect x="4" y="4" width="10" height="3.5" fill="currentColor"/><rect x="8" y="10.5" width="6" height="3.5" fill="currentColor"/></svg></button>
          <button class="pbtn ic" data-al="top" title="Alinear bordes superiores"><svg viewBox="0 0 18 18"><path d="M1 2h16" stroke="currentColor" stroke-width="1.4"/><rect x="4" y="4" width="3.5" height="10" fill="currentColor"/><rect x="10.5" y="4" width="3.5" height="6" fill="currentColor"/></svg></button>
          <button class="pbtn ic" data-al="vmiddle" title="Alinear centros verticales"><svg viewBox="0 0 18 18"><path d="M1 9h16" stroke="currentColor" stroke-width="1.4"/><rect x="4" y="3" width="3.5" height="12" fill="currentColor"/><rect x="10.5" y="5.5" width="3.5" height="7" fill="currentColor"/></svg></button>
          <button class="pbtn ic" data-al="bottom" title="Alinear bordes inferiores"><svg viewBox="0 0 18 18"><path d="M1 16h16" stroke="currentColor" stroke-width="1.4"/><rect x="4" y="4" width="3.5" height="10" fill="currentColor"/><rect x="10.5" y="8" width="3.5" height="6" fill="currentColor"/></svg></button>
        </div>
        <h4>Distribuir</h4>
        <div class="g2">
          <button class="pbtn" id="d-eqh" title="Misma separación horizontal entre la primera y la última (3 o más)">Igual ↔</button>
          <button class="pbtn" id="d-eqv" title="Misma separación vertical entre la primera y la última (3 o más)">Igual ↕</button>
        </div>
        <div class="row">
          <label class="f">Separación fija (cm)<input id="d-gap" type="number" min="0" step="0.5" value="10"></label>
          <button class="pbtn" id="d-gaph" title="Separar horizontalmente con la medida indicada">↔</button>
          <button class="pbtn" id="d-gapv" title="Separar verticalmente con la medida indicada">↕</button>
        </div>
        <h4>Centrar</h4>
        <div class="g2">
          <button class="pbtn" id="c-eye" title="Coloca el centro de cada obra seleccionada sobre el eje visual">En el eje visual</button>
          <button class="pbtn" id="c-wall" title="Centra el conjunto seleccionado a lo ancho del muro">Conjunto en muro</button>
        </div>
        <h4>Orden</h4>
        <div class="g2">
          <button class="pbtn" id="o-front" title="Traer al frente (Ctrl/⌘ Shift ])">Al frente</button>
          <button class="pbtn" id="o-back" title="Enviar al fondo (Ctrl/⌘ Shift [)">Al fondo</button>
        </div>
      </div>
    </details>

    <details open>
      <summary>Capas</summary>
      <div class="pb"><ul id="layers" aria-label="Elementos del muro"></ul><p class="note">Arriba en la lista es adelante en el muro. Los elementos bloqueados solo se seleccionan desde aquí.</p></div>
    </details>

    <details>
      <summary>Vista y ajustes</summary>
      <div class="pb stack">
        <label class="f">Ancho de las obras
          <select id="o-ancho"><option value="abajo">debajo de la obra</option><option value="arriba">encima de la obra</option></select>
        </label>
        <label class="f">Cotas
          <select id="o-cotas"><option value="sel">de la selección</option><option value="all">de todas las obras</option><option value="none">ocultas</option></select>
        </label>
        <label class="c"><input type="checkbox" id="o-eje"> Eje visual</label>
        <label class="c"><input type="checkbox" id="o-muro"> Tamaño del muro</label>
        <label class="c"><input type="checkbox" id="o-human"> Personas de referencia</label>
        <label class="c"><input type="checkbox" id="o-ojos"> Altura de ojos de las personas</label>
        <label class="c"><input type="checkbox" id="o-fichas"> Fichas bajo las obras</label>
        <p class="note">Añade personas desde «Añadir». Su estatura y figura se cambian en Selección o arrastrando sus esquinas superiores.</p>
        <h4>Cuadrícula y guías</h4>
        <label class="c"><input type="checkbox" id="o-grid"> Cuadrícula</label>
        <label class="f">Paso de cuadrícula (cm)<input id="o-gridstep" type="number" min="0.5" step="0.5"></label>
        <label class="c"><input type="checkbox" id="o-guides"> Guías <span class="muted small">(arrástralas desde las reglas)</span></label>
        <button class="pbtn" id="o-clearguides">Borrar guías</button>
        <h4>Ajustar a</h4>
        <label class="c"><input type="checkbox" id="s-obj"> Bordes y centros de obras y del muro</label>
        <label class="c"><input type="checkbox" id="s-guides"> Guías y eje visual</label>
        <label class="c"><input type="checkbox" id="s-grid"> Cuadrícula</label>
        <p class="note">Mantén Ctrl/⌘ mientras arrastras para mover sin ajuste.</p>
        <h4>Tamaño real</h4>
        <button class="pbtn" id="o-calib">Calibrar el 100 %</button>
      </div>
    </details>

    <details open>
      <summary>Exportar</summary>
      <div class="pb stack">
        <button class="pbtn main" id="f-export" title="Exportar el muro como PNG o SVG (Ctrl/⌘ E)">Exportar imagen…</button>
        <button class="pbtn" id="f-csv" title="Tabla con medidas, posición y altura de clavo de cada obra">Hoja de montaje (CSV)</button>
      </div>
    </details>
  </aside>
</div>

<footer id="md-status"><span id="st-pos"></span><span id="st-msg" role="status" aria-live="polite"></span></footer>

<input type="file" id="file-img" accept="image/*" multiple hidden>
<input type="file" id="file-replace" accept="image/*" hidden>

<dialog id="dlg-export">
  <div class="dh">Exportar imagen</div>
  <div class="db">
    <div class="prevbar"><span class="muted small">Vista previa: se actualiza con cada opción</span><button class="pbtn" id="ex-zoom">Ampliar</button></div>
    <div id="ex-prevwrap"><canvas id="ex-prev" aria-label="Vista previa de la exportación" title="Clic para ampliar o reducir"></canvas></div>
    <div class="g2">
      <label class="f">Formato<select id="ex-fmt"><option value="png">PNG</option><option value="svg">SVG (vectorial)</option></select></label>
      <label class="f">Resolución (px por cm)<input id="ex-pxcm" type="number" min="1" max="100" step="1"></label>
      <label class="f">Margen (cm)<input id="ex-margin" type="number" min="0" step="5"></label>
      <label class="f" title="Altura del texto de las cotas medida sobre el muro. No cambia con la resolución.">Texto de cotas (cm)<input id="ex-cota" type="number" min="0.5" max="50" step="0.5"></label>
      <label class="f">Cotas de<select id="ex-scope"><option value="all">todas las obras</option><option value="sel">la selección</option></select></label>
    </div>
    <div class="row">
      <label class="f">Encuadre<select id="ex-encuadre"><option value="todo">Todo el muro</option><option value="sel">Elementos seleccionados (más el margen)</option><option value="area">Área dibujada</option></select></label>
      <button class="pbtn" id="ex-drawarea" title="Cierra este diálogo para que arrastres un rectángulo sobre el lienzo">Dibujar área…</button>
    </div>
    <div class="presets"><span class="muted small">Preajustes:</span>
      <button class="pbtn" data-preset="montaje" title="Todo lo necesario para colgar: cotas, fichas, eje y medidas">Plano de montaje</button>
      <button class="pbtn" data-preset="presentacion" title="Obras, fichas y personas, sin cotas">Presentación</button>
      <button class="pbtn" data-preset="tecnico" title="Cotas y referencias sin imágenes de las obras">Técnico</button>
    </div>
    <div class="exgrid">
      <fieldset><legend>Cotas</legend>
        <label class="c"><input type="checkbox" data-ex="muro"> Tamaño del muro</label>
        <label class="c"><input type="checkbox" data-ex="dims"> Tamaño de las obras</label>
        <label class="f" style="margin:2px 0 4px 22px">Ancho<select id="ex-ancho"><option value="abajo">debajo de la obra</option><option value="arriba">encima de la obra</option></select></label>
        <label class="c"><input type="checkbox" data-ex="gaps"> Separaciones entre obras</label>
        <label class="c"><input type="checkbox" data-ex="bordes"> Distancias a los bordes y al piso</label>
        <label class="c"><input type="checkbox" data-ex="centro"> Altura del centro</label>
        <label class="c"><input type="checkbox" data-ex="lineas"> Líneas de cota <span class="muted small">(sin ellas quedan solo los números)</span></label>
        <label class="c"><input type="checkbox" data-ex="medidas"> Medidas hechas a mano</label>
      </fieldset>
      <fieldset><legend>Muro</legend>
        <label class="c"><input type="checkbox" data-ex="imagenes"> Imágenes de las obras</label>
        <label class="c"><input type="checkbox" data-ex="fichas"> Fichas <span class="muted small">(título, autor, año, técnica; se completan en Selección)</span></label>
        <label class="c"><input type="checkbox" data-ex="vanos"> Vanos</label>
        <label class="c"><input type="checkbox" data-ex="notas"> Notas</label>
        <label class="c"><input type="checkbox" data-ex="eje"> Eje visual</label>
        <label class="c"><input type="checkbox" data-ex="guias"> Guías</label>
        <label class="c"><input type="checkbox" data-ex="grid"> Cuadrícula</label>
      </fieldset>
      <fieldset><legend>Referencias</legend>
        <label class="c"><input type="checkbox" data-ex="human"> Personas</label>
        <label class="c"><input type="checkbox" data-ex="ojos"> Altura de ojos</label>
        <label class="c"><input type="checkbox" data-ex="escala"> Escala gráfica</label>
        <label class="c"><input type="checkbox" data-ex="rotulo"> Rótulo (título y medidas del muro)</label>
      </fieldset>
    </div>
    <p class="out small" id="ex-info"></p>
  </div>
  <div class="df"><button class="pbtn" id="ex-cancel">Cancelar</button><button class="pbtn main" id="ex-go">Exportar</button></div>
</dialog>

<dialog id="dlg-calib">
  <div class="dh">Calibrar el 100 %</div>
  <div class="db">
    <p style="margin:0">Apoya una tarjeta bancaria o un DNI (8,56 × 5,4 cm) sobre la pantalla y ajusta el control hasta que el recuadro tenga exactamente su tamaño.</p>
    <div id="calib-box"></div>
    <input type="range" id="calib-r" min="15" max="90" step="0.1" aria-label="Píxeles por centímetro">
    <p class="out small muted" id="calib-v"></p>
  </div>
  <div class="df"><button class="pbtn" id="calib-reset">Valor por defecto</button><button class="pbtn" id="calib-cancel">Cancelar</button><button class="pbtn main" id="calib-ok">Guardar</button></div>
</dialog>

<dialog id="dlg-lista">
  <div class="dh">Obras de la lista</div>
  <div class="db"><p class="muted small" style="margin:0">Clic en una obra para colocarla en este muro.</p><ul class="lista-obras"></ul></div>
  <div class="df"><button class="pbtn" id="lista-cancel">Cancelar</button></div>
</dialog>
<dialog id="dlg-help">
  <div class="dh">Atajos</div>
  <div class="db">
    <table class="keys">
      <tr><td>V · H · M</td><td>Mover · Mano · Medir</td></tr>
      <tr><td>Espacio + arrastrar</td><td>Desplazar la vista con cualquier herramienta</td></tr>
      <tr><td>Rueda / dos dedos</td><td>Desplazar la vista</td></tr>
      <tr><td>Ctrl/⌘ o Alt + rueda, pellizco</td><td>Zoom hacia el cursor</td></tr>
      <tr><td>Shift 1 · Ctrl/⌘ 0</td><td>Encajar el muro</td></tr>
      <tr><td>Shift 0</td><td>100 % (tamaño real)</td></tr>
      <tr><td>Shift 2</td><td>Centrar la vista en la selección</td></tr>
      <tr><td>Ctrl/⌘ + · −</td><td>Acercar · alejar</td></tr>
      <tr><td>Clic · Shift clic</td><td>Seleccionar · añadir o quitar de la selección</td></tr>
      <tr><td>Arrastrar en vacío</td><td>Selección por área</td></tr>
      <tr><td>Alt + arrastrar</td><td>Duplicar y mover</td></tr>
      <tr><td>Shift + arrastrar</td><td>Mover solo en horizontal o vertical</td></tr>
      <tr><td>Ctrl/⌘ + arrastrar</td><td>Mover sin ajuste</td></tr>
      <tr><td>Esquinas</td><td>Cambiar tamaño (Shift invierte la proporción fija)</td></tr>
      <tr><td>Exportar → Dibujar área</td><td>Arrastra un rectángulo para exportar solo esa zona; Esc cancela</td></tr>
      <tr><td>Shift A · Shift I</td><td>Vista en alzado · isométrica</td></tr>
      <tr><td>Personas</td><td>Se arrastran a lo largo del piso; sus esquinas superiores cambian la estatura</td></tr>
      <tr><td>Flechas</td><td>Mover 1 cm · Shift 10 cm · Alt 0,1 cm</td></tr>
      <tr><td>Ctrl/⌘ D</td><td>Duplicar</td></tr>
      <tr><td>Ctrl/⌘ A</td><td>Seleccionar todo</td></tr>
      <tr><td>Supr / ⌫</td><td>Eliminar selección</td></tr>
      <tr><td>Ctrl/⌘ ] · [</td><td>Subir · bajar un nivel (con Shift: al frente · al fondo)</td></tr>
      <tr><td>Ctrl/⌘ Z · Shift Z</td><td>Deshacer · rehacer</td></tr>
      <tr><td>Ctrl/⌘ E</td><td>Exportar este alzado</td></tr>
      <tr><td>Ctrl/⌘ S · O</td><td>Guardar el proyecto · abrir un .json (atajos de toda la app)</td></tr>
      <tr><td>Esc</td><td>Cancelar medida o quitar selección</td></tr>
      <tr><td>Reglas</td><td>Arrastra desde una regla para crear una guía; devuélvela a la regla para borrarla</td></tr>
    </table>
  </div>
  <div class="df"><button class="pbtn main" id="help-ok">Cerrar</button></div>
</dialog>
</div>
`;
