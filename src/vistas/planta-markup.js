// Marcado de la vista Planta (se inyecta en el contenedor que da el cascarón)
export const MARKUP = `
<div id="ps">
  <header>
    <label class="inline" for="selSala">sala</label>
    <select id="selSala" aria-label="Sala"></select>
    <button id="bSalaNombre" title="Renombrar la sala">✎</button>
    <button id="bSalaNueva" title="Añadir otra sala al proyecto">+ sala</button>
    <button id="bSalaBorrar" class="peligro" title="Borrar esta sala">×</button>
    <div id="acciones">
      <button id="bDeshacer" title="Deshacer (Ctrl+Z)">↶</button>
      <button id="bRehacer" title="Rehacer (Ctrl+Y)">↷</button>
      <span class="sep"></span>
      <button id="bAjustar" title="Ver todo el plano (0)">⤢ ver todo</button>
      <span class="sep"></span>
      <button id="bExportar" class="primario" title="Descargar el plano como SVG a escala o PNG">Exportar</button>
      <button id="bAyuda" title="Ayuda (?)">?</button>
    </div>
  </header>

  <nav id="herramientas" role="toolbar" aria-label="Herramientas">
    <button data-tool="select" title="Seleccionar y mover (V)"><span class="ic">↖</span><span class="tx">Elegir</span><kbd>V</kbd></button>
    <div class="grupo">dibujar</div>
    <button data-tool="linea" title="Muro o línea: clic punto a punto (L)"><span class="ic">╱</span><span class="tx">Muro</span><kbd>L</kbd></button>
    <button data-tool="rect" title="Rectángulo: panel, vitrina, tarima (R)"><span class="ic">▭</span><span class="tx">Rectángulo</span><kbd>R</kbd></button>
    <button data-tool="circulo" title="Círculo: columna, pedestal (O)"><span class="ic">◯</span><span class="tx">Círculo</span><kbd>O</kbd></button>
    <button data-tool="puerta" title="Puerta: dos clics sobre el muro (P)"><span class="ic">◜</span><span class="tx">Puerta</span><kbd>P</kbd></button>
    <button data-tool="ventana" title="Ventana: dos clics sobre el muro (N)"><span class="ic">▥</span><span class="tx">Ventana</span><kbd>N</kbd></button>
    <div class="grupo">obras</div>
    <button data-tool="cuadro" title="Cuadro: dos clics sobre el muro donde cuelga (C)"><span class="ic">▬</span><span class="tx">Cuadro</span><kbd>C</kbd></button>
    <button data-tool="obra" title="Obra en planta: lazo poligonal (B)"><span class="ic">⬠</span><span class="tx">Obra</span><kbd>B</kbd></button>
    <button data-tool="proyeccion" title="Proyección: imagen sobre el muro y lugar del proyector (Y)"><span class="ic">◭</span><span class="tx">Proyección</span><kbd>Y</kbd></button>
    <button data-tool="region" title="Región o núcleo curatorial: lazo poligonal (G)"><span class="ic">⬚</span><span class="tx">Región</span><kbd>G</kbd></button>
    <div class="grupo">anotar</div>
    <button data-tool="texto" title="Texto (T)"><span class="ic">T</span><span class="tx">Texto</span><kbd>T</kbd></button>
    <button data-tool="cota" title="Cota de medida (D)"><span class="ic">↔</span><span class="tx">Cota</span><kbd>D</kbd></button>
    <div class="grupo">calco</div>
    <button id="bCalcoNav" title="Subir una imagen para dibujar encima"><span class="ic">▤</span><span class="tx">Calcar</span><span></span></button>
  </nav>

  <div id="lienzo">
    <svg id="svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 100 100">
      <defs id="defsRejilla"></defs>
      <g id="capaRejilla"></g>
      <g id="capaCalco"></g>
      <g id="capaDibujo"></g>
      <g id="capaSel"></g>
      <g id="capaDraft"></g>
    </svg>
    <div id="guia"><span class="paso"></span><span class="txt"></span><button id="bGuiaCerrar">entendido</button></div>
    <div id="barraEscala"><span class="t"></span><div class="l"></div></div>
    <div id="flotante"></div>
    <div id="inicio">
      <div class="tarjeta">
        <h1>Empieza tu plano de sala</h1>
        <p class="sub">Todo se mide en metros. Puedes cambiar cualquier medida después.</p>
        <div class="opcion">
          <h2>Sala rectangular</h2>
          <p>Escribe el ancho y el largo; el contorno aparece con sus medidas.</p>
          <div class="fila">
            <input id="iAncho" type="text" inputmode="decimal" value="8" aria-label="Ancho en metros"> <span>m ×</span>
            <input id="iLargo" type="text" inputmode="decimal" value="5" aria-label="Largo en metros"> <span>m</span>
            <button id="bCrearSala" class="primario">Crear sala</button>
          </div>
        </div>
        <div class="opcion">
          <h2>Calcar desde una imagen</h2>
          <p>Sube un plano, un croquis o una foto cenital. Marcas una medida que conozcas y dibujas encima con papel de cebolla.</p>
          <button id="bCalcoInicio" class="primario">Subir imagen…</button>
        </div>
        <div class="pie">
          <button id="bBlanco">Empezar en blanco</button>
        </div>
      </div>
    </div>
  </div>

  <aside id="panel"></aside>

  <footer>
    <span id="pista"></span>
    <span id="pistaBtns"></span>
    <span id="msg"></span>
    <span id="coords"></span>
    <span id="zoomInfo"></span>
  </footer>
</div>

<div id="exportar" class="modal" role="dialog" aria-label="Exportar">
  <div class="caja">
    <h2>Exportar plano</h2>
    <label>formato</label>
    <div class="seg" id="exFormato">
      <button data-v="svg" class="activo">SVG a escala</button>
      <button data-v="png">PNG imagen</button>
    </div>
    <div id="exOpSvg">
      <label>escala de impresión</label>
      <select id="exEscala"></select>
      <div class="dato" id="exPapel"></div>
    </div>
    <div id="exOpPng" style="display:none">
      <label>ancho de la imagen</label>
      <select id="exAncho"><option value="1600">1600 px</option><option value="3000" selected>3000 px</option><option value="5000">5000 px</option></select>
    </div>
    <label class="check"><input type="checkbox" id="exTitulo" checked> nombre de la sala</label>
    <label class="check"><input type="checkbox" id="exBarra" checked> barra de escala</label>
    <label class="check" id="exCalcoFila"><input type="checkbox" id="exCalco"> incluir la imagen de calco</label>
    <p class="nota">El SVG lleva medidas reales en milímetros: al imprimirlo al 100 % (sin «ajustar a la página») respeta la escala. Ábrelo en el navegador, Inkscape o Illustrator.</p>
    <div class="btns"><button id="exDescargar" class="primario">Descargar</button><button id="exObras">Lista de obras (CSV)</button><button id="exCancelar">Cancelar</button></div>
  </div>
</div>

<div id="ayuda" class="modal" role="dialog" aria-label="Ayuda">
  <div class="caja">
    <h2>plano-sala</h2>
    <table>
      <tr><td><kbd>V</kbd> Elegir</td><td>Clic para seleccionar; arrastrar para mover. Con un muro seleccionado, arrastra sus puntos naranjas; doble clic sobre un tramo añade un punto; <kbd>Supr</kbd> borra el punto marcado o el elemento.</td></tr>
      <tr><td><kbd>L</kbd> Muro</td><td>Clic punto a punto. Mientras dibujas, <b>escribe una medida</b> (por ejemplo <kbd>3,4</kbd>) y <kbd>⏎</kbd>: el tramo sale exacto en la dirección del cursor. Clic en el primer punto cierra la figura. Doble clic o <kbd>⏎</kbd> termina. <kbd>⌫</kbd> quita el último punto.</td></tr>
      <tr><td><kbd>R</kbd> Rectángulo</td><td>Dos esquinas (clic-clic o arrastrar). Medida exacta: escribe <kbd>3x2</kbd> y <kbd>⏎</kbd>.</td></tr>
      <tr><td><kbd>O</kbd> Círculo</td><td>Centro y borde. Escribe el diámetro y <kbd>⏎</kbd>.</td></tr>
      <tr><td><kbd>P</kbd> Puerta</td><td>Dos clics sobre el muro, en los extremos del vano. En el panel, «Cambiar giro» rota la hoja.</td></tr>
      <tr><td><kbd>N</kbd> Ventana</td><td>Dos clics sobre el muro, en los extremos de la ventana. En el panel ajustas el ancho y el espesor del muro.</td></tr>
      <tr><td><kbd>C</kbd> Cuadro</td><td>Dos clics sobre el muro o panel donde cuelga (o escribe el ancho y ⏎). Queda adosado, hacia dentro de la sala, con su número. «Cambiar de cara» lo pasa al otro lado.</td></tr>
      <tr><td><kbd>B</kbd> Obra</td><td>Lazo poligonal para esculturas, instalaciones o vitrinas: clic punto a punto y cierra en el primer punto, con doble clic o <kbd>⏎</kbd>. Ficha en el panel.</td></tr>
      <tr><td><kbd>Y</kbd> Proyección</td><td>Dos clics marcan el ancho de la imagen sobre el muro o la pantalla; el tercero, la lente del proyector (o escribe la distancia y <kbd>⏎</kbd>). En el panel: formato, ancho y alto de imagen, distancia, relación de tiro y tamaño del cuerpo. Escribe el tiro de tu proyector y se coloca a la distancia justa.</td></tr>
      <tr><td><kbd>G</kbd> Región</td><td>Lazo poligonal para un núcleo o zona curatorial. Muestra su nombre y cuántas obras caen dentro.</td></tr>
      <tr><td>Lista</td><td>Sin nada elegido, el panel lista las obras; clic en una para ir a ella. «Lista de obras (CSV)» descarga la checklist de montaje.</td></tr>
      <tr><td><kbd>T</kbd> Texto</td><td>Clic y escribe en el panel derecho.</td></tr>
      <tr><td><kbd>D</kbd> Cota</td><td>Primer punto, segundo punto, y un tercer clic para separarla del muro. Después, cada clic encadena otra medida en la misma línea; <kbd>⏎</kbd> o <kbd>Esc</kbd> termina. En el panel puedes mostrar el total.</td></tr>
      <tr><td>Rótulos</td><td>Las medidas, alturas y números se colocan solos donde no chocan con otros rótulos, muros, cuadros ni obras. Con «Elegir» puedes arrastrar cualquiera; sigue a su muro si este se mueve. Doble clic sobre un rótulo movido lo devuelve a su sitio automático.</td></tr>
      <tr><td>Altura</td><td>Con un muro elegido, escribe su altura en el panel; aparece como «h 3,20 m» por el otro lado del muro. Si un tramo es distinto, escribe su alto en la tabla de tramos.</td></tr>
      <tr><td>Espesor</td><td>Con un muro elegido, escribe su espesor en el panel. La línea que dibujaste es la cara interior y el espesor crece hacia fuera (puedes cambiarlo). Puertas y ventanas cortan el muro completo.</td></tr>
      <tr><td>Calcar</td><td>Sube una imagen, marca dos puntos de una medida conocida y escribe los metros. La imagen queda a escala debajo del dibujo; regula su opacidad en el panel.</td></tr>
      <tr><td><kbd>Shift</kbd></td><td>Al dibujar, fija ángulos de 15° (horizontal, vertical, 45°…).</td></tr>
      <tr><td><kbd>Alt</kbd></td><td>Desactiva el imán mientras lo mantienes.</td></tr>
      <tr><td>Vista</td><td>Rueda: acercar. Arrastrar el fondo (en Elegir), botón central, o <kbd>Espacio</kbd> + arrastrar: desplazar. <kbd>0</kbd> ver todo.</td></tr>
      <tr><td>Otros</td><td><kbd>Ctrl+Z</kbd>/<kbd>Ctrl+Y</kbd> deshacer/rehacer · <kbd>Ctrl+D</kbd> duplicar · flechas: mover lo seleccionado · <kbd>Esc</kbd> cancela.</td></tr>
    </table>
    <p>El proyecto se guarda solo en este navegador. «Guardar» en la barra superior descarga un .json con todo: salas, obras, muros e imágenes.</p>
    <div class="btns"><button id="bCerrarAyuda">Cerrar</button></div>
  </div>
</div>

<input type="file" id="fCalco" accept="image/*">
`;
