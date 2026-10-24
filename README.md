# MuseoDraft

Diseñador de planos para proyectos curatoriales: planta de sala, alzados de muro con hoja de montaje, y planos anotados navegables. Web, ligero, sin servidor ni cuentas. Vive en GitHub Pages.

Unifica tres herramientas que antes eran archivos sueltos (plano-sala, MuseoDraft, anotador-planos) sobre un solo proyecto, para no escribir las obras y los muros dos veces.

## Estado

- **Fase 1 (hecha):** modelo de datos, validación e importadores de los tres formatos anteriores, con tests.
- **Fase 2 (hecha):** `index.html` es la app nueva: cascarón con pestañas, lista de obras, Planta sobre el proyecto (varias salas), guardado automático en IndexedDB, abrir/guardar .json e importación de los archivos antiguos.
- **Fase 3 (hecha):** vista Muro (la mesa de montaje de MuseoDraft) sobre el proyecto, conectada a la planta: desde un tramo de muro se abre su alzado con el ancho, el alto y los cuadros ya colocados; las obras se pueden colgar también desde la lista.
- **Fase 4 (hecha):** vista Lectura (el anotador) sobre imágenes o sobre las plantas y muros del propio proyecto, redibujados a escala; `app.html` de un solo archivo; exportación de HTML de lectura autocontenido.

- **Modo 3D (hecho):** la sala en axonometría con giro libre e inclinación, al estilo de Los Sims: los muros que dan la espalda a la cámara se cortan a un zócalo, se vuelven transparentes o se dejan enteros. Cuadros con su colgado, obras en planta y columnas con su alto, proyectores con su haz. Exporta PNG y SVG y entra en Lectura como base («+ 3D»).

- **Puntos de vista (hecho):** vistas guardadas de la cámara 3D con nombre, y perspectiva real desde los ojos de una figura colocada en la planta (persona, silla de ruedas, niño), con cono de visión, exportación y entrada en Lectura.

- **Biblioteca de objetos (hecha):** mobiliario museográfico con medidas reales (pedestales, vitrinas, paneles, bancas, señalética, técnica, figuras de referencia) que se coloca en la planta con un clic, se ajusta y se guarda en una biblioteca propia exportable; aparece en el 3D y en la lista de materiales.

- **Auditoría (hecha):** revisión completa de errores y usabilidad: puente planta↔muro sin pérdida de datos al deshacer, deshacer de la planta que no toca las fichas compartidas, HTML de lectura exportable desde `app.html`, planos anotados que sobreviven al borrado de su sala o muro, atajos únicos por app, estados vacíos y foco. Detalle en `AUDITORIA.md`.

Las cuatro fases del plan están hechas, más el modo 3D, la biblioteca y la auditoría. La mesa de montaje anterior sigue intacta en `legacy/museodraft.html`.

Dos formas de abrir la app:
- `index.html` en GitHub Pages (o cualquier servidor; en local, `python3 -m http.server`). Usa módulos ES, así que con doble clic desde el disco se queda en blanco.
- `app.html`: todo en un archivo, se abre con doble clic y se puede mandar por correo. Se genera con `npm run build` y conviene regenerarlo antes de publicar; `npm test` lo regenera también.

El botón «HTML» de la vista Lectura produce una copia de `app.html` con el proyecto incrustado en modo lectura: solo la vista Lectura, enlaces activos, sin guardar nada en el navegador de quien la abre. «Editar» la convierte en el editor completo. Desde `index.html` esa exportación descarga `app.html` del mismo sitio, así que hay que tenerlo publicado.

## Estructura

```
index.html             cascarón: barra, pestañas, panel de obras
legacy/museodraft.html copia fija de la herramienta anterior
src/core/              sin DOM, probado en Node
  unidades.js          metros ↔ centímetros, formato numérico en español
  modelo.js            esquema v3, validación, importar/incorporar los .json antiguos
  planta.js            geometría y render SVG de la planta (de plano-sala)
  muro.js              geometría, cotas y pintores del alzado (de MuseoDraft)
  puente.js            planta → muro; SVG a escala de una sala o un muro; documento de la vista Muro
  anotacion.js         geometría del anotador (de anotador-planos)
  isometrica.js        modo 3D: proyección con giro libre, escena por piezas, corte de muros, pintado, vistas guardadas
  perspectiva.js       perspectiva desde los ojos de una figura: proyector, recorte al plano cercano, imágenes por celdas
  biblioteca.js        catálogo de mobiliario, huella y cajas 3D de un mueble, lista de materiales
src/vistas/
  planta.js            vista Planta (de plano-sala, sobre una sala del proyecto)
  planta-markup.js     su marcado
  muro.js              vista Muro (de MuseoDraft, sobre un muro del proyecto; trabaja en cm y vuelca en m)
  muro-markup.js       su marcado
  lectura.js           vista Lectura (de anotador-planos, sobre las anotaciones del proyecto)
  lectura-markup.js    su marcado
  isometrica.js        modo 3D de la planta: canvas, arrastrar para girar e inclinar, exportación
build/concatenar.js    produce app.html (resuelve los import/export y los incrusta con el CSS)
app.html               generado
src/ui/
  cascaron.js          arranque, pestañas, abrir/guardar, reparto del proyecto a las vistas
  obras.js             panel de obras
  almacen.js           IndexedDB (localStorage de emergencia)
  imagenes.js          lectura y reducción de imágenes
  estilo.css           sistema visual, una sola vez
test/                  node --test (sin dependencias)
```

### Cómo se conectan obras y planta

Las entidades `cuadro` y `obra` de la planta llevan `obraId` y no guardan ficha. Al dibujar un cuadro se crea una obra en la lista con el ancho del tramo; si antes se eligió una obra en el panel («colocar en planta»), se usa esa y el cuadro toma el ancho de su ficha. Borrar un cuadro de la planta no borra la obra: queda «sin colocar». Borrar la obra desde el panel sí quita sus cuadros de la planta y sus colgados de los muros. El título, autor y medidas se editan en cualquiera de los dos sitios y son el mismo dato; por eso el deshacer de la planta solo cubre el dibujo (entidades, calco, rótulos), nunca las fichas.

### Cómo se conectan planta y muro

En el panel de un muro de la planta, cada tramo tiene un botón ▭ que abre su alzado en la vista Muro. Si no existe, se crea con el largo del tramo, su altura y los cuadros que cuelgan de la cara interior, colocados desde la izquierda tal como se ven desde dentro de la sala, centrados en el eje visual. A las obras sin alto conocido se les asigna uno estimado (≈). El alzado queda ligado al tramo (`muro.tramo = {entidadId, i, cara}`), así que el botón vuelve a abrir el mismo muro.

La vista Muro guarda posición, marco, caída y demás en `muro.colgado[]` y las medidas y la ficha en la obra compartida: cambiar un ancho en el muro cambia la ficha que ve la planta, y al revés (lo que se edita en el panel Obras entra al alzado sin perder su historial). Cada ítem del alzado lleva `obraId`, así que deshacer y rehacer no crean obras duplicadas. Una obra sin medidas se dibuja con 0,5 × 0,7 m de relleno, pero sigue «sin medidas» hasta que alguien escribe una. Lo que se añade en el muro (vanos, personas, notas, medidas) vive solo en el muro. Mover un cuadro en la planta después de crear el alzado no lo mueve en el muro: son dos decisiones distintas (dónde va en la sala, cómo cuelga).

### Modo 3D

Botón «3D» (o tecla 3) en la planta. Proyección: la planta se gira θ grados y se mira con elevación φ: `X = x'`, `Y = y'·sen φ − z·cos φ`; las paralelas siguen paralelas. Cada tramo de muro se trocea en rebanadas de 0,5 m con profundidad propia y todo se pinta de lejos a cerca (orden de pintor); un muro de contorno cuya cara interior da la espalda a la cámara es «de frente» y se corta al zócalo, se vuelve transparente o se deja entero según la opción. Las obras en planta y las columnas toman su alto del campo «alto en 3D» de su ficha (1 m y la altura del muro por defecto); los cuadros, el colgado del alzado del tramo si existe, y si no quedan centrados en el eje visual a 1,50 m. No hay ocultación real entre objetos que se atraviesan ni perspectiva. La cámara se guarda en la sala (`sala.iso`).

**Puntos de vista.** «＋ vista» guarda la cámara y el encuadre actuales con un nombre («desde la entrada», «vista general») en `sala.iso.vistas[]`; el selector de la barra y PgUp/PgDn los recorren, PNG y SVG llevan el nombre de la vista en el archivo, y «+ 3D» en Lectura pregunta cuál usar como fondo. El encuadre se guarda relativo al encaje (factor de zoom y punto central proyectado), así que se reproduce igual en otra pantalla; las exportaciones y la base de Lectura usan la cámara completa de la escena, no el recorte.

**Desde los ojos de una figura.** Las figuras de referencia de la biblioteca (persona, silla de ruedas, niño) son puntos de vista: en su ficha se fija hacia dónde miran (`mira`, grados en planta; Shift+R gira 45°), la altura de ojos (`ojos`: 1,60 / 1,20 / 1,10 m por defecto) y el campo visual (`fov`, 60°); la planta dibuja su cono. «Ver desde sus ojos», o el selector «ojos de» del 3D, pasan a perspectiva: arrastrar mira alrededor (gira la mirada y el cabeceo, que se guardan en la figura), la rueda abre o cierra el campo, PNG/SVG exportan esa vista, y «+ 3D» en Lectura la ofrece como fondo (sigue a la figura si se mueve). La escena es la misma del modo axonométrico (`isometrica.escena` con otro proyector, `perspectiva.proyectorPov`): cada cara conserva su geometría 3D, se recorta contra un plano cercano a 0,25 m y se pinta de lejos a cerca. Lo que no hace: oclusión exacta cuando dos piezas se cruzan cerca del ojo (orden de pintor), iluminación, texturas; las imágenes de las obras se proyectan por celdas afines (6 por lado), no con una homografía exacta; los vanos se pintan como huecos blancos, no se ve el piso a través de una puerta.

### Biblioteca de objetos

Entidad `mueble` en la planta: `{ x, y (centro), l, a, h, rot, forma: 'caja'|'cilindro', nombre, cat, color, dz (elevación), partes? }`. `partes` son cajas relativas al centro de la base para objetos compuestos (una vitrina es base opaca + caja de cristal); al cambiar largo, ancho o alto se escalan. El catálogo base está en `src/core/biblioteca.js`; la biblioteca propia vive en `proyecto.biblioteca[]` y se intercambia como `.json` (`{ app:'museodraft-biblioteca', objetos:[…] }`). Todo son prismas y cilindros: no hay modelos 3D ni catálogos de fabricante.

### Cómo se conecta la lectura con el resto

Un plano anotado tiene una base: una imagen suelta, o una sala o un muro del proyecto. Las bases «sala» y «muro» se redibujan a partir del proyecto cada vez que se abren (la planta a 2400 px de ancho, el alzado a 8 px/cm, o menos si no cabe en 16 Mpx), ya con la escala puesta, así que no hay que calibrar. Las anotaciones se guardan en píxeles de esa imagen: si después la planta crece mucho (otra sala al lado, por ejemplo), el dibujo se reencuadra y los marcadores pueden quedar desplazados; para planos cerrados es más seguro anotar al final. Si la sala o el muro de base se borran, el plano se conserva con sus anotaciones sobre un fondo vacío (`base.perdida`).

## Modelo (versión 3)

Todas las longitudes en metros. La obra existe una sola vez; planta y alzados la referencian por `obraId`.

```
proyecto { app:'museodraft', version:3, nombre, creado, modificado,
  obras[]        { id, nombre, autor, anio, tecnica, inv, nota,
                   ancho, alto (m o null), estimado:{ancho,alto}, imagenId, imgRatio }
  salas[]        { id, nombre, rotulo, rejilla, imanes, calco, iso, entidades[] }
                   entidades en el formato de plano-sala; cuadro y obra en planta llevan obraId
  muros[]        { id, nombre, salaId, tramo:{entidadId,i}|null, ancho, alto, eje, grosor, color,
                   colgado[] { id, obraId, x, y, marco, pp, prof, caida, rot, lock, bloqueado, oculto },
                   otros[] (vanos, personas, medidas, notas en el formato de MuseoDraft, en m),
                   guias:{v,h}, opts }
  anotaciones[]  { id, nombre, base, escala, capas[], capaActiva, items[] }
                   base: {tipo:'imagen', imagenId, w, h} | {tipo:'sala', salaId} | {tipo:'muro', muroId} | {tipo:'iso', salaId, cam} | {tipo:'pov', salaId, figuraId}
                   items en el formato de anotador-planos (px de la imagen base); las imágenes incrustadas por imagenId
  imagenes{}     id → dataURL (las huérfanas se quitan al guardar, nunca en memoria: el deshacer puede necesitarlas)
  biblioteca[]   objetos propios de mobiliario }
```

`importar(json)` acepta un proyecto v3 o un .json de plano-sala, MuseoDraft 2 o anotador-planos y devuelve `{ proyecto, origen }`. `incorporar(proyecto, json)` añade lo que trae otro archivo regenerando ids. MuseoDraft 1 no se importa: ábrelo en `legacy/museodraft.html`, guárdalo y vuelve a importar.

## Desarrollo

```
npm test        # node --test, sin instalar nada
```

```
npm run build   # regenera app.html
```

Sin dependencias ni empaquetador: módulos ES nativos y un concatenador propio de 60 líneas. Limitaciones del concatenador, a propósito: solo `import { a } from`, `import * as X from`, `export const/function/class` y `export default`; nada de re-exports ni import dinámico.
