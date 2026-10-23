# MuseoDraft

Diseñador de planos para proyectos curatoriales: planta de sala, alzados de muro con hoja de montaje, y planos anotados navegables. Web, ligero, sin servidor ni cuentas. Vive en GitHub Pages.

Unifica tres herramientas que antes eran archivos sueltos (plano-sala, MuseoDraft, anotador-planos) sobre un solo proyecto, para no escribir las obras y los muros dos veces.

## Estado

**Fase 1 (hecha):** modelo de datos, validación e importadores de los tres formatos anteriores, con tests.
Mientras las vistas no estén listas, `index.html` sigue siendo el MuseoDraft de siempre; una copia fija vive en `legacy/museodraft.html`.

Fases siguientes: 2 cascarón + almacén + panel de obras + Planta · 3 Muro conectado a la planta · 4 Lectura, concatenado y publicación.

## Estructura

```
index.html            MuseoDraft actual (pasará a ser el cascarón en la fase 2)
legacy/museodraft.html copia fija de la herramienta actual
src/core/             sin DOM, probado en Node
  unidades.js         metros ↔ centímetros, formato numérico en español
  modelo.js           esquema v3, validación, importar/incorporar los .json antiguos
test/                 node --test (sin dependencias)
```

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
  anotaciones[]  { id, nombre, base:{tipo:'imagen', imagenId, w, h}, escala, capas[], capaActiva, items[] }
                   items en el formato de anotador-planos (px de la imagen base)
  imagenes{}     id → dataURL }
```

`importar(json)` acepta un proyecto v3 o un .json de plano-sala, MuseoDraft 2 o anotador-planos y devuelve `{ proyecto, origen }`. `incorporar(proyecto, json)` añade lo que trae otro archivo regenerando ids. MuseoDraft 1 no se importa: ábrelo en `legacy/museodraft.html`, guárdalo y vuelve a importar.

## Desarrollo

```
npm test        # node --test, sin instalar nada
```

Sin dependencias ni empaquetador: módulos ES nativos. Más adelante, `build/concatenar.js` producirá `app.html` (todo en un archivo) para compartir sin servidor.
