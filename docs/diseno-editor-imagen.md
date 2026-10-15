# Image Editor — diseño (copia de Canva sobre el motor de Doory)

> **El pedido, textual (Martín, 14/10/2026):** «Quiero que implementes end to end un "Canva" dentro de
> MaKo, tal cual, copialo todo, tanto en diseño como funcionalidades. Revisa si hay algún repo que nos
> ahorre trabajo. Dejalo en "Content Machine" en una tab que sea "Image"».
>
> **Y la decisión de la base (14/10, entre tres opciones):** «Copia a Doory, y luego lo modificamos
> completamente para que sea original de MaKo, pero quiero la plantilla para ir trabajando».

Vive en `app/image-editor/` (tab «Image» de Content Machine, primera sección, «Editor»). Este documento
es el plano: qué se decidió, cómo está armado y qué falta. Los relevamientos que lo sostienen están en
`docs/editor-imagen/`:

| Archivo | Qué tiene |
|---|---|
| `repos/doory.md` | La base: licencia (qué obliga), arquitectura, tabla SÍ/PARCIAL/NO contra Canva, esfuerzo |
| `repos/tela.md`, `repos/fabritor-web.md` | Los descartados como base y las piezas que valen (snapping/reflow de Tela, recetas de fabric de fabritor) |
| `relevamiento-integracion-mako.md` | Cómo se enchufa una tab así en MaKo HOY: guard por persona, tests que barren, CSP, guardado, API |
| `relevamiento-contenido-licencias.md` | Fotos, íconos, fuentes, plantillas e IA en el navegador con licencia usable |
| `relevamiento-canva-armazon.md` | El armazón de Canva medido (paleta, proporciones, rótulos) — para el re-vestido |
| `relevamiento-canva-funciones.md` | La checklist de funciones de Canva — para lo que le falta a Doory |

---

## 1. Decisiones

| # | Decisión | Por qué |
|---|---|---|
| 1 | **Motor: Doory** (`shaongitbd/doory`, commit en `_doory/COMMIT-DOORY`), su frontend portado a `app/image-editor/_doory/` | Martín, 14/10. Es el único Canva open source completo sobre fabric.js 7 (≈51 mil líneas de editor, TS estricto, ≈60 % de Canva). Ahorra 25–40 días contra escribirlo (`repos/doory.md` §8) |
| 2 | **El crédito de Doory se muestra en cada apertura del editor** (`editor/CreditoDoory.tsx`) y el `LICENSE` viaja con el código (`_doory/LICENSE-DOORY`, `NOTICE-DOORY`, `THIRD_PARTY-DOORY.md`) | La licencia es la Attribution Assurance License: servir el JS es redistribuir y pide «a prominent display … each time … launched». Modificar el código NO saca la obligación: se va con permiso escrito del autor (su propio `NOTICE` dice «the rest is MIT», sirve para pedírselo) o reescribiendo sin su código |
| 3 | **Abierto a todos los workspaces desde el 15/10** (Martín: «Que Image aparezca en todos los workspace»): sin `adminOnly` en el nav y el guard es la pregunta de toda tab (`acceso.ts`: rol admin del workspace y la tab en la capa; molde `app/video-editor/acceso.ts`). Image Generator y Thumbnails siguen `comingSoon`, con su «pronto». Hasta el 14/10 fue sólo del super admin, por persona | El crédito de Doory (#2) lo ve desde entonces cada negocio que abre el editor: es lo que pide la licencia; sacarlo es la decisión `image-licencia-doory`. La capa `pm` no tiene Content Machine (como el Video Editor) |
| 4 | **Los diseños y «Subidos» viven en la base** (desde el 14/10, tanda 3): `image_disenos` (el `DoryDocument` en jsonb, `version` para compare-and-set, miniatura, `borrado_at`) e `image_subidos`, mig 0278; bucket PÚBLICO `image-editor`, rutas `<ws>/…`. El adaptador de MaKo (`mako/adaptadorNube.ts`) reemplaza al de «invitado». Lo que la etapa 1 dejó en IndexedDB sube solo al abrir el editor (`mako/mudanza.ts`), con su mismo id | La regla de la casa: el estado del producto va a la base; otra máquina y el equipo lo ven, y la API de MaKo y las Estrellas leen de ahí (`relevamiento-integracion-mako.md` §0.7, §5.7). La etapa 1 («plantilla para ir trabajando») guardaba en el navegador porque era lo que Doory traía andando |
| 5 | **Tokens de Doory prefijados `--cv-` y limitados a `.cv`**; su `global.css` reescrito colgado de `.cv` | Sus nombres (`--color-*`, `--text-*`, `--font-*`, `--space-*`) son los namespaces de Tailwind 4 y pisarían MaKo (`repos/doory.md` §4) |
| 6 | **Sin co-edición, comentarios, compartir, versiones, Marca ni fotos de stock**: sus servicios van en `null` y el editor esconde esas herramientas. «Subidos» sí está (tanda 3) | Dependían del backend Django de Doory; cada uno pide sus tablas propias. Fotos de stock: decisión de Martín (Unsplash con key) |
| 7 | **Catálogos propios de MaKo** (`mako/servicios.ts` los arma): 70 familias de Google Fonts (499 variantes, por la copia de jsDelivr de `@fontsource/*`, `mako/fuentes.ts`) y sus 14 combinaciones; elementos de 7 sets de Iconify MIT/ISC/Apache (`mako/elementos.ts`, búsqueda en vivo con diccionario español → inglés); las 10 plantillas de Doory con títulos, categorías y etiquetas en español (`mako/plantillas.ts`, cargadas al usarlas). Los archivos generados se rehacen con `scripts/image-editor/` | El backend de Doory los servía. Licencias en `relevamiento-contenido-licencias.md`. Las fuentes todavía no se alojan (tanda 4) |
| 8 | **Dependencias nuevas instaladas SIN `npm install` en el clon** (en `C:/dev/canva-deps` y copiadas a `node_modules`), `package.json`/lock con `--package-lock-only` | El `node_modules` compartido tiene paquetes sueltos de otra sesión (`@simplewebauthn/*`): un `npm install` común los borraba |
| 9 | **Textos de pantalla en español neutro (tú)**, con los nombres de Canva | AGENTS.md + `tests/puente-panel-copy.test.ts` barre el port entero |
| 10 | **Onboarding = estado vacío** («Crear un diseño»), sin entrada en el catálogo | La tab ES la herramienta (regla del 05/10, como el Video Editor) |

**Lo que NO se copia de Canva:** el logo, los íconos propios, la fuente Canva Sans, sus plantillas,
fotos y elementos (son de Canva o de sus proveedores), publicar directo en redes, y lo «Pro» como
corona (no hay planes dentro del editor).

---

## 2. Cómo está armado

```
app/image-editor/
  page.tsx                 /image-editor — guard + inicio
  [diseno]/page.tsx        /image-editor/<id> — guard + editor
  acceso.ts                quién entra (hoy: sólo el super admin, por persona)
  espacio.ts               la base IndexedDB de la etapa 1, por workspace: sólo la LEE la mudanza
  ruta.ts                  rutas internas con el `?ws=`
  ImageEditorCliente.tsx   raíz `.cv` (tokens + estilos base de Doory), monta todo sin SSR
  inicio/                  Inicio de Canva: franja, chips, buscador, círculos, «Crear un diseño», recientes en cuadrícula o lista
  editor/PantallaEditor.tsx carga el diseño de la base, arma el adaptador (con «Copiar y redimensionar») y monta EditorApp
  presentador/             /image-editor/presentador — la ventana de «Vista de presentador» (sin la cáscara)
  editor/CreditoDoory.tsx  el crédito que exige la licencia (franja fina al pie, en cada apertura)
  mako/servicios.ts        fuentes, elementos y plantillas del lado de MaKo (fuentes.ts, elementos.ts, plantillas.ts)
  mako/registro.ts         los paneles que suma MaKo (hoy «Proyectos», ProyectosPanel.tsx)
  mako/nube.ts             los pedidos a /api/image-editor/* y la subida firmar → bucket → registrar
  mako/adaptadorNube.ts    el EditorAdapter de MaKo: guarda con compare-and-set, sube a «Subidos»
  mako/mudanza.ts          sube a la base lo que la etapa 1 dejó en el navegador
  _doory/                  el frontend de Doory portado (sin tests, sin el shell de su app)
    editor/                el editor: engine/ (fabric), chrome/, panels/, toolbar/, workspace/, dialogs/…
    types/                 documento, adaptador y tipos de su API
    lib/                   document.ts, local/ (IndexedDB), api/ (cliente de su backend: sin uso en MaKo)
    features/editor/adapters/  adaptadores de invitado/cuenta/compartido (MaKo usa el de invitado)
    styles/                tokens.css (`--cv-*`) y global.css (colgado de `.cv`)
    LICENSE-DOORY · NOTICE-DOORY · THIRD_PARTY-DOORY.md · COMMIT-DOORY
lib/image-editor/          reglas.ts (tipos, topes, rutas del bucket, magic bytes, saneo del doc) · tipos.ts (el
                           contrato) · server.ts (la puerta y el trabajo con la base)
app/api/image-editor/      disenos[/<id>[/miniatura]] y subidos[/<id>]: rutas finas sobre lib/image-editor/server.ts
```

**El enchufe entre MaKo y el editor es UNO: `EditorAdapter`** (`_doory/types/adapter.ts`): guardar,
subir una imagen, resolver una URL y los servicios (fuentes, elementos, plantillas, subidos, marca,
stock, versiones, compartir, comentarios). El editor no toca rutas, sesión ni HTTP. La tanda 3 fue
eso: un adaptador nuevo (`mako/adaptadorNube.ts`), sin tocar el motor.

**Extender el editor:** `_doory/editor/extensions.ts` (`registerPanel`, `registerToolbarSection`,
`registerCommand`, `registerExportFormat`, `registerObjectKind`). Un panel con `rail: true` es una pestaña del
riel izquierdo (`chrome/RielCanva.tsx`), en el orden de `order` (Diseño 10 · Elementos 20 · Texto 30 · Marca 40 ·
Subidos 50 · Herramientas 60 · Proyectos 70 · Apps 80); sin `rail` (Animar, Audio, Capas, Comentarios) se abre
desde la barra del objeto, «Apps», el menú del clic derecho o los comandos.

**El armazón de Canva (tanda 2)**, de arriba abajo: `TopBar.tsx` (degradado, Archivo, Redimensionar, título,
Presentar, Compartir) · en fila sobre el gris del cromo: `RielCanva` (72 px), `SidebarHost` (la tarjeta de 350 px)
y el área: la barra del objeto flotando arriba (`toolbar/ContextualToolbar.tsx`), el lienzo
(`workspace/Workspace.tsx`) y al pie la barra inferior (`workspace/BottomBar.tsx`: Notas, Duración, zoom, Páginas,
cuadrícula, pantalla completa). Debajo de 1024 px el riel pasa a la tira `CompactTools` y los paneles abren como hoja.

---

## 3. Reglas para el código nuevo del editor

1. **Texto de pantalla**: el rótulo de Canva en español, en tú, corto. Los textos de Doory viven en
   `_doory/editor/**/strings.ts`: se cambian ahí, no en el JSX.
2. **Colores**: los `--cv-*` de `styles/tokens.css`. El re-vestido cambia los VALORES por la paleta
   medida de Canva (`relevamiento-canva-armazon.md`), no los nombres.
3. **Navegación**: `Link`/`useRouter` de `@/app/_ui/Link`, o `rutaEditor()`.
4. **Nada del server importa de `_doory/`**: el motor entra sólo por `ImageEditorCliente`.
5. **Imágenes de afuera se copian antes al almacenamiento propio**: Openverse/Picsum no mandan CORS y
   un lienzo con una imagen ajena no se puede exportar (`relevamiento-integracion-mako.md` §0.3).
6. **Nada que cobre por default**; IA de imagen por el puente a Flow (decisión del 11/10).
7. **Typecheck acotado**: `node C:/dev/tsc-cv.mjs` (`app/image-editor`, `lib/image-editor` y `app/api/image-editor`,
   con el lock de la máquina; `tsconfig.cv.json` no se versiona). El completo lo corre el pre-push.
8. **Borrar** = el tacho de la casa (`BotonBorrar`).
9. **Tamaños: UNA lista**, `_doory/editor/dialogs/resizeSizes.ts` (nombres en `strings.ts → dialog.resizeSizes`).
   De ahí salen Redimensionar, el popover de tamaño de la página (`engine/presets.ts`) y el Inicio (`inicio/tamanos.ts`).
10. **Un módulo de `app/image-editor/` que importe un VALOR de `_doory/` lleva `'use client'`** (o entra en `PUERTA`
    del test 4 de `tests/image-editor-integracion.test.ts`).
11. **La barra del objeto flota sobre el lienzo**: si cambia su alto, cambia `TOOLBAR_BAND` de `workspace/Workspace.tsx`.
12. **Color**: todo selector de color abre `ui/ColorPanel` (Colores del documento, predeterminados de Canva); el
    selector propio (`ColorPicker`/`FillEditor`) va con `showSwatches={false}` detrás de la baldosa arcoíris.
13. **Nada nuevo se guarda en el navegador**: el estado va a `image_disenos` / `image_subidos`. Un `src` se guarda
    como URL del bucket: el server rechaza `idb://` y `blob:` (422), y el adaptador los sube antes.
14. **Cada handler de `/api/image-editor` empieza con `puerta()`** (`lib/image-editor/server.ts`): la misma pregunta
    que las páginas (`veEditorImagen`). Lo barre el test 5 de `tests/image-editor-nube.test.ts`.
15. **Verificar sin el dev server**: el banco de esbuild + Chrome sin ventana (`hallazgos-editor-imagen.md`).

---

## 4. Qué falta (por tandas)

| Tanda | Qué | Estado |
|---|---|---|
| 1 | Port de Doory + cáscara de MaKo + textos en español + crédito | hecha (14/10) |
| 2 | **Re-vestido como Canva**: barra superior (Archivo, Redimensionar, título, Compartir violeta), riel izquierdo con panel (Diseño, Elementos, Texto, Marca, Subidos, Herramientas, Proyectos, Apps), barra contextual, barra inferior (Notas, zoom, cuadrícula de páginas, pantalla completa), inicio de Canva; paleta y proporciones medidas | hecha (14/10), **vista en el banco**: crear, texto, plantilla, imagen, PNG, PDF, presentador. Falta mirarla dentro de la cáscara en producción. Lo que no se hizo, en `hallazgos-editor-imagen.md` |
| 3 | **Supabase**: tabla de diseños (jsonb + miniatura, por workspace), bucket de imágenes, adaptador; Marca, versiones, compartir y comentarios con tablas propias | diseños, «Subidos», miniaturas y la mudanza **hechos (14/10, mig 0278 aplicada)**. Marca, versiones, compartir y comentarios: pendientes |
| 4 | **Catálogo propio**: ~64 fuentes alojadas + combinaciones, packs de íconos MIT/Apache por Iconify, emoji Fluent/Noto, ilustraciones CC0, formas/líneas/marcos/cuadrículas propias, plantillas propias (las 10 de Doory al principio), fotos de Unsplash | en parte (14/10): 70 fuentes + 14 combinaciones, 7 sets de Iconify, las 10 plantillas de Doory en español, con el texto del lienzo y las miniaturas también (`scripts/image-editor/traducir-plantillas.mjs`). Falta alojar las fuentes, ilustraciones, plantillas propias y fotos |
| 5 | **Lo que a Doory le falta frente a Canva**: texto en formas, tablas, cuadrículas, dibujar, copiar estilo, efectos de texto Elevar/Salpicadura/Eco/Glitch, líneas en codo/curvas, gráficos con datos, ajustes de foto que faltan, quitar fondo de objetos, borrador mágico | pendiente |
| 6 | **API de MaKo** (área del editor: listar/crear/exportar diseños) y Estrellas `formato_imagen` | **espera a Martín**: con el editor sólo suyo, declararla con `gating.tab` la abre por token a todo cliente completo/agencia (`relevamiento-integracion-mako.md` §6.2, §13.7). La base ya está |
