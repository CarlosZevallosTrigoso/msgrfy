// Marcado de la vista Lectura (se inyecta en el contenedor que da el cascarón)
export const MARKUP = `
<div id="ap">
<div id="ap-app">
  <header>
    <div id="ap-herramientas" role="toolbar" aria-label="Herramientas">
      <button data-tool="select" title="Seleccionar y mover (V)">↖<kbd>V</kbd></button>
      <button data-tool="marcador" title="Marcador numerado (M)">●<kbd>M</kbd></button>
      <button data-tool="texto" title="Texto (T)">T<kbd>T</kbd></button>
      <button data-tool="imagen" title="Imagen (I)">▣<kbd>I</kbd></button>
      <button data-tool="dimension" title="Cota: dos clics (D)">⟷<kbd>D</kbd></button>
      <button data-tool="poligono" title="Polígono con área: clics, doble clic o Enter para cerrar (P)">⬠<kbd>P</kbd></button>
      <button data-tool="zona" title="Zona rectangular: arrastrar (Z)">▭<kbd>Z</kbd></button>
      <button data-tool="medir" title="Medir sin anotar (X)">⟟<kbd>X</kbd></button>
      <button data-tool="calibrar" title="Calibrar escala: dos clics sobre una medida conocida (C)">⊢<kbd>C</kbd></button>
    </div>
    <div id="ap-acciones">
      <span id="ap-accionesEditor" style="display:flex;gap:4px">
        <button id="ap-btnDeshacer" title="Deshacer (Ctrl+Z)">↶</button>
        <button id="ap-btnRehacer" title="Rehacer (Ctrl+Y)">↷</button>
        <button id="ap-btnExportHtml" title="Exportar HTML de lectura con enlaces">HTML</button>
        <button id="ap-btnExportPng" title="Exportar PNG del plano activo">PNG</button>
        <button id="ap-btnExportCsv" title="Exportar CSV de medidas y áreas">CSV</button>
      </span>
      <button id="ap-btnEditar" class="soloLectura" title="Pasar a modo edición">Editar</button>
      <button id="ap-btnAjustar" title="Ajustar a la ventana (0)">⤢</button>
      <button id="ap-btnAyuda" title="Ayuda (?)">?</button>
    </div>
  </header>

  <aside id="ap-izquierda">
    <h2>Planos <span><button id="ap-btnPlano" title="Añadir plano desde una imagen">+ imagen</button> <button id="ap-btnPlanoSala" title="Añadir la planta de una sala del proyecto">+ planta</button> <button id="ap-btnPlanoMuro" title="Añadir el alzado de un muro del proyecto">+ muro</button> <button id="ap-btnPlanoIso" title="Añadir la vista 3D de una sala, con el giro guardado en la planta">+ 3D</button></span></h2>
    <ul id="ap-listaPlanos" class="lista"></ul>
    <h2>Capas <button id="ap-btnCapa" title="Nueva capa">+</button></h2>
    <ul id="ap-listaCapas" class="lista"></ul>
    <h2>Escala</h2>
    <div id="ap-infoEscala" class="dato"></div>
  </aside>

  <div id="ap-lienzo" data-tool="select">
    <svg id="ap-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 100 100"></svg>
    <div id="ap-tabsPlanos"></div>
    <div id="ap-vacioLienzo"><b>Sin plano</b><span>Arrastra una imagen aquí, o añade una planta o un muro del proyecto</span></div>
    <div id="ap-barraEscala"><span class="texto"></span><div class="linea"></div></div>
    <div id="ap-medida"></div>
    <div id="ap-ayuda">
      <h3>Lectura · planos anotados</h3>
      <table>
        <tr><td><kbd>V</kbd></td><td>Seleccionar / mover. Arrastrar el fondo desplaza la vista; rueda = zoom.</td></tr>
        <tr><td><kbd>M</kbd></td><td>Marcador numerado. Puede llevar nota y enlace.</td></tr>
        <tr><td><kbd>T</kbd></td><td>Texto sobre el plano (escala con el zoom).</td></tr>
        <tr><td><kbd>I</kbd></td><td>Imagen incrustada; clic para situarla.</td></tr>
        <tr><td><kbd>D</kbd></td><td>Cota: dos clics. Muestra la longitud real si hay calibración.</td></tr>
        <tr><td><kbd>P</kbd></td><td>Polígono: clics, doble clic o <kbd>Enter</kbd> para cerrar. Muestra el área.</td></tr>
        <tr><td><kbd>Z</kbd></td><td>Zona rectangular: arrastrar. Muestra el área.</td></tr>
        <tr><td><kbd>X</kbd></td><td>Medir sin crear anotación.</td></tr>
        <tr><td><kbd>C</kbd></td><td>Calibrar: dos clics sobre una longitud conocida y escribe los metros.</td></tr>
        <tr><td><kbd>Supr</kbd></td><td>Borrar seleccionado. <kbd>Esc</kbd> cancela. <kbd>Ctrl+Z</kbd>/<kbd>Y</kbd> deshacer/rehacer. <kbd>0</kbd> ajustar vista. <kbd>+</kbd>/<kbd>−</kbd> zoom.</td></tr>
      </table>
      <p>Los planos pueden ser imágenes sueltas o las plantas y muros del propio proyecto (se redibujan a partir de él, ya a escala). «HTML» produce la app entera en modo lectura, con el proyecto incrustado y los enlaces activos; desde ahí «Editar» vuelve a abrir el editor.</p>
      <p><button id="ap-btnCerrarAyuda">Cerrar</button></p>
    </div>
  </div>

  <aside id="ap-derecha">
    <h2>Anotaciones</h2>
    <ul id="ap-listaItems" class="lista"></ul>
    <h2 class="soloEditor">Propiedades</h2>
    <div id="ap-props" class="props"></div>
  </aside>

  <footer>
    <span id="ap-coords"></span>
    <span id="ap-zoomInfo"></span>
    <span id="ap-msg"></span>
  </footer>
</div>
<input type="file" id="ap-filePlano" accept="image/*">
<input type="file" id="ap-fileImagen" accept="image/*">
</div>
`;
