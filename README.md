# MuseoDraft

Diseñador de planos para proyectos curatoriales: planta de sala, alzados de muro con hoja de montaje, y planos anotados navegables. Web, ligero, sin servidor ni cuentas. Vive en GitHub Pages.

Unifica tres herramientas que antes eran archivos sueltos (plano-sala, MuseoDraft, anotador-planos) sobre un solo proyecto, para no escribir las obras y los muros dos veces.

## Estado

- **Fase 1 (hecha):** modelo de datos, validación e importadores de los tres formatos anteriores, con tests.
- **Fase 2 (hecha):** `index.html` es la app nueva: cascarón con pestañas, lista de obras, Planta sobre el proyecto (varias salas), guardado automático en IndexedDB, abrir/guardar .json e importación de los archivos antiguos.
- **Fase 3 (hecha):** vista Muro (la mesa de montaje de MuseoDraft) sobre el proyecto, conectada a la planta: desde un tramo de muro se abre su alzado con el ancho, el alto y los cuadros ya colocados; las obras se pueden colgar también desde la lista.
- **Fase 4 (hecha):** vista Lectura (el anotador) sobre imágenes o sobre las plantas y muros del propio proyecto, redibujados a escala; `app.html` de un solo archivo; exportación de HTML de lectura autocontenido.

Las cuatro fases del plan están hechas. La mesa de montaje anterior sigue intacta en `legacy/museodraft.html`.

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
  puente.js            planta → muro: alzado de un tramo con sus cuadros colocados
  anotacion.js         geometría del anotador (de anotador-planos)
  puente.js            planta → muro; SVG a escala de una sala o un muro; documento de la vista Muro
src/vistas/
  planta.js            vista Planta (de plano-sala, sobre una sala del proyecto)
  planta-markup.js     su marcado
  muro.js              vista Muro (de MuseoDraft, sobre un muro del proyecto; trabaja en cm y vuelca en m)
  muro-markup.js       su marcado
  lectura.js           vista Lectura (de anotador-planos, sobre las anotaciones del proyecto)
  lectura-markup.js    su marcado
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

Las entidades `cuadro` y `obra` de la planta llevan `obraId` y no guardan ficha. Al dibujar un cuadro se crea una obra en la lista con el ancho del tramo; si antes se eligió una obra en el panel («colocar en planta»), se usa esa y el cuadro toma el ancho de su ficha. Borrar un cuadro de la planta no borra la obra: queda «sin colocar». El título, autor y medidas se editan en cualquiera de los dos sitios y son el mismo dato.

### Cómo se conectan planta y muro

En el panel de un muro de la planta, cada tramo tiene un botón ▭ que abre su alzado en la vista Muro. Si no existe, se crea con el largo del tramo, su altura y los cuadros que cuelgan de la cara interior, colocados desde la izquierda tal como se ven desde dentro de la sala, centrados en el eje visual. A las obras sin alto conocido se les asigna uno estimado (≈). El alzado queda ligado al tramo (`muro.tramo = {entidadId, i, cara}`), así que el botón vuelve a abrir el mismo muro.

La vista Muro guarda posición, marco, caída y demás en `muro.colgado[]` y las medidas y la ficha en la obra compartida: cambiar un ancho en el muro cambia la ficha que ve la planta. Lo que se añade en el muro (vanos, personas, notas, medidas) vive solo en el muro. Mover un cuadro en la planta después de crear el alzado no lo mueve en el muro: son dos decisiones distintas (dónde va en la sala, cómo cuelga).

### Cómo se conecta la lectura con el resto

Un plano anotado tiene una base: una imagen suelta, o una sala o un muro del proyecto. Las bases «sala» y «muro» se redibujan a partir del proyecto cada vez que se abren (la planta a 2400 px de ancho, el alzado a 8 px/cm, o menos si no cabe en 16 Mpx), ya con la escala puesta, así que no hay que calibrar. Las anotaciones se guardan en píxeles de esa imagen: si después la planta crece mucho (otra sala al lado, por ejemplo), el dibujo se reencuadra y los marcadores pueden quedar desplazados; para planos cerrados es más seguro anotar al final.

## Modelo (versión 3)

Todas las longitudes en metros. La obra existe una sola vez; planta y alzados la referencian por `obraId`.

```
proyecto { app:'museodraft', version:3, nombre, creado, modificado,
  obras[]        { id, nombre, autor, anio, tecnica, inv, nota,
                   ancho, alto (m o null), estimado:{ancho,alto}, imagenId, imgRatio }
  salas[]        { id, nombre, rotulo, rejilla, imanes, calco, entidades[] }
                   entidades en el formato de plano-sala; cuadro y obra en planta llevan obraId
  muros[]        { id, nombre, salaId, tramo:{entidadId,i}|null, ancho, alto, eje, grosor, color,
                   colgado[] { id, obraId, x, y, marco, pp, prof, caida, rot, lock, bloqueado, oculto },
                   otros[] (vanos, personas, medidas, notas en el formato de MuseoDraft, en m),
                   guias:{v,h}, opts }
  anotaciones[]  { id, nombre, base, escala, capas[], capaActiva, items[] }
                   base: {tipo:'imagen', imagenId, w, h} | {tipo:'sala', salaId} | {tipo:'muro', muroId}
                   items en el formato de anotador-planos (px de la imagen base); las imágenes incrustadas por imagenId
  imagenes{}     id → dataURL }
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
