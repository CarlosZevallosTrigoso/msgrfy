# Auditoría de MuseoDraft (octubre 2026)

Revisión de todo el código en busca de errores y problemas de usabilidad, hecha por lectura sistemática de cada módulo y verificada con pruebas en Node (jsdom + fake-indexeddb). Nada de esto se ha comprobado aún en un navegador real: los puntos visuales (barras que se parten, foco) se dedujeron del CSS y del DOM.

## Corregido

### Bloqueantes
- **Duplicar un cuadro creaba una obra sin id** (`{ ...o, id: undefined }` pisaba el id generado): el duplicado quedaba sin ficha y la obra fantasma desaparecía al guardar. Los constructores del modelo ya no aceptan un id vacío.
- **El deshacer de la planta incluía `proyecto.obras`**: revertía títulos editados en el panel o en un muro y dejaba colgados apuntando a obras inexistentes. Ahora la instantánea solo lleva el dibujo (entidades, calco, rótulo); si vuelve un cuadro cuya obra ya no existe, se recrea una ficha vacía.
- **El HTML de lectura exportado desde `app.html` salía vacío**: la copia del documento (`__ORIGEN_HTML`) se tomaba en un `<script>` justo después de `<body>`, antes de que el navegador leyera el resto. Ahora va al final del body y el cascarón espera a `DOMContentLoaded` antes de montar.
- **Vista Muro, puente doc↔proyecto:**
  - una obra nueva perdía el nombre en el primer commit (título vacío «ganaba»);
  - Supr + Ctrl+Z duplicaba obras en el proyecto (el colgado se buscaba por id de ítem y al no existir se creaba otra obra). Cada ítem lleva ahora `obraId`;
  - lo editado en el panel Obras se revertía al siguiente commit del muro (el doc conservaba los valores viejos). Ahora los cambios del panel entran al doc (`obrasAlDoc`) sin tocar el historial;
  - entrar y salir de la pestaña escribía 0,5 × 0,7 m como medidas «reales» de obras sin medidas y disparaba un guardado sin cambios.
- **Vistas zombi**: al abrir otro proyecto o pulsar «Nuevo», las vistas anteriores conservaban sus listeners de teclado en `document`/`window` y seguían activas (Ctrl+S descargaba 3 archivos, Supr borraba en el proyecto viejo). Cada vista tiene `destruir()` y `desmontar()` las desactiva.

### Graves
- Ctrl+S lo gestionaban la vista y el cascarón: dos descargas por pulsación. Solo el cascarón.
- Tras «Editar» en un HTML de lectura, recargar volvía al modo lectura y perdía lo editado: ahora, si el almacén tiene el mismo proyecto (mismo `creado`) más reciente, se sigue con él.
- El confirm de «¿Reemplazar el proyecto?» solo contaba obras y entidades: un proyecto con solo muros o planos anotados se reemplazaba sin preguntar.
- Un proyecto del almacén que no pasaba la validación se descartaba en silencio y se sobrescribía: ahora se descarga como `museodraft-recuperado.json` y se avisa.
- Tras hacer clic en una pestaña el foco quedaba en el botón y las tres vistas ignoraban el teclado hasta pinchar el lienzo.
- `S.obraPendiente` («colocar en planta») sobrevivía a Esc o a cambiar de herramienta: el siguiente cuadro, quizá en otra sala, se ligaba a esa obra.
- En modo 3D seguían vivos todos los atajos de la planta (Supr borraba la pieza seleccionada bajo el 3D); `dblclick` y `drop` sobre el canvas llegaban al lienzo de debajo.
- Un mueble seleccionado no tenía marca de selección.
- PNG de la vista Lectura: sin el CSS de la página, los halos y zonas de clic salían como discos y cajas negras.
- El visor de lectura exportado aceptaba arrastrar archivos y mutaba el proyecto incrustado.
- `incorporar()` no remapeaba `destino` de los enlaces internos entre planos, `apunta` de las notas del muro ni la biblioteca propia; `desdeMuseoDraft` cambiaba el id de los colgados y las notas perdían su flecha.
- `validar()` descartaba en silencio todo plano anotado cuya sala o muro se hubiera borrado (con todas sus anotaciones); aceptaba ítems sin geometría y escalas sin referencia que rompían el render. Ahora conserva el plano (`base.perdida`, fondo vacío con aviso), filtra ítems por tipo y normaliza la escala.
- `limpiarImagenes` se llamaba desde las vistas tras borrar: el deshacer devolvía ítems, calcos y fichas con imágenes ya eliminadas. La limpieza solo se hace sobre una copia al guardar y serializar; `serializar` ya no muta el proyecto.
- `borrarObra` dejaba cuadros sin ficha en la planta aunque el confirm decía lo contrario; ahora los quita.
- Panel de obras: al confirmar una medida con Tab, el re-render destruía el campo y se perdía el foco; se restaura.
- Borrar un muro no avisaba de los planos de Lectura que lo usan de fondo; `refrescar()` del muro destruía el historial y los cambios pendientes.
- Barra superior y barra del 3D sin `flex-wrap`: en ventanas de ~1 000 px los mensajes se recortaban y los botones quedaban fuera. Ahora envuelven y el 3D mide la altura real de su barra.
- En pantallas estrechas el panel Obras (overlay) tapaba la planta al pulsar «colocar en planta»; se cierra solo.
- Estado vacío de Muro: sin muro se mostraba un «Muro A» ficticio editable; ahora una tarjeta explica cómo crear un alzado y los campos se deshabilitan.

### Menores
- Etiquetas del panel del muro en versales por una regla global; selectores CSS de Lectura y Muro sin prefijo que afectaban a toda la app (`outline:none` en todos los campos, `label.f select`, `#st-pos`); anillo de foco visible para teclado.
- `almacen.cargar()` resucitaba una copia vieja de `localStorage` aunque IndexedDB funcionara; `imagenes.js` rechazaba archivos sin tipo MIME (HEIC, algunos arrastres); `beforeunload` avisa si el guardado automático falló.
- Mensajes: alzado creado con `fmtNum`; lista de obras vacía en «De la lista…»; «colocar en planta» explica qué hace el segundo clic; colocar un mueble no lo selecciona (la biblioteca sigue visible) y dice cómo seguir.
- Un cuadro cuya obra se borró muestra «sin obra asociada» con botón «crear ficha»; campos deshabilitados.
- Ayudas con el nombre de las herramientas antiguas («plano-sala», «anotador-planos»); atajos de la app separados de los de la vista en la ayuda del Muro; Ctrl+O desactivado en modo lectura; `#brand` ya no recarga la página sin confirmar; `aria-pressed` en pestañas y botones de estado; lista de obras navegable con teclado y `label`/`for` en la ficha.
- Deshacer en la planta conserva la selección si la pieza sigue existiendo y cubre el tamaño de rótulos; el estado de inicio vuelve si se deshace «Crear sala»; `S.espacio` se resetea al cambiar de vista o perder el foco; el resalte del tramo se apaga al abrir el alzado; cambiar a una sala vacía con el 3D abierto lo cierra con aviso; «Rehacer» no queda habilitado con un commit pendiente.
- `detectar` no toma `{planos: []}` por un archivo de anotador; `validarSala` migra calcos antiguos con `src` incrustado al almacén de imágenes.

## Pendiente (decisiones de diseño, no errores)
- El alzado se liga al tramo por índice (`tramo.i`): insertar o borrar un vértice en ese muro de la planta desplaza los tramos y el botón ▭ abre otro alzado. Haría falta identificar el tramo por sus dos vértices.
- La barra del Muro sigue cargada (20 controles); los de gestión del muro cabrían en el panel.
- `planoActivo` de Lectura no se persiste.
- Las anotaciones de Lectura se anclan en píxeles de la imagen base, no en metros.
- Bajo 900 px el panel derecho de la planta se oculta sin alternativa.
- No hay cambios de rendimiento: la firma de caché de Lectura serializa la sala en cada render y el panel de obras se reconstruye entero con cada tecla.

## Pruebas
- `npm test`: 34 pruebas (modelo, puente, isométrica, biblioteca, build). Las nuevas cubren constructores con id vacío, `borrarObra`, `serializar` sin mutar, notas con `apunta`, `incorporar` con enlaces y biblioteca, planos con base perdida e ítems rotos, calcos antiguos y el orden de los `<script>` en `app.html`.
- Pruebas de humo con jsdom (fuera del repo): seis guiones que recorren planta, muro, lectura, 3D, biblioteca y, el último, los once flujos corregidos en esta auditoría.
